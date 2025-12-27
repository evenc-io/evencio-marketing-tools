import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useFormContext } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
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
import { SNIPPET_TEMPLATE_OPTIONS } from "@/lib/snippets/templates"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type { AssetLicense, AssetScope } from "@/types/asset-library"

const optionalUrl = z.union([z.literal(""), z.string().url("Enter a valid URL")])

const optionalText = z.string()

const isFileList = (value: unknown): value is FileList =>
	typeof FileList !== "undefined" && value instanceof FileList

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

// Base object shape (without refinements) for extension
const metadataBaseShape = {
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	tags: z.string().min(1, "Add at least one tag"),
	scope: z.enum(["personal", "event", "org"]),
	licenseName: optionalText,
	licenseId: optionalText,
	licenseUrl: optionalUrl,
	attributionRequired: z.boolean(),
	attributionText: z.string().optional(),
	attributionUrl: optionalUrl,
}

// Shared refinement logic
const metadataRefinement = (
	data: { tags: string; attributionRequired: boolean; attributionText?: string },
	ctx: z.RefinementCtx,
) => {
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
}

const metadataSchema = z.object(metadataBaseShape).superRefine(metadataRefinement)

const fileSchema = z.custom<FileList>(
	(value) => isFileList(value) && value.length > 0,
	"File is required",
)

const assetUploadSchema = z
	.object({
		...metadataBaseShape,
		assetType: z.enum(["image", "svg"]),
		file: fileSchema,
	})
	.superRefine(metadataRefinement)
	.superRefine((data, ctx) => {
		const files = data.file
		if (!isFileList(files) || files.length === 0) return
		const file = files[0]
		const name = file.name.toLowerCase()
		const isSvg = file.type === "image/svg+xml" || name.endsWith(".svg")
		const isImage = file.type.startsWith("image/") && !isSvg

		if (data.assetType === "svg" && !isSvg) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["file"],
				message: "Upload an SVG file for SVG assets",
			})
		}

		if (data.assetType === "image" && !isImage) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["file"],
				message: "Upload a PNG, JPG, or WEBP for image assets",
			})
		}
	})

type AssetMetadataValues = z.infer<typeof metadataSchema>
type AssetUploadValues = z.infer<typeof assetUploadSchema>

const scopeOptions: { value: AssetScope; label: string; description: string }[] = [
	{ value: "personal", label: "Personal", description: "Visible to you only" },
	{ value: "event", label: "Event", description: "Shared within the current event" },
	{ value: "org", label: "Organization", description: "Reusable across the organization" },
]

const textareaClass =
	"min-h-[96px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"

const DEFAULT_LICENSE = {
	id: "unlicensed",
	name: "Unspecified license",
} as const

function AssetMetadataFields({ tagHints }: { tagHints: string[] }) {
	const form = useFormContext<AssetMetadataValues>()
	const attributionRequired = form.watch("attributionRequired")
	const tagHintText =
		tagHints.length > 0 ? `Existing tags: ${tagHints.slice(0, 5).join(", ")}` : null

	return (
		<div className="space-y-4">
			<FormField
				control={form.control}
				name="title"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Title</FormLabel>
						<FormControl>
							<Input placeholder="Launch hero graphic" {...field} />
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
						<FormLabel>Description</FormLabel>
						<FormControl>
							<textarea
								className={textareaClass}
								placeholder="Short summary for teammates browsing the library."
								{...field}
							/>
						</FormControl>
						<FormDescription>Optional, but helps search results.</FormDescription>
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
							<Input placeholder="brand, social, launch" {...field} />
						</FormControl>
						<FormDescription>
							Comma-separated tags power search and filters. {tagHintText}
						</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name="scope"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Scope</FormLabel>
						<FormControl>
							<select
								{...field}
								className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
							>
								{scopeOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</FormControl>
						<FormDescription>
							{scopeOptions.find((option) => option.value === field.value)?.description}
						</FormDescription>
					</FormItem>
				)}
			/>

			<div className="grid gap-4 sm:grid-cols-2">
				<FormField
					control={form.control}
					name="licenseName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>License name (optional)</FormLabel>
							<FormControl>
								<Input placeholder="CC BY 4.0" {...field} />
							</FormControl>
							<FormDescription>Leave blank to mark as {DEFAULT_LICENSE.name}.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="licenseId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>License ID (optional)</FormLabel>
							<FormControl>
								<Input placeholder="cc-by-4" {...field} />
							</FormControl>
							<FormDescription>Leave blank to auto-generate when a license is set.</FormDescription>
						</FormItem>
					)}
				/>
			</div>

			<FormField
				control={form.control}
				name="licenseUrl"
				render={({ field }) => (
					<FormItem>
						<FormLabel>License URL (optional)</FormLabel>
						<FormControl>
							<Input placeholder="https://creativecommons.org/licenses/by/4.0/" {...field} />
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name="attributionRequired"
				render={({ field }) => (
					<FormItem className="flex items-center gap-2">
						<FormControl>
							<input
								type="checkbox"
								checked={field.value}
								onChange={(event) => field.onChange(event.target.checked)}
								className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900"
							/>
						</FormControl>
						<FormLabel className="text-sm font-medium text-neutral-700">
							Attribution required
						</FormLabel>
					</FormItem>
				)}
			/>

			{attributionRequired && (
				<div className="grid gap-4 sm:grid-cols-2">
					<FormField
						control={form.control}
						name="attributionText"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Attribution text</FormLabel>
								<FormControl>
									<Input placeholder="Evencio Design Team" {...field} />
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
								<FormLabel>Attribution URL</FormLabel>
								<FormControl>
									<Input placeholder="https://example.com" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			)}
		</div>
	)
}

export function AssetImportDialog() {
	const [open, setOpen] = useState(false)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const [isUploading, setIsUploading] = useState(false)

	const tags = useAssetLibraryStore((state) => state.tags)
	const createAssetFromUpload = useAssetLibraryStore((state) => state.createAssetFromUpload)
	const tagHints = useMemo(() => tags.map((tag) => tag.name), [tags])

	const baseDefaults = {
		title: "",
		description: "",
		tags: "",
		scope: "personal" as const,
		licenseName: "",
		licenseId: "",
		licenseUrl: "",
		attributionRequired: false,
		attributionText: "",
		attributionUrl: "",
	}

	const uploadForm = useForm<AssetUploadValues>({
		resolver: zodResolver(assetUploadSchema),
		mode: "onChange",
		defaultValues: {
			...baseDefaults,
			assetType: "image",
		},
	})

	const resetForm = () => {
		uploadForm.reset()
		setUploadError(null)
		setIsUploading(false)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) {
			resetForm()
		}
	}

	const buildLicense = (values: AssetMetadataValues): AssetLicense => {
		const licenseName = values.licenseName?.trim() || DEFAULT_LICENSE.name
		const licenseId = values.licenseId?.trim() || slugify(licenseName) || DEFAULT_LICENSE.id
		return {
			id: licenseId,
			name: licenseName,
			url: values.licenseUrl,
			attributionRequired: values.attributionRequired,
		}
	}

	const buildAttribution = (values: AssetMetadataValues) => {
		if (!values.attributionRequired) return null
		const text = values.attributionText?.trim()
		if (!text) return null
		return {
			text,
			url: values.attributionUrl,
		}
	}

	const handleUploadSubmit = async (values: AssetUploadValues) => {
		setUploadError(null)
		setIsUploading(true)
		try {
			const files = values.file
			const file = isFileList(files) ? files[0] : null
			if (!file) {
				throw new Error("File is required")
			}
			await createAssetFromUpload({
				type: values.assetType,
				file,
				scope: values.scope,
				title: values.title.trim(),
				description: values.description?.trim() || null,
				tagNames: parseTagInput(values.tags),
				license: buildLicense(values),
				attribution: buildAttribution(values),
			})
			resetForm()
			setOpen(false)
		} catch (error) {
			setUploadError(error instanceof Error ? error.message : "Failed to import asset")
		} finally {
			setIsUploading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm" className="gap-2">
					<Plus className="h-4 w-4" />
					Add asset
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Import asset</DialogTitle>
					<DialogDescription>
						Upload images or SVGs. Files are stored locally in your browser (IndexedDB).
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-4">
					<div>
						<p className="text-sm font-medium text-neutral-900">Create a custom snippet</p>
						<p className="text-xs text-neutral-500">
							Build reusable React components with a code editor
						</p>
					</div>
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					{SNIPPET_TEMPLATE_OPTIONS.map((template) => (
						<Link
							key={template.id}
							to="/snippets/new"
							search={{ template: template.id }}
							onClick={() => handleOpenChange(false)}
							className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50"
						>
							<span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
								{template.label}
							</span>
							<span className="text-xs text-neutral-500">{template.description}</span>
						</Link>
					))}
				</div>
				<p className="text-[10px] text-neutral-500">
					Choose a starter example now. You can switch templates later in the editor.
				</p>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t border-neutral-200" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-white px-2 text-neutral-500">or upload a file</span>
					</div>
				</div>

				<Form {...uploadForm}>
					<form onSubmit={uploadForm.handleSubmit(handleUploadSubmit)} className="space-y-5">
						<FormField
							control={uploadForm.control}
							name="assetType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Asset type</FormLabel>
									<FormControl>
										<select
											{...field}
											className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
										>
											<option value="image">Image</option>
											<option value="svg">SVG</option>
										</select>
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={uploadForm.control}
							name="file"
							render={({ field }) => (
								<FormItem>
									<FormLabel>File</FormLabel>
									<FormControl>
										<Input
											type="file"
											accept="image/*,.svg"
											name={field.name}
											ref={field.ref}
											onBlur={field.onBlur}
											onChange={(event) => field.onChange(event.target.files)}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<AssetMetadataFields tagHints={tagHints} />

						{uploadError && (
							<p className="text-sm text-red-500" role="alert">
								{uploadError}
							</p>
						)}

						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={!uploadForm.formState.isValid || isUploading}>
								{isUploading ? "Importing..." : "Import asset"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
