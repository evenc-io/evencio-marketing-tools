import type { LucideIcon } from "lucide-react"
import type { SnippetFileId } from "@/routes/-snippets/new/constants"

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
