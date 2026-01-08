import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react"
import type { StyleReadResponse } from "@/lib/engine/protocol"

type BorderDraftsArgs = {
	state: StyleReadResponse | null
	focusedFieldRef: MutableRefObject<string | null>
}

export type BorderDraftsState = {
	borderWidthMode: "scale" | "custom"
	setBorderWidthMode: Dispatch<SetStateAction<"scale" | "custom">>
	borderWidthScale: string
	setBorderWidthScale: Dispatch<SetStateAction<string>>
	borderWidthCustom: string
	setBorderWidthCustom: Dispatch<SetStateAction<string>>
	radiusMode: "scale" | "custom"
	setRadiusMode: Dispatch<SetStateAction<"scale" | "custom">>
	radiusScale: string
	setRadiusScale: Dispatch<SetStateAction<string>>
	radiusCustom: string
	setRadiusCustom: Dispatch<SetStateAction<string>>
	resetBorderDrafts: () => void
}

export const useBorderDrafts = ({
	state,
	focusedFieldRef,
}: BorderDraftsArgs): BorderDraftsState => {
	const [borderWidthMode, setBorderWidthMode] = useState<"scale" | "custom">("scale")
	const [borderWidthScale, setBorderWidthScale] = useState("1")
	const [borderWidthCustom, setBorderWidthCustom] = useState("")

	const [radiusMode, setRadiusMode] = useState<"scale" | "custom">("scale")
	const [radiusScale, setRadiusScale] = useState("md")
	const [radiusCustom, setRadiusCustom] = useState("")

	const resetBorderDrafts = useCallback(() => {
		setBorderWidthMode("scale")
		setBorderWidthScale("1")
		setBorderWidthCustom("")
		setRadiusMode("scale")
		setRadiusScale("md")
		setRadiusCustom("")
	}, [])

	useEffect(() => {
		if (!state?.found) return

		const shouldSync = (prefix: string) => !(focusedFieldRef.current?.startsWith(prefix) ?? false)

		if (shouldSync("borderWidth")) {
			const value = state.properties.borderWidth.value
			if (typeof value === "number" && [1, 2, 4, 8].includes(value)) {
				setBorderWidthMode("scale")
				setBorderWidthScale(String(value))
				setBorderWidthCustom("")
			} else if (typeof value === "number") {
				setBorderWidthMode("custom")
				setBorderWidthCustom(String(value))
			} else {
				setBorderWidthMode("scale")
				setBorderWidthScale("1")
				setBorderWidthCustom("")
			}
		}

		if (shouldSync("borderRadius")) {
			const value = state.properties.borderRadius.value
			if (typeof value === "number") {
				setRadiusMode("custom")
				setRadiusCustom(String(value))
			} else if (typeof value === "string") {
				setRadiusMode("scale")
				setRadiusScale(value)
				setRadiusCustom("")
			} else {
				setRadiusMode("scale")
				setRadiusScale("md")
				setRadiusCustom("")
			}
		}
	}, [focusedFieldRef, state])

	return {
		borderWidthMode,
		setBorderWidthMode,
		borderWidthScale,
		setBorderWidthScale,
		borderWidthCustom,
		setBorderWidthCustom,
		radiusMode,
		setRadiusMode,
		radiusScale,
		setRadiusScale,
		radiusCustom,
		setRadiusCustom,
		resetBorderDrafts,
	}
}
