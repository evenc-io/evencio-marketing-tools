import { useCallback } from "react"
import { toast } from "sonner"
import { parseSnippetFiles, serializeSnippetFiles } from "@/lib/snippets/source/files"
import {
	ensureImportAssetsFileSource,
	getImportAsset,
	type ImportAssetId,
	normalizeImportAssetsFileMap,
	resolveImportAssetsFileName,
} from "@/routes/-snippets/editor/import-assets"
import { stripAutoImportBlock, syncImportBlock } from "@/routes/-snippets/editor/snippet-file-utils"

type SourceFormAccess = {
	getValues: (name: "source") => unknown
	setValue: (
		name: "source",
		value: string,
		options?: { shouldValidate?: boolean; shouldDirty?: boolean },
	) => void
}

type UseSnippetImportAssetsAddOptions = {
	form: SourceFormAccess
	commitHistoryNow: (label: string, nextSource: string) => void
}

export const useSnippetImportAssetsAdd = ({
	form,
	commitHistoryNow,
}: UseSnippetImportAssetsAddOptions) => {
	const handleImportAssetAdd = useCallback(
		async (rawAssetId: string) => {
			try {
				const asset = getImportAsset(rawAssetId as ImportAssetId)
				if (!asset) return

				const currentSource = (form.getValues("source") as string | undefined) ?? ""
				const parsed = parseSnippetFiles(currentSource)
				const normalizedFiles = normalizeImportAssetsFileMap(parsed.files).files
				const importAssetsFileName = resolveImportAssetsFileName(normalizedFiles)
				const currentImportsSource = normalizedFiles[importAssetsFileName] ?? ""
				const nextImportsSource = ensureImportAssetsFileSource(currentImportsSource, [asset.id])

				if (
					nextImportsSource === currentImportsSource &&
					Object.hasOwn(normalizedFiles, importAssetsFileName)
				) {
					return
				}

				const nextFiles: Record<string, string> = {
					...normalizedFiles,
					[importAssetsFileName]: nextImportsSource,
				}

				const nextMainBase = stripAutoImportBlock(parsed.mainSource)
				const normalizedMain = syncImportBlock(nextMainBase, Object.keys(nextFiles))
				const nextSource = serializeSnippetFiles(normalizedMain, nextFiles)

				if (nextSource === currentSource) return
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				commitHistoryNow(`Import asset: ${asset.label}`, nextSource)
				toast.success(`Imported ${asset.label}`)
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to import asset.")
			}
		},
		[commitHistoryNow, form],
	)

	return { handleImportAssetAdd }
}
