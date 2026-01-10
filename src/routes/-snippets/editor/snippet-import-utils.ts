import { parseSnippetFiles, serializeSnippetFiles } from "@/lib/snippets"
import { clampSnippetViewport, getSnippetViewportError } from "@/lib/snippets/constraints"
import {
	ensureImportAssetsFileSource,
	getImportAsset,
	getImportAssetIdsInFileSource,
	IMPORT_ASSET_FILE_LEGACY_NAME,
	IMPORT_ASSET_FILE_NAME,
	type ImportAssetId,
	isImportAssetsFileName,
	normalizeImportAssetsFileMap,
	resolveImportAssetsFileName,
} from "@/routes/-snippets/editor/import-assets"
import { syncImportBlock } from "@/routes/-snippets/editor/snippet-file-utils"

export type SnippetImportViewport = {
	width: number
	height: number
}

export type SnippetImportResult = {
	source: string
	viewport: SnippetImportViewport | null
	warnings: string[]
	fileNames: string[]
}

export type SnippetImportParseResult =
	| { ok: true; value: SnippetImportResult }
	| { ok: false; error: string }

type CodeFence = {
	lang: string | null
	code: string
}

const stripAssistantArtifacts = (source: string) =>
	source
		.split(/\r?\n/)
		.filter((line) => !/^\s*(?:\/\/\s*)?:contentReference\[[^\]]+\]\{[^}]+\}\s*$/.test(line))
		.join("\n")
		.trimEnd()

const stripMainDirectiveLines = (source: string) =>
	source
		.split(/\r?\n/)
		.filter((line) => !/^\s*\/\/\s*@res\b/i.test(line))
		.join("\n")
		.trimEnd()

const unwrapOuterQuotes = (value: string) => {
	const trimmed = value.trim()
	const tripleQuotes = ['"""', "'''"] as const
	for (const marker of tripleQuotes) {
		if (
			trimmed.startsWith(marker) &&
			trimmed.endsWith(marker) &&
			trimmed.length > marker.length * 2
		) {
			return trimmed.slice(marker.length, -marker.length).trim()
		}
	}
	return trimmed
}

const findBestFence = (value: string): { fence: CodeFence | null; fenceCount: number } => {
	const regex = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```/g
	let best: CodeFence | null = null
	let bestScore = Number.NEGATIVE_INFINITY
	let fenceCount = 0

	for (const match of value.matchAll(regex)) {
		fenceCount += 1
		const lang = match[1]?.trim() || null
		const code = match[2] ?? ""

		const langLower = lang?.toLowerCase() ?? ""
		const hasDefaultExport = /\bexport\s+default\b/.test(code)
		const hasSnippetFiles = /\/\/\s*@snippet-file\b/.test(code)
		const hasJsx = /<\s*[A-Za-z]/.test(code)

		let score = 0
		if (langLower.includes("tsx") || langLower.includes("typescript")) score += 6
		else if (langLower.includes("ts")) score += 4
		if (hasDefaultExport) score += 10
		if (hasSnippetFiles) score += 8
		if (hasJsx) score += 2
		score += Math.min(4, Math.floor(code.length / 2000))

		if (score > bestScore) {
			best = { lang, code }
			bestScore = score
		}
	}

	return { fence: best, fenceCount }
}

const extractSnippetSource = (rawInput: string): { source: string; warnings: string[] } => {
	const warnings: string[] = []
	const unwrapped = unwrapOuterQuotes(rawInput)
	const { fence: bestFence, fenceCount } = findBestFence(unwrapped)
	if (bestFence) {
		if (fenceCount > 1) {
			warnings.push("Multiple code blocks detected; importing the most likely TSX snippet.")
		}
		return { source: bestFence.code.trim(), warnings }
	}
	return { source: unwrapped.trim(), warnings }
}

const stripImportLines = (source: string) =>
	source
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^(\s*\/\/\s*Auto-managed imports\s*\(do not edit\)\.\s*)$/i.test(line) &&
				!/^(\s*\/\/\s*@import\s+.+?)\s*$/.test(line),
		)
		.join("\n")
		.trimEnd()

const extractResolutions = (source: string) => {
	const regex = /^\s*\/\/\s*@res\s*([0-9]{2,5})\s*[xX]\s*([0-9]{2,5})\s*$/gm
	let last: { width: number; height: number } | null = null
	for (const match of source.matchAll(regex)) {
		const width = Number.parseInt(match[1] ?? "", 10)
		const height = Number.parseInt(match[2] ?? "", 10)
		if (!Number.isFinite(width) || !Number.isFinite(height)) continue
		last = { width, height }
	}
	return last
}

const isIdentifierDeclared = (source: string, name: string) => {
	const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return new RegExp(
		`\\b(?:export\\s+)?(?:const|function|class)\\s+${safe}\\b|\\bexport\\s*{[^}]*\\b${safe}\\b[^}]*}`,
	).test(source)
}

const isComponentReferenced = (source: string, name: string) => {
	const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return new RegExp(`<\\s*${safe}(\\s|>|/)`).test(source)
}

const resolveImportAssetDependencies = (ids: ImportAssetId[]) => {
	const resolved: ImportAssetId[] = []
	const visited = new Set<ImportAssetId>()

	const visit = (id: ImportAssetId) => {
		if (visited.has(id)) return
		visited.add(id)
		const asset = getImportAsset(id)
		const deps = asset?.dependsOn ?? []
		for (const dep of deps) {
			visit(dep)
		}
		resolved.push(id)
	}

	for (const id of ids) {
		visit(id)
	}

	return resolved
}

const buildImportAssetsFileIfNeeded = (options: {
	mainSource: string
	files: Record<string, string>
}): { files: Record<string, string>; warnings: string[] } => {
	const warnings: string[] = []

	const importAssetsFileName = resolveImportAssetsFileName(options.files)
	const hasAssetsFile =
		Object.hasOwn(options.files, IMPORT_ASSET_FILE_NAME) ||
		Object.hasOwn(options.files, IMPORT_ASSET_FILE_LEGACY_NAME)
	const currentAssetsSource = options.files[importAssetsFileName] ?? ""
	const nonAssetSources = [
		options.mainSource,
		...Object.entries(options.files)
			.filter(([fileName]) => !isImportAssetsFileName(fileName))
			.map(([, source]) => source),
	]
	const sources = [options.mainSource, ...Object.values(options.files)]

	const wantsLockup = nonAssetSources.some((source) =>
		isComponentReferenced(source, "EvencioLockup"),
	)
	const wantsMark = nonAssetSources.some((source) => isComponentReferenced(source, "EvencioMark"))
	if (!wantsLockup && !wantsMark) {
		if (!hasAssetsFile) {
			return { files: options.files, warnings }
		}

		const presentAssetIds = getImportAssetIdsInFileSource(currentAssetsSource)
		if (!presentAssetIds.includes("evencio-lockup")) {
			return { files: options.files, warnings }
		}
	}

	const isDeclared = (componentName: string) =>
		sources.some((source) => isIdentifierDeclared(source, componentName))

	const desiredAssetIds = new Set<ImportAssetId>()
	if (wantsMark) desiredAssetIds.add("evencio-mark")
	if (wantsLockup) desiredAssetIds.add("evencio-lockup")
	if (hasAssetsFile) {
		for (const id of getImportAssetIdsInFileSource(currentAssetsSource)) {
			desiredAssetIds.add(id)
		}
	}

	const desiredWithDeps = resolveImportAssetDependencies(Array.from(desiredAssetIds))
	const idsToEnsure = desiredWithDeps.filter((id) => {
		const asset = getImportAsset(id)
		return asset ? !isDeclared(asset.componentName) : false
	})

	if (idsToEnsure.length === 0) {
		return { files: options.files, warnings }
	}

	const nextFiles = {
		...options.files,
		[importAssetsFileName]: ensureImportAssetsFileSource(currentAssetsSource, idsToEnsure, {
			resolveDependencies: false,
		}),
	}
	warnings.push(
		hasAssetsFile
			? "Updated Imports.assets.tsx (Evencio logo/icon) based on snippet usage."
			: "Added Imports.assets.tsx (Evencio logo/icon) based on snippet usage.",
	)
	return { files: nextFiles, warnings }
}

export const parseSnippetImportText = (rawInput: string): SnippetImportParseResult => {
	if (!rawInput.trim()) {
		return { ok: false, error: "Paste a snippet to import." }
	}

	const extracted = extractSnippetSource(rawInput)
	const normalizedSource = extracted.source.replaceAll("\r\n", "\n").trim()
	if (!normalizedSource) {
		return { ok: false, error: "No snippet source detected." }
	}

	const cleanedSource = stripAssistantArtifacts(normalizedSource)
	const viewportRaw = extractResolutions(cleanedSource)
	const viewport = viewportRaw ? clampSnippetViewport(viewportRaw) : null
	if (viewport) {
		const viewportError = getSnippetViewportError(viewport)
		if (viewportError) {
			return { ok: false, error: `Resolution directive is invalid: ${viewportError}` }
		}
	}

	const parsed = parseSnippetFiles(cleanedSource)
	const cleanedMain = stripMainDirectiveLines(stripImportLines(parsed.mainSource))
	const { files: filesWithAssets, warnings: assetWarnings } = buildImportAssetsFileIfNeeded({
		mainSource: cleanedMain,
		files: parsed.files,
	})

	const normalizedFiles = normalizeImportAssetsFileMap(filesWithAssets).files
	const fileNames = Object.keys(normalizedFiles).sort((a, b) => a.localeCompare(b))
	const nextMain = syncImportBlock(cleanedMain, fileNames)
	const nextSource = serializeSnippetFiles(nextMain, normalizedFiles)

	return {
		ok: true,
		value: {
			source: nextSource,
			viewport,
			warnings: [...extracted.warnings, ...assetWarnings],
			fileNames,
		},
	}
}
