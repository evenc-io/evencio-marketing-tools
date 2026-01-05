import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useCallback } from "react"
import type { UseFormReturn } from "react-hook-form"
import { DEFAULT_SNIPPET_EXPORT } from "@/lib/snippets"
import type { PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import type { SnippetTemplateId } from "@/lib/snippets/templates"
import { IMPORT_ASSET_FILE_NAME } from "@/routes/-snippets/editor/import-assets"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import { parseSnippetImportText } from "@/routes/-snippets/editor/snippet-import-utils"

type ImportResult = Awaited<ReturnType<typeof parseSnippetImportText>>

interface UseSnippetImportSnippetOptions {
	form: UseFormReturn<CustomSnippetValues>
	fileMigrationRef: MutableRefObject<boolean>
	resetComponentExports: () => void
	resetAnalysis: () => void
	resetAutoOpenComponents: () => void
	commitHistoryNow: (label?: string, overrideSource?: string) => void
	setIsExamplePreviewActive: Dispatch<SetStateAction<boolean>>
	setActiveComponentExport: Dispatch<SetStateAction<string>>
	setActiveFile: Dispatch<SetStateAction<SnippetEditorFileId>>
	setSelectedTemplateId: Dispatch<SetStateAction<SnippetTemplateId>>
	setComponentTreeSelectedId: Dispatch<SetStateAction<string | null>>
	setComponentTreeSelection: Dispatch<SetStateAction<PreviewSourceLocation | null>>
	setComponentTreeSelectionToken: Dispatch<SetStateAction<number>>
}

export function useSnippetImportSnippet({
	form,
	fileMigrationRef,
	resetComponentExports,
	resetAnalysis,
	resetAutoOpenComponents,
	commitHistoryNow,
	setIsExamplePreviewActive,
	setActiveComponentExport,
	setActiveFile,
	setSelectedTemplateId,
	setComponentTreeSelectedId,
	setComponentTreeSelection,
	setComponentTreeSelectionToken,
}: UseSnippetImportSnippetOptions) {
	return useCallback(
		async (value: string): Promise<ImportResult | { ok: true }> => {
			const result = parseSnippetImportText(value)
			if (!result.ok) {
				return result
			}

			const nextSource = result.value.source
			const viewport = result.value.viewport
			const hasMultiFiles = result.value.fileNames.some(
				(fileName) => fileName !== IMPORT_ASSET_FILE_NAME,
			)

			fileMigrationRef.current = false
			resetComponentExports()
			resetAnalysis()
			resetAutoOpenComponents()

			setIsExamplePreviewActive(false)
			setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			setActiveFile("source")
			setComponentTreeSelectedId(null)
			setComponentTreeSelection(null)
			setComponentTreeSelectionToken((prev) => prev + 1)
			setSelectedTemplateId(hasMultiFiles ? "multi" : "single")

			if (viewport) {
				form.setValue("viewportWidth", viewport.width, {
					shouldValidate: true,
					shouldDirty: true,
				})
				form.setValue("viewportHeight", viewport.height, {
					shouldValidate: true,
					shouldDirty: true,
				})
			}

			form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			commitHistoryNow("Import snippet", nextSource)

			return { ok: true as const }
		},
		[
			commitHistoryNow,
			fileMigrationRef,
			form,
			resetAnalysis,
			resetAutoOpenComponents,
			resetComponentExports,
			setActiveComponentExport,
			setActiveFile,
			setComponentTreeSelectedId,
			setComponentTreeSelection,
			setComponentTreeSelectionToken,
			setIsExamplePreviewActive,
			setSelectedTemplateId,
		],
	)
}
