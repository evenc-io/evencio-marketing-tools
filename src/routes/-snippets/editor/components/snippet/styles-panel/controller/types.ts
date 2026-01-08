import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import type {
	ColorDraft,
	ScheduleApplyFn,
	StylesPanelExpandedState,
	StylesPanelSectionState,
} from "../types"

export type SnippetStylesPanelController = {
	focusedFieldRef: MutableRefObject<string | null>
	expanded: StylesPanelExpandedState
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	sectionOpen: StylesPanelSectionState
	setSectionOpen: Dispatch<SetStateAction<StylesPanelSectionState>>
	backgroundDraft: ColorDraft
	setBackgroundDraft: Dispatch<SetStateAction<ColorDraft>>
	borderColorDraft: ColorDraft
	setBorderColorDraft: Dispatch<SetStateAction<ColorDraft>>
	textColorDraft: ColorDraft
	setTextColorDraft: Dispatch<SetStateAction<ColorDraft>>
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
	panelLabel: string
	disabledReason: string | null
	canApply: boolean
	supportsBackground: boolean
	supportsBorder: boolean
	supportsRadius: boolean
	supportsSpacing: boolean
	supportsTypography: boolean
	hasBorderWidth: boolean
	hasBorderColor: boolean
	showBackground: boolean
	showBorderWidth: boolean
	showBorderColor: boolean
	showRadius: boolean
	showTextColor: boolean
	showFontSize: boolean
	showFontWeight: boolean
	baseSelectClassName: string
	scheduleApply: ScheduleApplyFn
}
