import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useRef,
	useState,
} from "react"
import type { StylesPanelExpandedState, StylesPanelSectionState } from "../types"

const defaultExpandedState = (): StylesPanelExpandedState => ({
	backgroundColor: false,
	borderWidth: false,
	borderColor: false,
	borderRadius: false,
	textColor: false,
	fontSize: false,
	fontWeight: false,
})

const defaultSectionOpenState = (): StylesPanelSectionState => ({
	background: false,
	border: false,
	radius: false,
	spacing: false,
	type: false,
})

const defaultPresenceState = () => ({
	background: false,
	border: false,
	radius: false,
	spacing: false,
	type: false,
})

export type PanelSectionsState = {
	expanded: StylesPanelExpandedState
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	sectionOpen: StylesPanelSectionState
	setSectionOpen: Dispatch<SetStateAction<StylesPanelSectionState>>
	sectionPresenceRef: MutableRefObject<ReturnType<typeof defaultPresenceState>>
	resetSections: () => void
}

export const usePanelSectionsState = (): PanelSectionsState => {
	const [expanded, setExpanded] = useState<StylesPanelExpandedState>(defaultExpandedState)
	const [sectionOpen, setSectionOpen] = useState<StylesPanelSectionState>(defaultSectionOpenState)
	const sectionPresenceRef = useRef(defaultPresenceState())

	const resetSections = useCallback(() => {
		setExpanded(defaultExpandedState)
		setSectionOpen(defaultSectionOpenState)
		sectionPresenceRef.current = defaultPresenceState()
	}, [])

	return {
		expanded,
		setExpanded,
		sectionOpen,
		setSectionOpen,
		sectionPresenceRef,
		resetSections,
	}
}
