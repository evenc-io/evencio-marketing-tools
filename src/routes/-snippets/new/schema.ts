import { z } from "zod"
import { snippetPropsSchema, snippetPropsSchemaDefinitionSchema } from "@/lib/asset-library"
import { SNIPPET_DIMENSION_LIMITS } from "@/lib/snippets/constraints"
import type { SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"

const optionalUrl = z.union([z.literal(""), z.string().url("Enter a valid URL")])

export const parseTagInput = (value: string) =>
	value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)

export const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")

export const customSnippetSchema = z
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

export type CustomSnippetValues = z.infer<typeof customSnippetSchema>
