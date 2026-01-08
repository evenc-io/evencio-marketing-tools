import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useEffect,
	useMemo,
} from "react"
import type { StyleReadResponse } from "@/lib/engine/protocol"
import type { StylesPanelExpandedState, StylesPanelSectionState } from "../types"

type SectionPresence = {
	background: boolean
	border: boolean
	radius: boolean
	spacing: boolean
	type: boolean
}

type SectionVisibilityArgs = {
	state: StyleReadResponse | null
	focusedFieldRef: MutableRefObject<string | null>
	expanded: StylesPanelExpandedState
	setSectionOpen: Dispatch<SetStateAction<StylesPanelSectionState>>
	sectionPresenceRef: MutableRefObject<SectionPresence>
}

export type SectionVisibilityState = {
	hasBorderWidth: boolean
	hasBorderColor: boolean
	showBackground: boolean
	showBorderWidth: boolean
	showBorderColor: boolean
	showRadius: boolean
	showTextColor: boolean
	showFontSize: boolean
	showFontWeight: boolean
}

export const useSectionVisibility = ({
	state,
	focusedFieldRef,
	expanded,
	setSectionOpen,
	sectionPresenceRef,
}: SectionVisibilityArgs): SectionVisibilityState => {
	const hasBackground = Boolean(state?.properties.backgroundColor.present)
	const hasBorderWidth = Boolean(state?.properties.borderWidth.present)
	const hasBorderColor = Boolean(state?.properties.borderColor.present)
	const hasRadius = Boolean(state?.properties.borderRadius.present)
	const hasTextColor = Boolean(state?.properties.textColor.present)
	const hasFontFamily = Boolean(state?.properties.fontFamily.present)
	const hasFontSize = Boolean(state?.properties.fontSize.present)
	const hasFontWeight = Boolean(state?.properties.fontWeight.present)
	const hasLineHeight = Boolean(state?.properties.lineHeight.present)
	const hasLetterSpacing = Boolean(state?.properties.letterSpacing.present)
	const hasTextAlign = Boolean(state?.properties.textAlign.present)
	const hasTextTransform = Boolean(state?.properties.textTransform.present)
	const hasFontStyle = Boolean(state?.properties.fontStyle.present)
	const hasTextDecoration = Boolean(state?.properties.textDecoration.present)
	const hasPadding = Boolean(state?.properties.padding.present)
	const hasPaddingX = Boolean(state?.properties.paddingX.present)
	const hasPaddingY = Boolean(state?.properties.paddingY.present)
	const hasPaddingTop = Boolean(state?.properties.paddingTop.present)
	const hasPaddingRight = Boolean(state?.properties.paddingRight.present)
	const hasPaddingBottom = Boolean(state?.properties.paddingBottom.present)
	const hasPaddingLeft = Boolean(state?.properties.paddingLeft.present)

	const isEditingBackground = Boolean(focusedFieldRef.current?.startsWith("backgroundColor"))
	const isEditingBorderWidth = Boolean(focusedFieldRef.current?.startsWith("borderWidth"))
	const isEditingBorderColor = Boolean(focusedFieldRef.current?.startsWith("borderColor"))
	const isEditingRadius = Boolean(focusedFieldRef.current?.startsWith("borderRadius"))
	const isEditingTextColor = Boolean(focusedFieldRef.current?.startsWith("textColor"))
	const isEditingFontFamily = Boolean(focusedFieldRef.current?.startsWith("fontFamily"))
	const isEditingFontSize = Boolean(focusedFieldRef.current?.startsWith("fontSize"))
	const isEditingFontWeight = Boolean(focusedFieldRef.current?.startsWith("fontWeight"))
	const isEditingLineHeight = Boolean(focusedFieldRef.current?.startsWith("lineHeight"))
	const isEditingLetterSpacing = Boolean(focusedFieldRef.current?.startsWith("letterSpacing"))
	const isEditingTextAlign = Boolean(focusedFieldRef.current?.startsWith("textAlign"))
	const isEditingTextTransform = Boolean(focusedFieldRef.current?.startsWith("textTransform"))
	const isEditingFontStyle = Boolean(focusedFieldRef.current?.startsWith("fontStyle"))
	const isEditingTextDecoration = Boolean(focusedFieldRef.current?.startsWith("textDecoration"))
	const isEditingPadding = Boolean(focusedFieldRef.current?.startsWith("padding"))

	const sectionPresence = useMemo(
		() => ({
			background: hasBackground,
			border: hasBorderWidth || hasBorderColor,
			radius: hasRadius,
			spacing:
				hasPadding ||
				hasPaddingX ||
				hasPaddingY ||
				hasPaddingTop ||
				hasPaddingRight ||
				hasPaddingBottom ||
				hasPaddingLeft,
			type:
				hasTextColor ||
				hasFontFamily ||
				hasFontSize ||
				hasFontWeight ||
				hasLineHeight ||
				hasLetterSpacing ||
				hasTextAlign ||
				hasTextTransform ||
				hasFontStyle ||
				hasTextDecoration,
		}),
		[
			hasBackground,
			hasBorderColor,
			hasBorderWidth,
			hasFontFamily,
			hasFontSize,
			hasFontStyle,
			hasFontWeight,
			hasLetterSpacing,
			hasLineHeight,
			hasPadding,
			hasPaddingBottom,
			hasPaddingLeft,
			hasPaddingRight,
			hasPaddingTop,
			hasPaddingX,
			hasPaddingY,
			hasRadius,
			hasTextAlign,
			hasTextColor,
			hasTextDecoration,
			hasTextTransform,
		],
	)

	const keepBackgroundOpen = isEditingBackground || expanded.backgroundColor
	const keepBorderOpen =
		isEditingBorderWidth || isEditingBorderColor || expanded.borderWidth || expanded.borderColor
	const keepRadiusOpen = isEditingRadius || expanded.borderRadius
	const keepTypeOpen =
		isEditingTextColor ||
		isEditingFontFamily ||
		isEditingFontSize ||
		isEditingFontWeight ||
		isEditingLineHeight ||
		isEditingLetterSpacing ||
		isEditingTextAlign ||
		isEditingTextTransform ||
		isEditingFontStyle ||
		isEditingTextDecoration ||
		expanded.textColor ||
		expanded.fontSize ||
		expanded.fontWeight
	const keepSpacingOpen = isEditingPadding

	useEffect(() => {
		const prev = sectionPresenceRef.current
		const next = sectionPresence
		if (!prev.background && next.background) {
			setSectionOpen((current) => ({ ...current, background: true }))
		}
		if (prev.background && !next.background && !keepBackgroundOpen) {
			setSectionOpen((current) => ({ ...current, background: false }))
		}
		if (!prev.border && next.border) {
			setSectionOpen((current) => ({ ...current, border: true }))
		}
		if (prev.border && !next.border && !keepBorderOpen) {
			setSectionOpen((current) => ({ ...current, border: false }))
		}
		if (!prev.radius && next.radius) {
			setSectionOpen((current) => ({ ...current, radius: true }))
		}
		if (prev.radius && !next.radius && !keepRadiusOpen) {
			setSectionOpen((current) => ({ ...current, radius: false }))
		}
		if (!prev.spacing && next.spacing) {
			setSectionOpen((current) => ({ ...current, spacing: true }))
		}
		if (prev.spacing && !next.spacing && !keepSpacingOpen) {
			setSectionOpen((current) => ({ ...current, spacing: false }))
		}
		if (!prev.type && next.type) {
			setSectionOpen((current) => ({ ...current, type: true }))
		}
		if (prev.type && !next.type && !keepTypeOpen) {
			setSectionOpen((current) => ({ ...current, type: false }))
		}
		sectionPresenceRef.current = next
	}, [
		keepBackgroundOpen,
		keepBorderOpen,
		keepRadiusOpen,
		keepSpacingOpen,
		keepTypeOpen,
		sectionPresence,
		sectionPresenceRef,
		setSectionOpen,
	])

	return {
		hasBorderWidth,
		hasBorderColor,
		showBackground: hasBackground || expanded.backgroundColor || isEditingBackground,
		showBorderWidth: hasBorderWidth || expanded.borderWidth || isEditingBorderWidth,
		showBorderColor: hasBorderColor || expanded.borderColor || isEditingBorderColor,
		showRadius: hasRadius || expanded.borderRadius || isEditingRadius,
		showTextColor: hasTextColor || expanded.textColor || isEditingTextColor,
		showFontSize: hasFontSize || expanded.fontSize || isEditingFontSize,
		showFontWeight: hasFontWeight || expanded.fontWeight || isEditingFontWeight,
	}
}
