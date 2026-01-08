import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react"
import type { StyleReadResponse } from "@/lib/engine/protocol"

type SpacingDraftsArgs = {
	state: StyleReadResponse | null
	focusedFieldRef: MutableRefObject<string | null>
}

export type SpacingDraftsState = {
	padding: string
	setPadding: Dispatch<SetStateAction<string>>
	paddingX: string
	setPaddingX: Dispatch<SetStateAction<string>>
	paddingY: string
	setPaddingY: Dispatch<SetStateAction<string>>
	paddingTop: string
	setPaddingTop: Dispatch<SetStateAction<string>>
	paddingRight: string
	setPaddingRight: Dispatch<SetStateAction<string>>
	paddingBottom: string
	setPaddingBottom: Dispatch<SetStateAction<string>>
	paddingLeft: string
	setPaddingLeft: Dispatch<SetStateAction<string>>
	resetSpacingDrafts: () => void
}

export const useSpacingDrafts = ({
	state,
	focusedFieldRef,
}: SpacingDraftsArgs): SpacingDraftsState => {
	const [padding, setPadding] = useState("")
	const [paddingX, setPaddingX] = useState("")
	const [paddingY, setPaddingY] = useState("")
	const [paddingTop, setPaddingTop] = useState("")
	const [paddingRight, setPaddingRight] = useState("")
	const [paddingBottom, setPaddingBottom] = useState("")
	const [paddingLeft, setPaddingLeft] = useState("")

	const resetSpacingDrafts = useCallback(() => {
		setPadding("")
		setPaddingX("")
		setPaddingY("")
		setPaddingTop("")
		setPaddingRight("")
		setPaddingBottom("")
		setPaddingLeft("")
	}, [])

	useEffect(() => {
		if (!state?.found) return

		const shouldSync = (prefix: string) => !(focusedFieldRef.current?.startsWith(prefix) ?? false)

		if (shouldSync("padding")) {
			setPadding(state.properties.padding.value ?? "")
			setPaddingX(state.properties.paddingX.value ?? "")
			setPaddingY(state.properties.paddingY.value ?? "")
			setPaddingTop(state.properties.paddingTop.value ?? "")
			setPaddingRight(state.properties.paddingRight.value ?? "")
			setPaddingBottom(state.properties.paddingBottom.value ?? "")
			setPaddingLeft(state.properties.paddingLeft.value ?? "")
		}
	}, [focusedFieldRef, state])

	return {
		padding,
		setPadding,
		paddingX,
		setPaddingX,
		paddingY,
		setPaddingY,
		paddingTop,
		setPaddingTop,
		paddingRight,
		setPaddingRight,
		paddingBottom,
		setPaddingBottom,
		paddingLeft,
		setPaddingLeft,
		resetSpacingDrafts,
	}
}
