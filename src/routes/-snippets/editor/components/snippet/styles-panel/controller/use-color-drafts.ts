import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react"
import type { StyleReadResponse } from "@/lib/engine/protocol"
import type { ColorDraft } from "../types"
import { toColorDraft } from "../utils"

type ColorDraftsArgs = {
	state: StyleReadResponse | null
	focusedFieldRef: MutableRefObject<string | null>
}

export type ColorDraftsState = {
	backgroundDraft: ColorDraft
	setBackgroundDraft: Dispatch<SetStateAction<ColorDraft>>
	borderColorDraft: ColorDraft
	setBorderColorDraft: Dispatch<SetStateAction<ColorDraft>>
	textColorDraft: ColorDraft
	setTextColorDraft: Dispatch<SetStateAction<ColorDraft>>
	resetColorDrafts: () => void
}

export const useColorDrafts = ({ state, focusedFieldRef }: ColorDraftsArgs): ColorDraftsState => {
	const [backgroundDraft, setBackgroundDraft] = useState<ColorDraft>(() => toColorDraft(null))
	const [borderColorDraft, setBorderColorDraft] = useState<ColorDraft>(() => toColorDraft(null))
	const [textColorDraft, setTextColorDraft] = useState<ColorDraft>(() => toColorDraft(null))

	const resetColorDrafts = useCallback(() => {
		setBackgroundDraft(toColorDraft(null))
		setBorderColorDraft(toColorDraft(null))
		setTextColorDraft(toColorDraft(null))
	}, [])

	useEffect(() => {
		if (!state?.found) return

		const shouldSync = (prefix: string) => !(focusedFieldRef.current?.startsWith(prefix) ?? false)

		if (shouldSync("backgroundColor")) {
			setBackgroundDraft(toColorDraft(state.properties.backgroundColor.value))
		}
		if (shouldSync("borderColor")) {
			setBorderColorDraft(toColorDraft(state.properties.borderColor.value))
		}
		if (shouldSync("textColor")) {
			setTextColorDraft(toColorDraft(state.properties.textColor.value))
		}
	}, [focusedFieldRef, state])

	return {
		backgroundDraft,
		setBackgroundDraft,
		borderColorDraft,
		setBorderColorDraft,
		textColorDraft,
		setTextColorDraft,
		resetColorDrafts,
	}
}
