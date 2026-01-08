import type { StyleUpdateRequest } from "@/lib/engine/protocol"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"

export type StyleUpdatePayload = Omit<StyleUpdateRequest, "source" | "line" | "column">

export type ColorDraft = {
	mode: "token" | "custom"
	token: string
	hex: string
}

export type StylesPanelExpandedState = {
	backgroundColor: boolean
	borderWidth: boolean
	borderColor: boolean
	borderRadius: boolean
	textColor: boolean
	fontSize: boolean
	fontWeight: boolean
}

export type StylesPanelSectionState = {
	background: boolean
	border: boolean
	radius: boolean
	type: boolean
}

export type ScheduleApplyFn = (
	payload: StyleUpdatePayload,
	label: string,
	options?: { immediate?: boolean },
) => void

export interface SnippetStylesPanelProps {
	open: boolean
	target: SnippetInspectTextRequest | null
	state: import("@/lib/engine/protocol").StyleReadResponse | null
	isReading?: boolean
	isApplying?: boolean
	onClose: () => void
	onApply: (payload: StyleUpdatePayload, label: string, target: SnippetInspectTextRequest) => void
}
