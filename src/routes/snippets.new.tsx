import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	FileCode,
	FolderOpen,
	Info,
	LayoutTemplate,
	Loader2,
	Plus,
	SlidersHorizontal,
	Trash2,
	Upload,
	X,
} from "lucide-react"
import { nanoid } from "nanoid"
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { Logo } from "@/components/brand/logo"
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { SCREEN_GUARD_DEFAULTS, useScreenGuard } from "@/lib/screen-guard"
import {
	DEFAULT_SNIPPET_EXPORT,
	deriveSnippetPropsFromAllExports,
	getSnippetComponentSourceMap,
	listSnippetComponentExports,
	parseSnippetFiles,
	removeSnippetComponentExport,
	type SnippetComponentExport,
	serializeSnippetFiles,
	useSnippetCompiler,
} from "@/lib/snippets"
import {
	clampSnippetViewport,
	SNIPPET_COMPONENT_LIMITS,
	SNIPPET_SOURCE_MAX_CHARS,
} from "@/lib/snippets/constraints"
import { SNIPPET_EXAMPLE_LABELS, SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import { AVAILABLE_FONTS, TRUSTED_FONT_PROVIDERS } from "@/lib/snippets/imports"
import { DEFAULT_PREVIEW_DIMENSIONS } from "@/lib/snippets/preview-runtime"
import {
	SNIPPET_TEMPLATE_OPTIONS,
	SNIPPET_TEMPLATES,
	type SnippetTemplateId,
} from "@/lib/snippets/templates"
import { cn } from "@/lib/utils"
import { MetadataFields } from "@/routes/-snippets/new/components/metadata-fields"
import { ResolutionFields } from "@/routes/-snippets/new/components/resolution-fields"
import {
	CUSTOM_PRESET_ID,
	DEFAULT_DEFAULT_PROPS,
	DEFAULT_LICENSE,
	DEFAULT_PROPS_SCHEMA,
	EXAMPLE_FILTERS,
	type ExampleFilterId,
	IMPORT_FILTERS,
	type ImportFilterId,
	SNIPPET_FILES,
	type SnippetFileId,
	STARTER_SOURCE,
} from "@/routes/-snippets/new/constants"
import {
	LazyMonacoEditor,
	MonacoEditorSkeleton,
	useIsomorphicLayoutEffect,
} from "@/routes/-snippets/new/editor"
import type { PanelSnapshot } from "@/routes/-snippets/new/panel-state"
import { readPanelState, writePanelState } from "@/routes/-snippets/new/panel-state"
import {
	type CustomSnippetValues,
	customSnippetSchema,
	parseTagInput,
	slugify,
} from "@/routes/-snippets/new/schema"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type {
	AssetLicense,
	SnippetProps,
	SnippetPropsSchemaDefinition,
} from "@/types/asset-library"

export const Route = createFileRoute("/snippets/new")({
	component: NewSnippetPage,
})

type SnippetEditorFileId = SnippetFileId | `component:${string}`

type SnippetEditorFileKind = "source" | "propsSchema" | "defaultProps" | "component"

type SnippetEditorFile = {
	id: SnippetEditorFileId
	label: string
	description: string
	kind: SnippetEditorFileKind
	icon: typeof FileCode
	exportName?: string
	fileName?: string
	deletable: boolean
}

const COMPONENT_FILE_PREFIX = "component:"

const toComponentFileId = (fileName: string): SnippetEditorFileId =>
	`${COMPONENT_FILE_PREFIX}${fileName}`

const isComponentFileId = (fileId: SnippetEditorFileId): fileId is `component:${string}` =>
	fileId.startsWith(COMPONENT_FILE_PREFIX)

const getComponentFileName = (fileId: SnippetEditorFileId) =>
	isComponentFileId(fileId) ? fileId.slice(COMPONENT_FILE_PREFIX.length) : null

const getExportNameFromFile = (fileName: string) => fileName.replace(/\.[^/.]+$/, "")

const getComponentExportName = (fileId: SnippetEditorFileId) => {
	const fileName = getComponentFileName(fileId)
	return fileName ? getExportNameFromFile(fileName) : null
}

const stripSnippetFileDirectives = (source: string) =>
	source
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^\s*\/\/\s*@snippet-file(\s|$)/.test(line) &&
				!/^\s*\/\/\s*@snippet-file-end\s*$/.test(line),
		)
		.join("\n")

const stripAutoImportBlock = (source: string) => {
	const lines = stripSnippetFileDirectives(source).split(/\r?\n/)
	let index = 0
	let sawImport = false
	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}
	return lines.slice(index).join("\n")
}

const extractPrimaryNamedExport = (source: string) => {
	const match = source.match(/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/m)
	return match?.[1] ?? null
}

const extractNamedExports = (source: string) => {
	const matches = source.matchAll(
		/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
	)
	const names = new Set<string>()
	for (const match of matches) {
		const name = match[1]
		if (name) names.add(name)
	}
	return [...names]
}

const syncImportBlock = (source: string, fileNames: string[]) => {
	const sortedFiles = [...fileNames].sort((a, b) => a.localeCompare(b))
	const cleaned = stripAutoImportBlock(source)
	const lines = cleaned.split(/\r?\n/)
	if (sortedFiles.length === 0) {
		return lines.join("\n").trimEnd()
	}
	const importLines = [
		"// Auto-managed imports (do not edit).",
		...sortedFiles.map((fileName) => `// @import ${fileName}`),
		"",
	]
	return [...importLines, ...lines].join("\n").trimEnd()
}

function NewSnippetPage() {
	const navigate = useNavigate()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const deriveVersionRef = useRef(0)
	const exportVersionRef = useRef(0)
	const templateAppliedRef = useRef(false)
	const contextMenuStampRef = useRef<number | null>(null)
	const autoOpenComponentsRef = useRef(false)
	const fileMigrationRef = useRef(false)
	const [error, setError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [useComponentDefaults, setUseComponentDefaults] = useState(false)
	const [openFiles, setOpenFiles] = useState<SnippetEditorFileId[]>(() =>
		SNIPPET_FILES.map((file) => file.id),
	)
	const [activeFile, setActiveFile] = useState<SnippetEditorFileId>("source")
	const [componentExports, setComponentExports] = useState<SnippetComponentExport[]>([])
	const [componentExportsLoaded, setComponentExportsLoaded] = useState(false)
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
	const [deleteTarget, setDeleteTarget] = useState<{
		exportName: string
		label: string
		fileName?: string
	} | null>(null)
	const [isDeletingComponent, setIsDeletingComponent] = useState(false)
	const [editorCollapsed, setEditorCollapsed] = useState(false)
	const [detailsCollapsed, setDetailsCollapsed] = useState(false)
	const [explorerCollapsed, setExplorerCollapsed] = useState(false)
	const [examplesOpen, setExamplesOpen] = useState(false)
	const [importsOpen, setImportsOpen] = useState(false)
	const [activeExampleId, setActiveExampleId] = useState(() => SNIPPET_EXAMPLES[0]?.id ?? "")
	const [isExamplePreviewActive, setIsExamplePreviewActive] = useState(false)
	const [exampleFilters, setExampleFilters] = useState<ExampleFilterId[]>(["all"])
	const [importsFilters, setImportsFilters] = useState<ImportFilterId[]>(["all"])
	const [panelsHydrated, setPanelsHydrated] = useState(false)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const [isPreviewVisible, setIsPreviewVisible] = useState(true)
	const screenGate = useScreenGuard()
	const previousPanelsRef = useRef<PanelSnapshot | null>(null)
	const [derivedProps, setDerivedProps] = useState<{
		propsSchema: SnippetPropsSchemaDefinition
		defaultProps: SnippetProps
		duplicateKeys: string[]
	}>(() => ({
		propsSchema: DEFAULT_PROPS_SCHEMA,
		defaultProps: DEFAULT_DEFAULT_PROPS,
		duplicateKeys: [],
	}))
	const derivedPropsRef = useRef(derivedProps)
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
	const watchedSource = form.watch("source")
	const parsedFiles = useMemo(() => parseSnippetFiles(watchedSource ?? ""), [watchedSource])
	const componentFileNames = useMemo(
		() => Object.keys(parsedFiles.files).sort((a, b) => a.localeCompare(b)),
		[parsedFiles.files],
	)

	const tags = useAssetLibraryStore((state) => state.tags)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const registerCustomSnippetAsset = useAssetLibraryStore(
		(state) => state.registerCustomSnippetAsset,
	)
	const tagHints = useMemo(() => tags.map((tag) => tag.name), [tags])
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
	const isFocusPanelOpen = examplesOpen || importsOpen
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
	const canCreateSnippet =
		form.formState.isValid && !isCreating && componentCount > 0 && !overHardComponentLimit
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
	const importsSections = useMemo(() => {
		const sections = [
			{
				id: "fonts",
				group: "fonts",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Fonts</p>
						{AVAILABLE_FONTS.map((font) => (
							<div key={font.id} className="rounded-md border border-neutral-200 bg-white p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-neutral-900">{font.name}</p>
										<p className="text-[11px] text-neutral-500">{font.usage}</p>
									</div>
									<span className="text-[10px] uppercase tracking-widest text-neutral-400">
										{font.classNameLabel}
									</span>
								</div>
								<p className={cn("mt-2 text-sm text-neutral-900", font.previewClassName)}>
									Aa Bb 012
								</p>
							</div>
						))}
					</div>
				),
			},
			{
				id: "providers",
				group: "fonts",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">
							Trusted font providers
						</p>
						{TRUSTED_FONT_PROVIDERS.map((provider) => (
							<div
								key={provider.id}
								className="rounded-md border border-neutral-200 bg-white px-3 py-2"
							>
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm font-medium text-neutral-900">{provider.label}</span>
									<span className="text-[10px] uppercase tracking-widest text-neutral-400">
										{provider.status === "active" ? "Active" : "Available"}
									</span>
								</div>
							</div>
						))}
						<p className="text-[10px] text-neutral-400">
							Only trusted providers are injected into preview.
						</p>
					</div>
				),
			},
			{
				id: "svgs",
				group: "svgs",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">SVG assets</p>
						<div className="rounded-md border border-neutral-200 bg-white p-3">
							<div className="flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-neutral-900">Evencio mark</span>
								<span className="text-[10px] uppercase tracking-widest text-neutral-400">SVG</span>
							</div>
							<div className="mt-3 flex items-center gap-3">
								<Logo size="xs" showWordmark={false} />
								<span className="text-[11px] text-neutral-500">Icon only</span>
							</div>
						</div>
						<div className="rounded-md border border-neutral-200 bg-white p-3">
							<div className="flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-neutral-900">Evencio lockup</span>
								<span className="text-[10px] uppercase tracking-widest text-neutral-400">
									SVG + type
								</span>
							</div>
							<div className="mt-3">
								<Logo size="xs" showWordmark />
							</div>
						</div>
					</div>
				),
			},
			{
				id: "icons",
				group: "icons",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Icons</p>
						<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
							<p className="text-sm text-neutral-500">Lucide icons (coming soon)</p>
						</div>
					</div>
				),
			},
			{
				id: "images",
				group: "images",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Images</p>
						<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
							<p className="text-sm text-neutral-500">Image imports (coming soon)</p>
						</div>
					</div>
				),
			},
		]

		if (importsFilters.includes("all") || importsFilters.length === 0) return sections
		return sections.filter((section) => importsFilters.includes(section.group as ImportFilterId))
	}, [importsFilters])

	useEffect(() => {
		loadLibrary()
	}, [loadLibrary])

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

	useIsomorphicLayoutEffect(() => {
		const stored = readPanelState()
		if (stored) {
			setDetailsCollapsed(stored.detailsCollapsed)
			setExplorerCollapsed(stored.explorerCollapsed)
			setExamplesOpen(stored.examplesOpen)
			setImportsOpen(stored.importsOpen)
		}
		setPanelsHydrated(true)
	}, [])

	useEffect(() => {
		if (!panelsHydrated) return
		writePanelState({ detailsCollapsed, explorerCollapsed, examplesOpen, importsOpen })
	}, [detailsCollapsed, explorerCollapsed, examplesOpen, importsOpen, panelsHydrated])

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

	const openFocusPanel = (panel: "examples" | "imports") => {
		if (!isFocusPanelOpen) {
			previousPanelsRef.current = {
				detailsCollapsed,
				explorerCollapsed,
			}
		}
		setDetailsCollapsed(true)
		setExplorerCollapsed(true)
		if (panel === "examples") {
			setExamplesOpen(true)
			setImportsOpen(false)
		} else {
			setImportsOpen(true)
			setExamplesOpen(false)
		}
	}

	const closeFocusPanels = () => {
		setExamplesOpen(false)
		setImportsOpen(false)
		const previous = previousPanelsRef.current
		if (previous) {
			setDetailsCollapsed(previous.detailsCollapsed)
			setExplorerCollapsed(previous.explorerCollapsed)
		}
	}

	const toggleExamplesPanel = () => {
		if (examplesOpen) {
			closeFocusPanels()
		} else {
			openFocusPanel("examples")
		}
	}

	const toggleImportsPanel = () => {
		if (importsOpen) {
			closeFocusPanels()
		} else {
			openFocusPanel("imports")
		}
	}

	useEffect(() => {
		let isCancelled = false
		const version = ++exportVersionRef.current
		const timer = setTimeout(async () => {
			try {
				const exportEntries = await listSnippetComponentExports(watchedSource)
				if (isCancelled || version !== exportVersionRef.current) return
				setComponentExports(exportEntries)
				setComponentExportsLoaded(true)
			} catch {
				if (isCancelled || version !== exportVersionRef.current) return
				setComponentExports([])
				setComponentExportsLoaded(true)
			}
		}, 250)

		return () => {
			isCancelled = true
			clearTimeout(timer)
		}
	}, [watchedSource])

	useEffect(() => {
		if (fileMigrationRef.current) return
		if (!componentExportsLoaded) return
		if (parsedFiles.hasFileBlocks) {
			fileMigrationRef.current = true
			return
		}
		const namedExports = componentExports.filter((component) => !component.isDefault)
		if (namedExports.length === 0) {
			fileMigrationRef.current = true
			return
		}

		void (async () => {
			try {
				const currentSource = form.getValues("source") ?? ""
				const { mainSource } = parseSnippetFiles(currentSource)
				const sourceMap = await getSnippetComponentSourceMap(currentSource)
				let nextMain = mainSource
				const nextFiles: Record<string, string> = {}

				for (const component of namedExports) {
					const exportName = component.exportName
					const fileName = `${exportName}.tsx`
					const componentSource = sourceMap[exportName]
					if (!componentSource) continue
					nextFiles[fileName] = componentSource.trimEnd()
					const removal = await removeSnippetComponentExport(nextMain, exportName)
					if (removal.removed) {
						nextMain = removal.source
					}
				}

				if (Object.keys(nextFiles).length === 0) {
					fileMigrationRef.current = true
					return
				}

				const nextSerialized = serializeSnippetFiles(
					syncImportBlock(nextMain, Object.keys(nextFiles)),
					nextFiles,
				)
				form.setValue("source", nextSerialized, {
					shouldValidate: true,
					shouldDirty: true,
				})
			} catch {
				// Ignore migration errors to avoid blocking edits.
			} finally {
				fileMigrationRef.current = true
			}
		})()
	}, [componentExports, componentExportsLoaded, form, parsedFiles.hasFileBlocks])

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
	const previewProps = useComponentDefaults ? {} : parsedProps
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

	useEffect(() => {
		let isCancelled = false
		const version = ++deriveVersionRef.current
		const timer = setTimeout(async () => {
			try {
				const derived = await deriveSnippetPropsFromAllExports(watchedSource)
				if (isCancelled || version !== deriveVersionRef.current) return

				const propsSchemaJson = JSON.stringify(derived.propsSchema, null, 2)
				const defaultPropsJson = JSON.stringify(derived.defaultProps, null, 2)
				const currentDerived = derivedPropsRef.current
				const shouldUpdateDerived =
					JSON.stringify(currentDerived.propsSchema, null, 2) !== propsSchemaJson ||
					JSON.stringify(currentDerived.defaultProps, null, 2) !== defaultPropsJson ||
					currentDerived.duplicateKeys.join("|") !== derived.duplicateKeys.join("|")

				if (shouldUpdateDerived) {
					derivedPropsRef.current = derived
					setDerivedProps(derived)
				}

				if (form.getValues("propsSchema") !== propsSchemaJson) {
					form.setValue("propsSchema", propsSchemaJson, {
						shouldValidate: true,
						shouldDirty: false,
					})
				}
				if (form.getValues("defaultProps") !== defaultPropsJson) {
					form.setValue("defaultProps", defaultPropsJson, {
						shouldValidate: true,
						shouldDirty: false,
					})
				}
			} catch {
				// Ignore derive errors; form keeps last valid state
			}
		}, 400)

		return () => {
			isCancelled = true
			clearTimeout(timer)
		}
	}, [form, watchedSource])

	const buildLicense = (values: CustomSnippetValues): AssetLicense => {
		const licenseName = values.licenseName?.trim() || DEFAULT_LICENSE.name
		const licenseId = values.licenseId?.trim() || slugify(licenseName) || DEFAULT_LICENSE.id
		return {
			id: licenseId,
			name: licenseName,
			url: values.licenseUrl,
			attributionRequired: values.attributionRequired,
		}
	}

	const buildAttribution = (values: CustomSnippetValues) => {
		if (!values.attributionRequired) return null
		const text = values.attributionText?.trim()
		if (!text) return null
		return {
			text,
			url: values.attributionUrl,
		}
	}

	const openFileTab = useCallback((fileId: SnippetEditorFileId) => {
		setOpenFiles((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
		setActiveFile(fileId)
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
			setComponentExportsLoaded(false)
			form.setValue("source", template.source, {
				shouldValidate: true,
				shouldDirty: options?.markDirty ?? true,
			})
			setIsExamplePreviewActive(false)
			openFileTab("source")
		},
		[form, openFileTab],
	)

	const handleFileContextMenu = (event: React.MouseEvent, fileId: SnippetEditorFileId) => {
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

	const handleSourceFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (!files?.length) return
		const file = files[0]
		const reader = new FileReader()
		reader.onload = () => {
			const content = reader.result as string
			fileMigrationRef.current = false
			setComponentExportsLoaded(false)
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
		if (typeof window === "undefined") return
		const params = new URLSearchParams(window.location.search)
		const templateParam = params.get("template")
		if (templateParam && Object.hasOwn(SNIPPET_TEMPLATES, templateParam)) {
			const templateId = templateParam as SnippetTemplateId
			setSelectedTemplateId(templateId)
			applySnippetTemplate(templateId, { markDirty: false })
		}
		templateAppliedRef.current = true
	}, [applySnippetTemplate])

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
		setComponentExportsLoaded(false)
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

	const handleExampleFilterClick = (
		id: ExampleFilterId,
		event: React.MouseEvent<HTMLButtonElement>,
	) => {
		if (id === "all") {
			setExampleFilters(["all"])
			return
		}
		const isMulti = event.shiftKey || event.metaKey || event.ctrlKey
		if (!isMulti) {
			setExampleFilters([id])
			return
		}
		setExampleFilters((prev) => {
			const withoutAll = prev.filter((entry) => entry !== "all")
			const hasId = withoutAll.includes(id)
			const next = hasId ? withoutAll.filter((entry) => entry !== id) : [...withoutAll, id]
			return next.length > 0 ? next : ["all"]
		})
	}

	const handleImportsFilterClick = (
		id: ImportFilterId,
		event: React.MouseEvent<HTMLButtonElement>,
	) => {
		if (id === "all") {
			setImportsFilters(["all"])
			return
		}
		const isMulti = event.shiftKey || event.metaKey || event.ctrlKey
		if (!isMulti) {
			setImportsFilters([id])
			return
		}
		setImportsFilters((prev) => {
			const withoutAll = prev.filter((entry) => entry !== "all")
			const hasId = withoutAll.includes(id)
			const next = hasId ? withoutAll.filter((entry) => entry !== id) : [...withoutAll, id]
			return next.length > 0 ? next : ["all"]
		})
	}

	const handleSubmit = async (values: CustomSnippetValues) => {
		setError(null)
		setIsCreating(true)
		try {
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
				license: buildLicense(values),
				attribution: buildAttribution(values),
			})

			navigate({ to: "/library" })
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create custom snippet")
		} finally {
			setIsCreating(false)
		}
	}

	const isExamplePreviewing = Boolean(isExamplePreviewActive && activeExample)
	const previewCompiledCode = isExamplePreviewing ? exampleCompiledCode : compiledCode
	const previewPropsToUse = isExamplePreviewing ? examplePreviewProps : previewProps
	const previewTailwindCss = isExamplePreviewing ? exampleTailwindCss : tailwindCss
	const previewDimensionsToUse = isExamplePreviewing
		? examplePreviewDimensions
		: snippetPreviewDimensions
	const previewHeaderActions = isExamplePreviewing ? (
		<>
			<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
				Example
			</span>
			<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
				{activeExample?.title}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-6 px-2 text-[11px]"
				onClick={() => setIsExamplePreviewActive(false)}
			>
				Back to snippet
			</Button>
		</>
	) : (
		<>
			<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
				Component: {activeComponentLabel}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"h-6 px-2 text-[11px]",
					useComponentDefaults
						? "bg-neutral-900 text-white hover:bg-neutral-800"
						: "text-neutral-500 hover:text-neutral-700",
				)}
				aria-pressed={useComponentDefaults}
				onClick={() => setUseComponentDefaults((prev) => !prev)}
			>
				Preview: {useComponentDefaults ? "Component defaults" : "Default props"}
			</Button>
		</>
	)

	if (screenGate.status !== "supported") {
		const isChecking = screenGate.status === "unknown"
		const showMetrics = !isChecking && screenGate.viewport.width > 0

		return (
			<div className="flex h-screen flex-col items-center justify-center bg-white px-6">
				<div
					className="flex w-full max-w-xl flex-col items-center gap-4 text-center"
					role={screenGate.status === "unsupported" ? "alert" : undefined}
				>
					<Logo size="sm" href="/" animateOnHover />
					<div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
						{isChecking ? (
							<Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
						) : (
							<AlertCircle className="h-5 w-5 text-red-500" />
						)}
					</div>
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
							Snippet editor
						</p>
						<h1 className="text-lg font-semibold text-neutral-900">
							{isChecking ? "Checking screen size..." : "Desktop screen required"}
						</h1>
						<p className="text-sm text-neutral-600">
							{isChecking
								? "Preparing the editor layout."
								: "This editor needs a wide screen and full keyboard support. Open it on a larger display or expand your browser window."}
						</p>
						{showMetrics && (
							<p className="text-xs text-neutral-400">
								Minimum: {SCREEN_GUARD_DEFAULTS.minViewportWidth}x
								{SCREEN_GUARD_DEFAULTS.minViewportHeight} viewport and{" "}
								{SCREEN_GUARD_DEFAULTS.minScreenWidth}x{SCREEN_GUARD_DEFAULTS.minScreenHeight}{" "}
								screen. Current viewport: {screenGate.viewport.width}x{screenGate.viewport.height}.
							</p>
						)}
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link to="/library">Back to library</Link>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-white">
			<DropdownMenu open={fileContextMenu.open} onOpenChange={handleFileContextMenuOpenChange}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						className="pointer-events-none fixed h-px w-px opacity-0"
						style={{ left: fileContextMenu.x, top: fileContextMenu.y }}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" sideOffset={4} className="w-48">
					{contextMenuFile ? (
						<>
							<DropdownMenuItem
								onSelect={() => {
									selectFile(contextMenuFile.id)
								}}
							>
								Open file
							</DropdownMenuItem>
							{openFiles.includes(contextMenuFile.id) && (
								<DropdownMenuItem
									disabled={!canCloseContextTab}
									onSelect={() => {
										closeFileTab(contextMenuFile.id)
									}}
								>
									Close tab
								</DropdownMenuItem>
							)}
							{contextMenuFile.deletable && contextMenuFile.exportName && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => {
											setDeleteTarget({
												exportName:
													contextMenuFile.exportName ??
													getExportNameFromFile(contextMenuFile.label),
												label: contextMenuFile.label,
												fileName: contextMenuFile.fileName,
											})
										}}
									>
										<Trash2 className="h-4 w-4" />
										Remove file
									</DropdownMenuItem>
								</>
							)}
						</>
					) : (
						<DropdownMenuItem disabled>No file actions</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null)
				}}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove component file?</DialogTitle>
						<DialogDescription>
							This removes the file and its @import reference. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{deleteTarget && (
						<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
							{deleteTarget.label.replace(/\.tsx$/, "")}
						</div>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleConfirmDeleteComponent}
							disabled={isDeletingComponent}
						>
							{isDeletingComponent ? "Removing..." : "Remove file"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* Fixed header */}
			<header className="h-12 shrink-0 border-b border-neutral-200 bg-white">
				<div className="flex h-full items-center justify-between px-4">
					<div className="flex items-center gap-3">
						<Logo size="sm" href="/" animateOnHover />
						<span className="text-neutral-300">/</span>
						<Link
							to="/library"
							className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
						>
							<ArrowLeft className="h-4 w-4" />
							Library
						</Link>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link to="/library">Cancel</Link>
						</Button>
						<Button
							size="sm"
							disabled={!canCreateSnippet}
							onClick={form.handleSubmit(handleSubmit)}
						>
							{isCreating ? "Creating..." : "Create snippet"}
						</Button>
					</div>
				</div>
			</header>

			{/* Main content - fills remaining height */}
			<Form {...form}>
				<form className="flex flex-1 overflow-hidden" onSubmit={form.handleSubmit(handleSubmit)}>
					<div className="w-14 shrink-0 border-r border-neutral-200 bg-neutral-50">
						<div className="relative flex h-full flex-col items-center py-2">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={cn(
									"mb-2 h-10 w-10",
									!editorCollapsed && "border border-neutral-200 bg-white text-neutral-900",
								)}
								onClick={() => setEditorCollapsed((prev) => !prev)}
								aria-pressed={!editorCollapsed}
								aria-label={editorCollapsed ? "Show code editor" : "Hide code editor"}
								title="Editor"
							>
								<FileCode className="h-4 w-4" />
							</Button>
							<div
								className={cn(
									"flex flex-col items-center gap-1 transition-all duration-200 ease-out",
									isFocusPanelOpen
										? "pointer-events-none -translate-y-2 opacity-0"
										: "translate-y-0 opacity-100",
								)}
							>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={cn(
										"h-10 w-10",
										!detailsCollapsed && "border border-neutral-200 bg-white text-neutral-900",
									)}
									onClick={() => setDetailsCollapsed((prev) => !prev)}
									aria-pressed={!detailsCollapsed}
									aria-label={
										detailsCollapsed ? "Show snippet details panel" : "Hide snippet details panel"
									}
									title="Snippet details"
								>
									<Info className="h-4 w-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={cn(
										"h-10 w-10",
										!explorerCollapsed && "border border-neutral-200 bg-white text-neutral-900",
									)}
									onClick={() => setExplorerCollapsed((prev) => !prev)}
									aria-pressed={!explorerCollapsed}
									aria-label={explorerCollapsed ? "Show explorer panel" : "Hide explorer panel"}
									title="Explorer"
								>
									<FolderOpen className="h-4 w-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={cn(
										"h-10 w-10",
										examplesOpen && "border border-neutral-200 bg-white text-neutral-900",
									)}
									onClick={toggleExamplesPanel}
									aria-pressed={examplesOpen}
									aria-label={examplesOpen ? "Hide examples panel" : "Show examples panel"}
									title="Examples"
								>
									<LayoutTemplate className="h-4 w-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={cn(
										"h-10 w-10",
										importsOpen && "border border-neutral-200 bg-white text-neutral-900",
									)}
									onClick={toggleImportsPanel}
									aria-pressed={importsOpen}
									aria-label={importsOpen ? "Hide imports panel" : "Show imports panel"}
									title="Imports"
								>
									<SlidersHorizontal className="h-4 w-4" />
								</Button>
							</div>

							<div
								className={cn(
									"absolute top-2 left-0 right-0 flex flex-col items-center transition-all duration-200 ease-out",
									examplesOpen
										? "translate-y-0 opacity-100"
										: "pointer-events-none -translate-y-2 opacity-0",
								)}
							>
								<div className="flex w-full flex-col items-center">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-10 w-10 border border-neutral-200 bg-white text-neutral-900"
										onClick={toggleExamplesPanel}
										aria-pressed={examplesOpen}
										aria-label="Hide examples panel"
										title="Examples"
									>
										<LayoutTemplate className="h-4 w-4" />
									</Button>
									<div className="mt-2 w-full border-t border-neutral-200 pt-2">
										<div className="flex flex-col items-center gap-1 px-1">
											<span className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
												Filter
											</span>
											<div className="flex w-full flex-col items-center gap-1 px-1 group">
												{EXAMPLE_FILTERS.map((filter) => {
													const isActive = exampleFilters.includes(filter.id)
													return (
														<button
															key={filter.id}
															type="button"
															onClick={(event) => handleExampleFilterClick(filter.id, event)}
															className={cn(
																"w-full rounded-md border px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors",
																isActive
																	? "border-neutral-200 bg-white text-neutral-900"
																	: "border-transparent text-neutral-400 hover:bg-neutral-100",
															)}
															title={`Filter: ${filter.label}`}
															aria-label={`Filter: ${filter.label}`}
														>
															<filter.icon className="mx-auto h-4 w-4" />
														</button>
													)
												})}
												<p className="pt-1 text-[9px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
													Shift+click to multi-select
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div
								className={cn(
									"absolute top-2 left-0 right-0 flex flex-col items-center transition-all duration-200 ease-out",
									importsOpen
										? "translate-y-0 opacity-100"
										: "pointer-events-none -translate-y-2 opacity-0",
								)}
							>
								<div className="flex w-full flex-col items-center">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-10 w-10 border border-neutral-200 bg-white text-neutral-900"
										onClick={toggleImportsPanel}
										aria-pressed={importsOpen}
										aria-label="Hide imports panel"
										title="Imports"
									>
										<SlidersHorizontal className="h-4 w-4" />
									</Button>
									<div className="mt-2 w-full border-t border-neutral-200 pt-2">
										<div className="flex flex-col items-center gap-1 px-1">
											<span className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
												Filter
											</span>
											<div className="flex w-full flex-col items-center gap-1 px-1 group">
												{IMPORT_FILTERS.map((filter) => {
													const isActive = importsFilters.includes(filter.id)
													return (
														<button
															key={filter.id}
															type="button"
															onClick={(event) => handleImportsFilterClick(filter.id, event)}
															className={cn(
																"w-full rounded-md border px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors",
																isActive
																	? "border-neutral-200 bg-white text-neutral-900"
																	: "border-transparent text-neutral-400 hover:bg-neutral-100",
															)}
															title={`Filter: ${filter.label}`}
															aria-label={`Filter: ${filter.label}`}
														>
															<filter.icon className="mx-auto h-4 w-4" />
														</button>
													)
												})}
												<p className="pt-1 text-[9px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
													Shift+click to multi-select
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					{/* Left panel - scrollable sidebar */}
					<aside
						className={cn(
							"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
							detailsCollapsed ? "w-0 border-r-0" : "w-[19rem] border-r border-neutral-200",
						)}
					>
						<div
							className={cn(
								"flex h-full w-[19rem] flex-col transition-opacity duration-200",
								detailsCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
							)}
							aria-hidden={detailsCollapsed}
						>
							<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
								<span className="whitespace-nowrap">Snippet details</span>
							</div>

							<div className="overflow-y-auto">
								<MetadataFields tagHints={tagHints} />
								<ResolutionFields />
								<div className="px-4 pb-4">
									<div className="rounded-md border border-neutral-200 bg-white p-3">
										<div className="flex items-center justify-between">
											<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
												Starter template
											</p>
											<span className="text-[10px] uppercase tracking-widest text-neutral-300">
												Optional
											</span>
										</div>
										<div className="mt-2 space-y-2">
											{SNIPPET_TEMPLATE_OPTIONS.map((template) => {
												const isActive = selectedTemplateId === template.id
												return (
													<button
														key={template.id}
														type="button"
														onClick={() => setSelectedTemplateId(template.id)}
														className={cn(
															"flex w-full flex-col gap-1 rounded-md border px-2 py-2 text-left text-xs transition-colors",
															isActive
																? "border-neutral-900 bg-neutral-50 text-neutral-900"
																: "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
														)}
													>
														<span className="text-[11px] font-semibold uppercase tracking-widest">
															{template.label}
														</span>
														<span className="text-[10px] text-neutral-500">
															{template.description}
														</span>
													</button>
												)
											})}
										</div>
										<div className="mt-3 flex items-center justify-between">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => applySnippetTemplate(selectedTemplateId)}
											>
												Apply template
											</Button>
											<span className="text-[10px] text-neutral-400">Replaces current source</span>
										</div>
									</div>
								</div>

								{error && (
									<div className="px-4 py-3">
										<p className="text-sm text-red-500" role="alert">
											{error}
										</p>
									</div>
								)}
							</div>
						</div>
					</aside>

					{/* Examples panel */}
					<aside
						className={cn(
							"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
							examplesOpen ? "w-[21rem] border-r border-neutral-200" : "w-0 border-r-0",
						)}
					>
						<div
							className={cn(
								"flex h-full w-[21rem] flex-col transition-opacity duration-200",
								examplesOpen ? "opacity-100" : "pointer-events-none opacity-0",
							)}
							aria-hidden={!examplesOpen}
						>
							{examplesOpen && (
								<>
									<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
										Evencio examples
									</div>
									<div className="flex-1 overflow-y-auto px-3 pb-3">
										<div className="space-y-2">
											{filteredExamples.map((example) => {
												const isActive = activeExample?.id === example.id
												const isPreviewing = isExamplePreviewActive && isActive
												return (
													<button
														key={example.id}
														type="button"
														onClick={() => setActiveExampleId(example.id)}
														className={cn(
															"w-full rounded-md border px-3 py-2 text-left transition-colors",
															isActive
																? "border-neutral-900 bg-white"
																: "border-transparent text-neutral-600 hover:bg-neutral-100",
														)}
													>
														<div className="flex items-center justify-between">
															<span className="text-[10px] uppercase tracking-widest text-neutral-400">
																{SNIPPET_EXAMPLE_LABELS[example.category]}
															</span>
															<span className="text-[10px] text-neutral-400">
																{example.viewport.width}×{example.viewport.height}
															</span>
														</div>
														<p className="mt-1 text-sm font-medium text-neutral-900">
															{example.title}
														</p>
														<p className="mt-1 text-[11px] text-neutral-500">
															{example.description}
														</p>
														{isPreviewing && (
															<span className="mt-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
																Previewing
															</span>
														)}
													</button>
												)
											})}
										</div>
									</div>
									<div className="border-t border-neutral-200 bg-white/70 px-3 py-3">
										<div className="space-y-2">
											<div>
												<p className="text-[10px] uppercase tracking-widest text-neutral-400">
													Selected
												</p>
												<p className="text-sm font-medium text-neutral-900">
													{activeExample?.title ?? "Select an example"}
												</p>
												<p className="text-[11px] text-neutral-500">
													{activeExample?.description ?? "Browse curated Evencio templates."}
												</p>
											</div>
											<div className="flex gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => setIsExamplePreviewActive((prev) => !prev)}
													disabled={!activeExample}
												>
													{isExamplePreviewActive ? "Exit preview" : "Preview example"}
												</Button>
												<Button
													type="button"
													size="sm"
													onClick={applyExampleToEditor}
													disabled={!activeExample}
												>
													Use in editor
												</Button>
											</div>
											<p className="text-[10px] text-neutral-400">
												Preview examples without changing your current snippet.
											</p>
										</div>
									</div>
								</>
							)}
						</div>
					</aside>

					{/* Imports panel */}
					<aside
						className={cn(
							"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
							importsOpen ? "w-[21rem] border-r border-neutral-200" : "w-0 border-r-0",
						)}
					>
						<div
							className={cn(
								"flex h-full w-[21rem] flex-col transition-opacity duration-200",
								importsOpen ? "opacity-100" : "pointer-events-none opacity-0",
							)}
							aria-hidden={!importsOpen}
						>
							{importsOpen && (
								<>
									<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
										Imports
									</div>
									<div className="flex-1 space-y-6 overflow-y-auto px-3 pb-3">
										{importsSections.map((section) => (
											<Fragment key={section.id}>{section.node}</Fragment>
										))}
									</div>
								</>
							)}
						</div>
					</aside>

					{/* Center - Editor and Preview split */}
					<section className="flex flex-1 overflow-hidden">
						{/* Editor panel - 60% width */}
						<div
							className={cn(
								"flex overflow-hidden border-r border-neutral-200 transition-all duration-200",
								editorCollapsed ? (explorerCollapsed ? "w-0 border-r-0" : "w-52") : "w-[60%]",
							)}
						>
							{/* Explorer */}
							<div
								className={cn(
									"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
									explorerCollapsed ? "w-0 border-r-0" : "w-52 border-r border-neutral-200",
								)}
							>
								<div
									className={cn(
										"w-52 space-y-1 p-2 transition-opacity duration-200",
										explorerCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
									)}
									aria-hidden={explorerCollapsed}
								>
									<div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
										Explorer
									</div>
									<div className="space-y-2">
										<div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
											<span>Files</span>
											<span>
												{componentCount}/{SNIPPET_COMPONENT_LIMITS.hard} components
											</span>
										</div>
										<div className="space-y-1">
											{editorFiles.map((file) => {
												const Icon = file.icon
												const isActive = activeFile === file.id
												const isMainFile = file.id === "source"
												return (
													<button
														key={file.id}
														type="button"
														onClick={() => selectFile(file.id)}
														onContextMenu={(event) => handleFileContextMenu(event, file.id)}
														className={cn(
															"flex w-full flex-col gap-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
															isActive
																? "border-neutral-200 bg-white text-neutral-900"
																: "border-transparent text-neutral-600 hover:bg-neutral-100",
														)}
													>
														<div className="flex items-center justify-between gap-2">
															<div className="flex min-w-0 items-center gap-2">
																<Icon className="h-3.5 w-3.5 text-neutral-400" />
																<span className="truncate font-medium">{file.label}</span>
															</div>
															<div className="flex items-center gap-1">
																{isMainFile && (
																	<span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
																		Main
																	</span>
																)}
															</div>
														</div>
														<span className="text-[10px] text-neutral-400">{file.description}</span>
													</button>
												)
											})}
										</div>

										{componentExports.length === 0 && (
											<div className="rounded-md border border-dashed border-neutral-200 bg-white px-2 py-2 text-[11px] text-neutral-500">
												Export a component to enable preview and props generation.
											</div>
										)}

										<Button
											type="button"
											variant="outline"
											size="sm"
											className="w-full justify-start text-[11px]"
											onClick={handleAddComponent}
											disabled={!canAddComponent}
										>
											<Plus className="mr-2 h-3 w-3" />
											Add component
										</Button>

										{overSoftComponentLimit && !overHardComponentLimit && (
											<div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] text-amber-700">
												Soft limit is {SNIPPET_COMPONENT_LIMITS.soft} components. Consider
												consolidating exports.
											</div>
										)}
										{overHardComponentLimit && (
											<div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-[10px] text-red-700">
												Hard limit reached ({SNIPPET_COMPONENT_LIMITS.hard}). Remove extra exports
												to continue.
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Editor area */}
							<div
								className={cn(
									"flex flex-1 flex-col overflow-hidden transition-opacity duration-200",
									editorCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
								)}
							>
								{/* Tabs */}
								<div className="flex h-9 shrink-0 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-2">
									<div className="flex items-center gap-1">
										{openFiles.map((fileId) => {
											const file = editorFilesById.get(fileId)
											if (!file) return null
											const Icon = file.icon
											const isActive = activeFile === file.id
											const isOnlyTab = openFiles.length <= 1
											return (
												<div
													key={file.id}
													className={cn(
														"flex items-center gap-1 rounded-t-md border border-transparent px-1",
														isActive
															? "border-neutral-200 bg-white text-neutral-900"
															: "text-neutral-500 hover:text-neutral-700",
													)}
												>
													<button
														type="button"
														onClick={() => selectFile(file.id)}
														className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-medium"
													>
														<Icon className="h-3 w-3 text-neutral-400" />
														{file.label}
													</button>
													<button
														type="button"
														onClick={() => closeFileTab(file.id)}
														disabled={isOnlyTab}
														aria-label={`Close ${file.label} tab`}
														className={cn(
															"rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600",
															isOnlyTab && "pointer-events-none opacity-30",
														)}
													>
														<X className="h-3 w-3" />
													</button>
												</div>
											)
										})}
									</div>
									{isSourceEditorActive && (
										<>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 text-xs"
												onClick={() => fileInputRef.current?.click()}
												disabled={activeFile !== "source"}
											>
												<Upload className="mr-1 h-3 w-3" />
												Upload
											</Button>
											<input
												ref={fileInputRef}
												type="file"
												accept=".jsx,.tsx,.js,.ts"
												className="hidden"
												onChange={handleSourceFileUpload}
											/>
										</>
									)}
								</div>

								{/* Editor - fills remaining height */}
								<div className="flex-1 overflow-hidden">
									{isSourceEditorActive && (
										<FormField
											control={form.control}
											name="source"
											render={() => (
												<FormItem className="relative h-full">
													<FormControl>
														<ClientOnly fallback={<MonacoEditorSkeleton />}>
															<Suspense fallback={<MonacoEditorSkeleton />}>
																<LazyMonacoEditor
																	value={mainEditorSource}
																	onChange={handleMainSourceChange}
																	language="typescript"
																	path="Snippet.tsx"
																	extraLibs={componentTypeLibs}
																	definitionMap={componentDefinitionMap}
																	onDefinitionSelect={handleDefinitionSelect}
																	height="100%"
																	className="h-full"
																	markers={monacoMarkers}
																	markerOwner="snippet-compiler"
																/>
															</Suspense>
														</ClientOnly>
													</FormControl>
													<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
												</FormItem>
											)}
										/>
									)}

									{isComponentEditorActive && (
										<div className="h-full">
											<ClientOnly fallback={<MonacoEditorSkeleton />}>
												<Suspense fallback={<MonacoEditorSkeleton />}>
													<LazyMonacoEditor
														value={
															hasActiveComponentFile
																? activeComponentSource
																: "// Component file not found. Add a component to create this file."
														}
														onChange={handleComponentSourceChange}
														language="typescript"
														path={activeComponentFileName ?? "Component.tsx"}
														height="100%"
														className="h-full"
														markers={[]}
														markerOwner="snippet-compiler"
													/>
												</Suspense>
											</ClientOnly>
										</div>
									)}

									{isPropsSchemaActive && (
										<FormField
											control={form.control}
											name="propsSchema"
											render={({ field }) => (
												<FormItem className="relative h-full">
													<FormControl>
														<ClientOnly
															fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}
														>
															<Suspense
																fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}
															>
																<LazyMonacoEditor
																	value={field.value}
																	onChange={field.onChange}
																	language="json"
																	path="props.schema.json"
																	height="100%"
																	className="h-full bg-neutral-50"
																	readOnly
																/>
															</Suspense>
														</ClientOnly>
													</FormControl>
													<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
												</FormItem>
											)}
										/>
									)}

									{isDefaultPropsActive && (
										<FormField
											control={form.control}
											name="defaultProps"
											render={({ field }) => (
												<FormItem className="relative h-full">
													<FormControl>
														<ClientOnly
															fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}
														>
															<Suspense
																fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}
															>
																<LazyMonacoEditor
																	value={field.value ?? "{}"}
																	onChange={field.onChange}
																	language="json"
																	path="default.props.json"
																	height="100%"
																	className="h-full bg-neutral-50"
																	readOnly
																/>
															</Suspense>
														</ClientOnly>
													</FormControl>
													<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
												</FormItem>
											)}
										/>
									)}
								</div>

								{/* Status bar */}
								<div className="flex h-6 shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4">
									<div className="flex items-center gap-3">
										<p className="text-[11px] text-neutral-500">
											{isSourceEditorActive &&
												"Editing Snippet.tsx. Select a file to preview or edit."}
											{isComponentEditorActive &&
												`Editing ${activeFileMeta?.label ?? "component"} component file.`}
											{isPropsSchemaActive &&
												"Auto-generated from source. Defines the props contract used to validate inputs."}
											{isDefaultPropsActive &&
												"Auto-generated from source. Used when inserting the snippet and in preview mode."}
										</p>
										{derivedProps.duplicateKeys.length > 0 && (
											<div className="flex items-center gap-1 text-[11px] text-amber-600">
												<AlertCircle className="h-3 w-3" />
												<span>
													Duplicate prop keys merged: {derivedProps.duplicateKeys.join(", ")}
												</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-1.5">
										{compileStatus === "compiling" && (
											<>
												<Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
												<span className="text-[11px] text-neutral-400">Compiling...</span>
											</>
										)}
										{compileStatus === "success" && (
											<>
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span className="text-[11px] text-green-600">Ready</span>
											</>
										)}
										{compileStatus === "error" && (
											<>
												<AlertCircle className="h-3 w-3 text-red-500" />
												<span className="text-[11px] text-red-600">
													{compileErrors.length} error{compileErrors.length !== 1 ? "s" : ""}
												</span>
											</>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Preview panel - 40% width */}
						<div
							ref={previewContainerRef}
							className={cn(
								"flex flex-col overflow-hidden transition-all duration-200",
								editorCollapsed ? "flex-1" : "w-[40%]",
							)}
						>
							<SnippetPreview
								compiledCode={previewCompiledCode}
								props={previewPropsToUse}
								tailwindCss={previewTailwindCss}
								dimensions={previewDimensionsToUse}
								className="h-full"
								headerActions={previewHeaderActions}
							/>
						</div>
					</section>
				</form>
			</Form>
		</div>
	)
}
