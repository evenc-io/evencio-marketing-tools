import { useMemo } from "react"
import {
	getImportAssetIdsInFileSource,
	IMPORT_ASSET_FILE_NAME,
	IMPORT_ASSETS,
	type ImportAssetId,
} from "@/routes/-snippets/editor/import-assets"

export type ImportAssetUsage = {
	id: ImportAssetId
	imported: boolean
	used: boolean
	wrapperCount: number
	componentCount: number
	usageCount: number
}

export type SnippetImportsIndex = {
	importedImportAssetIds: ImportAssetId[]
	importAssets: ImportAssetUsage[]
	importAssetsById: Map<ImportAssetId, ImportAssetUsage>
}

const DATA_SNIPPET_ASSET_REGEX = /data-snippet-(?:asset|import)\s*=\s*(?:"([^"]+)"|'([^']+)')/g
const JSX_COMPONENT_TAG_REGEX = /<\s*([A-Z][A-Za-z0-9_$]*)\b/g

const IMPORT_ASSET_DEPENDENCIES_BY_ID = new Map<ImportAssetId, ImportAssetId[]>(
	IMPORT_ASSETS.map((asset) => [asset.id, asset.dependsOn ?? []]),
)
const IMPORT_ASSET_COMPONENT_NAME_TO_ID = new Map<string, ImportAssetId>(
	IMPORT_ASSETS.map((asset) => [asset.componentName, asset.id]),
)

const EMPTY_IMPORT_ASSET_USAGES: ImportAssetUsage[] = IMPORT_ASSETS.map((asset) => ({
	id: asset.id,
	imported: false,
	used: false,
	wrapperCount: 0,
	componentCount: 0,
	usageCount: 0,
}))

const EMPTY_IMPORTS_INDEX: SnippetImportsIndex = {
	importedImportAssetIds: [],
	importAssets: EMPTY_IMPORT_ASSET_USAGES,
	importAssetsById: new Map(EMPTY_IMPORT_ASSET_USAGES.map((entry) => [entry.id, entry])),
}

const increment = (map: Map<string, number>, key: string) => {
	map.set(key, (map.get(key) ?? 0) + 1)
}

export const buildSnippetImportsIndex = (parsedFiles: {
	mainSource: string
	files: Record<string, string>
}): SnippetImportsIndex => {
	const importAssetsFileSource = parsedFiles.files[IMPORT_ASSET_FILE_NAME] ?? ""
	const importedImportAssetIds = getImportAssetIdsInFileSource(importAssetsFileSource)
	const importedSet = new Set<ImportAssetId>(importedImportAssetIds)

	const sources: string[] = [parsedFiles.mainSource]
	for (const [fileName, fileSource] of Object.entries(parsedFiles.files)) {
		if (fileName === IMPORT_ASSET_FILE_NAME) continue
		sources.push(fileSource)
	}

	const wrapperCounts = new Map<string, number>()
	const componentCounts = new Map<string, number>()

	for (const source of sources) {
		if (!source) continue

		if (source.includes("data-snippet-asset") || source.includes("data-snippet-import")) {
			for (const match of source.matchAll(DATA_SNIPPET_ASSET_REGEX)) {
				const raw = (match[1] ?? match[2] ?? "").trim()
				if (!raw) continue
				increment(wrapperCounts, raw)
			}
		}

		for (const match of source.matchAll(JSX_COMPONENT_TAG_REGEX)) {
			const componentName = (match[1] ?? "").trim()
			if (!componentName) continue
			const assetId = IMPORT_ASSET_COMPONENT_NAME_TO_ID.get(componentName)
			if (!assetId) continue
			increment(componentCounts, assetId)
		}
	}

	const directUsageById = new Map<ImportAssetId, number>()
	for (const asset of IMPORT_ASSETS) {
		const wrapperCount = wrapperCounts.get(asset.id) ?? 0
		const componentCount = componentCounts.get(asset.id) ?? 0
		directUsageById.set(asset.id, wrapperCount > 0 ? wrapperCount : componentCount)
	}

	const dependencyUsageById = new Map<ImportAssetId, number>()
	const propagateToDependencies = (assetId: ImportAssetId, usageCount: number) => {
		if (usageCount <= 0) return
		const visited = new Set<ImportAssetId>()
		const stack = [...(IMPORT_ASSET_DEPENDENCIES_BY_ID.get(assetId) ?? [])]
		while (stack.length > 0) {
			const dependencyId = stack.pop()
			if (!dependencyId) continue
			if (visited.has(dependencyId)) continue
			visited.add(dependencyId)
			dependencyUsageById.set(
				dependencyId,
				(dependencyUsageById.get(dependencyId) ?? 0) + usageCount,
			)
			for (const next of IMPORT_ASSET_DEPENDENCIES_BY_ID.get(dependencyId) ?? []) {
				stack.push(next)
			}
		}
	}

	for (const asset of IMPORT_ASSETS) {
		propagateToDependencies(asset.id, directUsageById.get(asset.id) ?? 0)
	}

	const importAssets: ImportAssetUsage[] = IMPORT_ASSETS.map((asset) => {
		const wrapperCount = wrapperCounts.get(asset.id) ?? 0
		const componentCount = componentCounts.get(asset.id) ?? 0
		const directUsageCount = directUsageById.get(asset.id) ?? 0
		const dependencyUsageCount = dependencyUsageById.get(asset.id) ?? 0
		const usageCount = directUsageCount + dependencyUsageCount
		const used = usageCount > 0
		return {
			id: asset.id,
			imported: importedSet.has(asset.id),
			used,
			wrapperCount,
			componentCount,
			usageCount,
		}
	})

	return {
		importedImportAssetIds,
		importAssets,
		importAssetsById: new Map(importAssets.map((entry) => [entry.id, entry])),
	}
}

export const useSnippetImportsIndex = (
	parsedFiles: {
		mainSource: string
		files: Record<string, string>
	},
	options?: { enabled?: boolean },
) => {
	const enabled = options?.enabled !== false
	return useMemo(
		() => (enabled ? buildSnippetImportsIndex(parsedFiles) : EMPTY_IMPORTS_INDEX),
		[enabled, parsedFiles],
	)
}
