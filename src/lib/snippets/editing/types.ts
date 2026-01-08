export type SnippetEditableStyleGroup =
	| "background"
	| "border"
	| "radius"
	| "spacing"
	| "typography"

export type SnippetStyleEditCapabilities = Record<SnippetEditableStyleGroup, boolean>

export type SnippetIntrinsicTagRule = {
	tag: string
	label: string
	capabilities: SnippetStyleEditCapabilities
}
