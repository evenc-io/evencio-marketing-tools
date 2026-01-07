import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import {
	lazy,
	Suspense,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { Button } from "@/components/ui/button"
import { ClientOnly } from "@/components/ui/client-only"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { SCREEN_GUARD_EMPTY, useScreenGuard } from "@/lib/screen-guard"
import {
	DEFAULT_SNIPPET_EXPORT,
	parseSnippetFiles,
	serializeSnippetFiles,
	useSnippetCompiler,
} from "@/lib/snippets"
import type { SnippetComponentTreeNode } from "@/lib/snippets/component-tree"
import { clampSnippetViewport, SNIPPET_COMPONENT_LIMITS } from "@/lib/snippets/constraints"
import { SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	type PreviewLayerSnapshot,
	type PreviewSourceLocation,
} from "@/lib/snippets/preview/runtime"
import { buildSnippetLineMapSegments } from "@/lib/snippets/source/files"
import { SNIPPET_TEMPLATES, type SnippetTemplateId } from "@/lib/snippets/templates"
import { SnippetComponentTreePanel } from "@/routes/-snippets/editor/components/component-tree-panel"
import { SnippetComponentTreeResizer } from "@/routes/-snippets/editor/components/component-tree-resizer"
import { SnippetDetailsPanel } from "@/routes/-snippets/editor/components/details-panel"
import { SnippetEditorPanel } from "@/routes/-snippets/editor/components/editor-panel"
import { SnippetExamplesPanel } from "@/routes/-snippets/editor/components/examples-panel"
import { SnippetImportDndOverlay } from "@/routes/-snippets/editor/components/import-dnd-overlay"
import { SnippetImportsPanel } from "@/routes/-snippets/editor/components/imports-panel"
import { PanelRail } from "@/routes/-snippets/editor/components/panel-rail"
import { SnippetPreviewHeaderActions } from "@/routes/-snippets/editor/components/preview-header-actions"
import { SnippetSettingsPanel } from "@/routes/-snippets/editor/components/settings-panel"
import { SnippetFileOverlays } from "@/routes/-snippets/editor/components/snippet/file-overlays"
import { SnippetHeader } from "@/routes/-snippets/editor/components/snippet/header"
import { SnippetHistoryPanel } from "@/routes/-snippets/editor/components/snippet/history-panel"
import { SnippetImportDialog } from "@/routes/-snippets/editor/components/snippet/import-dialog"
import { SnippetInspectOverlays } from "@/routes/-snippets/editor/components/snippet/inspect-overlays"
import { SnippetScreenGuard } from "@/routes/-snippets/editor/components/snippet/screen-guard"
import { SnippetSwitcherDialog } from "@/routes/-snippets/editor/components/snippet/switcher-dialog"
import { SnippetSplitViewResizer } from "@/routes/-snippets/editor/components/split-view-resizer"
import {
	CUSTOM_PRESET_ID,
	DEFAULT_DEFAULT_PROPS,
	DEFAULT_PROPS_SCHEMA,
	type ExampleFilterId,
	STARTER_SOURCE,
} from "@/routes/-snippets/editor/constants"
import { useSnippetAnalysis } from "@/routes/-snippets/editor/hooks/snippet/analysis"
import { useSnippetComponentExports } from "@/routes/-snippets/editor/hooks/snippet/component-exports"
import { useSnippetComponentTree } from "@/routes/-snippets/editor/hooks/snippet/component-tree"
import { useSnippetComponentTreePanel } from "@/routes/-snippets/editor/hooks/snippet/component-tree-panel"
import { useDerivedSnippetProps } from "@/routes/-snippets/editor/hooks/snippet/derived-props"
import { useSnippetDrafts } from "@/routes/-snippets/editor/hooks/snippet/drafts"
import { useSnippetEditorActions } from "@/routes/-snippets/editor/hooks/snippet/editor-actions"
import { useSnippetEditorFiles } from "@/routes/-snippets/editor/hooks/snippet/editor-files"
import { useSnippetFilters } from "@/routes/-snippets/editor/hooks/snippet/filters"
import { useSnippetHistory } from "@/routes/-snippets/editor/hooks/snippet/history"
import { useSnippetImportAssetsAdd } from "@/routes/-snippets/editor/hooks/snippet/import-assets-add"
import { useSnippetImportAssetsRemove } from "@/routes/-snippets/editor/hooks/snippet/import-assets-remove"
import { useSnippetImportDnd } from "@/routes/-snippets/editor/hooks/snippet/import-dnd"
import { useSnippetImportSnippet } from "@/routes/-snippets/editor/hooks/snippet/import-snippet"
import {
	buildSnippetImportsIndex,
	useSnippetImportsIndex,
} from "@/routes/-snippets/editor/hooks/snippet/imports-index"
import { useSnippetInspect } from "@/routes/-snippets/editor/hooks/snippet/inspect"
import { useSnippetInspectText } from "@/routes/-snippets/editor/hooks/snippet/inspect-text"
import { useSnippetPanels } from "@/routes/-snippets/editor/hooks/snippet/panels"
import { usePreviewCameraHotkey } from "@/routes/-snippets/editor/hooks/snippet/preview-camera"
import { useSnippetSelection } from "@/routes/-snippets/editor/hooks/snippet/selection"
import { useSnippetSplitView } from "@/routes/-snippets/editor/hooks/snippet/split-view"
import { useSnippetSubmit } from "@/routes/-snippets/editor/hooks/snippet/submit"
import {
	buildImportAssetsPreviewSource,
	getImportAsset,
	getImportAssetRemovalIds,
	getImportAssetsPreviewDimensions,
	IMPORT_ASSET_FILE_NAME,
	type ImportAssetId,
} from "@/routes/-snippets/editor/import-assets"
import { type CustomSnippetValues, customSnippetSchema } from "@/routes/-snippets/editor/schema"
import { getSnippetDraftId, NEW_SNIPPET_DRAFT_ID } from "@/routes/-snippets/editor/snippet-drafts"
import type {
	SnippetEditorFileId,
	SnippetExplorerItem,
} from "@/routes/-snippets/editor/snippet-editor-types"
import {
	getComponentFileName,
	isComponentFileId,
	stripSnippetFileDirectives,
	syncImportBlock,
} from "@/routes/-snippets/editor/snippet-file-utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type { AssetScope, SnippetAsset } from "@/types/asset-library"

const LazySnippetLayers3DView = lazy(() =>
	import("@/routes/-snippets/editor/components/snippet/layers-3d").then((module) => ({
		default: module.SnippetLayers3DView,
	})),
)

const LazySnippetImportsGalleryDialog = lazy(() =>
	import("@/routes/-snippets/editor/components/imports-gallery-dialog").then((module) => ({
		default: module.SnippetImportsGalleryDialog,
	})),
)

const getPreviewSourceKey = (source: PreviewSourceLocation | null) => {
	if (!source) return null
	const fileName = source.fileName ?? ""
	const line = source.lineNumber ?? ""
	const column = source.columnNumber ?? ""
	return `${String(fileName)}:${String(line)}:${String(column)}`
}

const normalizeNewlines = (value: string) =>
	value.includes("\r") ? value.replace(/\r\n?/g, "\n") : value

const getPreviewSourceLineKey = (source: PreviewSourceLocation | null) => {
	if (!source) return null
	const fileName = source.fileName ?? ""
	const line = source.lineNumber ?? ""
	return `${String(fileName)}:${String(line)}`
}

const isDomNodeName = (name: string) => /^[a-z]/.test(name)

const getDefaultSnippetValues = (): CustomSnippetValues => ({
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
})

const findSelectableTreeNode = (
	node: SnippetComponentTreeNode,
): SnippetComponentTreeNode | null => {
	if (node.source && isDomNodeName(node.name)) return node
	for (const child of node.children) {
		const match = findSelectableTreeNode(child)
		if (match) return match
	}
	return node.source ? node : null
}

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
	const importAssetMutationRef = useRef(false)
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
	const [componentTreeSelection, setComponentTreeSelection] =
		useState<PreviewSourceLocation | null>(null)
	const [componentTreeSelectionToken, setComponentTreeSelectionToken] = useState(0)
	const [selectedTemplateId, setSelectedTemplateId] = useState<SnippetTemplateId>("single")
	const [snippetSearch, setSnippetSearch] = useState("")
	const [snippetSwitcherOpen, setSnippetSwitcherOpen] = useState(false)
	const [importDialogOpen, setImportDialogOpen] = useState(false)
	const [importsGalleryOpen, setImportsGalleryOpen] = useState(false)
	const [importAssetRemoveConfirm, setImportAssetRemoveConfirm] = useState<{
		assetId: ImportAssetId
		removalIds: ImportAssetId[]
		usedIds: ImportAssetId[]
	} | null>(null)
	const [isImportAssetImporting, setIsImportAssetImporting] = useState(false)
	const [isImportAssetRemoving, setIsImportAssetRemoving] = useState(false)
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
	const { draftIds, loadDraft, saveDraft, deleteDraft } = useSnippetDrafts()
	const currentDraftId = getSnippetDraftId(editAssetId)
	const splitContainerRef = useRef<HTMLDivElement>(null)
	const editorPanelRef = useRef<HTMLDivElement>(null)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const {
		isOpen: componentTreeOpen,
		setIsOpen: setComponentTreeOpen,
		width: componentTreeWidth,
		onResizeStart: onComponentTreeResizeStart,
	} = useSnippetComponentTreePanel({ containerRef: previewContainerRef })
	const [componentTreeSelectedId, setComponentTreeSelectedId] = useState<string | null>(null)
	const screenGate = useScreenGuard()
	const defaultSnippetValues = useMemo(() => getDefaultSnippetValues(), [])
	const form = useForm<CustomSnippetValues>({
		resolver: zodResolver(customSnippetSchema),
		mode: "onChange",
		defaultValues: defaultSnippetValues,
	})
	const watchedSource = useWatch({ control: form.control, name: "source" }) ?? ""
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
	const deferredParsedFiles = useDeferredValue(parsedFiles)
	const lineMapSegments = useMemo(() => {
		if (analysis?.lineMapSegments && analysis.lineMapSegments.length > 0) {
			return analysis.lineMapSegments
		}
		return buildSnippetLineMapSegments(parsedFiles.mainSource, parsedFiles.files)
	}, [analysis?.lineMapSegments, parsedFiles.files, parsedFiles.mainSource])

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
	const editableSnippets = useMemo(
		() =>
			assets.filter(
				(asset): asset is SnippetAsset =>
					asset.type === "snippet" &&
					Boolean(asset.snippet.source) &&
					asset.scope.scope !== "global",
			),
		[assets],
	)
	const editableSnippetById = useMemo(
		() => new Map(editableSnippets.map((asset) => [asset.id, asset])),
		[editableSnippets],
	)
	const hasNewSnippetDraft = draftIds.has(NEW_SNIPPET_DRAFT_ID)
	const normalizedWatchedSource = useMemo(() => normalizeNewlines(watchedSource), [watchedSource])
	const normalizedDefaultSource = useMemo(
		() => normalizeNewlines(defaultSnippetValues.source ?? ""),
		[defaultSnippetValues.source],
	)
	const canResetNewSnippet =
		!isEditing && (hasNewSnippetDraft || normalizedWatchedSource !== normalizedDefaultSource)

	const isNewSnippetAtDefaultValues = useCallback(() => {
		const values = form.getValues()
		return (
			normalizeNewlines(values.source ?? "") === normalizedDefaultSource &&
			(values.title ?? "") === (defaultSnippetValues.title ?? "") &&
			(values.description ?? "") === (defaultSnippetValues.description ?? "") &&
			values.scope === defaultSnippetValues.scope &&
			(values.licenseName ?? "") === (defaultSnippetValues.licenseName ?? "") &&
			(values.licenseId ?? "") === (defaultSnippetValues.licenseId ?? "") &&
			(values.licenseUrl ?? "") === (defaultSnippetValues.licenseUrl ?? "") &&
			Boolean(values.attributionRequired) === Boolean(defaultSnippetValues.attributionRequired) &&
			(values.attributionText ?? "") === (defaultSnippetValues.attributionText ?? "") &&
			(values.attributionUrl ?? "") === (defaultSnippetValues.attributionUrl ?? "") &&
			(values.viewportPreset ?? CUSTOM_PRESET_ID) === defaultSnippetValues.viewportPreset &&
			(values.viewportWidth ?? DEFAULT_PREVIEW_DIMENSIONS.width) ===
				defaultSnippetValues.viewportWidth &&
			(values.viewportHeight ?? DEFAULT_PREVIEW_DIMENSIONS.height) ===
				defaultSnippetValues.viewportHeight
		)
	}, [defaultSnippetValues, form, normalizedDefaultSource])

	useEffect(() => {
		if (isEditing) return
		if (!hasNewSnippetDraft) return
		if (!isNewSnippetAtDefaultValues()) return
		void deleteDraft(NEW_SNIPPET_DRAFT_ID).catch(() => {})
	}, [deleteDraft, hasNewSnippetDraft, isEditing, isNewSnippetAtDefaultValues])
	const isSnippetListLoading = isLibraryLoading
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
	const snippetSearchTerm = snippetSearch.trim().toLowerCase()
	const snippetItems = useMemo<SnippetExplorerItem[]>(() => {
		const sorted = [...editableSnippets].sort(
			(left, right) =>
				new Date(right.metadata.updatedAt).getTime() - new Date(left.metadata.updatedAt).getTime(),
		)
		const items = sorted.map((asset) => ({
			id: asset.id,
			title: asset.metadata.title?.trim() || "Untitled snippet",
			description: asset.metadata.description ?? null,
			scope: asset.scope.scope,
			updatedLabel: new Date(asset.metadata.updatedAt).toLocaleDateString(),
			hasDraft: draftIds.has(asset.id),
		}))
		if (!snippetSearchTerm) return items
		return items.filter((item) => {
			const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase()
			return haystack.includes(snippetSearchTerm)
		})
	}, [draftIds, editableSnippets, snippetSearchTerm])
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
	const isImportAssetsFileActive =
		isComponentEditorActive && activeComponentFileName === IMPORT_ASSET_FILE_NAME
	const shouldComputeImportsIndex =
		importsOpen ||
		importsGalleryOpen ||
		isImportAssetsFileActive ||
		Boolean(importAssetRemoveConfirm)
	const importsIndex = useSnippetImportsIndex(deferredParsedFiles, {
		enabled: shouldComputeImportsIndex,
	})
	const componentCount = componentExports.length
	const overSoftComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.soft
	const overHardComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.hard
	const canAddComponent = componentCount < SNIPPET_COMPONENT_LIMITS.hard
	const resolvedEntryExport = activeComponentExport || DEFAULT_SNIPPET_EXPORT
	const previewTreeFileId = componentDefinitionMap[resolvedEntryExport] ?? "source"
	const previewTreeFileName = isComponentFileId(previewTreeFileId)
		? getComponentFileName(previewTreeFileId)
		: null
	const previewTreeSource =
		previewTreeFileId === "source"
			? mainEditorSource
			: previewTreeFileName
				? (parsedFiles.files[previewTreeFileName] ?? "")
				: ""
	const { tree: componentTree, resolvePreviewSource: resolvePreviewSourceForTree } =
		useSnippetComponentTree({
			entryExport: resolvedEntryExport,
			fileId: previewTreeFileId,
			fileName: previewTreeFileName,
			fileSource: previewTreeSource,
			mainSource: parsedFiles.mainSource,
			files: parsedFiles.files,
			lineMapSegments,
			enabled: componentTreeOpen,
		})
	const previewTreeLabel = previewTreeFileName ?? "Snippet.tsx"
	const componentTreeSelectionMap = useMemo(() => {
		if (!componentTreeOpen) return null
		const byKey = new Map<string, string>()
		const byLine = new Map<string, string>()
		const visit = (node: SnippetComponentTreeNode) => {
			const previewSource = resolvePreviewSourceForTree(node)
			if (previewSource) {
				const key = getPreviewSourceKey(previewSource)
				if (key && !byKey.has(key)) {
					byKey.set(key, node.id)
				}
				const lineKey = getPreviewSourceLineKey(previewSource)
				if (lineKey && !byLine.has(lineKey)) {
					byLine.set(lineKey, node.id)
				}
			}
			for (const child of node.children) {
				visit(child)
			}
		}
		for (const node of componentTree) {
			visit(node)
		}
		return { byKey, byLine }
	}, [componentTree, componentTreeOpen, resolvePreviewSourceForTree])
	const resolveTreeSelectionId = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!componentTreeSelectionMap || !source) return null
			const key = getPreviewSourceKey(source)
			if (key) {
				const direct = componentTreeSelectionMap.byKey.get(key)
				if (direct) return direct
			}
			const lineKey = getPreviewSourceLineKey(source)
			return lineKey ? (componentTreeSelectionMap.byLine.get(lineKey) ?? null) : null
		},
		[componentTreeSelectionMap],
	)
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
					return true
				}
				return false
			}

			if (!isComponentFileId(fileId)) return false
			const fileName = getComponentFileName(fileId)
			if (!fileName) return false
			const nextFiles = { ...parsed.files, [fileName]: sanitizedValue }
			const nextMain = syncImportBlock(parsed.mainSource, Object.keys(nextFiles))
			const nextSource = serializeSnippetFiles(nextMain, nextFiles)
			if (nextSource !== currentSource) {
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
				commitHistoryNow(label, nextSource)
				return true
			}
			return false
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
	const importAssetsPreviewDimensions = useMemo(() => getImportAssetsPreviewDimensions(), [])
	const examplePreviewDimensions = activeExample?.viewport ?? DEFAULT_PREVIEW_DIMENSIONS
	const examplePreviewProps = useMemo(() => activeExample?.previewProps ?? {}, [activeExample])
	const exampleSource = activeExample?.source ?? ""
	const { analysis: exampleAnalysis } = useSnippetAnalysis({
		source: isExamplePreviewActive ? exampleSource : "",
		includeTailwind: isExamplePreviewActive,
		debounceMs: 300,
		key: "snippet-analyze-example",
	})
	const importAssetsFileSource = parsedFiles.files[IMPORT_ASSET_FILE_NAME] ?? ""
	const importAssetsPreviewSource = useMemo(() => {
		if (!isImportAssetsFileActive) return ""
		return buildImportAssetsPreviewSource(importAssetsFileSource)
	}, [importAssetsFileSource, isImportAssetsFileActive])
	const { analysis: importAssetsPreviewAnalysis } = useSnippetAnalysis({
		source: isImportAssetsFileActive ? importAssetsPreviewSource : "",
		includeTailwind: isImportAssetsFileActive,
		includeInspect: false,
		debounceMs: 200,
		key: "snippet-analyze-import-assets-preview",
	})

	useEffect(() => {
		loadLibrary()
	}, [loadLibrary])

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

	const { autoCompile, handleSnippetSelect, cancelPendingSelection, resetNewSnippet } =
		useSnippetSelection({
			isEditing,
			editAssetId,
			isLibraryLoading,
			assetsLength: assets.length,
			editableSnippetById,
			currentDraftId,
			defaultSnippetValues,
			watchedSource,
			form,
			activeComponentExport,
			openFiles,
			activeFile,
			selectedTemplateId,
			setActiveComponentExport,
			setOpenFiles,
			setActiveFile,
			setSelectedTemplateId,
			setIsExamplePreviewActive,
			resetAutoOpenComponents,
			resetComponentExports,
			resetAnalysis,
			resetHistory,
			fileMigrationRef,
			templateAppliedRef,
			loadDraft,
			saveDraft,
			setError,
			navigate,
			setComponentTreeSelectedId,
			setComponentTreeSelection,
			setComponentTreeSelectionToken,
		})

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
		autoCompile,
		enableTailwindCss: true,
		analysis,
		engineKey: "snippet-compile-main",
		resetKey: currentDraftId,
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
	const { compiledCode: importAssetsCompiledCode, tailwindCss: importAssetsTailwindCss } =
		useSnippetCompiler({
			source: isImportAssetsFileActive ? importAssetsPreviewSource : "",
			defaultProps: {},
			debounceMs: 200,
			autoCompile: isImportAssetsFileActive,
			enableTailwindCss: isImportAssetsFileActive,
			analysis: importAssetsPreviewAnalysis,
			engineKey: "snippet-compile-import-assets-preview",
		})
	const {
		inspectMode,
		setInspectMode,
		inspectEnabled,
		inspectHighlight,
		onPreviewInspectHover,
		onPreviewInspectSelect,
		onPreviewInspectContext,
		resolvePreviewSource: resolvePreviewSourceForInspect,
	} = useSnippetInspect({
		mainSource: parsedFiles.mainSource,
		mainEditorSource,
		componentFiles: parsedFiles.files,
		activeFile,
		isExamplePreviewActive,
		onOpenFileForInspect: openFileForInspect,
		inspectIndexByFileId: analysis?.inspectIndexByFileId,
		lineMapSegments,
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
		handlePreviewInspectSelect: handlePreviewInspectSelectInternal,
		handleInspectContext,
		handleInspectEscape,
		handleLayoutCommit,
	} = useSnippetInspectText({
		getSourceForFile,
		updateSourceForFile,
		applyLayoutSourceForFile,
		resolvePreviewSource: resolvePreviewSourceForInspect,
		onPreviewInspectSelect,
		onPreviewInspectContext,
		layoutMode,
		isExamplePreviewActive,
		inspectEnabled,
	})

	const setSnippetSource = useCallback(
		(nextSource: string) => {
			form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
		},
		[form],
	)

	const getLatestImportsIndex = useCallback(() => {
		const currentSource = (form.getValues("source") as string | undefined) ?? ""
		return buildSnippetImportsIndex(parseSnippetFiles(currentSource))
	}, [form])

	const importDnd = useSnippetImportDnd({
		enabled:
			Boolean(compiledCode) && !isExamplePreviewActive && !layoutMode && !isImportAssetsFileActive,
		form,
		setSource: setSnippetSource,
		commitHistoryNow,
		previewContainerRef,
		resolvePreviewSource: resolvePreviewSourceForInspect,
	})
	const isImportAssetMutating = isImportAssetImporting || isImportAssetRemoving
	const { handleImportAssetAdd } = useSnippetImportAssetsAdd({ form, commitHistoryNow })
	const { handleImportAssetRemove } = useSnippetImportAssetsRemove({ form, commitHistoryNow })
	const removeImportAsset = useCallback(
		async (assetId: ImportAssetId) => {
			if (importAssetMutationRef.current) return
			importAssetMutationRef.current = true
			setIsImportAssetRemoving(true)
			try {
				await handleImportAssetRemove(assetId)
			} finally {
				setIsImportAssetRemoving(false)
				importAssetMutationRef.current = false
			}
		},
		[handleImportAssetRemove],
	)
	const requestImportAssetRemove = useCallback(
		(assetId: ImportAssetId) => {
			if (importAssetMutationRef.current || isImportAssetMutating) return
			cancelPendingSelection({ preserveDraftAutosave: true })
			const removalIds = getImportAssetRemovalIds(assetId)
			const latestImportsIndex = getLatestImportsIndex()
			const usedIds = removalIds.filter((id) => latestImportsIndex.importAssetsById.get(id)?.used)
			if (usedIds.length > 0) {
				setImportAssetRemoveConfirm({ assetId, removalIds, usedIds })
				return
			}
			void removeImportAsset(assetId)
		},
		[cancelPendingSelection, getLatestImportsIndex, isImportAssetMutating, removeImportAsset],
	)
	const requestImportAssetAdd = useCallback(
		async (assetId: ImportAssetId) => {
			if (importAssetMutationRef.current || isImportAssetMutating) return
			const latestImportsIndex = getLatestImportsIndex()
			if (latestImportsIndex.importAssetsById.get(assetId)?.imported) return
			cancelPendingSelection({ preserveDraftAutosave: true })
			importAssetMutationRef.current = true
			setIsImportAssetImporting(true)
			try {
				await handleImportAssetAdd(assetId)
			} finally {
				setIsImportAssetImporting(false)
				importAssetMutationRef.current = false
			}
		},
		[cancelPendingSelection, getLatestImportsIndex, handleImportAssetAdd, isImportAssetMutating],
	)
	const handlePreviewImportAssetRemove = useCallback(
		(assetId: string) => {
			const asset = getImportAsset(assetId as ImportAssetId)
			if (!asset) return
			requestImportAssetRemove(asset.id)
		},
		[requestImportAssetRemove],
	)
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

	const handleSnippetSearchChange = useCallback((value: string) => {
		setSnippetSearch(value)
	}, [])

	const handleResetNewSnippet = useCallback(async () => {
		cancelPendingSelection()
		await deleteDraft(NEW_SNIPPET_DRAFT_ID)
		if (!isEditing) {
			resetNewSnippet()
			return
		}
		handleSnippetSelect(null)
	}, [cancelPendingSelection, deleteDraft, handleSnippetSelect, isEditing, resetNewSnippet])

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
		templateAppliedRef.current = true
		if (isEditing) return

		const templateParam = search.template
		if (!templateParam || !Object.hasOwn(SNIPPET_TEMPLATES, templateParam)) return

		const currentSource = (form.getValues("source") as string | undefined) ?? ""
		const defaultSource = defaultSnippetValues.source ?? ""
		if (normalizeNewlines(currentSource) !== normalizeNewlines(defaultSource)) {
			return
		}

		const templateId = templateParam as SnippetTemplateId
		setSelectedTemplateId(templateId)
		applySnippetTemplate(templateId, { markDirty: false })
	}, [applySnippetTemplate, defaultSnippetValues.source, form, isEditing, search.template])
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
		onSuccess: () => {
			void deleteDraft(currentDraftId)
		},
	})

	const isExamplePreviewing = Boolean(isExamplePreviewActive && activeExample)
	const isImportsPreviewing = Boolean(isImportAssetsFileActive)
	const previewMode = isExamplePreviewing ? "example" : isImportsPreviewing ? "imports" : "snippet"
	const previewCompiledCode =
		previewMode === "example"
			? exampleCompiledCode
			: previewMode === "imports"
				? importAssetsCompiledCode
				: compiledCode
	const previewPropsToUse =
		previewMode === "example" ? examplePreviewProps : previewMode === "imports" ? {} : previewProps
	const previewTailwindCss =
		previewMode === "example"
			? exampleTailwindCss
			: previewMode === "imports"
				? importAssetsTailwindCss
				: tailwindCss
	const previewDimensionsToUse =
		previewMode === "example"
			? examplePreviewDimensions
			: previewMode === "imports"
				? importAssetsPreviewDimensions
				: snippetPreviewDimensions
	const previewFitMode = previewMode === "imports" ? "width" : "contain"
	const previewCameraAvailable = previewMode !== "imports"
	const [previewCameraEnabled, setPreviewCameraEnabled] = useState(false)
	const [previewCameraResetToken, setPreviewCameraResetToken] = useState(0)
	const [isPreviewHovering, setIsPreviewHovering] = useState(false)

	usePreviewCameraHotkey({
		enabled: previewCameraEnabled,
		setEnabled: setPreviewCameraEnabled,
		scopeEnabled: previewCameraAvailable && isPreviewHovering,
	})

	useEffect(() => {
		if (!previewCameraAvailable && previewCameraEnabled) {
			setPreviewCameraEnabled(false)
		}
	}, [previewCameraAvailable, previewCameraEnabled])

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
	const previewHeaderActions =
		previewMode === "imports" ? (
			<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
				Imports · Assets
			</span>
		) : (
			<SnippetPreviewHeaderActions
				isExamplePreviewing={isExamplePreviewing}
				activeExampleTitle={activeExample?.title}
				onExitExamplePreview={() => setIsExamplePreviewActive(false)}
				cameraEnabled={previewCameraEnabled}
				onToggleCamera={() => setPreviewCameraEnabled((prev) => !prev)}
				onResetCamera={() => setPreviewCameraResetToken((prev) => prev + 1)}
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
	const isPreviewSelectable = Boolean(previewCompiledCode) && previewMode === "snippet"
	const handleComponentTreeSelect = useCallback(
		(node: SnippetComponentTreeNode) => {
			if (!isPreviewSelectable) return
			const targetNode = findSelectableTreeNode(node)
			if (!targetNode) return
			const source = resolvePreviewSourceForTree(targetNode)
			if (!source) return
			setInspectMode(true)
			setComponentTreeSelectedId(targetNode.id)
			setComponentTreeSelection(source)
			setComponentTreeSelectionToken((prev) => prev + 1)
		},
		[isPreviewSelectable, resolvePreviewSourceForTree, setInspectMode],
	)
	const inspectEditorLabel = inspectTextEdit
		? inspectTextEdit.fileId === "source"
			? "Snippet.tsx"
			: (getComponentFileName(inspectTextEdit.fileId) ?? "Component")
		: undefined
	const handlePreviewInspectSelect = useCallback(
		(
			source: PreviewSourceLocation | null,
			meta?: {
				reason?: "reset"
			},
		) => {
			handlePreviewInspectSelectInternal(source, meta)
			if (!componentTreeOpen) return
			if (!source && meta?.reason === "reset") {
				setComponentTreeSelectedId(null)
				return
			}
			const nextSelected = resolveTreeSelectionId(source)
			if (nextSelected) {
				setComponentTreeSelectedId(nextSelected)
			}
		},
		[componentTreeOpen, handlePreviewInspectSelectInternal, resolveTreeSelectionId],
	)
	const { onResizeStart } = useSnippetSplitView({
		containerRef: splitContainerRef,
		editorRef: editorPanelRef,
		editorCollapsed,
		explorerCollapsed,
	})

	const handleImportSnippetInternal = useSnippetImportSnippet({
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
	})
	const handleImportSnippet = useCallback(
		(value: string) => {
			templateAppliedRef.current = true
			cancelPendingSelection({ preserveDraftAutosave: true })
			return handleImportSnippetInternal(value)
		},
		[cancelPendingSelection, handleImportSnippetInternal],
	)

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
					<SnippetImportDndOverlay drag={importDnd.dragOverlay} />
					<SnippetHeader
						canSubmit={canSubmit}
						isSubmitting={isSubmitting}
						isEditing={isEditing}
						onSubmit={form.handleSubmit(handleSubmit)}
						onOpenSnippetSwitcher={() => setSnippetSwitcherOpen(true)}
						onOpenImportDialog={() => setImportDialogOpen(true)}
					/>
					<SnippetSwitcherDialog
						open={snippetSwitcherOpen}
						onOpenChange={setSnippetSwitcherOpen}
						snippetItems={snippetItems}
						activeSnippetId={editAssetId}
						hasNewSnippetDraft={hasNewSnippetDraft}
						canResetNewSnippet={canResetNewSnippet}
						snippetSearch={snippetSearch}
						onSnippetSearchChange={handleSnippetSearchChange}
						onSelectSnippet={handleSnippetSelect}
						onResetNewSnippet={handleResetNewSnippet}
						isSnippetListLoading={isSnippetListLoading}
					/>
					<SnippetImportDialog
						open={importDialogOpen}
						onOpenChange={setImportDialogOpen}
						onImport={handleImportSnippet}
					/>
					{importsGalleryOpen ? (
						<Suspense fallback={null}>
							<LazySnippetImportsGalleryDialog
								open={importsGalleryOpen}
								onOpenChange={setImportsGalleryOpen}
								importsIndex={importsIndex}
								libraryAssets={assets}
								tagNameById={tagNameById}
								isLibraryLoading={isLibraryLoading}
								isImportingImportAsset={isImportAssetImporting}
								isRemovingImportAsset={isImportAssetRemoving}
								onRequestImportImportAsset={requestImportAssetAdd}
								onRequestRemoveImportAsset={requestImportAssetRemove}
							/>
						</Suspense>
					) : null}

					<Dialog
						open={Boolean(importAssetRemoveConfirm)}
						onOpenChange={(next) => {
							if (importAssetMutationRef.current || isImportAssetMutating) return
							if (!next) setImportAssetRemoveConfirm(null)
						}}
					>
						<DialogContent className="max-w-lg">
							<DialogHeader>
								<DialogTitle>Remove imported assets?</DialogTitle>
								<DialogDescription>
									These assets are currently used by your snippet. Removing them will also remove
									their usages from the source.
								</DialogDescription>
							</DialogHeader>
							{importAssetRemoveConfirm ? (
								<div className="space-y-2">
									{importAssetRemoveConfirm.removalIds.map((id) => {
										const label = getImportAsset(id)?.label ?? id
										const isUsed = importAssetRemoveConfirm.usedIds.includes(id)
										return (
											<div
												key={id}
												className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
											>
												<span className="font-medium text-neutral-900">{label}</span>
												{isUsed ? (
													<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
														In use
													</span>
												) : (
													<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
														Imported
													</span>
												)}
											</div>
										)
									})}
								</div>
							) : null}
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setImportAssetRemoveConfirm(null)}
									disabled={isImportAssetMutating}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={async () => {
										if (!importAssetRemoveConfirm) return
										const assetId = importAssetRemoveConfirm.assetId
										await removeImportAsset(assetId)
										setImportAssetRemoveConfirm(null)
									}}
									disabled={isImportAssetMutating}
								>
									{isImportAssetRemoving ? "Removing…" : "Remove assets"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

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

							<SnippetImportsPanel
								open={importsOpen}
								filters={importsFilters}
								importsIndex={importsIndex}
								onAssetPointerDown={importDnd.handleAssetPointerDown}
								isRemovingImportAsset={isImportAssetMutating}
								onRequestRemoveImportAsset={requestImportAssetRemove}
								onOpenGallery={() => {
									cancelPendingSelection({ preserveDraftAutosave: true })
									setImportsGalleryOpen(true)
								}}
							/>

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
									deferExternalUpdatesWhileFocused={!layoutMode}
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
									<div className="flex h-full w-full overflow-hidden">
										{componentTreeOpen ? (
											<>
												<SnippetComponentTreePanel
													fileLabel={previewTreeLabel}
													tree={componentTree}
													width={componentTreeWidth}
													selectedId={componentTreeSelectedId}
													selectionEnabled={isPreviewSelectable}
													onSelectNode={handleComponentTreeSelect}
													onClose={() => setComponentTreeOpen(false)}
												/>
												<SnippetComponentTreeResizer onPointerDown={onComponentTreeResizeStart} />
											</>
										) : (
											<button
												type="button"
												onClick={() => setComponentTreeOpen(true)}
												className="group flex w-7 shrink-0 flex-col items-center justify-center border-r border-neutral-200 bg-neutral-50 text-neutral-400 hover:text-neutral-600"
												aria-label="Show component tree"
												title="Show component tree"
											>
												<ChevronRight className="h-4 w-4" />
											</button>
										)}
										<div className="relative flex min-w-0 flex-1 flex-col">
											<SnippetPreview
												compiledCode={previewCompiledCode}
												props={previewPropsToUse}
												tailwindCss={previewTailwindCss}
												dimensions={previewDimensionsToUse}
												fitMode={previewFitMode}
												className="h-full"
												headerActions={previewHeaderActions}
												cameraAvailable={previewCameraAvailable}
												cameraEnabled={previewCameraAvailable && previewCameraEnabled}
												cameraResetToken={previewCameraResetToken}
												onCameraHoverChange={setIsPreviewHovering}
												inspectEnabled={previewMode === "imports" ? false : inspectEnabled}
												onInspectHover={
													previewMode === "imports" ? undefined : onPreviewInspectHover
												}
												onInspectSelect={
													previewMode === "imports" ? undefined : handlePreviewInspectSelect
												}
												onInspectContext={
													previewMode === "imports" ? undefined : handleInspectContext
												}
												onInspectEscape={
													previewMode === "imports" ? undefined : handleInspectEscape
												}
												inspectSelectionRequest={
													previewMode === "imports" ? null : componentTreeSelection
												}
												inspectSelectionRequestToken={
													previewMode === "imports" ? 0 : componentTreeSelectionToken
												}
												layoutEnabled={
													previewMode === "snippet" && layoutMode && !isExamplePreviewing
												}
												layoutDebugEnabled={
													previewMode === "snippet" &&
													layoutDebugEnabled &&
													layoutMode &&
													!isExamplePreviewing
												}
												layoutSnapEnabled={layoutSnapEnabled}
												layoutSnapGrid={layoutSnapGrid}
												onLayoutCommit={handleLayoutCommit}
												onImportAssetRemove={
													previewMode === "imports" ? handlePreviewImportAssetRemove : undefined
												}
												layersEnabled={previewMode === "imports" ? false : layers3dOpen}
												layersRequestToken={layersRequestToken}
												onLayersSnapshot={handleLayersSnapshot}
												onLayersError={handleLayersError}
											/>
											{layers3dOpen && previewMode !== "imports" && (
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
									</div>
								</div>
							</section>
						</form>
					</Form>
				</div>
			)}
		</ClientOnly>
	)
}
