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
	SlidersHorizontal,
	Upload,
} from "lucide-react"
import { nanoid } from "nanoid"
import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { ClientOnly } from "@/components/ui/client-only"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { SCREEN_GUARD_DEFAULTS, useScreenGuard } from "@/lib/screen-guard"
import { deriveSnippetPropsFromSource, useSnippetCompiler } from "@/lib/snippets"
import { clampSnippetViewport } from "@/lib/snippets/constraints"
import { SNIPPET_EXAMPLE_LABELS, SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import { AVAILABLE_FONTS, TRUSTED_FONT_PROVIDERS } from "@/lib/snippets/imports"
import { DEFAULT_PREVIEW_DIMENSIONS } from "@/lib/snippets/preview-runtime"
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

function NewSnippetPage() {
	const navigate = useNavigate()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const deriveVersionRef = useRef(0)
	const [error, setError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [useComponentDefaults, setUseComponentDefaults] = useState(false)
	const [activeFile, setActiveFile] = useState<SnippetFileId>("source")
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
	}>(() => ({
		propsSchema: DEFAULT_PROPS_SCHEMA,
		defaultProps: DEFAULT_DEFAULT_PROPS,
	}))
	const derivedPropsRef = useRef(derivedProps)

	const tags = useAssetLibraryStore((state) => state.tags)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const registerCustomSnippetAsset = useAssetLibraryStore(
		(state) => state.registerCustomSnippetAsset,
	)
	const tagHints = useMemo(() => tags.map((tag) => tag.name), [tags])
	const isFocusPanelOpen = examplesOpen || importsOpen
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

	// Watch source for live compilation
	const watchedSource = form.watch("source")

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
				const derived = await deriveSnippetPropsFromSource(watchedSource)
				if (isCancelled || version !== deriveVersionRef.current) return

				const propsSchemaJson = JSON.stringify(derived.propsSchema, null, 2)
				const defaultPropsJson = JSON.stringify(derived.defaultProps, null, 2)
				const currentDerived = derivedPropsRef.current
				const shouldUpdateDerived =
					JSON.stringify(currentDerived.propsSchema, null, 2) !== propsSchemaJson ||
					JSON.stringify(currentDerived.defaultProps, null, 2) !== defaultPropsJson

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

	const handleSourceFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (!files?.length) return
		const file = files[0]
		const reader = new FileReader()
		reader.onload = () => {
			const content = reader.result as string
			form.setValue("source", content, { shouldValidate: true })
			if (!form.getValues("title")) {
				const name = file.name.replace(/\.(jsx?|tsx?)$/, "")
				form.setValue("title", name)
			}
		}
		reader.readAsText(file)
	}

	const applyExampleToEditor = () => {
		if (!activeExample) return
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

		setActiveFile("source")
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
			const propsSchema = derivedProps.propsSchema
			const defaultProps = derivedProps.defaultProps

			const entry = `custom:${nanoid()}`

			await registerCustomSnippetAsset({
				entry,
				runtime: "react",
				propsSchema,
				defaultProps,
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
							disabled={!form.formState.isValid || isCreating}
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
									{SNIPPET_FILES.map((file) => {
										const Icon = file.icon
										return (
											<button
												key={file.id}
												type="button"
												onClick={() => setActiveFile(file.id)}
												className={cn(
													"flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
													activeFile === file.id
														? "border-neutral-200 bg-white text-neutral-900"
														: "border-transparent text-neutral-600 hover:bg-neutral-100",
												)}
											>
												<Icon className="h-3.5 w-3.5 text-neutral-400" />
												<div className="flex flex-col">
													<span className="font-medium">{file.label}</span>
													<span className="text-[10px] text-neutral-400">{file.description}</span>
												</div>
											</button>
										)
									})}
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
										{SNIPPET_FILES.map((file) => {
											const Icon = file.icon
											return (
												<button
													key={file.id}
													type="button"
													onClick={() => setActiveFile(file.id)}
													className={cn(
														"flex items-center gap-1.5 rounded-t-md border border-transparent px-2 py-1 text-[11px] font-medium transition-colors",
														activeFile === file.id
															? "border-neutral-200 bg-white text-neutral-900"
															: "text-neutral-500 hover:text-neutral-700",
													)}
												>
													<Icon className="h-3 w-3 text-neutral-400" />
													{file.label}
												</button>
											)
										})}
									</div>
									{activeFile === "source" && (
										<>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 text-xs"
												onClick={() => fileInputRef.current?.click()}
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
									{activeFile === "source" && (
										<FormField
											control={form.control}
											name="source"
											render={({ field }) => (
												<FormItem className="relative h-full">
													<FormControl>
														<ClientOnly fallback={<MonacoEditorSkeleton />}>
															<Suspense fallback={<MonacoEditorSkeleton />}>
																<LazyMonacoEditor
																	value={field.value}
																	onChange={field.onChange}
																	language="typescript"
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

									{activeFile === "propsSchema" && (
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

									{activeFile === "defaultProps" && (
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
									<p className="text-[11px] text-neutral-500">
										{activeFile === "source" &&
											"Must include a default export. Props from schema will be passed to your component."}
										{activeFile === "propsSchema" &&
											"Auto-generated from source. Defines the props contract used to validate inputs."}
										{activeFile === "defaultProps" &&
											"Auto-generated from source. Used when inserting the snippet and in preview mode."}
									</p>
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
