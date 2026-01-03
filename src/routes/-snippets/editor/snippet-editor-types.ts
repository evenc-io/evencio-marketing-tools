import type { LucideIcon } from "lucide-react"
import type { SnippetFileId } from "@/routes/-snippets/editor/constants"
import type { AssetScope } from "@/types/asset-library"

export type SnippetEditorFileId = SnippetFileId | `component:${string}`

export type SnippetEditorFileKind = "source" | "propsSchema" | "defaultProps" | "component"

export interface SnippetEditorFile {
	id: SnippetEditorFileId
	label: string
	description: string
	kind: SnippetEditorFileKind
	icon: LucideIcon
	exportName?: string
	fileName?: string
	deletable: boolean
}

export interface SnippetExplorerItem {
	id: string
	title: string
	description?: string | null
	scope: AssetScope
	updatedLabel: string
	hasDraft: boolean
}
