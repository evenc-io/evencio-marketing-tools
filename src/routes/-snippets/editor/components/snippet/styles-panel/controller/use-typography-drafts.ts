import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react"
import type { StyleReadResponse } from "@/lib/engine/protocol"

type TypographyDraftsArgs = {
	state: StyleReadResponse | null
	focusedFieldRef: MutableRefObject<string | null>
}

export type TypographyDraftsState = {
	fontSizeMode: "scale" | "custom"
	setFontSizeMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontSizeScale: string
	setFontSizeScale: Dispatch<SetStateAction<string>>
	fontSizeCustom: string
	setFontSizeCustom: Dispatch<SetStateAction<string>>
	fontWeightMode: "scale" | "custom"
	setFontWeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontWeightScale: string
	setFontWeightScale: Dispatch<SetStateAction<string>>
	fontWeightCustom: string
	setFontWeightCustom: Dispatch<SetStateAction<string>>
	fontFamily: string
	setFontFamily: Dispatch<SetStateAction<string>>
	lineHeightMode: "scale" | "custom"
	setLineHeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	lineHeightScale: string
	setLineHeightScale: Dispatch<SetStateAction<string>>
	lineHeightCustom: string
	setLineHeightCustom: Dispatch<SetStateAction<string>>
	letterSpacingMode: "scale" | "custom"
	setLetterSpacingMode: Dispatch<SetStateAction<"scale" | "custom">>
	letterSpacingScale: string
	setLetterSpacingScale: Dispatch<SetStateAction<string>>
	letterSpacingCustom: string
	setLetterSpacingCustom: Dispatch<SetStateAction<string>>
	textAlign: string
	setTextAlign: Dispatch<SetStateAction<string>>
	textTransform: string
	setTextTransform: Dispatch<SetStateAction<string>>
	fontStyle: string
	setFontStyle: Dispatch<SetStateAction<string>>
	textDecoration: string
	setTextDecoration: Dispatch<SetStateAction<string>>
	resetTypographyDrafts: () => void
}

const fontWeightTokenFromNumber = (value: number) => {
	switch (Math.round(value)) {
		case 100:
			return "thin"
		case 200:
			return "extralight"
		case 300:
			return "light"
		case 400:
			return "normal"
		case 500:
			return "medium"
		case 600:
			return "semibold"
		case 700:
			return "bold"
		case 800:
			return "extrabold"
		case 900:
			return "black"
		default:
			return null
	}
}

export const useTypographyDrafts = ({
	state,
	focusedFieldRef,
}: TypographyDraftsArgs): TypographyDraftsState => {
	const [fontSizeMode, setFontSizeMode] = useState<"scale" | "custom">("scale")
	const [fontSizeScale, setFontSizeScale] = useState("base")
	const [fontSizeCustom, setFontSizeCustom] = useState("")

	const [fontWeightMode, setFontWeightMode] = useState<"scale" | "custom">("scale")
	const [fontWeightScale, setFontWeightScale] = useState("semibold")
	const [fontWeightCustom, setFontWeightCustom] = useState("")

	const [fontFamily, setFontFamily] = useState("")

	const [lineHeightMode, setLineHeightMode] = useState<"scale" | "custom">("scale")
	const [lineHeightScale, setLineHeightScale] = useState("")
	const [lineHeightCustom, setLineHeightCustom] = useState("")

	const [letterSpacingMode, setLetterSpacingMode] = useState<"scale" | "custom">("scale")
	const [letterSpacingScale, setLetterSpacingScale] = useState("")
	const [letterSpacingCustom, setLetterSpacingCustom] = useState("")

	const [textAlign, setTextAlign] = useState("")
	const [textTransform, setTextTransform] = useState("")
	const [fontStyle, setFontStyle] = useState("")
	const [textDecoration, setTextDecoration] = useState("")

	const resetTypographyDrafts = useCallback(() => {
		setFontSizeMode("scale")
		setFontSizeScale("base")
		setFontSizeCustom("")
		setFontWeightMode("scale")
		setFontWeightScale("semibold")
		setFontWeightCustom("")
		setFontFamily("")
		setLineHeightMode("scale")
		setLineHeightScale("")
		setLineHeightCustom("")
		setLetterSpacingMode("scale")
		setLetterSpacingScale("")
		setLetterSpacingCustom("")
		setTextAlign("")
		setTextTransform("")
		setFontStyle("")
		setTextDecoration("")
	}, [])

	useEffect(() => {
		if (!state?.found) return

		const shouldSync = (prefix: string) => !(focusedFieldRef.current?.startsWith(prefix) ?? false)

		if (shouldSync("fontSize")) {
			const value = state.properties.fontSize.value
			if (typeof value === "number") {
				setFontSizeMode("custom")
				setFontSizeCustom(String(value))
			} else if (typeof value === "string") {
				setFontSizeMode("scale")
				setFontSizeScale(value)
				setFontSizeCustom("")
			} else {
				setFontSizeMode("scale")
				setFontSizeScale("base")
				setFontSizeCustom("")
			}
		}

		if (shouldSync("fontWeight")) {
			const value = state.properties.fontWeight.value
			if (typeof value === "string") {
				setFontWeightMode("scale")
				setFontWeightScale(value)
				setFontWeightCustom("")
			} else if (typeof value === "number") {
				const token = fontWeightTokenFromNumber(value)
				if (token) {
					setFontWeightMode("scale")
					setFontWeightScale(token)
					setFontWeightCustom("")
				} else {
					setFontWeightMode("custom")
					setFontWeightCustom(String(value))
				}
			} else {
				setFontWeightMode("scale")
				setFontWeightScale("semibold")
				setFontWeightCustom("")
			}
		}

		if (shouldSync("fontFamily")) {
			const value = state.properties.fontFamily.value
			setFontFamily(typeof value === "string" ? value : "")
		}

		if (shouldSync("lineHeight")) {
			const value = state.properties.lineHeight.value
			if (typeof value === "number") {
				setLineHeightMode("custom")
				setLineHeightCustom(String(value))
				setLineHeightScale("")
			} else if (typeof value === "string") {
				if (value.startsWith("[") && value.endsWith("]")) {
					setLineHeightMode("custom")
					setLineHeightCustom(value.slice(1, -1))
					setLineHeightScale("")
				} else {
					setLineHeightMode("scale")
					setLineHeightScale(value)
					setLineHeightCustom("")
				}
			} else {
				setLineHeightMode("scale")
				setLineHeightScale("")
				setLineHeightCustom("")
			}
		}

		if (shouldSync("letterSpacing")) {
			const value = state.properties.letterSpacing.value
			if (typeof value === "string") {
				if (value.startsWith("[") && value.endsWith("]")) {
					setLetterSpacingMode("custom")
					setLetterSpacingCustom(value.slice(1, -1))
					setLetterSpacingScale("")
				} else {
					setLetterSpacingMode("scale")
					setLetterSpacingScale(value)
					setLetterSpacingCustom("")
				}
			} else {
				setLetterSpacingMode("scale")
				setLetterSpacingScale("")
				setLetterSpacingCustom("")
			}
		}

		if (shouldSync("textAlign")) {
			const value = state.properties.textAlign.value
			setTextAlign(typeof value === "string" ? value : "")
		}

		if (shouldSync("textTransform")) {
			const value = state.properties.textTransform.value
			setTextTransform(typeof value === "string" ? value : "")
		}

		if (shouldSync("fontStyle")) {
			const value = state.properties.fontStyle.value
			setFontStyle(typeof value === "string" ? value : "")
		}

		if (shouldSync("textDecoration")) {
			const value = state.properties.textDecoration.value
			setTextDecoration(typeof value === "string" ? value : "")
		}
	}, [focusedFieldRef, state])

	return {
		fontSizeMode,
		setFontSizeMode,
		fontSizeScale,
		setFontSizeScale,
		fontSizeCustom,
		setFontSizeCustom,
		fontWeightMode,
		setFontWeightMode,
		fontWeightScale,
		setFontWeightScale,
		fontWeightCustom,
		setFontWeightCustom,
		fontFamily,
		setFontFamily,
		lineHeightMode,
		setLineHeightMode,
		lineHeightScale,
		setLineHeightScale,
		lineHeightCustom,
		setLineHeightCustom,
		letterSpacingMode,
		setLetterSpacingMode,
		letterSpacingScale,
		setLetterSpacingScale,
		letterSpacingCustom,
		setLetterSpacingCustom,
		textAlign,
		setTextAlign,
		textTransform,
		setTextTransform,
		fontStyle,
		setFontStyle,
		textDecoration,
		setTextDecoration,
		resetTypographyDrafts,
	}
}
