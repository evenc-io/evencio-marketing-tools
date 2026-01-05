import { parseSnippetFiles, serializeSnippetFiles } from "@/lib/snippets"
import { clampSnippetViewport, getSnippetViewportError } from "@/lib/snippets/constraints"
import {
	ensureImportAssetsFileSource,
	IMPORT_ASSET_FILE_NAME,
	type ImportAssetId,
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

const buildImportAssetsFileIfNeeded = (options: {
	mainSource: string
	files: Record<string, string>
}): { files: Record<string, string>; warnings: string[] } => {
	const warnings: string[] = []
	if (Object.hasOwn(options.files, IMPORT_ASSET_FILE_NAME)) {
		return { files: options.files, warnings }
	}

	const sources = [options.mainSource, ...Object.values(options.files)]

	const wantsLockup = sources.some((source) => isComponentReferenced(source, "EvencioLockup"))
	const wantsMark = sources.some((source) => isComponentReferenced(source, "EvencioMark"))
	if (!wantsLockup && !wantsMark) {
		return { files: options.files, warnings }
	}

	const declaresLockup = wantsLockup
		? sources.some((source) => isIdentifierDeclared(source, "EvencioLockup"))
		: false
	const declaresMark = wantsMark
		? sources.some((source) => isIdentifierDeclared(source, "EvencioMark"))
		: false
	if (declaresLockup || declaresMark) {
		return { files: options.files, warnings }
	}

	const idsToEnsure: ImportAssetId[] = []
	if (wantsMark) idsToEnsure.push("evencio-mark")
	if (wantsLockup) idsToEnsure.push("evencio-lockup")

	if (idsToEnsure.length === 0) {
		return { files: options.files, warnings }
	}

	const nextFiles = {
		...options.files,
		[IMPORT_ASSET_FILE_NAME]: ensureImportAssetsFileSource("", idsToEnsure),
	}
	warnings.push("Added Imports.assets.tsx (Evencio logo/icon) based on snippet usage.")
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
	const cleanedMain = stripImportLines(parsed.mainSource)
	const { files: filesWithAssets, warnings: assetWarnings } = buildImportAssetsFileIfNeeded({
		mainSource: cleanedMain,
		files: parsed.files,
	})

	const fileNames = Object.keys(filesWithAssets).sort((a, b) => a.localeCompare(b))
	const nextMain = syncImportBlock(cleanedMain, fileNames)
	const nextSource = serializeSnippetFiles(nextMain, filesWithAssets)

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
