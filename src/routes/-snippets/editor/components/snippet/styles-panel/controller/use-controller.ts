import { useEffect, useMemo, useRef } from "react"
import { getSnippetIntrinsicTagRule, isSnippetIntrinsicTag } from "@/lib/snippets/editing"
import { cn } from "@/lib/utils"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"
import type { SnippetStylesPanelProps } from "../types"
import type { SnippetStylesPanelController } from "./types"
import { useSnippetStylesApplyScheduler } from "./use-apply-scheduler"
import { useBorderDrafts } from "./use-border-drafts"
import { useColorDrafts } from "./use-color-drafts"
import { usePanelSectionsState } from "./use-panel-sections"
import { useSectionVisibility } from "./use-section-visibility"
import { useSpacingDrafts } from "./use-spacing-drafts"
import { useTypographyDrafts } from "./use-typography-drafts"

const getTargetKey = (target: SnippetInspectTextRequest | null) => {
	if (!target) return null
	if (target.elementRange) {
		const range = target.elementRange
		return `${target.fileId}:${range.startLine}:${range.startColumn}:${range.endLine}:${range.endColumn}`
	}
	return `${target.fileId}:${target.line}:${target.column}`
}

type ControllerArgs = Pick<SnippetStylesPanelProps, "open" | "target" | "state" | "onApply">

export const useSnippetStylesPanelController = ({
	open,
	target,
	state,
	onApply,
}: ControllerArgs): SnippetStylesPanelController => {
	const focusedFieldRef = useRef<string | null>(null)

	const tagName = target?.elementName ?? null
	const isIntrinsic = isSnippetIntrinsicTag(tagName)
	const rule = useMemo(
		() => (isIntrinsic && tagName ? getSnippetIntrinsicTagRule(tagName) : null),
		[isIntrinsic, tagName],
	)
	const panelLabel = rule?.label ?? (tagName ? `<${tagName}>` : "Styles")

	const isCodeOnly = Boolean(state?.found && !state.editable)
	const canApply = Boolean(target) && isIntrinsic && !isCodeOnly
	const supportsBackground = rule?.capabilities.background ?? true
	const supportsBorder = rule?.capabilities.border ?? true
	const supportsRadius = rule?.capabilities.radius ?? true
	const supportsSpacing = rule?.capabilities.spacing ?? true
	const supportsTypography = rule?.capabilities.typography ?? true

	const disabledReason = !target
		? "Right click an element in the preview to edit styles."
		: !isIntrinsic
			? "Only intrinsic HTML tags are editable."
			: isCodeOnly
				? (state?.reason ?? "This element is editable only via code.")
				: state && !state.found
					? (state.reason ?? "Unable to read styles for the selected element.")
					: null

	const targetKey = useMemo(() => getTargetKey(target), [target])

	const { scheduleApply, flushPending, clearPending } = useSnippetStylesApplyScheduler({
		open,
		canApply,
		target,
		onApply,
		focusedFieldRef,
	})

	const { expanded, setExpanded, sectionOpen, setSectionOpen, sectionPresenceRef, resetSections } =
		usePanelSectionsState()

	const {
		backgroundDraft,
		setBackgroundDraft,
		borderColorDraft,
		setBorderColorDraft,
		textColorDraft,
		setTextColorDraft,
		resetColorDrafts,
	} = useColorDrafts({
		state,
		focusedFieldRef,
	})

	const {
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
	} = useBorderDrafts({
		state,
		focusedFieldRef,
	})

	const {
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
	} = useTypographyDrafts({
		state,
		focusedFieldRef,
	})

	const {
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
	} = useSpacingDrafts({
		state,
		focusedFieldRef,
	})

	useEffect(() => {
		void targetKey
		flushPending()
		clearPending()
		resetSections()
		resetColorDrafts()
		resetBorderDrafts()
		resetTypographyDrafts()
		resetSpacingDrafts()
		focusedFieldRef.current = null
	}, [
		clearPending,
		flushPending,
		resetBorderDrafts,
		resetColorDrafts,
		resetSections,
		resetSpacingDrafts,
		resetTypographyDrafts,
		targetKey,
	])

	const {
		hasBorderWidth,
		hasBorderColor,
		showBackground,
		showBorderWidth,
		showBorderColor,
		showRadius,
		showTextColor,
		showFontSize,
		showFontWeight,
	} = useSectionVisibility({
		state,
		focusedFieldRef,
		expanded,
		setSectionOpen,
		sectionPresenceRef,
	})

	const baseSelectClassName = cn(
		"h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900",
		"focus:border-neutral-900 focus:outline-none",
		"disabled:cursor-not-allowed disabled:opacity-50",
	)

	return {
		focusedFieldRef,
		expanded,
		setExpanded,
		sectionOpen,
		setSectionOpen,
		backgroundDraft,
		setBackgroundDraft,
		borderColorDraft,
		setBorderColorDraft,
		textColorDraft,
		setTextColorDraft,
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
		panelLabel,
		disabledReason,
		canApply,
		supportsBackground,
		supportsBorder,
		supportsRadius,
		supportsSpacing,
		supportsTypography,
		hasBorderWidth,
		hasBorderColor,
		showBackground,
		showBorderWidth,
		showBorderColor,
		showRadius,
		showTextColor,
		showFontSize,
		showFontWeight,
		baseSelectClassName,
		scheduleApply,
	}
}
