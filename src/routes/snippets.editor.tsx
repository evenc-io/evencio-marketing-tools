import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FileCode } from "lucide-react"
import { nanoid } from "nanoid"
import {
	type ChangeEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { Form } from "@/components/ui/form"
import { useScreenGuard } from "@/lib/screen-guard"
import {
	DEFAULT_SNIPPET_EXPORT,
	listSnippetComponentExports,
	parseSnippetFiles,
	removeSnippetComponentExport,
	serializeSnippetFiles,
	useSnippetCompiler,
} from "@/lib/snippets"
import {
	clampSnippetViewport,
	SNIPPET_COMPONENT_LIMITS,
	SNIPPET_SOURCE_MAX_CHARS,
} from "@/lib/snippets/constraints"
import { SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	type PreviewSourceLocation,
} from "@/lib/snippets/preview-runtime"
import { SNIPPET_TEMPLATES, type SnippetTemplateId } from "@/lib/snippets/templates"
import { SnippetDetailsPanel } from "@/routes/-snippets/new/components/details-panel"
import { SnippetEditorPanel } from "@/routes/-snippets/new/components/editor-panel"
import { SnippetExamplesPanel } from "@/routes/-snippets/new/components/examples-panel"
import { SnippetImportsPanel } from "@/routes/-snippets/new/components/imports-panel"
import { PanelRail } from "@/routes/-snippets/new/components/panel-rail"
import { SnippetPreviewHeaderActions } from "@/routes/-snippets/new/components/preview-header-actions"
import { SnippetFileOverlays } from "@/routes/-snippets/new/components/snippet-file-overlays"
import { SnippetHeader } from "@/routes/-snippets/new/components/snippet-header"
import {
	type InspectContextMenuState,
	type InspectTextEditState,
	SnippetInspectOverlays,
} from "@/routes/-snippets/new/components/snippet-inspect-overlays"
import { SnippetScreenGuard } from "@/routes/-snippets/new/components/snippet-screen-guard"
import { SnippetSplitViewResizer } from "@/routes/-snippets/new/components/split-view-resizer"
import {
	CUSTOM_PRESET_ID,
	DEFAULT_DEFAULT_PROPS,
	DEFAULT_PROPS_SCHEMA,
	type ExampleFilterId,
	SNIPPET_FILES,
	STARTER_SOURCE,
} from "@/routes/-snippets/new/constants"
import { useDerivedSnippetProps } from "@/routes/-snippets/new/hooks/use-derived-snippet-props"
import { useSnippetComponentExports } from "@/routes/-snippets/new/hooks/use-snippet-component-exports"
import { useSnippetFilters } from "@/routes/-snippets/new/hooks/use-snippet-filters"
import { useSnippetInspect } from "@/routes/-snippets/new/hooks/use-snippet-inspect"
import { useSnippetPanels } from "@/routes/-snippets/new/hooks/use-snippet-panels"
import { useSnippetSplitView } from "@/routes/-snippets/new/hooks/use-snippet-split-view"
import {
	type CustomSnippetValues,
	customSnippetSchema,
	parseTagInput,
} from "@/routes/-snippets/new/schema"
import {
	buildSnippetAttribution,
	buildSnippetLicense,
} from "@/routes/-snippets/new/snippet-asset-builders"
import type {
	SnippetEditorFile,
	SnippetEditorFileId,
} from "@/routes/-snippets/new/snippet-editor-types"
import {
	extractNamedExports,
	extractPrimaryNamedExport,
	getComponentExportName,
	getComponentFileName,
	getExportNameFromFile,
	isComponentFileId,
	stripAutoImportBlock,
	stripSnippetFileDirectives,
	syncImportBlock,
	toComponentFileId,
} from "@/routes/-snippets/new/snippet-file-utils"
import {
	buildSnippetTextLiteral,
	getSnippetTextRangeValue,
	replaceSnippetTextRange,
	type SnippetTextRange,
} from "@/routes/-snippets/new/snippet-inspect-utils"
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
	const contextMenuStampRef = useRef<number | null>(null)
	const autoOpenComponentsRef = useRef(false)
	const fileMigrationRef = useRef(false)
	const editAppliedRef = useRef<string | null>(null)
	const suppressComponentSyncRef = useRef(false)
	const inspectTextEditRef = useRef<HTMLDivElement>(null)
	const inspectTextEditStateRef = useRef<InspectTextEditState | null>(null)
	const inspectTextCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const inspectTextPendingValueRef = useRef<string | null>(null)
	const inspectContextMenuRef = useRef<HTMLDivElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [useComponentDefaults, setUseComponentDefaults] = useState(false)
	const [inspectTextEdit, setInspectTextEdit] = useState<InspectTextEditState | null>(null)
	const [openFiles, setOpenFiles] = useState<SnippetEditorFileId[]>(() =>
		SNIPPET_FILES.map((file) => file.id),
	)
	const [activeFile, setActiveFile] = useState<SnippetEditorFileId>("source")
	const [activeComponentExport, setActiveComponentExport] = useState(DEFAULT_SNIPPET_EXPORT)
	const [selectedTemplateId, setSelectedTemplateId] = useState<SnippetTemplateId>("single")
	const [fileContextMenu, setFileContextMenu] = useState<{
		open: boolean
		x: number
		y: number
		fileId: SnippetEditorFileId | null
	}>({
		open: false,
		x: 0,
		y: 0,
		fileId: null,
	})
	const [inspectContextMenu, setInspectContextMenu] = useState<InspectContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		label: "Snippet text",
		editable: false,
		request: null,
	})
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
		isFocusPanelOpen,
		toggleExamplesPanel,
		toggleImportsPanel,
	} = useSnippetPanels()
	const [activeExampleId, setActiveExampleId] = useState(() => SNIPPET_EXAMPLES[0]?.id ?? "")
	const [isExamplePreviewActive, setIsExamplePreviewActive] = useState(false)
	const { exampleFilters, importsFilters, handleExampleFilterClick, handleImportsFilterClick } =
		useSnippetFilters()
	const splitContainerRef = useRef<HTMLDivElement>(null)
	const editorPanelRef = useRef<HTMLDivElement>(null)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const [isPreviewVisible, setIsPreviewVisible] = useState(true)
	const screenGate = useScreenGuard()
	const form = useForm<CustomSnippetValues>({
		resolver: zodResolver(customSnippetSchema),
		mode: "onChange",
		defaultValues: {
			title: "",
			description: "",
			tags: "",
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
	const { componentExports, resetComponentExports } = useSnippetComponentExports({
		source: watchedSource,
		form,
		fileMigrationRef,
	})
	const derivedProps = useDerivedSnippetProps({ source: watchedSource, form })
	const parsedFiles = useMemo(() => parseSnippetFiles(watchedSource), [watchedSource])
	const componentFileNames = useMemo(
		() => Object.keys(parsedFiles.files).sort((a, b) => a.localeCompare(b)),
		[parsedFiles.files],
	)

	const assets = useAssetLibraryStore((state) => state.assets)
	const tags = useAssetLibraryStore((state) => state.tags)
	const isLibraryLoading = useAssetLibraryStore((state) => state.isLoading)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const registerCustomSnippetAsset = useAssetLibraryStore(
		(state) => state.registerCustomSnippetAsset,
	)
	const updateCustomSnippetAsset = useAssetLibraryStore((state) => state.updateCustomSnippetAsset)
	const tagHints = useMemo(() => tags.map((tag) => tag.name), [tags])
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
		if (!editAsset) return ""
		return editAsset.metadata.tags.map((tagId) => tagNameById.get(tagId) ?? tagId).join(", ")
	}, [editAsset, tagNameById])
	const mainComponentLabel = useMemo(() => {
		const defaultExport = componentExports.find((component) => component.isDefault)
		if (!defaultExport) return "Main component"
		if (defaultExport.label.length > 36) return "Main component"
		return defaultExport.label
	}, [componentExports])
	const editorFiles = useMemo<SnippetEditorFile[]>(() => {
		const mainFile = SNIPPET_FILES.find((file) => file.id === "source")
		const jsonFiles = SNIPPET_FILES.filter((file) => file.id !== "source")
		const staticFiles: SnippetEditorFile[] = [
			...(mainFile
				? [
						{
							id: mainFile.id,
							label: mainFile.label,
							description: mainComponentLabel,
							kind: mainFile.id,
							icon: mainFile.icon,
							deletable: false,
						},
					]
				: []),
		]

		const componentFiles: SnippetEditorFile[] = componentFileNames.map((fileName) => {
			const exportName = getExportNameFromFile(fileName)
			return {
				id: toComponentFileId(fileName),
				label: fileName,
				description: "Component file",
				kind: "component",
				icon: FileCode,
				exportName,
				fileName,
				deletable: true,
			}
		})

		return [
			...staticFiles,
			...componentFiles,
			...jsonFiles.map((file) => ({
				id: file.id,
				label: file.label,
				description: file.description,
				kind: file.id,
				icon: file.icon,
				deletable: false,
			})),
		]
	}, [componentFileNames, mainComponentLabel])
	const editorFilesById = useMemo(
		() => new Map(editorFiles.map((file) => [file.id, file])),
		[editorFiles],
	)
	const componentCount = componentExports.length
	const overSoftComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.soft
	const overHardComponentLimit = componentCount > SNIPPET_COMPONENT_LIMITS.hard
	const canAddComponent = componentCount < SNIPPET_COMPONENT_LIMITS.hard
	const activeComponent = useMemo(
		() => componentExports.find((component) => component.exportName === activeComponentExport),
		[activeComponentExport, componentExports],
	)
	const resolvedEntryExport = activeComponentExport || DEFAULT_SNIPPET_EXPORT
	const activeComponentLabel =
		activeComponent?.label ??
		(resolvedEntryExport === DEFAULT_SNIPPET_EXPORT ? "Default export" : activeComponentExport)
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
	const isSourceEditorActive = activeFile === "source"
	const isComponentEditorActive = isComponentFileId(activeFile)
	const isPropsSchemaActive = activeFile === "propsSchema"
	const isDefaultPropsActive = activeFile === "defaultProps"
	const mainSource = parsedFiles.mainSource
	const mainEditorSource = useMemo(() => stripAutoImportBlock(mainSource), [mainSource])
	const componentFiles = parsedFiles.files
	const getSourceForFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			if (fileId === "source") return mainEditorSource
			if (!isComponentFileId(fileId)) return ""
			const fileName = getComponentFileName(fileId)
			if (!fileName) return ""
			return componentFiles[fileName] ?? ""
		},
		[componentFiles, mainEditorSource],
	)
	const activeComponentFileName = isComponentFileId(activeFile)
		? getComponentFileName(activeFile)
		: null
	const hasActiveComponentFile = activeComponentFileName
		? Object.hasOwn(componentFiles, activeComponentFileName)
		: false
	const activeComponentSource =
		activeComponentFileName && hasActiveComponentFile
			? (componentFiles[activeComponentFileName] ?? "")
			: ""
	const componentTypeLibs = useMemo(() => {
		const libs: Array<{ content: string; filePath: string }> = []
		for (const [fileName, fileSource] of Object.entries(componentFiles)) {
			const exportNames = extractNamedExports(fileSource)
			if (exportNames.length === 0) continue
			const declarations = exportNames
				.map((name) => `declare const ${name}: (props: any) => JSX.Element;`)
				.join("\n")
			libs.push({
				filePath: `file:///snippets/components/${fileName}.d.ts`,
				content: declarations,
			})
		}
		return libs
	}, [componentFiles])
	const componentDefinitionMap = useMemo(() => {
		const map: Record<string, SnippetEditorFileId> = {}
		for (const [fileName, fileSource] of Object.entries(componentFiles)) {
			const exportNames = extractNamedExports(fileSource)
			if (exportNames.length === 0) continue
			const fileId = toComponentFileId(fileName)
			for (const name of exportNames) {
				if (!map[name]) {
					map[name] = fileId
				}
			}
		}
		return map
	}, [componentFiles])
	const activeFileMeta = editorFilesById.get(activeFile) ?? null
	const contextMenuFile = fileContextMenu.fileId
		? (editorFilesById.get(fileContextMenu.fileId) ?? null)
		: null
	const canCloseContextTab = contextMenuFile
		? openFiles.includes(contextMenuFile.id) && openFiles.length > 1
		: false
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
		autoOpenComponentsRef.current = false
		fileMigrationRef.current = false
		resetComponentExports()
		form.reset(
			{
				title: editAsset.metadata.title ?? "",
				description: editAsset.metadata.description ?? "",
				tags: editTagNames,
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
		setOpenFiles(SNIPPET_FILES.map((file) => file.id))
		setActiveFile("source")
		setActiveComponentExport(editAsset.snippet.entryExport ?? DEFAULT_SNIPPET_EXPORT)
		setIsExamplePreviewActive(false)
		editAppliedRef.current = editAsset.id
	}, [editAsset, editTagNames, form, isEditing, isLibraryLoading, resetComponentExports])

	useEffect(() => {
		const element = previewContainerRef.current
		if (!element || typeof IntersectionObserver === "undefined") return

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (!entry) return
				setIsPreviewVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2)
			},
			{ threshold: [0, 0.2, 0.6, 1] },
		)

		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!examplesOpen) {
			setIsExamplePreviewActive(false)
		}
	}, [examplesOpen])

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

	useEffect(() => {
		const hasActiveExport = componentExports.some(
			(component) => component.exportName === activeComponentExport,
		)
		const hasActiveFile = componentFileNames.some(
			(fileName) => getExportNameFromFile(fileName) === activeComponentExport,
		)
		if (hasActiveExport || hasActiveFile) return
		if (componentExports.length === 0) {
			return
		}
		const fallback =
			componentExports.find((component) => component.isDefault) ?? componentExports[0]
		if (fallback) {
			setActiveComponentExport(fallback.exportName)
		}
	}, [activeComponentExport, componentExports, componentFileNames])

	useEffect(() => {
		if (!isComponentFileId(activeFile)) return
		if (suppressComponentSyncRef.current) {
			suppressComponentSyncRef.current = false
			return
		}
		const exportName = getComponentExportName(activeFile)
		if (exportName && exportName !== activeComponentExport) {
			setActiveComponentExport(exportName)
		}
	}, [activeComponentExport, activeFile])

	useEffect(() => {
		const validIds = new Set(editorFiles.map((file) => file.id))
		setOpenFiles((prev) => {
			const next = prev.filter((fileId) => validIds.has(fileId))
			if (next.length === 0) return ["source"]
			return next.length === prev.length ? prev : next
		})
		if (!validIds.has(activeFile)) {
			setActiveFile("source")
			setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
		}
	}, [activeFile, editorFiles])

	useEffect(() => {
		if (autoOpenComponentsRef.current) return
		if (selectedTemplateId !== "multi") return
		const componentIds = componentFileNames.map((fileName) => toComponentFileId(fileName))
		if (componentIds.length === 0) return
		setOpenFiles((prev) => {
			const next = [...prev]
			for (const fileId of componentIds) {
				if (!next.includes(fileId)) {
					next.push(fileId)
				}
			}
			return next
		})
		autoOpenComponentsRef.current = true
	}, [componentFileNames, selectedTemplateId])

	// Compile snippet for preview
	const {
		status: compileStatus,
		compiledCode,
		tailwindCss,
		monacoMarkers,
		parsedProps,
		errors: compileErrors,
		compile,
	} = useSnippetCompiler({
		source: watchedSource,
		defaultProps: derivedProps.defaultProps,
		entryExport: resolvedEntryExport,
		debounceMs: 500,
		enableTailwindCss: isPreviewVisible,
	})
	const emptyPreviewProps = useMemo(() => ({}), [])
	const previewProps = useMemo(
		() => (useComponentDefaults ? emptyPreviewProps : parsedProps),
		[emptyPreviewProps, parsedProps, useComponentDefaults],
	)
	const {
		status: exampleCompileStatus,
		compiledCode: exampleCompiledCode,
		tailwindCss: exampleTailwindCss,
		compile: compileExample,
	} = useSnippetCompiler({
		source: exampleSource,
		defaultProps: examplePreviewProps,
		debounceMs: 300,
		autoCompile: isExamplePreviewActive,
		enableTailwindCss: isExamplePreviewActive && isPreviewVisible,
	})

	useEffect(() => {
		if (!isPreviewVisible) return
		if (compileStatus !== "success") return
		if (tailwindCss !== null) return
		void compile()
	}, [compile, compileStatus, isPreviewVisible, tailwindCss])

	useEffect(() => {
		if (!isExamplePreviewActive) return
		if (!isPreviewVisible) return
		if (exampleCompileStatus !== "success") return
		if (exampleTailwindCss !== null) return
		void compileExample()
	}, [
		compileExample,
		exampleCompileStatus,
		exampleTailwindCss,
		isExamplePreviewActive,
		isPreviewVisible,
	])

	const openFileTab = useCallback((fileId: SnippetEditorFileId) => {
		setOpenFiles((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
		setActiveFile(fileId)
	}, [])

	const openFileForInspect = useCallback(
		(fileId: SnippetEditorFileId) => {
			setOpenFiles((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
			if (fileId !== activeFile && isComponentFileId(fileId)) {
				suppressComponentSyncRef.current = true
			}
			if (fileId !== activeFile) {
				setActiveFile(fileId)
			}
		},
		[activeFile],
	)
	const {
		inspectMode,
		setInspectMode,
		inspectEnabled,
		inspectHighlight,
		onPreviewInspectHover,
		onPreviewInspectSelect,
		onPreviewInspectContext,
	} = useSnippetInspect({
		mainSource: parsedFiles.mainSource,
		mainEditorSource,
		componentFiles: parsedFiles.files,
		activeFile,
		isExamplePreviewActive,
		onOpenFileForInspect: openFileForInspect,
	})

	const buildTextRangeFromValue = useCallback((range: SnippetTextRange, rawValue: string) => {
		const lines = rawValue.split(/\r?\n/)
		if (lines.length <= 1) {
			return {
				...range,
				endLine: range.startLine,
				endColumn: range.startColumn + rawValue.length,
			}
		}
		const lastLine = lines[lines.length - 1] ?? ""
		return {
			...range,
			endLine: range.startLine + lines.length - 1,
			endColumn: lastLine.length + 1,
		}
	}, [])

	const updateSourceForFile = useCallback(
		(fileId: SnippetEditorFileId, nextFileSource: string) => {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedValue = stripSnippetFileDirectives(nextFileSource)

			if (fileId === "source") {
				const normalizedMain = syncImportBlock(sanitizedValue, Object.keys(parsed.files))
				const nextSource = serializeSnippetFiles(normalizedMain, parsed.files)
				if (nextSource !== currentSource) {
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
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[form],
	)

	const flushInspectTextEdit = useCallback(
		(nextValue?: string | null) => {
			const pendingValue =
				typeof nextValue === "string" ? nextValue : inspectTextPendingValueRef.current
			if (pendingValue === null || pendingValue === undefined) return
			const current = inspectTextEditStateRef.current
			if (!current) return
			const resolvedValue = current.quote
				? pendingValue
				: `${current.leadingWhitespace}${pendingValue}${current.trailingWhitespace}`
			const fileSource = getSourceForFile(current.fileId)
			const nextSource = replaceSnippetTextRange(
				fileSource,
				current.range,
				resolvedValue,
				current.quote,
			)
			if (nextSource !== fileSource) {
				updateSourceForFile(current.fileId, nextSource)
			}
			const rawValue = buildSnippetTextLiteral(resolvedValue, current.quote)
			const nextRange = buildTextRangeFromValue(current.range, rawValue)
			setInspectTextEdit((prev) => (prev ? { ...prev, range: nextRange } : prev))
			inspectTextPendingValueRef.current = null
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
				inspectTextCommitTimerRef.current = null
			}
		},
		[buildTextRangeFromValue, getSourceForFile, updateSourceForFile],
	)

	const closeInspectTextEdit = useCallback(() => {
		flushInspectTextEdit()
		setInspectTextEdit(null)
	}, [flushInspectTextEdit])

	const handleInspectTextChange = useCallback(
		(nextValue: string) => {
			setInspectTextEdit((prev) => {
				if (!prev) return prev
				return {
					...prev,
					value: nextValue,
				}
			})
			inspectTextPendingValueRef.current = nextValue
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
			}
			inspectTextCommitTimerRef.current = setTimeout(() => {
				flushInspectTextEdit()
			}, 300)
		},
		[flushInspectTextEdit],
	)

	const openInspectTextEditor = useCallback(
		(request: { fileId: SnippetEditorFileId; range: SnippetTextRange }, x: number, y: number) => {
			const fileSource = getSourceForFile(request.fileId)
			const { text, quote } = getSnippetTextRangeValue(fileSource, request.range)
			const leadingWhitespace = quote ? "" : (text.match(/^\s+/)?.[0] ?? "")
			const trailingWhitespace = quote ? "" : (text.match(/\s+$/)?.[0] ?? "")
			const coreText = quote ? text : text.trim()
			const normalizedText =
				/[\r\n\t]/.test(coreText) || /\s{2,}/.test(coreText)
					? coreText.replace(/\s+/g, " ").trim()
					: coreText
			const panelWidth = 288
			const panelHeight = 156
			const maxX = Math.max(12, window.innerWidth - panelWidth - 12)
			const maxY = Math.max(12, window.innerHeight - panelHeight - 12)
			setInspectTextEdit({
				fileId: request.fileId,
				range: request.range,
				value: normalizedText,
				quote,
				leadingWhitespace,
				trailingWhitespace,
				x: Math.min(Math.max(12, x), maxX),
				y: Math.min(Math.max(12, y), maxY),
			})
		},
		[getSourceForFile],
	)

	const closeInspectContextMenu = useCallback(() => {
		setInspectContextMenu((prev) => ({
			...prev,
			open: false,
			label: "Snippet text",
			request: null,
		}))
	}, [])

	const handleInspectContextEdit = useCallback(() => {
		setInspectContextMenu((prev) => {
			if (!prev.open || !prev.editable || !prev.request?.range) {
				return { ...prev, open: false, request: null }
			}
			const offset = 10
			openInspectTextEditor(
				{ fileId: prev.request.fileId, range: prev.request.range },
				prev.x + offset,
				prev.y + offset,
			)
			return { ...prev, open: false, request: null }
		})
	}, [openInspectTextEditor])

	const handleInspectContextRemove = useCallback(() => {
		setInspectContextMenu((prev) => {
			if (!prev.open || !prev.editable || !prev.request?.range) {
				return { ...prev, open: false, request: null }
			}
			const fileSource = getSourceForFile(prev.request.fileId)
			const { quote } = getSnippetTextRangeValue(fileSource, prev.request.range)
			const nextSource = replaceSnippetTextRange(fileSource, prev.request.range, "", quote)
			updateSourceForFile(prev.request.fileId, nextSource)
			return { ...prev, open: false, request: null }
		})
	}, [getSourceForFile, updateSourceForFile])

	const handlePreviewInspectSelect = useCallback(
		(
			source: PreviewSourceLocation | null,
			meta?: {
				reason?: "reset"
			},
		) => {
			onPreviewInspectSelect(source)
			if (!source && meta?.reason === "reset") return
			if (inspectTextEdit) {
				closeInspectTextEdit()
			}
			if (inspectContextMenu.open) {
				closeInspectContextMenu()
			}
		},
		[
			closeInspectContextMenu,
			closeInspectTextEdit,
			inspectContextMenu.open,
			inspectTextEdit,
			onPreviewInspectSelect,
		],
	)

	const handleInspectEscape = useCallback(() => {
		if (inspectTextEdit) {
			closeInspectTextEdit()
		}
		if (inspectContextMenu.open) {
			closeInspectContextMenu()
		}
	}, [closeInspectContextMenu, closeInspectTextEdit, inspectContextMenu.open, inspectTextEdit])

	const handleInspectContext = useCallback(
		(payload: { source: PreviewSourceLocation | null; clientX: number; clientY: number }) => {
			const request = onPreviewInspectContext(payload.source)
			flushInspectTextEdit()
			setInspectTextEdit(null)
			if (!request) return
			const menuWidth = 208
			const menuHeight = 140
			const maxX = Math.max(12, window.innerWidth - menuWidth - 12)
			const maxY = Math.max(12, window.innerHeight - menuHeight - 12)
			const fileLabel =
				request.fileId === "source"
					? "Snippet.tsx"
					: (getComponentFileName(request.fileId) ?? "Component")
			setInspectContextMenu({
				open: true,
				x: Math.min(payload.clientX, maxX),
				y: Math.min(payload.clientY, maxY),
				label: fileLabel,
				editable: Boolean(request.range),
				request,
			})
		},
		[flushInspectTextEdit, onPreviewInspectContext],
	)

	useEffect(() => {
		inspectTextEditStateRef.current = inspectTextEdit
	}, [inspectTextEdit])

	useEffect(() => {
		if (!inspectTextEdit) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" || event.key === "Esc") {
				closeInspectTextEdit()
			}
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null
			if (inspectTextEditRef.current && target && inspectTextEditRef.current.contains(target)) {
				return
			}
			flushInspectTextEdit()
			closeInspectTextEdit()
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("pointerdown", handlePointerDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("pointerdown", handlePointerDown)
		}
	}, [closeInspectTextEdit, flushInspectTextEdit, inspectTextEdit])

	useEffect(() => {
		return () => {
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
				inspectTextCommitTimerRef.current = null
			}
			inspectTextPendingValueRef.current = null
		}
	}, [])

	useEffect(() => {
		if (!inspectContextMenu.open) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" || event.key === "Esc") {
				closeInspectContextMenu()
			}
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null
			if (
				inspectContextMenuRef.current &&
				target &&
				inspectContextMenuRef.current.contains(target)
			) {
				return
			}
			closeInspectContextMenu()
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("pointerdown", handlePointerDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("pointerdown", handlePointerDown)
		}
	}, [closeInspectContextMenu, inspectContextMenu.open])

	useEffect(() => {
		if (!inspectEnabled && inspectTextEdit) {
			closeInspectTextEdit()
		}
	}, [closeInspectTextEdit, inspectEnabled, inspectTextEdit])

	useEffect(() => {
		if (!inspectEnabled && inspectContextMenu.open) {
			closeInspectContextMenu()
		}
	}, [closeInspectContextMenu, inspectContextMenu.open, inspectEnabled])

	const handleReorderOpenFiles = useCallback((fileIds: SnippetEditorFileId[]) => {
		setOpenFiles(fileIds)
	}, [])

	const closeFileTab = useCallback(
		(fileId: SnippetEditorFileId) => {
			setOpenFiles((prev) => {
				if (!prev.includes(fileId) || prev.length <= 1) return prev
				const next = prev.filter((entry) => entry !== fileId)
				if (activeFile === fileId) {
					const index = prev.indexOf(fileId)
					const nextActive = next[index] ?? next[index - 1] ?? next[0]
					if (nextActive) {
						setActiveFile(nextActive)
						if (isComponentFileId(nextActive)) {
							const exportName = getComponentExportName(nextActive)
							if (exportName) {
								setActiveComponentExport(exportName)
							}
						} else if (nextActive === "source") {
							setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
						}
					}
				}
				return next
			})
		},
		[activeFile],
	)

	const selectFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			openFileTab(fileId)
			if (isComponentFileId(fileId)) {
				const exportName = getComponentExportName(fileId)
				if (exportName) {
					setActiveComponentExport(exportName)
				}
				return
			}
			if (fileId === "source") {
				setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			}
		},
		[openFileTab],
	)
	const handleDefinitionSelect = useCallback(
		(_symbol: string, target: string) => {
			const fileId = target as SnippetEditorFileId
			if (componentDefinitionMap[_symbol] === fileId) {
				selectFile(fileId)
			}
		},
		[componentDefinitionMap, selectFile],
	)

	const applySnippetTemplate = useCallback(
		(templateId: SnippetTemplateId, options?: { markDirty?: boolean }) => {
			const template = SNIPPET_TEMPLATES[templateId]
			if (!template || typeof template.source !== "string") return
			setError(null)
			setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			autoOpenComponentsRef.current = false
			fileMigrationRef.current = false
			resetComponentExports()
			form.setValue("source", template.source, {
				shouldValidate: true,
				shouldDirty: options?.markDirty ?? true,
			})
			setIsExamplePreviewActive(false)
			openFileTab("source")
		},
		[form, openFileTab, resetComponentExports],
	)

	const handleFileContextMenu = (
		event: MouseEvent<HTMLButtonElement>,
		fileId: SnippetEditorFileId,
	) => {
		if (contextMenuStampRef.current === event.timeStamp) return
		contextMenuStampRef.current = event.timeStamp
		event.preventDefault()
		setFileContextMenu({
			open: true,
			x: event.clientX,
			y: event.clientY,
			fileId,
		})
	}

	const handleFileContextMenuOpenChange = (open: boolean) => {
		setFileContextMenu((prev) => ({ ...prev, open, fileId: open ? prev.fileId : null }))
	}

	const handleConfirmDeleteComponent = async () => {
		if (!deleteTarget) return
		setIsDeletingComponent(true)
		setError(null)
		try {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			let nextSource = currentSource
			if (deleteTarget.fileName && parsed.files[deleteTarget.fileName]) {
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
	}

	const handleSourceFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (!files?.length) return
		const file = files[0]
		const reader = new FileReader()
		reader.onload = () => {
			const content = reader.result as string
			fileMigrationRef.current = false
			resetComponentExports()
			form.setValue("source", content, { shouldValidate: true })
			if (!form.getValues("title")) {
				const name = file.name.replace(/\.(jsx?|tsx?)$/, "")
				form.setValue("title", name)
			}
		}
		reader.readAsText(file)
	}

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

	const getNextComponentName = () => {
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
	}

	const handleAddComponent = () => {
		if (overHardComponentLimit) {
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
		setActiveComponentExport(nextName)
		selectFile(toComponentFileId(fileName))
	}

	const handleMainSourceChange = useCallback(
		(nextValue: string | undefined) => {
			const currentSource = form.getValues("source") ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const sanitizedMain = stripSnippetFileDirectives(nextValue ?? "")
			const normalizedMain = syncImportBlock(sanitizedMain, Object.keys(parsed.files))
			const nextSource = serializeSnippetFiles(normalizedMain, parsed.files)
			if (nextSource !== currentSource) {
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[form],
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
				form.setValue("source", nextSource, { shouldValidate: true, shouldDirty: true })
			}
		},
		[activeComponentFileName, form],
	)

	const applyExampleToEditor = () => {
		if (!activeExample) return
		fileMigrationRef.current = false
		resetComponentExports()
		form.setValue("source", activeExample.source, { shouldValidate: true })
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

		const currentTags = form.getValues("tags")
		if (!currentTags.trim() && activeExample.tags.length > 0) {
			form.setValue("tags", activeExample.tags.join(", "), { shouldValidate: true })
		}

		selectFile("source")
		setIsExamplePreviewActive(false)
	}

	const handleSubmit = async (values: CustomSnippetValues) => {
		setError(null)
		setIsSubmitting(true)
		try {
			if (isEditing) {
				if (!editAsset) {
					throw new Error("Snippet not found or not editable.")
				}
				await updateCustomSnippetAsset(editAsset.id, {
					source: values.source,
					scope: values.scope,
					title: values.title.trim(),
					description: values.description?.trim() || null,
					tagNames: parseTagInput(values.tags),
					license: buildSnippetLicense(values),
					attribution: buildSnippetAttribution(values),
					viewport: {
						width: values.viewportWidth,
						height: values.viewportHeight,
					},
					entryExport: activeComponentExport,
				})
				form.reset(values, { keepDirty: false, keepTouched: false })
				return
			}

			const exportEntries = await listSnippetComponentExports(values.source)
			if (exportEntries.length === 0) {
				throw new Error("Snippet must export at least one component.")
			}
			if (exportEntries.length > SNIPPET_COMPONENT_LIMITS.hard) {
				throw new Error(
					`Snippet exports too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`,
				)
			}
			const hasEntry =
				activeComponentExport === DEFAULT_SNIPPET_EXPORT
					? exportEntries.some((component) => component.isDefault)
					: exportEntries.some((component) => component.exportName === activeComponentExport)
			if (!hasEntry) {
				throw new Error("Selected component export was not found in the source.")
			}
			const propsSchema = derivedProps.propsSchema
			const defaultProps = derivedProps.defaultProps

			const entry = `custom:${nanoid()}`

			await registerCustomSnippetAsset({
				entry,
				runtime: "react",
				propsSchema,
				defaultProps,
				entryExport: activeComponentExport,
				source: values.source,
				viewport: {
					width: values.viewportWidth,
					height: values.viewportHeight,
				},
				scope: values.scope,
				title: values.title.trim(),
				description: values.description?.trim() || null,
				tagNames: parseTagInput(values.tags),
				license: buildSnippetLicense(values),
				attribution: buildSnippetAttribution(values),
			})

			navigate({ to: "/library" })
		} catch (err) {
			const fallback = isEditing ? "Failed to update snippet" : "Failed to create custom snippet"
			setError(err instanceof Error ? err.message : fallback)
		} finally {
			setIsSubmitting(false)
		}
	}

	const isExamplePreviewing = Boolean(isExamplePreviewActive && activeExample)
	const previewCompiledCode = isExamplePreviewing ? exampleCompiledCode : compiledCode
	const previewPropsToUse = isExamplePreviewing ? examplePreviewProps : previewProps
	const previewTailwindCss = isExamplePreviewing ? exampleTailwindCss : tailwindCss
	const previewDimensionsToUse = isExamplePreviewing
		? examplePreviewDimensions
		: snippetPreviewDimensions
	const previewHeaderActions = (
		<SnippetPreviewHeaderActions
			isExamplePreviewing={isExamplePreviewing}
			activeExampleTitle={activeExample?.title}
			activeComponentLabel={activeComponentLabel}
			useComponentDefaults={useComponentDefaults}
			onExitExamplePreview={() => setIsExamplePreviewActive(false)}
			onToggleDefaults={() => setUseComponentDefaults((prev) => !prev)}
			inspectEnabled={inspectMode}
			onToggleInspect={() => setInspectMode((prev) => !prev)}
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

	if (screenGate.status !== "supported") {
		return <SnippetScreenGuard gate={screenGate} />
	}

	return (
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
				<form className="flex flex-1 overflow-hidden" onSubmit={form.handleSubmit(handleSubmit)}>
					<PanelRail
						editorCollapsed={editorCollapsed}
						detailsCollapsed={detailsCollapsed}
						explorerCollapsed={explorerCollapsed}
						examplesOpen={examplesOpen}
						importsOpen={importsOpen}
						isFocusPanelOpen={isFocusPanelOpen}
						onToggleEditor={() => setEditorCollapsed((prev) => !prev)}
						onToggleDetails={() => setDetailsCollapsed((prev) => !prev)}
						onToggleExplorer={() => setExplorerCollapsed((prev) => !prev)}
						onToggleExamples={toggleExamplesPanel}
						onToggleImports={toggleImportsPanel}
						exampleFilters={exampleFilters}
						importsFilters={importsFilters}
						onExampleFilterClick={handleExampleFilterClick}
						onImportsFilterClick={handleImportsFilterClick}
					/>
					<SnippetDetailsPanel
						collapsed={detailsCollapsed}
						tagHints={tagHints}
						disabledScopes={disabledScopes}
						selectedTemplateId={selectedTemplateId}
						onSelectTemplate={setSelectedTemplateId}
						onApplyTemplate={() => applySnippetTemplate(selectedTemplateId)}
						error={error}
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
						/>

						<SnippetSplitViewResizer isHidden={editorCollapsed} onPointerDown={onResizeStart} />

						{/* Preview panel - fills remaining width */}
						<div ref={previewContainerRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
							/>
						</div>
					</section>
				</form>
			</Form>
		</div>
	)
}
