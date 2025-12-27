import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	ChevronDown,
	FileBraces,
	FileCode,
	FolderOpen,
	Info,
	Loader2,
	Upload,
} from "lucide-react"
import { nanoid } from "nanoid"
import {
	type ChangeEvent,
	lazy,
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useForm, useFormContext } from "react-hook-form"
import { z } from "zod"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { ClientOnly } from "@/components/ui/client-only"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { snippetPropsSchema, snippetPropsSchemaDefinitionSchema } from "@/lib/asset-library"
import { SCREEN_GUARD_DEFAULTS, useScreenGuard } from "@/lib/screen-guard"
import { deriveSnippetPropsFromSource, useSnippetCompiler } from "@/lib/snippets"
import { clampSnippetViewport, SNIPPET_DIMENSION_LIMITS } from "@/lib/snippets/constraints"
import { DEFAULT_PREVIEW_DIMENSIONS } from "@/lib/snippets/preview-runtime"
import {
	STARTER_SNIPPET_DEFAULT_PROPS,
	STARTER_SNIPPET_PROPS_SCHEMA,
	STARTER_SNIPPET_SOURCE,
} from "@/lib/snippets/starter-snippet"
import { cn } from "@/lib/utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type {
	AssetLicense,
	AssetScope,
	SnippetProps,
	SnippetPropsSchemaDefinition,
} from "@/types/asset-library"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "@/types/editor"

export const Route = createFileRoute("/snippets/new")({
	component: NewSnippetPage,
})

const optionalUrl = z.union([z.literal(""), z.string().url("Enter a valid URL")])

const parseTagInput = (value: string) =>
	value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")

const customSnippetSchema = z
	.object({
		title: z.string().min(1, "Title is required"),
		description: z.string().optional(),
		tags: z.string().min(1, "Add at least one tag"),
		scope: z.enum(["personal", "event", "org"]),
		licenseName: z.string(),
		licenseId: z.string(),
		licenseUrl: optionalUrl,
		attributionRequired: z.boolean(),
		attributionText: z.string().optional(),
		attributionUrl: optionalUrl,
		viewportPreset: z.string().optional(),
		viewportWidth: z
			.number()
			.int("Width must be a whole number")
			.min(SNIPPET_DIMENSION_LIMITS.min, `Min ${SNIPPET_DIMENSION_LIMITS.min}px`)
			.max(SNIPPET_DIMENSION_LIMITS.max, `Max ${SNIPPET_DIMENSION_LIMITS.max}px`),
		viewportHeight: z
			.number()
			.int("Height must be a whole number")
			.min(SNIPPET_DIMENSION_LIMITS.min, `Min ${SNIPPET_DIMENSION_LIMITS.min}px`)
			.max(SNIPPET_DIMENSION_LIMITS.max, `Max ${SNIPPET_DIMENSION_LIMITS.max}px`),
		source: z.string().min(1, "Source code is required"),
		propsSchema: z.string().min(1, "Props schema is required"),
		defaultProps: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (parseTagInput(data.tags).length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["tags"],
				message: "Add at least one tag",
			})
		}

		if (data.attributionRequired && !data.attributionText?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["attributionText"],
				message: "Attribution text is required when attribution is enabled",
			})
		}

		const source = data.source.trim()
		const hasDefaultExport =
			/export\s+default\s+function/.test(source) || /export\s+default\s+/.test(source)

		if (!hasDefaultExport) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["source"],
				message: "Snippet must have a default export (e.g., 'export default function MySnippet')",
			})
		}

		try {
			const parsed = JSON.parse(data.propsSchema) as SnippetPropsSchemaDefinition
			snippetPropsSchemaDefinitionSchema.parse(parsed)
		} catch {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["propsSchema"],
				message: "Props schema must be valid JSON matching the snippet schema definition",
			})
		}

		if (data.defaultProps?.trim()) {
			try {
				const parsed = JSON.parse(data.defaultProps) as SnippetProps
				snippetPropsSchema.parse(parsed)
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["defaultProps"],
					message: "Default props must be valid JSON object data",
				})
			}
		}

		if (data.viewportWidth * data.viewportHeight > SNIPPET_DIMENSION_LIMITS.maxArea) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["viewportWidth"],
				message: `Max ${Math.round(SNIPPET_DIMENSION_LIMITS.maxArea / 1_000_000)}MP total area`,
			})
		}
	})

type CustomSnippetValues = z.infer<typeof customSnippetSchema>

const scopeOptions: { value: AssetScope; label: string; description: string }[] = [
	{ value: "personal", label: "Personal", description: "Visible to you only" },
	{ value: "event", label: "Event", description: "Shared within the current event" },
	{ value: "org", label: "Organization", description: "Reusable across the organization" },
]

const DEFAULT_LICENSE = {
	id: "unlicensed",
	name: "Unspecified license",
} as const

const STARTER_SOURCE = STARTER_SNIPPET_SOURCE
const DEFAULT_PROPS_SCHEMA: SnippetPropsSchemaDefinition = STARTER_SNIPPET_PROPS_SCHEMA
const DEFAULT_DEFAULT_PROPS: SnippetProps = STARTER_SNIPPET_DEFAULT_PROPS

type SnippetFileId = "source" | "propsSchema" | "defaultProps"

const SNIPPET_FILES: {
	id: SnippetFileId
	label: string
	description: string
	language: "typescript" | "json"
	icon: typeof FileCode
}[] = [
	{
		id: "source",
		label: "Snippet.tsx",
		description: "Source code",
		language: "typescript",
		icon: FileCode,
	},
	{
		id: "propsSchema",
		label: "props.schema.json",
		description: "Props schema",
		language: "json",
		icon: FileBraces,
	},
	{
		id: "defaultProps",
		label: "default.props.json",
		description: "Default props",
		language: "json",
		icon: FileBraces,
	},
]

type ResolutionPreset = {
	id: string
	label: string
	width: number
	height: number
}

const CUSTOM_PRESET_ID = "custom"

const RESOLUTION_PRESETS: ResolutionPreset[] = [
	{ id: "og", label: "Open Graph", width: 1200, height: 630 },
	...Object.entries(SOCIAL_DIMENSIONS).map(([id, dim]) => ({
		id,
		label: dim.label,
		width: dim.width,
		height: dim.height,
	})),
	...Object.entries(POSTER_DIMENSIONS)
		.filter(([key]) => key !== "custom")
		.map(([id, dim]) => ({
			id,
			label: dim.label,
			width: dim.width,
			height: dim.height,
		})),
]

const findPreset = (width: number, height: number) =>
	RESOLUTION_PRESETS.find((preset) => preset.width === width && preset.height === height)

const PANEL_STATE_KEY = "evencio.snippets.new.panel-state"

type PanelState = {
	detailsCollapsed: boolean
	explorerCollapsed: boolean
}

const readPanelState = (): PanelState | null => {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem(PANEL_STATE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<PanelState>
		if (!parsed || typeof parsed !== "object") return null
		return {
			detailsCollapsed: Boolean(parsed.detailsCollapsed),
			explorerCollapsed: Boolean(parsed.explorerCollapsed),
		}
	} catch {
		return null
	}
}

const writePanelState = (state: PanelState) => {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state))
	} catch {
		// Ignore storage failures (private mode, quota exceeded, etc.)
	}
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect
const LazyMonacoEditor = lazy(() =>
	import("@/components/ui/monaco-editor").then((mod) => ({
		default: mod.MonacoEditor,
	})),
)

const MonacoEditorSkeleton = ({ className }: { className?: string }) => (
	<div
		className={cn(
			"h-full w-full animate-pulse rounded-md border border-neutral-200 bg-white/70",
			className,
		)}
		aria-busy="true"
	/>
)

interface CollapsibleSectionProps {
	title: string
	defaultOpen?: boolean
	children: React.ReactNode
}

function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen)

	return (
		<div className="border-b border-neutral-200">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-neutral-100"
			>
				<span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
					{title}
				</span>
				<ChevronDown
					className={cn("h-4 w-4 text-neutral-400 transition-transform", isOpen && "rotate-180")}
				/>
			</button>
			{isOpen && <div className="px-4 pb-4 pt-2">{children}</div>}
		</div>
	)
}

function MetadataFields({ tagHints }: { tagHints: string[] }) {
	const form = useFormContext<CustomSnippetValues>()
	const attributionRequired = form.watch("attributionRequired")
	const tagHintText = tagHints.length > 0 ? `Existing: ${tagHints.slice(0, 3).join(", ")}` : null

	return (
		<div className="flex flex-col">
			{/* Section 1: Basics - Open by default */}
			<CollapsibleSection title="Basics" defaultOpen>
				<div className="space-y-3">
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Title</FormLabel>
								<FormControl>
									<Input placeholder="Hero Banner" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-neutral-500">Description</FormLabel>
								<FormControl>
									<Input placeholder="Short summary" {...field} />
								</FormControl>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="tags"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Tags</FormLabel>
								<FormControl>
									<Input placeholder="banner, hero, social" {...field} />
								</FormControl>
								<FormDescription className="text-xs">{tagHintText}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</CollapsibleSection>

			{/* Section 2: Visibility - Collapsed by default */}
			<CollapsibleSection title="Visibility">
				<FormField
					control={form.control}
					name="scope"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Scope</FormLabel>
							<FormControl>
								<select
									{...field}
									className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
								>
									{scopeOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</FormControl>
							<FormDescription className="text-xs">
								{scopeOptions.find((option) => option.value === field.value)?.description}
							</FormDescription>
						</FormItem>
					)}
				/>
			</CollapsibleSection>

			{/* Section 3: License - Collapsed by default */}
			<CollapsibleSection title="License">
				<div className="space-y-3">
					<div className="grid gap-2 grid-cols-2">
						<FormField
							control={form.control}
							name="licenseName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="CC BY 4.0" className="h-8" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="licenseId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>ID</FormLabel>
									<FormControl>
										<Input placeholder="cc-by-4" className="h-8" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name="licenseUrl"
						render={({ field }) => (
							<FormItem>
								<FormLabel>URL</FormLabel>
								<FormControl>
									<Input placeholder="https://..." className="h-8" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="attributionRequired"
						render={({ field }) => (
							<FormItem className="flex items-center gap-2 pt-1">
								<FormControl>
									<input
										type="checkbox"
										checked={field.value}
										onChange={(event) => field.onChange(event.target.checked)}
										className="h-4 w-4 rounded border-neutral-300"
									/>
								</FormControl>
								<FormLabel className="text-sm text-neutral-600">Requires attribution</FormLabel>
							</FormItem>
						)}
					/>

					{attributionRequired && (
						<div className="ml-5 space-y-2 border-l-2 border-neutral-200 pl-3">
							<FormField
								control={form.control}
								name="attributionText"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Credit</FormLabel>
										<FormControl>
											<Input placeholder="Author name" className="h-8" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="attributionUrl"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-neutral-500">Credit URL</FormLabel>
										<FormControl>
											<Input placeholder="https://..." className="h-8" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}

function ResolutionFields() {
	const form = useFormContext<CustomSnippetValues>()
	const viewportWidth = form.watch("viewportWidth")
	const viewportHeight = form.watch("viewportHeight")
	const viewport = useMemo(
		() => ({
			width: Number.isFinite(viewportWidth) ? viewportWidth : DEFAULT_PREVIEW_DIMENSIONS.width,
			height: Number.isFinite(viewportHeight) ? viewportHeight : DEFAULT_PREVIEW_DIMENSIONS.height,
		}),
		[viewportHeight, viewportWidth],
	)
	const activePreset = findPreset(viewport.width, viewport.height)
	const selectedId = activePreset?.id ?? CUSTOM_PRESET_ID

	useEffect(() => {
		form.setValue("viewportPreset", selectedId, {
			shouldDirty: false,
			shouldValidate: false,
		})
	}, [form, selectedId])

	const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const nextId = event.target.value
		if (nextId === CUSTOM_PRESET_ID) return
		const preset = RESOLUTION_PRESETS.find((item) => item.id === nextId)
		if (!preset) return
		form.setValue("viewportWidth", preset.width, { shouldValidate: true })
		form.setValue("viewportHeight", preset.height, { shouldValidate: true })
	}

	const clampViewport = () => {
		if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return
		const clamped = clampSnippetViewport(viewport)
		if (clamped.width !== viewport.width) {
			form.setValue("viewportWidth", clamped.width, { shouldValidate: true })
		}
		if (clamped.height !== viewport.height) {
			form.setValue("viewportHeight", clamped.height, { shouldValidate: true })
		}
	}

	return (
		<CollapsibleSection title="Resolution">
			<div className="space-y-3">
				<FormField
					control={form.control}
					name="viewportPreset"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Preset</FormLabel>
							<FormControl>
								<select
									{...field}
									value={selectedId}
									onChange={(event) => {
										field.onChange(event)
										handlePresetChange(event)
									}}
									className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
								>
									<option value={CUSTOM_PRESET_ID}>Custom</option>
									{RESOLUTION_PRESETS.map((preset) => (
										<option key={preset.id} value={preset.id}>
											{preset.label} · {preset.width}×{preset.height}
										</option>
									))}
								</select>
							</FormControl>
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="viewportWidth"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-xs text-neutral-500">Width</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={SNIPPET_DIMENSION_LIMITS.min}
										max={SNIPPET_DIMENSION_LIMITS.max}
										step={1}
										inputMode="numeric"
										value={field.value}
										onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
										onBlur={() => {
											field.onBlur()
											clampViewport()
										}}
										className="h-8"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="viewportHeight"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-xs text-neutral-500">Height</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={SNIPPET_DIMENSION_LIMITS.min}
										max={SNIPPET_DIMENSION_LIMITS.max}
										step={1}
										inputMode="numeric"
										value={field.value}
										onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
										onBlur={() => {
											field.onBlur()
											clampViewport()
										}}
										className="h-8"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormDescription className="text-[11px] text-neutral-400">
					Limits: {SNIPPET_DIMENSION_LIMITS.min}-{SNIPPET_DIMENSION_LIMITS.max}px per side,{" "}
					{Math.round(SNIPPET_DIMENSION_LIMITS.maxArea / 1_000_000)}MP max
				</FormDescription>
			</div>
		</CollapsibleSection>
	)
}

function NewSnippetPage() {
	const navigate = useNavigate()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const deriveVersionRef = useRef(0)
	const [error, setError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [useComponentDefaults, setUseComponentDefaults] = useState(false)
	const [activeFile, setActiveFile] = useState<SnippetFileId>("source")
	const [detailsCollapsed, setDetailsCollapsed] = useState(false)
	const [explorerCollapsed, setExplorerCollapsed] = useState(false)
	const [panelsHydrated, setPanelsHydrated] = useState(false)
	const previewContainerRef = useRef<HTMLDivElement>(null)
	const [isPreviewVisible, setIsPreviewVisible] = useState(true)
	const screenGate = useScreenGuard()
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
	const previewDimensions = useMemo(
		() =>
			clampSnippetViewport({
				width: Number.isFinite(viewportWidth) ? viewportWidth : DEFAULT_PREVIEW_DIMENSIONS.width,
				height: Number.isFinite(viewportHeight)
					? viewportHeight
					: DEFAULT_PREVIEW_DIMENSIONS.height,
			}),
		[viewportHeight, viewportWidth],
	)

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
		}
		setPanelsHydrated(true)
	}, [])

	useEffect(() => {
		if (!panelsHydrated) return
		writePanelState({ detailsCollapsed, explorerCollapsed })
	}, [detailsCollapsed, explorerCollapsed, panelsHydrated])

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

	useEffect(() => {
		if (!isPreviewVisible) return
		if (compileStatus !== "success") return
		if (tailwindCss !== null) return
		void compile()
	}, [compile, compileStatus, isPreviewVisible, tailwindCss])

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
					<div className="w-12 shrink-0 border-r border-neutral-200 bg-neutral-50">
						<div className="flex flex-col items-center gap-1 py-2">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={cn(
									"h-9 w-9",
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
									"h-9 w-9",
									!explorerCollapsed && "border border-neutral-200 bg-white text-neutral-900",
								)}
								onClick={() => setExplorerCollapsed((prev) => !prev)}
								aria-pressed={!explorerCollapsed}
								aria-label={explorerCollapsed ? "Show explorer panel" : "Hide explorer panel"}
								title="Explorer"
							>
								<FolderOpen className="h-4 w-4" />
							</Button>
						</div>
					</div>
					{/* Left panel - scrollable sidebar */}
					<aside
						className={cn(
							"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
							detailsCollapsed ? "w-0 border-r-0" : "w-72 border-r border-neutral-200",
						)}
					>
						<div
							className={cn(
								"flex h-full w-72 flex-col transition-opacity duration-200",
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

					{/* Center - Editor and Preview split */}
					<section className="flex flex-1 overflow-hidden">
						{/* Editor panel - 60% width */}
						<div className="flex w-[60%] overflow-hidden border-r border-neutral-200">
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
							<div className="flex flex-1 flex-col overflow-hidden">
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
						<div ref={previewContainerRef} className="flex w-[40%] flex-col overflow-hidden">
							<SnippetPreview
								compiledCode={compiledCode}
								props={previewProps}
								tailwindCss={tailwindCss}
								dimensions={previewDimensions}
								className="h-full"
								headerActions={
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
								}
							/>
						</div>
					</section>
				</form>
			</Form>
		</div>
	)
}
