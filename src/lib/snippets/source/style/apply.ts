import { parseSnippetTsxSource } from "../parse-tsx"
import { findJsxElementAt, hasValidRange } from "./ast"
import { buildClassNameUpdate } from "./classname-update"
import { normalizeColorToken } from "./colors"
import {
	formatBorderWidthClass,
	formatColorStyle,
	formatFontFamilyClass,
	formatFontSizeClass,
	formatFontStyleClass,
	formatFontWeightClass,
	formatLetterSpacingClass,
	formatLineHeightClass,
	formatNumber,
	formatPaddingClass,
	formatPxStyle,
	formatRadiusClass,
	formatTailwindColorClass,
	formatTextAlignClass,
	formatTextDecorationClass,
	formatTextTransformClass,
} from "./format"
import type { SourceUpdate } from "./source-update"
import { replaceRange } from "./source-update"
import { buildStyleUpdate, type StyleUpdate } from "./style-attribute-update"

export type SnippetStyleUpdateRequest = {
	source: string
	line: number
	column: number
	backgroundColor?: string | null
	borderWidth?: number | null
	borderColor?: string | null
	borderRadius?: number | string | null
	textColor?: string | null
	fontFamily?: string | null
	fontSize?: number | string | null
	fontWeight?: number | string | null
	lineHeight?: number | string | null
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

export type SnippetStyleUpdateResult = {
	source: string
	changed: boolean
	reason?: string
	notice?: string
}

export const applySnippetStyleUpdate = async ({
	source,
	line,
	column,
	backgroundColor,
	borderWidth,
	borderColor,
	borderRadius,
	textColor,
	fontFamily,
	fontSize,
	fontWeight,
	lineHeight,
	letterSpacing,
	textAlign,
	textTransform,
	fontStyle,
	textDecoration,
	padding,
	paddingX,
	paddingY,
	paddingTop,
	paddingRight,
	paddingBottom,
	paddingLeft,
}: SnippetStyleUpdateRequest): Promise<SnippetStyleUpdateResult> => {
	if (!source.trim()) {
		return { source, changed: false, reason: "Source is empty." }
	}

	const hasUpdates =
		backgroundColor !== undefined ||
		borderWidth !== undefined ||
		borderColor !== undefined ||
		borderRadius !== undefined ||
		textColor !== undefined ||
		fontFamily !== undefined ||
		fontSize !== undefined ||
		fontWeight !== undefined ||
		lineHeight !== undefined ||
		letterSpacing !== undefined ||
		textAlign !== undefined ||
		textTransform !== undefined ||
		fontStyle !== undefined ||
		textDecoration !== undefined ||
		padding !== undefined ||
		paddingX !== undefined ||
		paddingY !== undefined ||
		paddingTop !== undefined ||
		paddingRight !== undefined ||
		paddingBottom !== undefined ||
		paddingLeft !== undefined
	if (!hasUpdates) {
		return { source, changed: false }
	}

	const ast = await parseSnippetTsxSource(source)
	const targetLine = Math.max(1, Math.floor(line))
	const targetColumn = Math.max(0, Math.floor(column) - 1)
	const target = findJsxElementAt(ast, targetLine, targetColumn)
	if (!target) {
		return { source, changed: false, reason: "Unable to locate JSX element." }
	}
	const openingElement = target.node.openingElement as Record<string, unknown> | undefined
	if (!openingElement || !hasValidRange(openingElement)) {
		return { source, changed: false, reason: "Selected element is missing a JSX opening tag." }
	}

	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []

	const nextBackground =
		backgroundColor !== undefined ? normalizeColorToken(backgroundColor) : undefined
	const nextBorderColor = borderColor !== undefined ? normalizeColorToken(borderColor) : undefined
	const nextTextColor = textColor !== undefined ? normalizeColorToken(textColor) : undefined

	const nextFontFamily =
		fontFamily === undefined
			? undefined
			: fontFamily === null
				? null
				: typeof fontFamily === "string"
					? fontFamily.trim() || null
					: null

	const nextBorderWidth =
		borderWidth !== undefined && borderWidth !== null && Number.isFinite(borderWidth)
			? borderWidth > 0
				? borderWidth
				: null
			: borderWidth === null
				? null
				: borderWidth === undefined
					? undefined
					: null
	const nextBorderRadius =
		borderRadius === undefined
			? undefined
			: borderRadius === null
				? null
				: typeof borderRadius === "number"
					? Number.isFinite(borderRadius) && borderRadius > 0
						? borderRadius
						: null
					: typeof borderRadius === "string"
						? borderRadius.trim() || null
						: null
	const nextFontSize =
		fontSize === undefined
			? undefined
			: fontSize === null
				? null
				: typeof fontSize === "number"
					? Number.isFinite(fontSize) && fontSize > 0
						? fontSize
						: null
					: typeof fontSize === "string"
						? fontSize.trim() || null
						: null
	const nextFontWeight =
		fontWeight === undefined
			? undefined
			: fontWeight === null
				? null
				: typeof fontWeight === "number"
					? Number.isFinite(fontWeight) && fontWeight > 0
						? fontWeight
						: null
					: typeof fontWeight === "string"
						? fontWeight.trim() || null
						: null

	const nextLineHeight =
		lineHeight === undefined
			? undefined
			: lineHeight === null
				? null
				: typeof lineHeight === "number"
					? Number.isFinite(lineHeight) && lineHeight > 0
						? lineHeight
						: null
					: typeof lineHeight === "string"
						? lineHeight.trim() || null
						: null

	const nextLetterSpacing =
		letterSpacing === undefined
			? undefined
			: letterSpacing === null
				? null
				: typeof letterSpacing === "string"
					? letterSpacing.trim() || null
					: null

	const nextTextAlign =
		textAlign === undefined
			? undefined
			: textAlign === null
				? null
				: typeof textAlign === "string"
					? textAlign.trim() || null
					: null

	const nextTextTransform =
		textTransform === undefined
			? undefined
			: textTransform === null
				? null
				: typeof textTransform === "string"
					? textTransform.trim() || null
					: null

	const nextFontStyle =
		fontStyle === undefined
			? undefined
			: fontStyle === null
				? null
				: typeof fontStyle === "string"
					? fontStyle.trim() || null
					: null

	const nextTextDecoration =
		textDecoration === undefined
			? undefined
			: textDecoration === null
				? null
				: typeof textDecoration === "string"
					? textDecoration.trim() || null
					: null

	const nextPadding =
		padding === undefined
			? undefined
			: padding === null
				? null
				: typeof padding === "string"
					? padding.trim() || null
					: null

	const nextPaddingX =
		paddingX === undefined
			? undefined
			: paddingX === null
				? null
				: typeof paddingX === "string"
					? paddingX.trim() || null
					: null

	const nextPaddingY =
		paddingY === undefined
			? undefined
			: paddingY === null
				? null
				: typeof paddingY === "string"
					? paddingY.trim() || null
					: null

	const nextPaddingTop =
		paddingTop === undefined
			? undefined
			: paddingTop === null
				? null
				: typeof paddingTop === "string"
					? paddingTop.trim() || null
					: null

	const nextPaddingRight =
		paddingRight === undefined
			? undefined
			: paddingRight === null
				? null
				: typeof paddingRight === "string"
					? paddingRight.trim() || null
					: null

	const nextPaddingBottom =
		paddingBottom === undefined
			? undefined
			: paddingBottom === null
				? null
				: typeof paddingBottom === "string"
					? paddingBottom.trim() || null
					: null

	const nextPaddingLeft =
		paddingLeft === undefined
			? undefined
			: paddingLeft === null
				? null
				: typeof paddingLeft === "string"
					? paddingLeft.trim() || null
					: null

	let notice: string | undefined

	const normalizedLineHeight =
		nextLineHeight === undefined || nextLineHeight === null
			? nextLineHeight
			: typeof nextLineHeight === "number"
				? nextLineHeight
				: typeof nextLineHeight === "string"
					? (() => {
							const trimmed = nextLineHeight.trim()
							if (!trimmed) return null
							if (trimmed.startsWith("leading-")) return trimmed
							if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
							const numeric = trimmed.match(/^(-?\d+(?:\.\d+)?)$/)
							if (numeric) {
								if (trimmed.includes(".")) return Number(numeric[1])
								return trimmed
							}
							const withUnit = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/)
							if (withUnit) return `[${trimmed}]`
							return trimmed
						})()
					: null

	const normalizedLetterSpacing =
		nextLetterSpacing === undefined || nextLetterSpacing === null
			? nextLetterSpacing
			: typeof nextLetterSpacing === "string"
				? (() => {
						const trimmed = nextLetterSpacing.trim()
						if (!trimmed) return null
						if (trimmed.startsWith("tracking-")) return trimmed
						if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
						if (/^(tighter|tight|normal|wide|wider|widest)$/.test(trimmed)) return trimmed
						return `[${trimmed}]`
					})()
				: null

	const classUpdateResult = buildClassNameUpdate(openingElement, attributes, {
		background:
			nextBackground === undefined
				? undefined
				: nextBackground
					? formatTailwindColorClass("bg", nextBackground)
					: null,
		borderWidth:
			nextBorderWidth === undefined
				? undefined
				: nextBorderWidth === null
					? null
					: formatBorderWidthClass(nextBorderWidth),
		borderColor:
			nextBorderColor === undefined
				? undefined
				: nextBorderColor
					? formatTailwindColorClass("border", nextBorderColor)
					: null,
		radius:
			nextBorderRadius === undefined
				? undefined
				: nextBorderRadius === null
					? null
					: formatRadiusClass(nextBorderRadius),
		textColor:
			nextTextColor === undefined
				? undefined
				: nextTextColor
					? formatTailwindColorClass("text", nextTextColor)
					: null,
		fontFamily:
			nextFontFamily === undefined
				? undefined
				: nextFontFamily
					? formatFontFamilyClass(nextFontFamily)
					: null,
		fontSize:
			nextFontSize === undefined
				? undefined
				: nextFontSize === null
					? null
					: formatFontSizeClass(nextFontSize),
		fontWeight:
			nextFontWeight === undefined
				? undefined
				: nextFontWeight === null
					? null
					: formatFontWeightClass(nextFontWeight),
		lineHeight:
			normalizedLineHeight === undefined
				? undefined
				: normalizedLineHeight === null
					? null
					: formatLineHeightClass(normalizedLineHeight),
		letterSpacing:
			normalizedLetterSpacing === undefined
				? undefined
				: normalizedLetterSpacing === null
					? null
					: formatLetterSpacingClass(normalizedLetterSpacing),
		textAlign:
			nextTextAlign === undefined
				? undefined
				: nextTextAlign
					? formatTextAlignClass(nextTextAlign)
					: null,
		textTransform:
			nextTextTransform === undefined
				? undefined
				: nextTextTransform
					? formatTextTransformClass(nextTextTransform)
					: null,
		fontStyle:
			nextFontStyle === undefined
				? undefined
				: nextFontStyle
					? formatFontStyleClass(nextFontStyle)
					: null,
		textDecoration:
			nextTextDecoration === undefined
				? undefined
				: nextTextDecoration
					? formatTextDecorationClass(nextTextDecoration)
					: null,
		padding:
			nextPadding === undefined
				? undefined
				: nextPadding
					? formatPaddingClass("p", nextPadding)
					: null,
		paddingX:
			nextPaddingX === undefined
				? undefined
				: nextPaddingX
					? formatPaddingClass("px", nextPaddingX)
					: null,
		paddingY:
			nextPaddingY === undefined
				? undefined
				: nextPaddingY
					? formatPaddingClass("py", nextPaddingY)
					: null,
		paddingTop:
			nextPaddingTop === undefined
				? undefined
				: nextPaddingTop
					? formatPaddingClass("pt", nextPaddingTop)
					: null,
		paddingRight:
			nextPaddingRight === undefined
				? undefined
				: nextPaddingRight
					? formatPaddingClass("pr", nextPaddingRight)
					: null,
		paddingBottom:
			nextPaddingBottom === undefined
				? undefined
				: nextPaddingBottom
					? formatPaddingClass("pb", nextPaddingBottom)
					: null,
		paddingLeft:
			nextPaddingLeft === undefined
				? undefined
				: nextPaddingLeft
					? formatPaddingClass("pl", nextPaddingLeft)
					: null,
	})

	if (classUpdateResult.notice) {
		notice = classUpdateResult.notice
	}

	const canWriteTailwindClasses = classUpdateResult.applied
	const updates: SourceUpdate[] = []
	if (canWriteTailwindClasses && classUpdateResult.update) {
		updates.push(classUpdateResult.update)
	}

	const styleUpdates: StyleUpdate[] = []

	const recordStyleUpdate = (
		key: string,
		value: string | null | undefined,
		enabled: boolean,
		removeWhenTailwind = true,
	) => {
		if (!enabled) return
		if (canWriteTailwindClasses && removeWhenTailwind) {
			styleUpdates.push({ key, remove: true })
			return
		}
		if (value === null) {
			styleUpdates.push({ key, remove: true })
			return
		}
		if (value === undefined) return
		styleUpdates.push({ key, value })
	}

	recordStyleUpdate(
		"backgroundColor",
		nextBackground !== undefined && nextBackground !== null
			? formatColorStyle(nextBackground)
			: nextBackground,
		backgroundColor !== undefined,
	)
	recordStyleUpdate(
		"borderColor",
		nextBorderColor !== undefined && nextBorderColor !== null
			? formatColorStyle(nextBorderColor)
			: nextBorderColor,
		borderColor !== undefined,
	)
	recordStyleUpdate(
		"color",
		nextTextColor !== undefined && nextTextColor !== null
			? formatColorStyle(nextTextColor)
			: nextTextColor,
		textColor !== undefined,
	)
	recordStyleUpdate(
		"fontFamily",
		nextFontFamily !== undefined && nextFontFamily !== null
			? (() => {
					const raw = nextFontFamily.startsWith("font-")
						? nextFontFamily.slice("font-".length)
						: nextFontFamily
					switch (raw) {
						case "lexend":
							return '"Lexend Exa", sans-serif'
						case "unbounded":
							return '"Unbounded", sans-serif'
						case "mono":
							return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace'
						default:
							return undefined
					}
				})()
			: nextFontFamily,
		fontFamily !== undefined,
	)
	recordStyleUpdate(
		"borderWidth",
		nextBorderWidth !== undefined && nextBorderWidth !== null
			? formatPxStyle(nextBorderWidth)
			: nextBorderWidth,
		borderWidth !== undefined,
	)
	recordStyleUpdate(
		"borderRadius",
		nextBorderRadius !== undefined && nextBorderRadius !== null
			? typeof nextBorderRadius === "number"
				? formatPxStyle(nextBorderRadius)
				: nextBorderRadius.startsWith("[") && nextBorderRadius.endsWith("]")
					? nextBorderRadius.slice(1, -1)
					: undefined
			: nextBorderRadius,
		borderRadius !== undefined,
	)
	recordStyleUpdate(
		"fontSize",
		nextFontSize !== undefined && nextFontSize !== null
			? typeof nextFontSize === "number"
				? formatPxStyle(nextFontSize)
				: nextFontSize.startsWith("[") && nextFontSize.endsWith("]")
					? nextFontSize.slice(1, -1)
					: undefined
			: nextFontSize,
		fontSize !== undefined,
	)
	recordStyleUpdate(
		"fontWeight",
		nextFontWeight !== undefined && nextFontWeight !== null
			? typeof nextFontWeight === "number"
				? String(Math.round(nextFontWeight))
				: nextFontWeight.startsWith("[") && nextFontWeight.endsWith("]")
					? nextFontWeight.slice(1, -1)
					: undefined
			: nextFontWeight,
		fontWeight !== undefined,
	)
	recordStyleUpdate(
		"lineHeight",
		normalizedLineHeight !== undefined && normalizedLineHeight !== null
			? typeof normalizedLineHeight === "number"
				? formatNumber(normalizedLineHeight)
				: normalizedLineHeight.startsWith("[") && normalizedLineHeight.endsWith("]")
					? normalizedLineHeight.slice(1, -1)
					: undefined
			: normalizedLineHeight,
		lineHeight !== undefined,
	)
	recordStyleUpdate(
		"letterSpacing",
		normalizedLetterSpacing !== undefined && normalizedLetterSpacing !== null
			? normalizedLetterSpacing.startsWith("[") && normalizedLetterSpacing.endsWith("]")
				? normalizedLetterSpacing.slice(1, -1)
				: undefined
			: normalizedLetterSpacing,
		letterSpacing !== undefined,
	)
	recordStyleUpdate(
		"textAlign",
		nextTextAlign !== undefined && nextTextAlign !== null
			? nextTextAlign.startsWith("text-")
				? nextTextAlign.slice("text-".length)
				: nextTextAlign
			: nextTextAlign,
		textAlign !== undefined,
	)
	recordStyleUpdate(
		"textTransform",
		nextTextTransform !== undefined && nextTextTransform !== null
			? (() => {
					const raw = nextTextTransform.trim()
					if (!raw) return undefined
					if (raw === "normal-case") return "none"
					return raw
				})()
			: nextTextTransform,
		textTransform !== undefined,
	)
	recordStyleUpdate(
		"fontStyle",
		nextFontStyle !== undefined && nextFontStyle !== null
			? (() => {
					const raw = nextFontStyle.trim()
					if (!raw) return undefined
					if (raw === "not-italic") return "normal"
					return raw
				})()
			: nextFontStyle,
		fontStyle !== undefined,
	)
	recordStyleUpdate(
		"textDecoration",
		nextTextDecoration !== undefined && nextTextDecoration !== null
			? (() => {
					const raw = nextTextDecoration.trim()
					if (!raw) return undefined
					if (raw === "no-underline") return "none"
					return raw
				})()
			: nextTextDecoration,
		textDecoration !== undefined,
	)

	recordStyleUpdate("padding", undefined, padding !== undefined)
	recordStyleUpdate(
		"paddingLeft",
		undefined,
		paddingLeft !== undefined || paddingX !== undefined || padding !== undefined,
	)
	recordStyleUpdate(
		"paddingRight",
		undefined,
		paddingRight !== undefined || paddingX !== undefined || padding !== undefined,
	)
	recordStyleUpdate(
		"paddingTop",
		undefined,
		paddingTop !== undefined || paddingY !== undefined || padding !== undefined,
	)
	recordStyleUpdate(
		"paddingBottom",
		undefined,
		paddingBottom !== undefined || paddingY !== undefined || padding !== undefined,
	)

	const styleUpdate =
		styleUpdates.length > 0
			? buildStyleUpdate(source, openingElement, attributes, styleUpdates)
			: null
	if (styleUpdate) {
		updates.push(styleUpdate)
	}

	if (updates.length === 0) {
		return { source, changed: false }
	}

	const orderedUpdates = updates.sort((a, b) => b.start - a.start)
	const updatedSource = orderedUpdates.reduce(
		(current, update) => replaceRange(current, update.start, update.end, update.replacement),
		source,
	)
	return { source: updatedSource, changed: updatedSource !== source, notice }
}
