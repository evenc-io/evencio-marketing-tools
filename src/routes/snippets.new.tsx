import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ChevronDown, FileCode, Upload } from "lucide-react"
import { nanoid } from "nanoid"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useFormContext } from "react-hook-form"
import { z } from "zod"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
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
import { MonacoEditor } from "@/components/ui/monaco-editor"
import { snippetPropsSchema, snippetPropsSchemaDefinitionSchema } from "@/lib/asset-library"
import { cn } from "@/lib/utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type {
	AssetLicense,
	AssetScope,
	SnippetProps,
	SnippetPropsSchemaDefinition,
} from "@/types/asset-library"

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

const STARTER_SOURCE = `export default function MySnippet({ headline = "Hello World" }) {
  return (
    <div style={{ padding: 24, background: "#f5f5f5" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>{headline}</h1>
    </div>
  )
}
`

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

			{/* Section 2: Component - Open by default */}
			<CollapsibleSection title="Component" defaultOpen>
				<div className="space-y-3">
					<div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs">
						<span className="text-neutral-500">Runtime</span>
						<span className="font-medium text-neutral-900">React</span>
					</div>

					<FormField
						control={form.control}
						name="propsSchema"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Props schema</FormLabel>
								<FormControl>
									<MonacoEditor
										value={field.value}
										onChange={field.onChange}
										language="json"
										height={80}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="defaultProps"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-neutral-500">Default props</FormLabel>
								<FormControl>
									<MonacoEditor
										value={field.value ?? "{}"}
										onChange={field.onChange}
										language="json"
										height={50}
									/>
								</FormControl>
							</FormItem>
						)}
					/>
				</div>
			</CollapsibleSection>

			{/* Section 3: Visibility - Collapsed by default */}
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

			{/* Section 4: License - Collapsed by default */}
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

function NewSnippetPage() {
	const navigate = useNavigate()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)

	const tags = useAssetLibraryStore((state) => state.tags)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const registerCustomSnippetAsset = useAssetLibraryStore(
		(state) => state.registerCustomSnippetAsset,
	)
	const tagHints = useMemo(() => tags.map((tag) => tag.name), [tags])

	useEffect(() => {
		loadLibrary()
	}, [loadLibrary])

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
			source: STARTER_SOURCE,
			propsSchema:
				'{\n  "version": 1,\n  "props": [\n    { "key": "headline", "label": "Headline", "type": "string" }\n  ]\n}',
			defaultProps: '{\n  "headline": "Hello World"\n}',
		},
	})

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
			const propsSchema = JSON.parse(values.propsSchema) as SnippetPropsSchemaDefinition
			const defaultProps = values.defaultProps?.trim()
				? (JSON.parse(values.defaultProps) as SnippetProps)
				: {}

			const entry = `custom:${nanoid()}`

			await registerCustomSnippetAsset({
				entry,
				runtime: "react",
				propsSchema,
				defaultProps,
				source: values.source,
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

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-white">
			{/* Fixed header */}
			<header className="h-12 shrink-0 border-b border-neutral-200 bg-white">
				<div className="flex h-full items-center justify-between px-4">
					<div className="flex items-center gap-3">
						<Logo size="sm" href="/" />
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
					{/* Left panel - scrollable sidebar */}
					<aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-neutral-50">
						<div className="border-b border-neutral-200 px-4 py-3">
							<h2 className="text-sm font-semibold text-neutral-900">Snippet details</h2>
						</div>

						<MetadataFields tagHints={tagHints} />

						{error && (
							<div className="px-4 py-3">
								<p className="text-sm text-red-500" role="alert">
									{error}
								</p>
							</div>
						)}
					</aside>

					{/* Center - Monaco editor (fills remaining width) */}
					<section className="flex flex-1 flex-col overflow-hidden">
						{/* Editor toolbar */}
						<div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4">
							<div className="flex items-center gap-2">
								<FileCode className="h-4 w-4 text-neutral-500" />
								<span className="text-sm font-medium text-neutral-700">Source code</span>
							</div>
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
						</div>

						{/* Editor - fills remaining height */}
						<div className="flex-1 overflow-hidden">
							<FormField
								control={form.control}
								name="source"
								render={({ field }) => (
									<FormItem className="relative h-full">
										<FormControl>
											<MonacoEditor
												value={field.value}
												onChange={field.onChange}
												language="typescript"
												height="100%"
												className="h-full"
											/>
										</FormControl>
										<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
									</FormItem>
								)}
							/>
						</div>

						{/* Status bar */}
						<div className="flex h-6 shrink-0 items-center border-t border-neutral-200 bg-neutral-100 px-4">
							<p className="text-[11px] text-neutral-500">
								Must include a default export. Props from schema will be passed to your component.
							</p>
						</div>
					</section>
				</form>
			</Form>
		</div>
	)
}
