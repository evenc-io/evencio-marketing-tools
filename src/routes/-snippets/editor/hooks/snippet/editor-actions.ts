import {
	type ChangeEvent,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
} from "react"
import type { UseFormReturn } from "react-hook-form"
import type { SnippetComponentExport } from "@/lib/snippets"
import {
	DEFAULT_SNIPPET_EXPORT,
	parseSnippetFiles,
	removeSnippetComponentExport,
	serializeSnippetFiles,
} from "@/lib/snippets"
import { SNIPPET_COMPONENT_LIMITS, SNIPPET_SOURCE_MAX_CHARS } from "@/lib/snippets/constraints"
import type { SnippetExample } from "@/lib/snippets/examples"
import { SNIPPET_TEMPLATES, type SnippetTemplateId } from "@/lib/snippets/templates"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import {
	extractPrimaryNamedExport,
	getExportNameFromFile,
	stripSnippetFileDirectives,
	syncImportBlock,
	toComponentFileId,
} from "@/routes/-snippets/editor/snippet-file-utils"

const buildComponentTemplate = (name: string) => `
export const ${name} = ({ title = "New snippet" }) => {
  return (
    <div className="h-full w-full border border-neutral-200 bg-white p-8 text-neutral-900">
      <h1 className="font-lexend text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500">Update this component for your layout.</p>
    </div>
  )
}
`

interface UseSnippetEditorActionsOptions {
	form: UseFormReturn<CustomSnippetValues>
	componentExports: SnippetComponentExport[]
	componentFileNames: string[]
	activeComponentExport: string
	activeComponentFileName: string | null
	activeExample: SnippetExample | null
	fileMigrationRef: MutableRefObject<boolean>
	deleteTarget: { exportName: string; label: string; fileName?: string } | null
	setDeleteTarget: (value: { exportName: string; label: string; fileName?: string } | null) => void
	setIsDeletingComponent: (value: boolean) => void
	setError: (value: string | null) => void
	setActiveComponentExport: Dispatch<SetStateAction<string>>
	setActiveFile: Dispatch<SetStateAction<SnippetEditorFileId>>
	setOpenFiles: Dispatch<SetStateAction<SnippetEditorFileId[]>>
	setIsExamplePreviewActive: (value: boolean) => void
	resetAutoOpenComponents: () => void
	resetComponentExports: () => void
	resetAnalysis: () => void
	resetHistory: (source: string, label?: string) => void
	commitHistoryNow: (label: string, source: string) => void
	markHistoryLabel: (label: string) => void
	openFileTab: (fileId: SnippetEditorFileId) => void
	closeFileTab: (fileId: SnippetEditorFileId) => void
	selectFile: (fileId: SnippetEditorFileId) => void
}

export function useSnippetEditorActions({
	form,
	componentExports,
	componentFileNames,
	activeComponentExport,
	activeComponentFileName,
	activeExample,
	fileMigrationRef,
	deleteTarget,
	setDeleteTarget,
	setIsDeletingComponent,
	setError,
	setActiveComponentExport,
	setActiveFile,
	setOpenFiles,
	setIsExamplePreviewActive,
	resetAutoOpenComponents,
	resetComponentExports,
	resetAnalysis,
	resetHistory,
	commitHistoryNow,
	markHistoryLabel,
	openFileTab,
	closeFileTab,
	selectFile,
}: UseSnippetEditorActionsOptions) {
	const applySnippetTemplate = useCallback(
		(templateId: SnippetTemplateId, options?: { markDirty?: boolean }) => {
			const template = SNIPPET_TEMPLATES[templateId]
			if (!template || typeof template.source !== "string") return
			setError(null)
			setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			resetAutoOpenComponents()
			fileMigrationRef.current = false
			resetComponentExports()
			resetAnalysis()
			const shouldMarkDirty = options?.markDirty ?? true
			form.setValue("source", template.source, {
				shouldValidate: true,
				shouldDirty: shouldMarkDirty,
			})
			if (shouldMarkDirty) {
				commitHistoryNow("Apply template", template.source)
			} else {
				resetHistory(template.source, "Template loaded")
			}
			setIsExamplePreviewActive(false)
			openFileTab("source")
		},
		[
			commitHistoryNow,
			fileMigrationRef,
			form,
			openFileTab,
			resetAnalysis,
			resetAutoOpenComponents,
			resetComponentExports,
			resetHistory,
			setActiveComponentExport,
			setError,
			setIsExamplePreviewActive,
		],
	)

	const handleConfirmDeleteComponent = useCallback(async () => {
		if (!deleteTarget) return
		setIsDeletingComponent(true)
		setError(null)
		try {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			let nextSource = currentSource
			if (deleteTarget.fileName && Object.hasOwn(parsed.files, deleteTarget.fileName)) {
				const nextFiles = { ...parsed.files }
				delete nextFiles[deleteTarget.fileName]
				const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
				nextSource = serializeSnippetFiles(nextMain, nextFiles)
			} else {
				const result = await removeSnippetComponentExport(
					parsed.mainSource,
					deleteTarget.exportName,
				)
				if (!result.removed) {
					throw new Error(result.reason ?? "Unable to remove component export.")
				}
				const nextMain = syncImportBlock(result.source, Object.keys(parsed.files))
				nextSource = serializeSnippetFiles(nextMain, parsed.files)
			}

			form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			commitHistoryNow("Remove component", nextSource)
			if (activeComponentExport === deleteTarget.exportName) {
				setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			}
			const targetFileName = deleteTarget.fileName ?? `${deleteTarget.exportName}.tsx`
			closeFileTab(toComponentFileId(targetFileName))
			setDeleteTarget(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to remove component file")
		} finally {
			setIsDeletingComponent(false)
		}
	}, [
		activeComponentExport,
		closeFileTab,
		commitHistoryNow,
		deleteTarget,
		form,
		setActiveComponentExport,
		setDeleteTarget,
		setError,
		setIsDeletingComponent,
	])

	const handleSourceFileUpload = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const files = event.target.files
			if (!files?.length) return
			const file = files[0]
			const reader = new FileReader()
			reader.onload = () => {
				const content = reader.result as string
				fileMigrationRef.current = false
				resetComponentExports()
				resetAnalysis()
				form.setValue("source", content, { shouldValidate: true })
				commitHistoryNow("Upload source", content)
				if (!form.getValues("title")) {
					const name = file.name.replace(/\.(jsx?|tsx?)$/, "")
					form.setValue("title", name)
				}
			}
			reader.readAsText(file)
		},
		[commitHistoryNow, fileMigrationRef, form, resetAnalysis, resetComponentExports],
	)

	const getNextComponentName = useCallback(() => {
		const existing = new Set(componentExports.map((component) => component.exportName))
		for (const fileName of componentFileNames) {
			existing.add(getExportNameFromFile(fileName))
		}
		const base = "SnippetVariant"
		let index = 1
		let nextName = `${base}${index}`
		while (existing.has(nextName)) {
			index += 1
			nextName = `${base}${index}`
		}
		return nextName
	}, [componentExports, componentFileNames])

	const handleAddComponent = useCallback(() => {
		if (componentExports.length > SNIPPET_COMPONENT_LIMITS.hard) {
			setError(`Too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`)
			return
		}

		const nextName = getNextComponentName()
		const fileName = `${nextName}.tsx`
		const template = buildComponentTemplate(nextName).trimStart()
		const currentSource = form.getValues("source") ?? ""
		const parsed = parseSnippetFiles(currentSource)
		const nextFiles = {
			...parsed.files,
			[fileName]: template,
		}
		const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
		const nextSource = serializeSnippetFiles(nextMain, nextFiles)

		if (nextSource.length > SNIPPET_SOURCE_MAX_CHARS) {
			setError(
				`Adding a new component would exceed the ${SNIPPET_SOURCE_MAX_CHARS} character limit.`,
			)
			return
		}

		setError(null)
		form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
		commitHistoryNow("Add component", nextSource)
		setActiveComponentExport(nextName)
		selectFile(toComponentFileId(fileName))
	}, [
		commitHistoryNow,
		componentExports.length,
		form,
		getNextComponentName,
		selectFile,
		setActiveComponentExport,
		setError,
	])

	const handleMainSourceChange = useCallback(
		(nextValue: string | undefined) => {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedMain = stripSnippetFileDirectives(nextValue ?? "")
			const normalizedMain = syncImportBlock(sanitizedMain, Object.keys(parsed.files))
			const nextSource = serializeSnippetFiles(normalizedMain, parsed.files)
			if (nextSource !== currentSource) {
				markHistoryLabel("Edit Snippet.tsx")
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[form, markHistoryLabel],
	)

	const handleComponentSourceChange = useCallback(
		(nextValue: string | undefined) => {
			if (!activeComponentFileName) return
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedValue = stripSnippetFileDirectives(nextValue ?? "")
			const nextExportName = extractPrimaryNamedExport(sanitizedValue)
			const currentExportName = getExportNameFromFile(activeComponentFileName)
			const shouldRename =
				nextExportName &&
				nextExportName !== currentExportName &&
				!Object.hasOwn(parsed.files, `${nextExportName}.tsx`)

			if (shouldRename) {
				const nextFileName = `${nextExportName}.tsx`
				const nextFiles = { ...parsed.files }
				delete nextFiles[activeComponentFileName]
				nextFiles[nextFileName] = sanitizedValue
				const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
				const nextSource = serializeSnippetFiles(nextMain, nextFiles)
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				commitHistoryNow("Rename component", nextSource)
				setOpenFiles((prev) =>
					prev.map((fileId) =>
						fileId === toComponentFileId(activeComponentFileName)
							? toComponentFileId(nextFileName)
							: fileId,
					),
				)
				setActiveFile((prev) =>
					prev === toComponentFileId(activeComponentFileName)
						? toComponentFileId(nextFileName)
						: prev,
				)
				setActiveComponentExport(nextExportName)
				return
			}

			const nextFiles = { ...parsed.files, [activeComponentFileName]: sanitizedValue }
			const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
			const nextSource = serializeSnippetFiles(nextMain, nextFiles)
			if (nextSource !== currentSource) {
				markHistoryLabel(`Edit ${activeComponentFileName}`)
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[
			activeComponentFileName,
			commitHistoryNow,
			form,
			markHistoryLabel,
			setActiveComponentExport,
			setActiveFile,
			setOpenFiles,
		],
	)

	const applyExampleToEditor = useCallback(() => {
		if (!activeExample) return
		fileMigrationRef.current = false
		resetComponentExports()
		resetAnalysis()
		form.setValue("source", activeExample.source, { shouldValidate: true })
		commitHistoryNow("Apply example", activeExample.source)
		form.setValue("viewportWidth", activeExample.viewport.width, { shouldValidate: true })
		form.setValue("viewportHeight", activeExample.viewport.height, { shouldValidate: true })

		const currentTitle = form.getValues("title")
		if (!currentTitle.trim()) {
			form.setValue("title", activeExample.title, { shouldValidate: true })
		}

		const currentDescription = form.getValues("description")
		if (!currentDescription?.trim()) {
			form.setValue("description", activeExample.description, { shouldValidate: true })
		}

		selectFile("source")
		setIsExamplePreviewActive(false)
	}, [
		activeExample,
		commitHistoryNow,
		fileMigrationRef,
		form,
		resetAnalysis,
		resetComponentExports,
		selectFile,
		setIsExamplePreviewActive,
	])

	return {
		applySnippetTemplate,
		handleConfirmDeleteComponent,
		handleSourceFileUpload,
		handleAddComponent,
		handleMainSourceChange,
		handleComponentSourceChange,
		applyExampleToEditor,
	}
}
