import {
	FileBraces,
	FileCode,
	Grid,
	Image,
	Layers3,
	PanelTop,
	RectangleHorizontal,
	Share2,
	Sparkles,
	Type,
} from "lucide-react"
import type { SnippetExampleCategory } from "@/lib/snippets/examples"
import {
	STARTER_SNIPPET_DEFAULT_PROPS,
	STARTER_SNIPPET_PROPS_SCHEMA,
	STARTER_SNIPPET_SOURCE,
} from "@/lib/snippets/starter-snippet"
import type { AssetScope, SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "@/types/editor"

export const scopeOptions: { value: AssetScope; label: string; description: string }[] = [
	{ value: "personal", label: "Personal", description: "Visible to you only" },
	{ value: "event", label: "Event", description: "Shared within the current event" },
	{ value: "org", label: "Organization", description: "Reusable across the organization" },
]

export const DEFAULT_LICENSE = {
	id: "unlicensed",
	name: "Unspecified license",
} as const

export const STARTER_SOURCE = STARTER_SNIPPET_SOURCE
export const DEFAULT_PROPS_SCHEMA: SnippetPropsSchemaDefinition = STARTER_SNIPPET_PROPS_SCHEMA
export const DEFAULT_DEFAULT_PROPS: SnippetProps = STARTER_SNIPPET_DEFAULT_PROPS

export type SnippetFileId = "source" | "propsSchema" | "defaultProps"

export const SNIPPET_FILES: {
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

export type ResolutionPreset = {
	id: string
	label: string
	width: number
	height: number
}

export const CUSTOM_PRESET_ID = "custom"

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
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

export const findPreset = (width: number, height: number) =>
	RESOLUTION_PRESETS.find((preset) => preset.width === width && preset.height === height)

export type ExampleFilterId = "all" | SnippetExampleCategory

export const EXAMPLE_FILTERS: {
	id: ExampleFilterId
	label: string
	icon: typeof Grid
}[] = [
	{ id: "all", label: "All", icon: Grid },
	{ id: "hero", label: "Hero", icon: PanelTop },
	{ id: "social", label: "Social", icon: Share2 },
	{ id: "banner", label: "Banner", icon: RectangleHorizontal },
	{ id: "logo", label: "Logo", icon: Sparkles },
]

export type ImportFilterId = "all" | "fonts" | "svgs" | "icons" | "images"

export const IMPORT_FILTERS: {
	id: ImportFilterId
	label: string
	icon: typeof Grid
}[] = [
	{ id: "all", label: "All", icon: Grid },
	{ id: "fonts", label: "Fonts", icon: Type },
	{ id: "svgs", label: "SVGs", icon: Layers3 },
	{ id: "icons", label: "Icons", icon: Sparkles },
	{ id: "images", label: "Images", icon: Image },
]
