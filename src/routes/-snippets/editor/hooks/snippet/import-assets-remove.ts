import { useCallback } from "react"
import { toast } from "sonner"
import { loadBabelParser } from "@/lib/snippets/babel-parser"
import { parseSnippetFiles, serializeSnippetFiles } from "@/lib/snippets/source/files"
import {
	getImportAsset,
	getImportAssetIdsInFileSource,
	getImportAssetRemovalIds,
	IMPORT_ASSET_FILE_NAME,
	type ImportAssetId,
} from "@/routes/-snippets/editor/import-assets"
import {
	stripAutoImportBlock,
	stripSnippetFileDirectives,
	syncImportBlock,
} from "@/routes/-snippets/editor/snippet-file-utils"

type SourceFormAccess = {
	getValues: (name: "source") => unknown
	setValue: (
		name: "source",
		value: string,
		options?: { shouldValidate?: boolean; shouldDirty?: boolean },
	) => void
}

type UseSnippetImportAssetsRemoveOptions = {
	form: SourceFormAccess
	commitHistoryNow: (label: string, nextSource: string) => void
}

type JsxRemoval = {
	start: number
	end: number
	replacement: string
}

const hasValidRange = (node: { start?: number; end?: number } | null | undefined) =>
	typeof node?.start === "number" && typeof node?.end === "number"

const isJsxParentType = (type: string | null) => type === "JSXElement" || type === "JSXFragment"

const removeImportAssetUsagesFromSource = async ({
	source,
	assetIds,
	componentNames,
}: {
	source: string
	assetIds: ImportAssetId[]
	componentNames: string[]
}): Promise<{ source: string; changed: boolean }> => {
	if (!source.trim()) return { source, changed: false }
	if (assetIds.length === 0 || componentNames.length === 0) return { source, changed: false }

	const assetIdSet = new Set(assetIds)
	const componentNameSet = new Set(componentNames)

	const mightContain =
		source.includes("data-snippet-asset") ||
		componentNames.some((name) => source.includes(`<${name}`) || source.includes(`${name} `))
	if (!mightContain) return { source, changed: false }

	const parser = await loadBabelParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
		errorRecovery: true,
		allowReturnOutsideFunction: true,
	})

	const removals: JsxRemoval[] = []

	const visit = (node: unknown, parentType: string | null) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		if (type === "JSXElement") {
			const opening = record.openingElement as Record<string, unknown> | undefined
			const nameNode = opening?.name as Record<string, unknown> | undefined
			const attrs = opening?.attributes

			const matchesComponent = (() => {
				if (!nameNode || typeof nameNode.type !== "string") return false
				if (nameNode.type !== "JSXIdentifier") return false
				const name = nameNode.name
				return typeof name === "string" && componentNameSet.has(name)
			})()

			const matchesWrapper = (() => {
				if (!Array.isArray(attrs)) return false
				for (const entry of attrs) {
					if (!entry || typeof entry !== "object") continue
					if ((entry as { type?: string }).type !== "JSXAttribute") continue
					const attr = entry as {
						name?: { type?: string; name?: unknown }
						value?: unknown
					}
					const attrName = attr.name?.type === "JSXIdentifier" ? attr.name.name : null
					if (attrName !== "data-snippet-asset") continue

					const value = attr.value
					if (!value || typeof value !== "object") return false
					const valueType = (value as { type?: string }).type
					if (valueType === "StringLiteral") {
						const raw = (value as { value?: unknown }).value
						return typeof raw === "string" && assetIdSet.has(raw as ImportAssetId)
					}
					if (valueType === "JSXExpressionContainer") {
						const expression = (value as { expression?: unknown }).expression
						if (!expression || typeof expression !== "object") return false
						const expressionType = (expression as { type?: string }).type
						if (expressionType === "StringLiteral") {
							const raw = (expression as { value?: unknown }).value
							return typeof raw === "string" && assetIdSet.has(raw as ImportAssetId)
						}
					}

					return false
				}
				return false
			})()

			if ((matchesWrapper || matchesComponent) && hasValidRange(record)) {
				removals.push({
					start: record.start as number,
					end: record.end as number,
					replacement: isJsxParentType(parentType) ? "" : "null",
				})
				if (matchesWrapper) {
					return
				}
			}
		}

		for (const value of Object.values(record)) {
			if (!value) continue
			if (Array.isArray(value)) {
				for (const entry of value) {
					visit(entry, type)
				}
			} else if (typeof value === "object") {
				visit(value, type)
			}
		}
	}

	visit(ast, null)

	if (removals.length === 0) return { source, changed: false }

	removals.sort((a, b) => b.start - a.start)
	let next = source
	for (const removal of removals) {
		next = next.slice(0, removal.start) + removal.replacement + next.slice(removal.end)
	}

	return { source: next, changed: next !== source }
}

const removeImportAssetsFromImportsFileSource = async ({
	source,
	componentNames,
}: {
	source: string
	componentNames: string[]
}): Promise<{ source: string; changed: boolean }> => {
	if (!source.trim() || componentNames.length === 0) return { source, changed: false }

	const nameSet = new Set(componentNames.filter(Boolean))
	if (nameSet.size === 0) return { source, changed: false }

	const parser = await loadBabelParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
		errorRecovery: true,
		allowReturnOutsideFunction: true,
	})

	const program = ast.program as { body?: unknown[] }
	const body = Array.isArray(program.body) ? program.body : []
	const removals: Array<{ start: number; end: number }> = []

	for (const node of body) {
		if (!node || typeof node !== "object") continue
		const record = node as Record<string, unknown>
		if (!hasValidRange(record)) continue
		const type = record.type
		if (type === "VariableDeclaration") {
			const declarations = record.declarations
			if (!Array.isArray(declarations)) continue
			for (const decl of declarations) {
				if (!decl || typeof decl !== "object") continue
				const idNode = (decl as { id?: unknown }).id
				if (!idNode || typeof idNode !== "object") continue
				if ((idNode as { type?: string }).type !== "Identifier") continue
				const name = (idNode as { name?: unknown }).name
				if (typeof name === "string" && nameSet.has(name)) {
					removals.push({ start: record.start as number, end: record.end as number })
					break
				}
			}
			continue
		}
		if (type === "FunctionDeclaration" || type === "ClassDeclaration") {
			const id = record.id
			if (!id || typeof id !== "object") continue
			if ((id as { type?: string }).type !== "Identifier") continue
			const name = (id as { name?: unknown }).name
			if (typeof name === "string" && nameSet.has(name)) {
				removals.push({ start: record.start as number, end: record.end as number })
			}
		}
	}

	if (removals.length === 0) return { source, changed: false }

	removals.sort((a, b) => b.start - a.start)
	let next = source
	for (const removal of removals) {
		next = next.slice(0, removal.start) + next.slice(removal.end)
	}

	const trimmed = next.trim()
	const stillActive = getImportAssetIdsInFileSource(trimmed).length > 0
	const normalized = stillActive ? trimmed : ""

	return { source: normalized, changed: normalized !== source }
}

export const useSnippetImportAssetsRemove = ({
	form,
	commitHistoryNow,
}: UseSnippetImportAssetsRemoveOptions) => {
	const handleImportAssetRemove = useCallback(
		async (rawAssetId: string) => {
			try {
				const asset = getImportAsset(rawAssetId as ImportAssetId)
				if (!asset) return

				const removalIds = getImportAssetRemovalIds(asset.id)
				const removalAssets = removalIds
					.map((id) => getImportAsset(id))
					.filter((entry): entry is NonNullable<ReturnType<typeof getImportAsset>> =>
						Boolean(entry),
					)
				if (!removalAssets.length) return

				const currentSource = (form.getValues("source") as string | undefined) ?? ""
				const parsed = parseSnippetFiles(currentSource)
				const componentNames = removalAssets.map((entry) => entry.componentName)
				const label =
					removalAssets.length === 1
						? `Remove import asset: ${removalAssets[0].label}`
						: `Remove import assets (${removalAssets.length})`

				const nextFiles: Record<string, string> = { ...parsed.files }
				for (const [fileName, fileSource] of Object.entries(parsed.files)) {
					if (fileName === IMPORT_ASSET_FILE_NAME) continue
					const result = await removeImportAssetUsagesFromSource({
						source: fileSource,
						assetIds: removalIds,
						componentNames,
					})
					if (result.changed) {
						nextFiles[fileName] = stripSnippetFileDirectives(result.source)
					}
				}

				const mainResult = await removeImportAssetUsagesFromSource({
					source: stripAutoImportBlock(parsed.mainSource),
					assetIds: removalIds,
					componentNames,
				})
				const nextMainBase = stripSnippetFileDirectives(mainResult.source)

				if (Object.hasOwn(nextFiles, IMPORT_ASSET_FILE_NAME)) {
					const importsSource = parsed.files[IMPORT_ASSET_FILE_NAME] ?? ""
					const importsResult = await removeImportAssetsFromImportsFileSource({
						source: importsSource,
						componentNames,
					})
					const nextImportsSource = importsResult.changed ? importsResult.source : importsSource
					if (nextImportsSource.trim().length === 0) {
						delete nextFiles[IMPORT_ASSET_FILE_NAME]
					} else {
						nextFiles[IMPORT_ASSET_FILE_NAME] = nextImportsSource
					}
				}

				const normalizedMain = syncImportBlock(nextMainBase, Object.keys(nextFiles))
				const nextSource = serializeSnippetFiles(normalizedMain, nextFiles)

				if (nextSource === currentSource) return
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				commitHistoryNow(label, nextSource)

				if (removalAssets.length === 1) {
					toast.success(`Removed ${removalAssets[0].label}`)
				} else {
					toast.success(`Removed ${removalAssets.length} import assets`)
				}
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to remove import assets.")
			}
		},
		[commitHistoryNow, form],
	)

	return { handleImportAssetRemove }
}
