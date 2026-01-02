import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { ClientOnly } from "@/components/ui/client-only"
import { Form } from "@/components/ui/form"
import { SCREEN_GUARD_EMPTY, useScreenGuard } from "@/lib/screen-guard"
import {
	DEFAULT_SNIPPET_EXPORT,
	parseSnippetFiles,
	serializeSnippetFiles,
	useSnippetCompiler,
} from "@/lib/snippets"
import { clampSnippetViewport, SNIPPET_COMPONENT_LIMITS } from "@/lib/snippets/constraints"
import { SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	type PreviewLayerSnapshot,
} from "@/lib/snippets/preview/runtime"
import { SNIPPET_TEMPLATES, type SnippetTemplateId } from "@/lib/snippets/templates"
import { SnippetDetailsPanel } from "@/routes/-snippets/editor/components/details-panel"
import { SnippetEditorPanel } from "@/routes/-snippets/editor/components/editor-panel"
import { SnippetExamplesPanel } from "@/routes/-snippets/editor/components/examples-panel"
import { SnippetImportsPanel } from "@/routes/-snippets/editor/components/imports-panel"
import { PanelRail } from "@/routes/-snippets/editor/components/panel-rail"
import { SnippetPreviewHeaderActions } from "@/routes/-snippets/editor/components/preview-header-actions"
import { SnippetSettingsPanel } from "@/routes/-snippets/editor/components/settings-panel"
import { SnippetFileOverlays } from "@/routes/-snippets/editor/components/snippet/file-overlays"
import { SnippetHeader } from "@/routes/-snippets/editor/components/snippet/header"
import { SnippetHistoryPanel } from "@/routes/-snippets/editor/components/snippet/history-panel"
import { SnippetInspectOverlays } from "@/routes/-snippets/editor/components/snippet/inspect-overlays"
import { SnippetScreenGuard } from "@/routes/-snippets/editor/components/snippet/screen-guard"
import { SnippetSplitViewResizer } from "@/routes/-snippets/editor/components/split-view-resizer"
import {
	CUSTOM_PRESET_ID,
	DEFAULT_DEFAULT_PROPS,
	DEFAULT_PROPS_SCHEMA,
	type ExampleFilterId,
	SNIPPET_FILES,
	STARTER_SOURCE,
} from "@/routes/-snippets/editor/constants"
import { useSnippetAnalysis } from "@/routes/-snippets/editor/hooks/snippet/analysis"
import { useSnippetComponentExports } from "@/routes/-snippets/editor/hooks/snippet/component-exports"
import { useDerivedSnippetProps } from "@/routes/-snippets/editor/hooks/snippet/derived-props"
import { useSnippetEditorActions } from "@/routes/-snippets/editor/hooks/snippet/editor-actions"
import { useSnippetEditorFiles } from "@/routes/-snippets/editor/hooks/snippet/editor-files"
import { useSnippetFilters } from "@/routes/-snippets/editor/hooks/snippet/filters"
import { useSnippetHistory } from "@/routes/-snippets/editor/hooks/snippet/history"
import { useSnippetInspect } from "@/routes/-snippets/editor/hooks/snippet/inspect"
import { useSnippetInspectText } from "@/routes/-snippets/editor/hooks/snippet/inspect-text"
import { useSnippetPanels } from "@/routes/-snippets/editor/hooks/snippet/panels"
import { useSnippetSplitView } from "@/routes/-snippets/editor/hooks/snippet/split-view"
import { useSnippetSubmit } from "@/routes/-snippets/editor/hooks/snippet/submit"
import { type CustomSnippetValues, customSnippetSchema } from "@/routes/-snippets/editor/schema"

const LazySnippetLayers3DView = lazy(() =>
	import("@/routes/-snippets/editor/components/snippet/layers-3d").then((module) => ({
		default: module.SnippetLayers3DView,
	})),
)

import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import {
	getComponentFileName,
	isComponentFileId,
	stripSnippetFileDirectives,
	syncImportBlock,
} from "@/routes/-snippets/editor/snippet-file-utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type { AssetScope, SnippetAsset } from "@/types/asset-library"

export const Route = createFileRoute("/snippets/editor")({
	validateSearch: z.object({
		edit: z.string().optional(),
		template: z.string().optional(),
	}),
	component: NewSnippetPage,
})

function NewSnippetPage() {
	const navigate = useNavigate()
	const search = Route.useSearch()
	const editAssetId = search.edit ?? null
	const isEditing = Boolean(editAssetId)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const templateAppliedRef = useRef(false)
	const fileMigrationRef = useRef(false)
	const editAppliedRef = useRef<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [layoutMode, setLayoutMode] = useState(false)
	const [layoutDebugEnabled, setLayoutDebugEnabled] = useState(false)
	const [layoutSnapEnabled, setLayoutSnapEnabled] = useState(true)
	const [layoutSnapGrid, setLayoutSnapGrid] = useState(8)
	const [layers3dOpen, setLayers3dOpen] = useState(false)
	const [layersSnapshot, setLayersSnapshot] = useState<PreviewLayerSnapshot | null>(null)
	const [layersError, setLayersError] = useState<string | null>(null)
	const [layersRequestToken, setLayersRequestToken] = useState(0)
	const [selectedTemplateId, setSelectedTemplateId] = useState<SnippetTemplateId>("single")
	const [deleteTarget, setDeleteTarget] = useState<{
		exportName: string
		label: string
		fileName?: string
	} | null>(null)
	const [isDeletingComponent, setIsDeletingComponent] = useState(false)
	const [editorCollapsed, setEditorCollapsed] = useState(false)
	const {
		detailsCollapsed,
		setDetailsCollapsed,
		explorerCollapsed,
		setExplorerCollapsed,
		examplesOpen,
		importsOpen,
		historyOpen,
		settingsOpen,
		isFocusPanelOpen,
		toggleExamplesPanel,
		toggleImportsPanel,
		toggleHistoryPanel,
		toggleSettingsPanel,
	} = useSnippetPanels()
	const [activeExampleId, setActiveExampleId] = useState(() => SNIPPET_EXAMPLES[0]?.id ?? "")
	const [isExamplePreviewActive, setIsExamplePreviewActive] = useState(false)
	const { exampleFilters, importsFilters, handleExampleFilterClick, handleImportsFilterClick } =
		useSnippetFilters()
	const splitContainerRef = useRef<HTMLDivElement>(null)
	const editorPanelRef = useRef<HTMLDivElement>(null)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const screenGate = useScreenGuard()
	const form = useForm<CustomSnippetValues>({
		resolver: zodResolver(customSnippetSchema),
		mode: "onChange",
		defaultValues: {
			title: "",
			description: "",
			scope: "personal",
			licenseName: "",
			licenseId: "",
			licenseUrl: "",
			attributionRequired: false,
			attributionText: "",
			attributionUrl: "",
			viewportPreset: CUSTOM_PRESET_ID,
			viewportWidth: DEFAULT_PREVIEW_DIMENSIONS.width,
			viewportHeight: DEFAULT_PREVIEW_DIMENSIONS.height,
			source: STARTER_SOURCE,
			propsSchema: JSON.stringify(DEFAULT_PROPS_SCHEMA, null, 2),
			defaultProps: JSON.stringify(DEFAULT_DEFAULT_PROPS, null, 2),
		},
	})
	const watchedSource = form.watch("source") ?? ""
	const includeInspect = true
	const {
		analysis,
		resetAnalysis,
		status: analysisStatus,
		error: analysisError,
	} = useSnippetAnalysis({
		source: watchedSource,
		includeTailwind: true,
		includeInspect,
	})
	const { componentExports, resetComponentExports } = useSnippetComponentExports({
		source: watchedSource,
		form,
		fileMigrationRef,
		analysis,
	})
	const derivedProps = useDerivedSnippetProps({ analysis, form })
	const parsedFiles = useMemo(() => parseSnippetFiles(watchedSource), [watchedSource])

	const assets = useAssetLibraryStore((state) => state.assets)
	const tags = useAssetLibraryStore((state) => state.tags)
	const isLibraryLoading = useAssetLibraryStore((state) => state.isLoading)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const registerCustomSnippetAsset = useAssetLibraryStore(
		(state) => state.registerCustomSnippetAsset,
	)
	const updateCustomSnippetAsset = useAssetLibraryStore((state) => state.updateCustomSnippetAsset)
	const tagNameById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags])
	const editAsset = useMemo(() => {
		if (!editAssetId) return null
		return (
			assets.find(
				(asset): asset is SnippetAsset => asset.id === editAssetId && asset.type === "snippet",
			) ?? null
		)
	}, [assets, editAssetId])
	const disabledScopes = useMemo<AssetScope[]>(() => {
		if (!isEditing || !editAsset) return []
		const order: AssetScope[] = ["personal", "event", "org"]
		const currentIndex = order.indexOf(editAsset.scope.scope)
		if (currentIndex <= 0) return []
		return order.slice(0, currentIndex)
	}, [editAsset, isEditing])
	const editTagNames = useMemo(() => {
		if (!editAsset) return []
		return editAsset.metadata.tags.map((tagId) => tagNameById.get(tagId) ?? tagId).filter(Boolean)
	}, [editAsset, tagNameById])
	const mainComponentLabel = useMemo(() => {
		const defaultExport = componentExports.find((component) => component.isDefault)
		if (!defaultExport) return "Main component"
		if (defaultExport.label.length > 36) return "Main component"
		return defaultExport.label
	}, [componentExports])
	const {
		openFiles,
		setOpenFiles,
		activeFile,
		setActiveFile,
		activeComponentExport,
		setActiveComponentExport,
		resetAutoOpenComponents,
		fileContextMenu,
		contextMenuFile,
		canCloseContextTab,
		editorFiles,
		editorFilesById,
		componentDefinitionMap,
		componentTypeLibs,
		componentFileNames,
		mainEditorSource,
		isSourceEditorActive,
		isComponentEditorActive,
		isPropsSchemaActive,
		isDefaultPropsActive,
		activeComponentFileName,
		hasActiveComponentFile,
		activeComponentSource,
		getSourceForFile,
		openFileTab,
		openFileForInspect,
		closeFileTab,
		selectFile,
		handleReorderOpenFiles,
		handleDefinitionSelect,
		handleFileContextMenu,
		handleFileContextMenuOpenChange,
	} = useSnippetEditorFiles({
		parsedFiles,
		componentExports,
		mainComponentLabel,
		selectedTemplateId,
	})
	const componentCount = componentExports.length
	const overSoftComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.soft
	const overHardComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.hard
	const canAddComponent = componentCount < SNIPPET_COMPONENT_LIMITS.hard
	const resolvedEntryExport = activeComponentExport || DEFAULT_SNIPPET_EXPORT
	const filteredExamples = useMemo(() => {
		if (exampleFilters.includes("all") || exampleFilters.length === 0) return SNIPPET_EXAMPLES
		return SNIPPET_EXAMPLES.filter((example) =>
			exampleFilters.includes(example.category as ExampleFilterId),
		)
	}, [exampleFilters])
	const activeExample = useMemo(
		() =>
			filteredExamples.find((example) => example.id === activeExampleId) ??
			filteredExamples[0] ??
			null,
		[activeExampleId, filteredExamples],
	)
	const historyLabel = useCallback(() => {
		if (activeFile === "source") return "Edit Snippet.tsx"
		if (isComponentFileId(activeFile)) {
			const fileName = getComponentFileName(activeFile)
			return fileName ? `Edit ${fileName}` : "Edit component"
		}
		return "Edit snippet"
	}, [activeFile])
	const {
		entries: historyEntries,
		activeIndex: historyActiveIndex,
		canUndo,
		canRedo,
		undo,
		redo,
		jumpTo: jumpToHistory,
		markLabel: markHistoryLabel,
		commitNow: commitHistoryNow,
		reset: resetHistory,
	} = useSnippetHistory({
		source: watchedSource,
		onApply: (nextSource) => {
			form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
		},
		getLabel: historyLabel,
		maxEntries: 12,
		debounceMs: 900,
		minChangeChars: 6,
		minCommitIntervalMs: 1500,
		ignoreWhitespaceOnly: true,
	})

	const updateSourceForFile = useCallback(
		(fileId: SnippetEditorFileId, nextFileSource: string) => {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedValue = stripSnippetFileDirectives(nextFileSource)

			if (fileId === "source") {
				const normalizedMain = syncImportBlock(sanitizedValue, Object.keys(parsed.files))
				const nextSource = serializeSnippetFiles(normalizedMain, parsed.files)
				if (nextSource !== currentSource) {
					markHistoryLabel("Edit Snippet.tsx")
					form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				}
				return
			}

			if (!isComponentFileId(fileId)) return
			const fileName = getComponentFileName(fileId)
			if (!fileName) return
			const nextFiles = { ...parsed.files, [fileName]: sanitizedValue }
			const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
			const nextSource = serializeSnippetFiles(nextMain, nextFiles)
			if (nextSource !== currentSource) {
				markHistoryLabel(fileName ? `Edit ${fileName}` : "Edit component")
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[form, markHistoryLabel],
	)

	const applyLayoutSourceForFile = useCallback(
		(fileId: SnippetEditorFileId, nextFileSource: string, label: string) => {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedValue = stripSnippetFileDirectives(nextFileSource)

			if (fileId === "source") {
				const normalizedMain = syncImportBlock(sanitizedValue, Object.keys(parsed.files))
				const nextSource = serializeSnippetFiles(normalizedMain, parsed.files)
				if (nextSource !== currentSource) {
					form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
					commitHistoryNow(label, nextSource)
				}
				return
			}

			if (!isComponentFileId(fileId)) return
			const fileName = getComponentFileName(fileId)
			if (!fileName) return
			const nextFiles = { ...parsed.files, [fileName]: sanitizedValue }
			const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
			const nextSource = serializeSnippetFiles(nextMain, nextFiles)
			if (nextSource !== currentSource) {
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				commitHistoryNow(label, nextSource)
			}
		},
		[commitHistoryNow, form],
	)

	useEffect(() => {
		if (typeof window === "undefined") return
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!event.metaKey && !event.ctrlKey) return
			const key = event.key.toLowerCase()
			const isUndo = key === "z" && !event.shiftKey
			const isRedo = key === "z" && event.shiftKey
			const isAltRedo = key === "y"
			if (!isUndo && !isRedo && !isAltRedo) return
			const target = event.target as HTMLElement | null
			if (target) {
				if (target.isContentEditable) return
				if (target.closest("input, textarea, select")) return
				if (target.closest(".monaco-editor")) return
			}
			event.preventDefault()
			if (isUndo) {
				undo()
			} else {
				redo()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [redo, undo])
	const activeFileMeta = editorFilesById.get(activeFile) ?? null
	const canSubmit =
		form.formState.isValid &&
		!isSubmitting &&
		componentCount > 0 &&
		!overHardComponentLimit &&
		(!isEditing || Boolean(editAsset))
	const viewportWidth = form.watch("viewportWidth")
	const viewportHeight = form.watch("viewportHeight")
	const snippetPreviewDimensions = useMemo(
		() =>
			clampSnippetViewport({
				width: Number.isFinite(viewportWidth) ? viewportWidth : DEFAULT_PREVIEW_DIMENSIONS.width,
				height: Number.isFinite(viewportHeight)
					? viewportHeight
					: DEFAULT_PREVIEW_DIMENSIONS.height,
			}),
		[viewportHeight, viewportWidth],
	)
	const examplePreviewDimensions = activeExample?.viewport ?? DEFAULT_PREVIEW_DIMENSIONS
	const examplePreviewProps = useMemo(() => activeExample?.previewProps ?? {}, [activeExample])
	const exampleSource = activeExample?.source ?? ""
	const { analysis: exampleAnalysis } = useSnippetAnalysis({
		source: isExamplePreviewActive ? exampleSource : "",
		includeTailwind: isExamplePreviewActive,
		debounceMs: 300,
		key: "snippet-analyze-example",
	})

	useEffect(() => {
		loadLibrary()
	}, [loadLibrary])

	useEffect(() => {
		if (!isEditing) {
			editAppliedRef.current = null
			return
		}
		if (isLibraryLoading) return
		if (!editAsset || !editAsset.snippet.source) {
			setError("Snippet not found or not editable.")
			return
		}
		const editScope = editAsset.scope.scope
		if (editScope === "global") {
			setError("Global snippets are not editable.")
			return
		}
		if (editAppliedRef.current === editAsset.id) return

		const license = editAsset.metadata.license
		const attribution = editAsset.metadata.attribution
		const viewport = editAsset.snippet.viewport ?? DEFAULT_PREVIEW_DIMENSIONS
		const propsSchema = editAsset.snippet.propsSchema ?? DEFAULT_PROPS_SCHEMA
		const defaultProps = editAsset.defaultProps ?? DEFAULT_DEFAULT_PROPS

		setError(null)
		resetAutoOpenComponents()
		fileMigrationRef.current = false
		resetComponentExports()
		resetAnalysis()
		form.reset(
			{
				title: editAsset.metadata.title ?? "",
				description: editAsset.metadata.description ?? "",
				scope: editScope,
				licenseName: license.name ?? "",
				licenseId: license.id ?? "",
				licenseUrl: license.url ?? "",
				attributionRequired: license.attributionRequired ?? false,
				attributionText: attribution?.text ?? "",
				attributionUrl: attribution?.url ?? "",
				viewportPreset: CUSTOM_PRESET_ID,
				viewportWidth: viewport.width,
				viewportHeight: viewport.height,
				source: editAsset.snippet.source ?? "",
				propsSchema: JSON.stringify(propsSchema, null, 2),
				defaultProps: JSON.stringify(defaultProps, null, 2),
			},
			{ keepDirty: false, keepTouched: false },
		)
		resetHistory(editAsset.snippet.source ?? "", "Loaded snippet")
		setOpenFiles(SNIPPET_FILES.map((file) => file.id))
		setActiveFile("source")
		setActiveComponentExport(editAsset.snippet.entryExport ?? DEFAULT_SNIPPET_EXPORT)
		setIsExamplePreviewActive(false)
		editAppliedRef.current = editAsset.id
	}, [
		editAsset,
		form,
		isEditing,
		isLibraryLoading,
		resetAnalysis,
		resetAutoOpenComponents,
		resetComponentExports,
		resetHistory,
		setActiveComponentExport,
		setActiveFile,
		setOpenFiles,
	])

	useEffect(() => {
		if (!examplesOpen) {
			setIsExamplePreviewActive(false)
		}
	}, [examplesOpen])

	useEffect(() => {
		if (isExamplePreviewActive) {
			setLayoutMode(false)
		}
	}, [isExamplePreviewActive])

	useEffect(() => {
		if (!filteredExamples.length) {
			setActiveExampleId("")
			return
		}
		const stillVisible = filteredExamples.some((example) => example.id === activeExampleId)
		if (!stillVisible) {
			setActiveExampleId(filteredExamples[0]?.id ?? "")
		}
	}, [activeExampleId, filteredExamples])

	// Compile snippet for preview
	const {
		status: compileStatus,
		compiledCode,
		tailwindCss,
		monacoMarkers,
		parsedProps,
		errors: compileErrors,
	} = useSnippetCompiler({
		source: watchedSource,
		defaultProps: derivedProps.defaultProps,
		entryExport: resolvedEntryExport,
		debounceMs: 500,
		enableTailwindCss: true,
		analysis,
		engineKey: "snippet-compile-main",
	})
	const previewProps = useMemo(() => parsedProps ?? {}, [parsedProps])
	const { compiledCode: exampleCompiledCode, tailwindCss: exampleTailwindCss } = useSnippetCompiler(
		{
			source: exampleSource,
			defaultProps: examplePreviewProps,
			debounceMs: 300,
			autoCompile: isExamplePreviewActive,
			enableTailwindCss: isExamplePreviewActive,
			analysis: exampleAnalysis,
			engineKey: "snippet-compile-example",
		},
	)
	const {
		inspectMode,
		setInspectMode,
		inspectEnabled,
		inspectHighlight,
		onPreviewInspectHover,
		onPreviewInspectSelect,
		onPreviewInspectContext,
		resolvePreviewSource,
	} = useSnippetInspect({
		mainSource: parsedFiles.mainSource,
		mainEditorSource,
		componentFiles: parsedFiles.files,
		activeFile,
		isExamplePreviewActive,
		onOpenFileForInspect: openFileForInspect,
		inspectIndexByFileId: analysis?.inspectIndexByFileId,
		lineMapSegments: analysis?.lineMapSegments,
		forceEnabled: layoutMode,
	})
	const {
		inspectTextEdit,
		inspectContextMenu,
		selectedInspectSource,
		inspectTextEditRef,
		inspectContextMenuRef,
		handleInspectTextChange,
		closeInspectTextEdit,
		handleInspectContextEdit,
		handleInspectContextRemove,
		handleInspectContextRemoveContainer,
		handlePreviewInspectSelect,
		handleInspectContext,
		handleInspectEscape,
		handleLayoutCommit,
	} = useSnippetInspectText({
		getSourceForFile,
		updateSourceForFile,
		applyLayoutSourceForFile,
		resolvePreviewSource,
		onPreviewInspectSelect,
		onPreviewInspectContext,
		layoutMode,
		isExamplePreviewActive,
		inspectEnabled,
	})
	const {
		applySnippetTemplate,
		handleConfirmDeleteComponent,
		handleSourceFileUpload,
		handleAddComponent,
		handleMainSourceChange,
		handleComponentSourceChange,
		applyExampleToEditor,
	} = useSnippetEditorActions({
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
	})

	const handleLayersSnapshot = useCallback((snapshot: PreviewLayerSnapshot) => {
		setLayersSnapshot(snapshot)
		setLayersError(null)
	}, [])

	const handleLayersError = useCallback((nextError: string) => {
		setLayersError(nextError)
	}, [])

	const requestLayersSnapshot = useCallback(() => {
		setLayersRequestToken((prev) => prev + 1)
	}, [])

	useEffect(() => {
		if (!layers3dOpen) {
			setLayersSnapshot(null)
			setLayersError(null)
			return
		}
		requestLayersSnapshot()
	}, [layers3dOpen, requestLayersSnapshot])

	useEffect(() => {
		if (templateAppliedRef.current) return
		if (isEditing) {
			templateAppliedRef.current = true
			return
		}
		if (typeof window === "undefined") return
		const params = new URLSearchParams(window.location.search)
		const templateParam = params.get("template")
		if (templateParam && Object.hasOwn(SNIPPET_TEMPLATES, templateParam)) {
			const templateId = templateParam as SnippetTemplateId
			setSelectedTemplateId(templateId)
			applySnippetTemplate(templateId, { markDirty: false })
		}
		templateAppliedRef.current = true
	}, [applySnippetTemplate, isEditing])
	const { handleSubmit } = useSnippetSubmit({
		isEditing,
		editAsset,
		editTagNames,
		activeComponentExport,
		derivedProps,
		form,
		setError,
		setIsSubmitting,
		registerCustomSnippetAsset,
		updateCustomSnippetAsset,
		navigate,
	})

	const isExamplePreviewing = Boolean(isExamplePreviewActive && activeExample)
	const previewCompiledCode = isExamplePreviewing ? exampleCompiledCode : compiledCode
	const previewPropsToUse = isExamplePreviewing ? examplePreviewProps : previewProps
	const previewTailwindCss = isExamplePreviewing ? exampleTailwindCss : tailwindCss
	const previewDimensionsToUse = isExamplePreviewing
		? examplePreviewDimensions
		: snippetPreviewDimensions

	const handleToggleLayout = useCallback(() => {
		setLayoutMode((prev) => {
			const next = !prev
			if (!next) {
				setLayoutDebugEnabled(false)
			}
			return next
		})
	}, [])

	const handleToggleLayoutDebug = useCallback(() => {
		setLayoutDebugEnabled((prev) => !prev)
	}, [])

	useEffect(() => {
		if (!layoutMode && layoutDebugEnabled) {
			setLayoutDebugEnabled(false)
		}
	}, [layoutDebugEnabled, layoutMode])

	useEffect(() => {
		if (!layers3dOpen) return
		if (!previewCompiledCode) {
			setLayersSnapshot(null)
		}
	}, [layers3dOpen, previewCompiledCode])
	const previewHeaderActions = (
		<SnippetPreviewHeaderActions
			isExamplePreviewing={isExamplePreviewing}
			activeExampleTitle={activeExample?.title}
			onExitExamplePreview={() => setIsExamplePreviewActive(false)}
			inspectEnabled={inspectMode}
			onToggleInspect={() => setInspectMode((prev) => !prev)}
			layoutEnabled={layoutMode}
			onToggleLayout={handleToggleLayout}
			layoutDebugEnabled={layoutDebugEnabled}
			onToggleLayoutDebug={handleToggleLayoutDebug}
			layers3dEnabled={layers3dOpen}
			onToggleLayers3d={() => setLayers3dOpen((prev) => !prev)}
		/>
	)
	const inspectEditorLabel = inspectTextEdit
		? inspectTextEdit.fileId === "source"
			? "Snippet.tsx"
			: (getComponentFileName(inspectTextEdit.fileId) ?? "Component")
		: undefined
	const { onResizeStart } = useSnippetSplitView({
		containerRef: splitContainerRef,
		editorRef: editorPanelRef,
		editorCollapsed,
		explorerCollapsed,
	})

	return (
		<ClientOnly fallback={<SnippetScreenGuard gate={SCREEN_GUARD_EMPTY} />}>
			{screenGate.status !== "supported" ? (
				<SnippetScreenGuard gate={screenGate} />
			) : (
				<div className="flex h-screen flex-col overflow-hidden bg-white">
					<SnippetFileOverlays
						contextMenu={fileContextMenu}
						contextMenuFile={contextMenuFile}
						openFiles={openFiles}
						canCloseContextTab={canCloseContextTab}
						deleteTarget={deleteTarget}
						isDeletingComponent={isDeletingComponent}
						onContextMenuOpenChange={handleFileContextMenuOpenChange}
						onSelectFile={selectFile}
						onCloseFileTab={closeFileTab}
						onRequestDelete={setDeleteTarget}
						onCancelDelete={() => setDeleteTarget(null)}
						onConfirmDelete={handleConfirmDeleteComponent}
					/>
					<SnippetInspectOverlays
						contextMenu={inspectContextMenu}
						onContextEdit={handleInspectContextEdit}
						onContextRemove={handleInspectContextRemove}
						onContextRemoveContainer={handleInspectContextRemoveContainer}
						editor={inspectTextEdit}
						editorLabel={inspectEditorLabel}
						editorRef={inspectTextEditRef}
						menuRef={inspectContextMenuRef}
						onEditorChange={handleInspectTextChange}
						onEditorClose={closeInspectTextEdit}
					/>
					<SnippetHeader
						canSubmit={canSubmit}
						isSubmitting={isSubmitting}
						isEditing={isEditing}
						onSubmit={form.handleSubmit(handleSubmit)}
					/>

					{/* Main content - fills remaining height */}
					<Form {...form}>
						<form
							className="flex flex-1 overflow-hidden"
							onSubmit={form.handleSubmit(handleSubmit)}
						>
							<PanelRail
								editorCollapsed={editorCollapsed}
								detailsCollapsed={detailsCollapsed}
								explorerCollapsed={explorerCollapsed}
								examplesOpen={examplesOpen}
								importsOpen={importsOpen}
								historyOpen={historyOpen}
								settingsOpen={settingsOpen}
								isFocusPanelOpen={isFocusPanelOpen}
								onToggleEditor={() => setEditorCollapsed((prev) => !prev)}
								onToggleDetails={() => setDetailsCollapsed((prev) => !prev)}
								onToggleExplorer={() => setExplorerCollapsed((prev) => !prev)}
								onToggleExamples={toggleExamplesPanel}
								onToggleImports={toggleImportsPanel}
								onToggleHistory={toggleHistoryPanel}
								onToggleSettings={toggleSettingsPanel}
								exampleFilters={exampleFilters}
								importsFilters={importsFilters}
								onExampleFilterClick={handleExampleFilterClick}
								onImportsFilterClick={handleImportsFilterClick}
							/>
							<SnippetDetailsPanel
								collapsed={detailsCollapsed}
								disabledScopes={disabledScopes}
								selectedTemplateId={selectedTemplateId}
								onSelectTemplate={setSelectedTemplateId}
								onApplyTemplate={() => applySnippetTemplate(selectedTemplateId)}
								error={error}
							/>
							<SnippetHistoryPanel
								open={historyOpen}
								entries={historyEntries}
								activeIndex={historyActiveIndex}
								canUndo={canUndo}
								canRedo={canRedo}
								onUndo={undo}
								onRedo={redo}
								onJump={jumpToHistory}
							/>

							<SnippetSettingsPanel
								open={settingsOpen}
								analysis={analysis}
								analysisStatus={analysisStatus}
								analysisError={analysisError}
								includeTailwind
								includeInspect={includeInspect}
								layoutSnapEnabled={layoutSnapEnabled}
								onToggleLayoutSnap={() => setLayoutSnapEnabled((prev) => !prev)}
								layoutSnapGrid={layoutSnapGrid}
								onChangeLayoutSnapGrid={setLayoutSnapGrid}
							/>

							<SnippetExamplesPanel
								open={examplesOpen}
								examples={filteredExamples}
								activeExample={activeExample}
								activeExampleId={activeExampleId}
								isPreviewActive={isExamplePreviewActive}
								onSelectExample={setActiveExampleId}
								onTogglePreview={() => setIsExamplePreviewActive((prev) => !prev)}
								onApplyExample={applyExampleToEditor}
							/>

							<SnippetImportsPanel open={importsOpen} filters={importsFilters} />

							{/* Center - Editor and Preview split */}
							<section ref={splitContainerRef} className="flex flex-1 overflow-hidden">
								<SnippetEditorPanel
									containerRef={editorPanelRef}
									editorCollapsed={editorCollapsed}
									explorerCollapsed={explorerCollapsed}
									openFiles={openFiles}
									editorFiles={editorFiles}
									editorFilesById={editorFilesById}
									activeFile={activeFile}
									activeFileMeta={activeFileMeta}
									isSourceEditorActive={isSourceEditorActive}
									isComponentEditorActive={isComponentEditorActive}
									isPropsSchemaActive={isPropsSchemaActive}
									isDefaultPropsActive={isDefaultPropsActive}
									componentCount={componentCount}
									hasComponentExports={componentExports.length > 0}
									canAddComponent={canAddComponent}
									overSoftComponentLimit={overSoftComponentLimit}
									overHardComponentLimit={overHardComponentLimit}
									onSelectFile={selectFile}
									onCloseFileTab={closeFileTab}
									onReorderOpenFiles={handleReorderOpenFiles}
									onFileContextMenu={handleFileContextMenu}
									onAddComponent={handleAddComponent}
									fileInputRef={fileInputRef}
									onSourceUpload={handleSourceFileUpload}
									form={form}
									mainEditorSource={mainEditorSource}
									onMainSourceChange={handleMainSourceChange}
									componentTypeLibs={componentTypeLibs}
									componentDefinitionMap={componentDefinitionMap}
									onDefinitionSelect={handleDefinitionSelect}
									monacoMarkers={monacoMarkers}
									hasActiveComponentFile={hasActiveComponentFile}
									activeComponentSource={activeComponentSource}
									activeComponentFileName={activeComponentFileName}
									onComponentSourceChange={handleComponentSourceChange}
									derivedDuplicateKeys={derivedProps.duplicateKeys}
									compileStatus={compileStatus}
									compileErrors={compileErrors}
									inspectHighlight={inspectHighlight}
									canUndo={canUndo}
									canRedo={canRedo}
									onUndo={undo}
									onRedo={redo}
								/>

								<SnippetSplitViewResizer isHidden={editorCollapsed} onPointerDown={onResizeStart} />

								{/* Preview panel - fills remaining width */}
								<div
									ref={previewContainerRef}
									className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
								>
									<SnippetPreview
										compiledCode={previewCompiledCode}
										props={previewPropsToUse}
										tailwindCss={previewTailwindCss}
										dimensions={previewDimensionsToUse}
										className="h-full"
										headerActions={previewHeaderActions}
										inspectEnabled={inspectEnabled}
										onInspectHover={onPreviewInspectHover}
										onInspectSelect={handlePreviewInspectSelect}
										onInspectContext={handleInspectContext}
										onInspectEscape={handleInspectEscape}
										layoutEnabled={layoutMode && !isExamplePreviewing}
										layoutDebugEnabled={layoutDebugEnabled && layoutMode && !isExamplePreviewing}
										layoutSnapEnabled={layoutSnapEnabled}
										layoutSnapGrid={layoutSnapGrid}
										onLayoutCommit={handleLayoutCommit}
										layersEnabled={layers3dOpen}
										layersRequestToken={layersRequestToken}
										onLayersSnapshot={handleLayersSnapshot}
										onLayersError={handleLayersError}
									/>
									{layers3dOpen && (
										<div className="absolute inset-0 z-30">
											<Suspense
												fallback={
													<div className="flex h-full items-center justify-center bg-white text-xs text-neutral-500">
														Loading layers...
													</div>
												}
											>
												<LazySnippetLayers3DView
													snapshot={layersSnapshot}
													error={layersError}
													selectedSource={selectedInspectSource}
													onSelectSource={handlePreviewInspectSelect}
													onRequestRefresh={requestLayersSnapshot}
													onClose={() => setLayers3dOpen(false)}
													className="h-full"
												/>
											</Suspense>
										</div>
									)}
								</div>
							</section>
						</form>
					</Form>
				</div>
			)}
		</ClientOnly>
	)
}
