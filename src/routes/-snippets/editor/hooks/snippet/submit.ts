import type { useNavigate } from "@tanstack/react-router"
import { nanoid } from "nanoid"
import { useCallback } from "react"
import type { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { generateSnippetThumbnail } from "@/lib/asset-library/snippet-thumbnail"
import { DEFAULT_SNIPPET_EXPORT, listSnippetComponentExports } from "@/lib/snippets"
import { SNIPPET_COMPONENT_LIMITS } from "@/lib/snippets/constraints"
import type { useDerivedSnippetProps } from "@/routes/-snippets/editor/hooks/snippet/derived-props"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import {
	buildSnippetAttribution,
	buildSnippetLicense,
} from "@/routes/-snippets/editor/snippet-asset-builders"
import type {
	Asset,
	AssetAttribution,
	AssetLicense,
	AssetScope,
	SnippetAsset,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetRuntime,
	SnippetViewport,
} from "@/types/asset-library"

type DerivedSnippetProps = ReturnType<typeof useDerivedSnippetProps>
type NavigateFn = ReturnType<typeof useNavigate>

interface CustomSnippetRegistrationInput {
	entry: string
	runtime: SnippetRuntime
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	viewport?: SnippetViewport
	entryExport?: string
	scope: AssetScope
	title: string
	description?: string | null
	tagNames: string[]
	license: AssetLicense
	attribution?: AssetAttribution | null
	source: string
	thumbnailDataUrl?: string | null
}

interface CustomSnippetUpdateInput {
	source: string
	scope: AssetScope
	title: string
	description?: string | null
	tagNames: string[]
	license: AssetLicense
	attribution?: AssetAttribution | null
	viewport?: SnippetViewport
	entryExport?: string
	thumbnailDataUrl?: string | null
}

type RegisterCustomSnippetAsset = (input: CustomSnippetRegistrationInput) => Promise<Asset>
type UpdateCustomSnippetAsset = (assetId: string, input: CustomSnippetUpdateInput) => Promise<Asset>

interface UseSnippetSubmitOptions {
	isEditing: boolean
	editAsset: SnippetAsset | null
	editTagNames: string[]
	activeComponentExport: string
	derivedProps: DerivedSnippetProps
	form: UseFormReturn<CustomSnippetValues>
	setError: (value: string | null) => void
	setIsSubmitting: (value: boolean) => void
	registerCustomSnippetAsset: RegisterCustomSnippetAsset
	updateCustomSnippetAsset: UpdateCustomSnippetAsset
	navigate: NavigateFn
	onSuccess?: (info: { mode: "update" | "create"; assetId: string }) => void
	/** Compiled code for thumbnail generation */
	compiledCode: string | null
	/** Tailwind CSS for thumbnail generation */
	tailwindCss: string | null
}

export function useSnippetSubmit({
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
	onSuccess,
	compiledCode,
	tailwindCss,
}: UseSnippetSubmitOptions) {
	const handleSubmit = useCallback(
		async (values: CustomSnippetValues) => {
			setError(null)
			setIsSubmitting(true)
			const tagNames = isEditing ? editTagNames : []
			try {
				// Generate thumbnail if we have compiled code
				let thumbnailDataUrl: string | null = null
				if (compiledCode) {
					try {
						thumbnailDataUrl = await generateSnippetThumbnail({
							compiledCode,
							props: derivedProps.defaultProps,
							tailwindCss,
							viewport: {
								width: values.viewportWidth,
								height: values.viewportHeight,
							},
						})
					} catch {
						// Continue save - thumbnail is nice-to-have
					}
				}

				if (isEditing) {
					if (!editAsset) {
						throw new Error("Snippet not found or not editable.")
					}
					await updateCustomSnippetAsset(editAsset.id, {
						source: values.source,
						scope: values.scope,
						title: values.title.trim(),
						description: values.description?.trim() || null,
						tagNames,
						license: buildSnippetLicense(values),
						attribution: buildSnippetAttribution(values),
						viewport: {
							width: values.viewportWidth,
							height: values.viewportHeight,
						},
						entryExport: activeComponentExport,
						thumbnailDataUrl,
					})
					form.reset(values, { keepDirty: false, keepTouched: false })
					toast.success("Changes saved")
					onSuccess?.({ mode: "update", assetId: editAsset.id })
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

				const createdAsset = await registerCustomSnippetAsset({
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
					tagNames,
					license: buildSnippetLicense(values),
					attribution: buildSnippetAttribution(values),
					thumbnailDataUrl,
				})

				toast.success("Snippet created")
				onSuccess?.({ mode: "create", assetId: createdAsset.id })
				navigate({ to: "/library" })
			} catch (err) {
				const fallback = isEditing ? "Failed to update snippet" : "Failed to create custom snippet"
				setError(err instanceof Error ? err.message : fallback)
			} finally {
				setIsSubmitting(false)
			}
		},
		[
			activeComponentExport,
			compiledCode,
			derivedProps.defaultProps,
			derivedProps.propsSchema,
			editAsset,
			editTagNames,
			form,
			isEditing,
			navigate,
			onSuccess,
			registerCustomSnippetAsset,
			setError,
			setIsSubmitting,
			tailwindCss,
			updateCustomSnippetAsset,
		],
	)

	return { handleSubmit }
}
