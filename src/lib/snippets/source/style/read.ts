import { parseSnippetTsxSource } from "../parse-tsx"
import {
	findJsxElementAt,
	getAttributeName,
	getObjectPropertyKey,
	hasValidRange,
	readOpeningElementName,
	readStaticClassNameValue,
} from "./ast"
import { normalizeColorValue } from "./colors"
import { formatNumber } from "./format"
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
import {
	readBorderWidthValue,
	readColorSuffix,
	readFontFamilyValue,
	readFontSizeValue,
	readFontWeightValue,
	readLetterSpacingValue,
	readLineHeightValue,
	readPaddingValue,
	readRadiusValue,
	readTextAlignValue,
} from "./read-values"
import { getUtility } from "./tokens"

export type SnippetStyleReadRequest = {
	source: string
	line: number
	column: number
}

export type SnippetStyleReadResponse = {
	found: boolean
	reason?: string
	elementName?: string | null
	classNameKind: "none" | "static" | "dynamic"
	editable: boolean
	properties: {
		backgroundColor: { present: boolean; value: string | null }
		borderWidth: { present: boolean; value: number | null }
		borderColor: { present: boolean; value: string | null }
		borderRadius: { present: boolean; value: number | string | null }
		textColor: { present: boolean; value: string | null }
		fontFamily: { present: boolean; value: string | null }
		fontSize: { present: boolean; value: number | string | null }
		fontWeight: { present: boolean; value: number | string | null }
		lineHeight: { present: boolean; value: number | string | null }
		letterSpacing: { present: boolean; value: string | null }
		textAlign: { present: boolean; value: string | null }
		textTransform: { present: boolean; value: string | null }
		fontStyle: { present: boolean; value: string | null }
		textDecoration: { present: boolean; value: string | null }
		padding: { present: boolean; value: string | null }
		paddingX: { present: boolean; value: string | null }
		paddingY: { present: boolean; value: string | null }
		paddingTop: { present: boolean; value: string | null }
		paddingRight: { present: boolean; value: string | null }
		paddingBottom: { present: boolean; value: string | null }
		paddingLeft: { present: boolean; value: string | null }
	}
}

const readInlineStyleObject = (
	styleValue: Record<string, unknown> | null | undefined,
): Partial<Record<string, string | number | null>> => {
	if (!styleValue || styleValue.type !== "JSXExpressionContainer") return {}
	const expression = styleValue.expression as Record<string, unknown> | null | undefined
	if (!expression || expression.type !== "ObjectExpression") return {}
	const properties = Array.isArray(expression.properties) ? expression.properties : []
	const out: Record<string, string | number | null> = {}
	for (const entry of properties) {
		if (!entry || typeof entry !== "object") continue
		const prop = entry as Record<string, unknown>
		if (prop.type !== "ObjectProperty") continue
		const key = getObjectPropertyKey(prop)
		if (!key) continue
		const value = prop.value as Record<string, unknown> | null | undefined
		if (!value) continue
		if (value.type === "StringLiteral") {
			out[key] = typeof value.value === "string" ? value.value : null
			continue
		}
		if (value.type === "NumericLiteral") {
			out[key] = typeof value.value === "number" ? value.value : null
		}
	}
	return out
}

const readInlinePx = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	const px = trimmed.match(/^(\d+(?:\.\d+)?)px$/)
	if (px) return Number(px[1])
	return null
}

const readInlineFontWeight = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	return null
}

const readInlineLineHeight = (raw: string | number | null | undefined): number | string | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
	const numeric = trimmed.match(/^(-?\d+(?:\.\d+)?)$/)
	if (numeric) {
		if (trimmed.includes(".")) return Number(numeric[1])
		return trimmed
	}
	const withUnit = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/)
	if (withUnit) return `[${trimmed}]`
	return trimmed
}

const readInlineLetterSpacing = (raw: string | number | null | undefined): string | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) {
		const formatted = formatNumber(raw)
		if (formatted === "0") return "0"
		if (formatted === "1") return "px"
		return `[${formatted}px]`
	}
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (/^0(?:\.0+)?(?:px|rem|em|%)?$/.test(trimmed)) return "0"
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
	return `[${trimmed}]`
}

const readInlineTextAlign = (raw: string | number | null | undefined): string | null => {
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	return trimmed
}

const readInlineTextTransform = (raw: string | number | null | undefined): string | null => {
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (trimmed === "none") return "normal-case"
	return trimmed
}

const readInlineFontStyle = (raw: string | number | null | undefined): string | null => {
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (trimmed === "normal") return "not-italic"
	return trimmed
}

const readInlineTextDecoration = (raw: string | number | null | undefined): string | null => {
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (trimmed === "none") return "no-underline"
	return trimmed
}

const readInlineSpacingValue = (raw: string | number | null | undefined): string | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) {
		const formatted = formatNumber(raw)
		if (formatted === "0") return "0"
		if (formatted === "1") return "px"
		return `[${formatted}px]`
	}
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	if (/^0(?:\.0+)?$/.test(trimmed)) return "0"
	if (/^0(?:\.0+)?(?:px|rem|em|%)$/.test(trimmed)) return "0"
	if (trimmed === "1px") return "px"
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed
	return `[${trimmed}]`
}

type InlineSpacingValues = {
	padding: string | null
	paddingX: string | null
	paddingY: string | null
	paddingTop: string | null
	paddingRight: string | null
	paddingBottom: string | null
	paddingLeft: string | null
}

const readInlinePaddingValues = (
	style: Partial<Record<string, string | number | null>>,
): InlineSpacingValues => {
	const out: InlineSpacingValues = {
		padding: null,
		paddingX: null,
		paddingY: null,
		paddingTop: null,
		paddingRight: null,
		paddingBottom: null,
		paddingLeft: null,
	}

	const rawPadding = style.padding
	let paddingParts: string[] | null = null
	if (typeof rawPadding === "number" && Number.isFinite(rawPadding)) {
		paddingParts = [String(rawPadding)]
	} else if (typeof rawPadding === "string") {
		const trimmed = rawPadding.trim()
		if (trimmed) {
			const parts = trimmed.split(/\s+/).filter(Boolean)
			if (parts.length >= 1 && parts.length <= 4) {
				paddingParts = parts
			}
		}
	}

	const hasExplicitSides =
		style.paddingTop !== undefined ||
		style.paddingRight !== undefined ||
		style.paddingBottom !== undefined ||
		style.paddingLeft !== undefined

	let expanded: {
		top: string | null
		right: string | null
		bottom: string | null
		left: string | null
	} | null = null

	if (paddingParts) {
		const normalized = paddingParts.map((part) =>
			readInlineSpacingValue(typeof rawPadding === "number" ? Number(part) : part),
		)
		if (
			normalized.every((value): value is string => typeof value === "string" && value.length > 0)
		) {
			const [a, b, c, d] = normalized
			if (normalized.length === 1) {
				expanded = { top: a, right: a, bottom: a, left: a }
			} else if (normalized.length === 2) {
				expanded = { top: a, right: b, bottom: a, left: b }
			} else if (normalized.length === 3) {
				expanded = { top: a, right: b, bottom: c ?? null, left: b }
			} else if (normalized.length === 4) {
				expanded = { top: a, right: b, bottom: c ?? null, left: d ?? null }
			}
		}
	}

	const topOverride = readInlineSpacingValue(style.paddingTop ?? null)
	const rightOverride = readInlineSpacingValue(style.paddingRight ?? null)
	const bottomOverride = readInlineSpacingValue(style.paddingBottom ?? null)
	const leftOverride = readInlineSpacingValue(style.paddingLeft ?? null)

	const resolvedTop = topOverride ?? expanded?.top ?? null
	const resolvedRight = rightOverride ?? expanded?.right ?? null
	const resolvedBottom = bottomOverride ?? expanded?.bottom ?? null
	const resolvedLeft = leftOverride ?? expanded?.left ?? null

	if (hasExplicitSides || (paddingParts && paddingParts.length >= 3)) {
		out.paddingTop = resolvedTop
		out.paddingRight = resolvedRight
		out.paddingBottom = resolvedBottom
		out.paddingLeft = resolvedLeft
		return out
	}

	if (paddingParts?.length === 1) {
		out.padding = resolvedTop
		return out
	}

	if (paddingParts?.length === 2) {
		out.paddingY = resolvedTop
		out.paddingX = resolvedRight
		return out
	}

	out.paddingTop = resolvedTop
	out.paddingRight = resolvedRight
	out.paddingBottom = resolvedBottom
	out.paddingLeft = resolvedLeft
	return out
}

export const readSnippetStyleState = async ({
	source,
	line,
	column,
}: SnippetStyleReadRequest): Promise<SnippetStyleReadResponse> => {
	if (!source.trim()) {
		return {
			found: false,
			reason: "Source is empty.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const ast = await parseSnippetTsxSource(source)
	const targetLine = Math.max(1, Math.floor(line))
	const targetColumn = Math.max(0, Math.floor(column) - 1)
	const target = findJsxElementAt(ast, targetLine, targetColumn)
	if (!target) {
		return {
			found: false,
			reason: "Unable to locate JSX element.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const openingElement = target.node.openingElement as Record<string, unknown> | undefined
	if (!openingElement || !hasValidRange(openingElement)) {
		return {
			found: false,
			reason: "Selected element is missing a JSX opening tag.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const elementName = readOpeningElementName(openingElement)
	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []

	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})
	const rawClassValue = classAttribute
		? readStaticClassNameValue(classAttribute.value as Record<string, unknown> | null | undefined)
		: ""
	const classNameKind: SnippetStyleReadResponse["classNameKind"] = !classAttribute
		? "none"
		: rawClassValue === null
			? "dynamic"
			: "static"

	const editable = classNameKind !== "dynamic"

	const classTokens =
		classNameKind === "static" && typeof rawClassValue === "string"
			? rawClassValue.split(/\s+/).filter(Boolean)
			: []

	const findLastToken = (predicate: (token: string) => boolean) => {
		for (let index = classTokens.length - 1; index >= 0; index -= 1) {
			const token = classTokens[index]
			if (token && predicate(token)) return token
		}
		return null
	}

	const bgToken = findLastToken(isBackgroundClass)
	const borderWidthToken = findLastToken(isBorderWidthClass)
	const borderColorToken = findLastToken(isBorderColorClass)
	const radiusToken = findLastToken(isRadiusClass)
	const textColorToken = findLastToken(isTextColorClass)
	const fontFamilyToken = findLastToken(isFontFamilyClass)
	const fontSizeToken = findLastToken(isFontSizeClass)
	const fontWeightToken = findLastToken(isFontWeightClass)
	const lineHeightToken = findLastToken(isLineHeightClass)
	const letterSpacingToken = findLastToken(isLetterSpacingClass)
	const textAlignToken = findLastToken(isTextAlignClass)
	const textTransformToken = findLastToken(isTextTransformClass)
	const fontStyleToken = findLastToken(isFontStyleClass)
	const textDecorationToken = findLastToken(isTextDecorationClass)
	const paddingToken = findLastToken(isPaddingClass("p-"))
	const paddingXToken = findLastToken(isPaddingClass("px-"))
	const paddingYToken = findLastToken(isPaddingClass("py-"))
	const paddingTopToken = findLastToken(isPaddingClass("pt-"))
	const paddingRightToken = findLastToken(isPaddingClass("pr-"))
	const paddingBottomToken = findLastToken(isPaddingClass("pb-"))
	const paddingLeftToken = findLastToken(isPaddingClass("pl-"))

	const bgValueFromClass =
		bgToken && getUtility(bgToken).startsWith("bg-")
			? readColorSuffix(getUtility(bgToken).slice("bg-".length))
			: null
	const borderColorFromClass =
		borderColorToken && getUtility(borderColorToken).startsWith("border-")
			? readColorSuffix(getUtility(borderColorToken).slice("border-".length))
			: null
	const textColorFromClass =
		textColorToken && getUtility(textColorToken).startsWith("text-")
			? readColorSuffix(getUtility(textColorToken).slice("text-".length))
			: null

	const borderWidthFromClass = borderWidthToken
		? readBorderWidthValue(getUtility(borderWidthToken))
		: null
	const radiusFromClass = radiusToken ? readRadiusValue(getUtility(radiusToken)) : null
	const fontFamilyFromClass = fontFamilyToken
		? readFontFamilyValue(getUtility(fontFamilyToken))
		: null
	const fontSizeFromClass = fontSizeToken ? readFontSizeValue(getUtility(fontSizeToken)) : null
	const fontWeightFromClass = fontWeightToken
		? readFontWeightValue(getUtility(fontWeightToken))
		: null
	const lineHeightFromClass = lineHeightToken
		? readLineHeightValue(getUtility(lineHeightToken))
		: null
	const letterSpacingFromClass = letterSpacingToken
		? readLetterSpacingValue(getUtility(letterSpacingToken))
		: null
	const textAlignFromClass = textAlignToken ? readTextAlignValue(getUtility(textAlignToken)) : null
	const textTransformFromClass = textTransformToken ? getUtility(textTransformToken) : null
	const fontStyleFromClass = fontStyleToken ? getUtility(fontStyleToken) : null
	const textDecorationFromClass = textDecorationToken ? getUtility(textDecorationToken) : null
	const paddingFromClass = paddingToken ? readPaddingValue(getUtility(paddingToken), "p-") : null
	const paddingXFromClass = paddingXToken
		? readPaddingValue(getUtility(paddingXToken), "px-")
		: null
	const paddingYFromClass = paddingYToken
		? readPaddingValue(getUtility(paddingYToken), "py-")
		: null
	const paddingTopFromClass = paddingTopToken
		? readPaddingValue(getUtility(paddingTopToken), "pt-")
		: null
	const paddingRightFromClass = paddingRightToken
		? readPaddingValue(getUtility(paddingRightToken), "pr-")
		: null
	const paddingBottomFromClass = paddingBottomToken
		? readPaddingValue(getUtility(paddingBottomToken), "pb-")
		: null
	const paddingLeftFromClass = paddingLeftToken
		? readPaddingValue(getUtility(paddingLeftToken), "pl-")
		: null

	const styleAttribute = attributes.find((attr) => getAttributeName(attr) === "style")
	const inlineStyle = readInlineStyleObject(
		styleAttribute?.value as Record<string, unknown> | null | undefined,
	)

	const inlineBackground = normalizeColorValue(String(inlineStyle.backgroundColor ?? ""))
	const inlineBorderColor = normalizeColorValue(String(inlineStyle.borderColor ?? ""))
	const inlineTextColor = normalizeColorValue(String(inlineStyle.color ?? ""))
	const inlineBorderWidth = readInlinePx(inlineStyle.borderWidth ?? null)
	const inlineRadius = readInlinePx(inlineStyle.borderRadius ?? null)
	const inlineFontSize = readInlinePx(inlineStyle.fontSize ?? null)
	const inlineFontWeight = readInlineFontWeight(inlineStyle.fontWeight ?? null)
	const inlineLineHeight = readInlineLineHeight(inlineStyle.lineHeight ?? null)
	const inlineLetterSpacing = readInlineLetterSpacing(inlineStyle.letterSpacing ?? null)
	const inlineTextAlign = readInlineTextAlign(inlineStyle.textAlign ?? null)
	const inlineTextTransform = readInlineTextTransform(inlineStyle.textTransform ?? null)
	const inlineFontStyle = readInlineFontStyle(inlineStyle.fontStyle ?? null)
	const inlineTextDecoration = readInlineTextDecoration(inlineStyle.textDecoration ?? null)
	const inlinePadding = readInlinePaddingValues(inlineStyle)

	const backgroundValue = inlineBackground ?? bgValueFromClass
	const borderColorValue = inlineBorderColor ?? borderColorFromClass
	const textColorValue = inlineTextColor ?? textColorFromClass
	const borderWidthValue = inlineBorderWidth ?? borderWidthFromClass
	const radiusValue = inlineRadius ?? radiusFromClass
	const fontSizeValue = inlineFontSize ?? fontSizeFromClass
	const fontWeightValue = inlineFontWeight ?? fontWeightFromClass
	const fontFamilyValue = fontFamilyFromClass
	const lineHeightValue = inlineLineHeight ?? lineHeightFromClass
	const letterSpacingValue = inlineLetterSpacing ?? letterSpacingFromClass
	const textAlignValue = inlineTextAlign ?? textAlignFromClass
	const textTransformValue = inlineTextTransform ?? textTransformFromClass
	const fontStyleValue = inlineFontStyle ?? fontStyleFromClass
	const textDecorationValue = inlineTextDecoration ?? textDecorationFromClass
	const paddingValue = inlinePadding.padding ?? paddingFromClass
	const paddingXValue = inlinePadding.paddingX ?? paddingXFromClass
	const paddingYValue = inlinePadding.paddingY ?? paddingYFromClass
	const paddingTopValue = inlinePadding.paddingTop ?? paddingTopFromClass
	const paddingRightValue = inlinePadding.paddingRight ?? paddingRightFromClass
	const paddingBottomValue = inlinePadding.paddingBottom ?? paddingBottomFromClass
	const paddingLeftValue = inlinePadding.paddingLeft ?? paddingLeftFromClass

	const backgroundPresent = Boolean(inlineStyle.backgroundColor !== undefined || bgToken)
	const borderColorPresent = Boolean(inlineStyle.borderColor !== undefined || borderColorToken)
	const textColorPresent = Boolean(inlineStyle.color !== undefined || textColorToken)
	const borderWidthPresent = Boolean(inlineStyle.borderWidth !== undefined || borderWidthToken)
	const radiusPresent = Boolean(inlineStyle.borderRadius !== undefined || radiusToken)
	const fontSizePresent = Boolean(inlineStyle.fontSize !== undefined || fontSizeToken)
	const fontWeightPresent = Boolean(inlineStyle.fontWeight !== undefined || fontWeightToken)
	const fontFamilyPresent = Boolean(fontFamilyToken)
	const lineHeightPresent = Boolean(inlineStyle.lineHeight !== undefined || lineHeightToken)
	const letterSpacingPresent = Boolean(
		inlineStyle.letterSpacing !== undefined || letterSpacingToken,
	)
	const textAlignPresent = Boolean(inlineStyle.textAlign !== undefined || textAlignToken)
	const textTransformPresent = Boolean(
		inlineStyle.textTransform !== undefined || textTransformToken,
	)
	const fontStylePresent = Boolean(inlineStyle.fontStyle !== undefined || fontStyleToken)
	const textDecorationPresent = Boolean(
		inlineStyle.textDecoration !== undefined || textDecorationToken,
	)
	const paddingPresent = Boolean(inlinePadding.padding !== null || paddingToken)
	const paddingXPresent = Boolean(inlinePadding.paddingX !== null || paddingXToken)
	const paddingYPresent = Boolean(inlinePadding.paddingY !== null || paddingYToken)
	const paddingTopPresent = Boolean(inlinePadding.paddingTop !== null || paddingTopToken)
	const paddingRightPresent = Boolean(inlinePadding.paddingRight !== null || paddingRightToken)
	const paddingBottomPresent = Boolean(inlinePadding.paddingBottom !== null || paddingBottomToken)
	const paddingLeftPresent = Boolean(inlinePadding.paddingLeft !== null || paddingLeftToken)

	return {
		found: true,
		elementName,
		classNameKind,
		editable,
		reason: editable ? undefined : "This element uses a dynamic className. Edit styles in code.",
		properties: {
			backgroundColor: { present: backgroundPresent, value: backgroundValue ?? null },
			borderWidth: { present: borderWidthPresent, value: borderWidthValue ?? null },
			borderColor: { present: borderColorPresent, value: borderColorValue ?? null },
			borderRadius: { present: radiusPresent, value: radiusValue ?? null },
			textColor: { present: textColorPresent, value: textColorValue ?? null },
			fontFamily: { present: fontFamilyPresent, value: fontFamilyValue ?? null },
			fontSize: { present: fontSizePresent, value: fontSizeValue ?? null },
			fontWeight: { present: fontWeightPresent, value: fontWeightValue ?? null },
			lineHeight: { present: lineHeightPresent, value: lineHeightValue ?? null },
			letterSpacing: { present: letterSpacingPresent, value: letterSpacingValue ?? null },
			textAlign: { present: textAlignPresent, value: textAlignValue ?? null },
			textTransform: { present: textTransformPresent, value: textTransformValue ?? null },
			fontStyle: { present: fontStylePresent, value: fontStyleValue ?? null },
			textDecoration: { present: textDecorationPresent, value: textDecorationValue ?? null },
			padding: { present: paddingPresent, value: paddingValue ?? null },
			paddingX: { present: paddingXPresent, value: paddingXValue ?? null },
			paddingY: { present: paddingYPresent, value: paddingYValue ?? null },
			paddingTop: { present: paddingTopPresent, value: paddingTopValue ?? null },
			paddingRight: { present: paddingRightPresent, value: paddingRightValue ?? null },
			paddingBottom: { present: paddingBottomPresent, value: paddingBottomValue ?? null },
			paddingLeft: { present: paddingLeftPresent, value: paddingLeftValue ?? null },
		},
	}
}
