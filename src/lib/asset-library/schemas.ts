import { z } from "zod"
import type {
	Asset,
	AssetAttribution,
	AssetCollection,
	AssetFavorite,
	AssetFileRef,
	AssetLicense,
	AssetMetadata,
	AssetScopeRef,
	AssetTag,
	AssetVersion,
	SnippetAssetDefinition,
	SnippetPropDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetViewport,
} from "@/types/asset-library"

export const assetScopeRefSchema = z.discriminatedUnion("scope", [
	z.object({
		scope: z.literal("global"),
	}),
	z.object({
		scope: z.literal("org"),
		orgId: z.string().min(1),
	}),
	z.object({
		scope: z.literal("event"),
		orgId: z.string().min(1),
		eventId: z.string().min(1),
	}),
	z.object({
		scope: z.literal("personal"),
		orgId: z.string().min(1),
		ownerUserId: z.string().min(1),
		eventId: z.string().min(1).nullable().optional(),
	}),
]) satisfies z.ZodType<AssetScopeRef>

export const assetLicenseSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		url: z.string().url().nullable().optional(),
		attributionRequired: z.boolean(),
	})
	.strict() satisfies z.ZodType<AssetLicense>

export const assetAttributionSchema = z
	.object({
		text: z.string().min(1),
		url: z.string().url().nullable().optional(),
	})
	.strict() satisfies z.ZodType<AssetAttribution>

export const assetMetadataSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().min(1).nullable().optional(),
		tags: z.array(z.string().min(1)),
		license: assetLicenseSchema,
		attribution: assetAttributionSchema.nullable().optional(),
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime(),
		createdBy: z.string().min(1).nullable().optional(),
		updatedBy: z.string().min(1).nullable().optional(),
	})
	.strict() satisfies z.ZodType<AssetMetadata>

export const assetFileRefSchema = z
	.object({
		storageKey: z.string().min(1),
		contentType: z.string().min(1),
		sizeBytes: z.number().int().nonnegative(),
		checksum: z.string().min(1),
		width: z.number().int().positive().nullable().optional(),
		height: z.number().int().positive().nullable().optional(),
	})
	.strict() satisfies z.ZodType<AssetFileRef>

export const assetTagSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		slug: z.string().min(1),
		scope: assetScopeRefSchema,
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime(),
	})
	.strict() satisfies z.ZodType<AssetTag>

export const assetCollectionSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		description: z.string().min(1).nullable().optional(),
		scope: assetScopeRefSchema,
		assetIds: z.array(z.string().min(1)),
		createdAt: z.string().datetime(),
		updatedAt: z.string().datetime(),
	})
	.strict() satisfies z.ZodType<AssetCollection>

export const assetFavoriteSchema = z
	.object({
		id: z.string().min(1),
		assetId: z.string().min(1),
		userId: z.string().min(1),
		createdAt: z.string().datetime(),
	})
	.strict() satisfies z.ZodType<AssetFavorite>

export const assetVersionSchema = z
	.object({
		id: z.string().min(1),
		assetId: z.string().min(1),
		version: z.number().int().positive(),
		changelog: z.string().min(1).nullable().optional(),
		createdAt: z.string().datetime(),
		createdBy: z.string().min(1).nullable().optional(),
	})
	.strict() satisfies z.ZodType<AssetVersion>

export const snippetPropDefinitionSchema = z
	.object({
		key: z.string().min(1),
		label: z.string().min(1),
		type: z.enum(["string", "number", "boolean", "color", "image", "enum", "object", "array"]),
		required: z.boolean().optional(),
		default: z.unknown().optional(),
		description: z.string().min(1).nullable().optional(),
		enumValues: z.array(z.string().min(1)).optional(),
	})
	.strict() satisfies z.ZodType<SnippetPropDefinition>

export const snippetPropsSchemaDefinitionSchema = z
	.object({
		version: z.literal(1),
		props: z.array(snippetPropDefinitionSchema),
	})
	.strict() satisfies z.ZodType<SnippetPropsSchemaDefinition>

export const snippetPropsSchema = z.record(
	z.string(),
	z.unknown(),
) satisfies z.ZodType<SnippetProps>

export const snippetViewportSchema = z
	.object({
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	})
	.strict() satisfies z.ZodType<SnippetViewport>

export const snippetAssetDefinitionSchema = z
	.object({
		entry: z.string().min(1),
		runtime: z.literal("react"),
		propsSchema: snippetPropsSchemaDefinitionSchema,
		source: z.string().optional(),
		viewport: snippetViewportSchema.optional(),
		entryExport: z.string().min(1).optional(),
	})
	.strict() satisfies z.ZodType<SnippetAssetDefinition>

export const assetSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("image"),
		id: z.string().min(1),
		scope: assetScopeRefSchema,
		metadata: assetMetadataSchema,
		version: z.number().int().positive(),
		file: assetFileRefSchema,
		hidden: z.boolean().default(false),
	}),
	z.object({
		type: z.literal("svg"),
		id: z.string().min(1),
		scope: assetScopeRefSchema,
		metadata: assetMetadataSchema,
		version: z.number().int().positive(),
		file: assetFileRefSchema,
		hidden: z.boolean().default(false),
	}),
	z.object({
		type: z.literal("snippet"),
		id: z.string().min(1),
		scope: assetScopeRefSchema,
		metadata: assetMetadataSchema,
		version: z.number().int().positive(),
		snippet: snippetAssetDefinitionSchema,
		defaultProps: snippetPropsSchema,
		hidden: z.boolean().default(false),
	}),
]) satisfies z.ZodType<Asset>
