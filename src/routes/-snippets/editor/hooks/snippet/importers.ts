import type { SnippetImportsIndex } from "@/routes/-snippets/editor/hooks/snippet/imports-index"
import type { ImportAssetId } from "@/routes/-snippets/editor/import-assets"
import type { Asset } from "@/types/asset-library"

export type SnippetImportTarget =
	| { kind: "import-asset"; assetId: ImportAssetId }
	| { kind: "library-asset"; asset: Asset }
	| { kind: "font"; fontId: string }
	| { kind: "provider"; providerId: string }

type SnippetImporterContext = {
	importsIndex: SnippetImportsIndex
	importImportAsset: (assetId: ImportAssetId) => Promise<void> | void
	requestRemoveImportAsset: (assetId: ImportAssetId) => void
}

export type SnippetImportersApi = {
	canImport: (target: SnippetImportTarget) => boolean
	import: (target: SnippetImportTarget) => Promise<void> | void
	canRemove: (target: SnippetImportTarget) => boolean
	remove: (target: SnippetImportTarget) => void
}

export const createSnippetImporters = (ctx: SnippetImporterContext): SnippetImportersApi => {
	return {
		canImport: (target) => {
			if (target.kind === "import-asset") {
				return !(ctx.importsIndex.importAssetsById.get(target.assetId)?.imported ?? false)
			}
			return false
		},
		import: (target) => {
			if (target.kind === "import-asset") {
				return ctx.importImportAsset(target.assetId)
			}
		},
		canRemove: (target) => {
			if (target.kind === "import-asset") {
				return ctx.importsIndex.importAssetsById.get(target.assetId)?.imported ?? false
			}
			return false
		},
		remove: (target) => {
			if (target.kind === "import-asset") {
				ctx.requestRemoveImportAsset(target.assetId)
			}
		},
	}
}
