import {
	assetCollectionSchema,
	assetSchema,
	assetTagSchema,
	snippetPropsSchemaDefinitionSchema,
} from "./schemas"

const SAMPLE_TIMESTAMP = "2024-01-01T00:00:00.000Z"

export const SAMPLE_TAG = assetTagSchema.parse({
	id: "tag_brand",
	name: "Brand",
	slug: "brand",
	scope: {
		scope: "org",
		orgId: "org_demo",
	},
	createdAt: SAMPLE_TIMESTAMP,
	updatedAt: SAMPLE_TIMESTAMP,
})

export const SAMPLE_COLLECTION = assetCollectionSchema.parse({
	id: "collection_event",
	name: "Event Essentials",
	description: "Core assets for event promotion",
	scope: {
		scope: "org",
		orgId: "org_demo",
	},
	assetIds: ["asset_image_01", "asset_snippet_01"],
	createdAt: SAMPLE_TIMESTAMP,
	updatedAt: SAMPLE_TIMESTAMP,
})

const sampleSnippetPropsSchema = snippetPropsSchemaDefinitionSchema.parse({
	version: 1,
	props: [
		{
			key: "headline",
			label: "Headline",
			type: "string",
			required: true,
			default: "Evencio Launch Night",
		},
		{
			key: "accent",
			label: "Accent Color",
			type: "color",
			default: "#111111",
		},
	],
})

export const SAMPLE_ASSETS = [
	assetSchema.parse({
		id: "asset_image_01",
		type: "image",
		scope: {
			scope: "org",
			orgId: "org_demo",
		},
		version: 1,
		file: {
			storageKey: "storage/image-asset-01",
			contentType: "image/png",
			sizeBytes: 24576,
			checksum: "checksum-image-01",
			width: 1200,
			height: 630,
		},
		metadata: {
			title: "Launch Social Graphic",
			description: "Square social tile for launch day",
			tags: [SAMPLE_TAG.id],
			license: {
				id: "license-cc-by-4",
				name: "CC BY 4.0",
				url: "https://creativecommons.org/licenses/by/4.0/",
				attributionRequired: true,
			},
			attribution: {
				text: "Evencio Design Team",
				url: "https://evencio.example.com",
			},
			createdAt: SAMPLE_TIMESTAMP,
			updatedAt: SAMPLE_TIMESTAMP,
			createdBy: "user_demo",
			updatedBy: "user_demo",
		},
	}),
	assetSchema.parse({
		id: "asset_snippet_01",
		type: "snippet",
		scope: {
			scope: "org",
			orgId: "org_demo",
		},
		version: 1,
		snippet: {
			entry: "@/lib/snippets/launch-hero",
			runtime: "react",
			propsSchema: sampleSnippetPropsSchema,
		},
		defaultProps: {
			headline: "Evencio Launch Night",
			accent: "#111111",
		},
		metadata: {
			title: "Launch Hero Snippet",
			description: "Reusable hero component for event pages.",
			tags: [SAMPLE_TAG.id],
			license: {
				id: "license-evencio-internal",
				name: "Evencio Internal Use",
				attributionRequired: false,
			},
			attribution: null,
			createdAt: SAMPLE_TIMESTAMP,
			updatedAt: SAMPLE_TIMESTAMP,
			createdBy: "user_demo",
			updatedBy: "user_demo",
		},
	}),
]
