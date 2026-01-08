import {
	isBackgroundClass,
	isBorderColorClass,
	isBorderWidthClass,
	isFontFamilyClass,
	isFontSizeClass,
	isFontStyleClass,
	isFontWeightClass,
	isLetterSpacingClass,
	isLineHeightClass,
	isPaddingClass,
	isRadiusClass,
	isTextAlignClass,
	isTextColorClass,
	isTextDecorationClass,
	isTextTransformClass,
} from "./predicates"

export type TailwindStyleUpdateOptions = {
	background?: string | null
	borderWidth?: string | null
	borderColor?: string | null
	radius?: string | null
	textColor?: string | null
	fontFamily?: string | null
	fontSize?: string | null
	fontWeight?: string | null
	lineHeight?: string | null
	letterSpacing?: string | null
	textAlign?: string | null
	textTransform?: string | null
	fontStyle?: string | null
	textDecoration?: string | null
	padding?: string | null
	paddingX?: string | null
	paddingY?: string | null
	paddingTop?: string | null
	paddingRight?: string | null
	paddingBottom?: string | null
	paddingLeft?: string | null
}

/**
 * Normalize an existing Tailwind className string by removing conflicting tokens and applying requested updates.
 */
export const normalizeTailwindClassName = (value: string, options: TailwindStyleUpdateOptions) => {
	const tokens = value.split(/\s+/).filter(Boolean)
	const next: string[] = []
	const seen = new Set<string>()

	const push = (token: string) => {
		if (!token) return
		if (seen.has(token)) return
		seen.add(token)
		next.push(token)
	}

	const shouldUpdateBackground = options.background !== undefined
	const shouldUpdateBorderWidth = options.borderWidth !== undefined
	const shouldUpdateBorderColor = options.borderColor !== undefined
	const shouldUpdateRadius = options.radius !== undefined
	const shouldUpdateTextColor = options.textColor !== undefined
	const shouldUpdateFontFamily = options.fontFamily !== undefined
	const shouldUpdateFontSize = options.fontSize !== undefined
	const shouldUpdateFontWeight = options.fontWeight !== undefined
	const shouldUpdateLineHeight = options.lineHeight !== undefined
	const shouldUpdateLetterSpacing = options.letterSpacing !== undefined
	const shouldUpdateTextAlign = options.textAlign !== undefined
	const shouldUpdateTextTransform = options.textTransform !== undefined
	const shouldUpdateFontStyle = options.fontStyle !== undefined
	const shouldUpdateTextDecoration = options.textDecoration !== undefined
	const shouldUpdatePadding = options.padding !== undefined
	const shouldUpdatePaddingX = options.paddingX !== undefined
	const shouldUpdatePaddingY = options.paddingY !== undefined
	const shouldUpdatePaddingTop = options.paddingTop !== undefined
	const shouldUpdatePaddingRight = options.paddingRight !== undefined
	const shouldUpdatePaddingBottom = options.paddingBottom !== undefined
	const shouldUpdatePaddingLeft = options.paddingLeft !== undefined

	const isPadding = isPaddingClass("p-")
	const isPaddingX = isPaddingClass("px-")
	const isPaddingY = isPaddingClass("py-")
	const isPaddingTop = isPaddingClass("pt-")
	const isPaddingRight = isPaddingClass("pr-")
	const isPaddingBottom = isPaddingClass("pb-")
	const isPaddingLeft = isPaddingClass("pl-")

	for (const token of tokens) {
		if (shouldUpdateBackground && isBackgroundClass(token)) continue
		if (shouldUpdateBorderWidth && isBorderWidthClass(token)) continue
		if (shouldUpdateBorderColor && isBorderColorClass(token)) continue
		if (shouldUpdateRadius && isRadiusClass(token)) continue
		if (shouldUpdateTextColor && isTextColorClass(token)) continue
		if (shouldUpdateFontFamily && isFontFamilyClass(token)) continue
		if (shouldUpdateFontSize && isFontSizeClass(token)) continue
		if (shouldUpdateFontWeight && isFontWeightClass(token)) continue
		if (shouldUpdateLineHeight && isLineHeightClass(token)) continue
		if (shouldUpdateLetterSpacing && isLetterSpacingClass(token)) continue
		if (shouldUpdateTextAlign && isTextAlignClass(token)) continue
		if (shouldUpdateTextTransform && isTextTransformClass(token)) continue
		if (shouldUpdateFontStyle && isFontStyleClass(token)) continue
		if (shouldUpdateTextDecoration && isTextDecorationClass(token)) continue
		if (shouldUpdatePadding && isPadding(token)) continue
		if (shouldUpdatePaddingX && isPaddingX(token)) continue
		if (shouldUpdatePaddingY && isPaddingY(token)) continue
		if (shouldUpdatePaddingTop && isPaddingTop(token)) continue
		if (shouldUpdatePaddingRight && isPaddingRight(token)) continue
		if (shouldUpdatePaddingBottom && isPaddingBottom(token)) continue
		if (shouldUpdatePaddingLeft && isPaddingLeft(token)) continue
		push(token)
	}

	const additions = [
		options.background,
		options.borderWidth,
		options.borderColor,
		options.radius,
		options.padding,
		options.paddingX,
		options.paddingY,
		options.paddingTop,
		options.paddingRight,
		options.paddingBottom,
		options.paddingLeft,
		options.textColor,
		options.fontFamily,
		options.fontSize,
		options.fontWeight,
		options.lineHeight,
		options.letterSpacing,
		options.textAlign,
		options.textTransform,
		options.fontStyle,
		options.textDecoration,
	].filter((token): token is string => typeof token === "string" && token.length > 0)

	for (const token of additions) push(token)

	return next.join(" ")
}
