import { isColorSuffix } from "./colors"
import { isSizeLikeArbitraryValue } from "./size-check"
import { getUtility, isBaseToken } from "./tokens"

/**
 * Check whether a Tailwind token represents a background color utility.
 */
export const isBackgroundClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("bg-")) return false
	return isColorSuffix(base.slice("bg-".length))
}

/**
 * Check whether a Tailwind token represents a border width utility.
 */
export const isBorderWidthClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (base === "border") return true
	if (/^border-(0|2|4|8)$/.test(base)) return true
	return /^border-\[[^\]]+\]$/.test(base)
}

const BORDER_COLOR_BLOCKLIST = new Set([
	"solid",
	"dashed",
	"dotted",
	"double",
	"hidden",
	"none",
	"collapse",
	"separate",
	"x",
	"y",
	"t",
	"r",
	"b",
	"l",
	"s",
	"e",
])

/**
 * Check whether a Tailwind token represents a border color utility (excluding border width/style variants).
 */
export const isBorderColorClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("border-")) return false
	if (isBorderWidthClass(token)) return false
	const suffix = base.slice("border-".length)
	if (!suffix) return false
	if (BORDER_COLOR_BLOCKLIST.has(suffix)) return false
	if (suffix.startsWith("spacing-")) return false
	if (/^\d+$/.test(suffix)) return false
	return isColorSuffix(suffix)
}

/**
 * Check whether a Tailwind token represents a border radius utility.
 */
export const isRadiusClass = (token: string) => {
	if (!isBaseToken(token)) return false
	return getUtility(token).startsWith("rounded")
}

/**
 * Check whether a Tailwind token represents a text color utility.
 */
export const isTextColorClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("text-")) return false
	const suffix = base.slice("text-".length)
	return isColorSuffix(suffix)
}

/**
 * Check whether a Tailwind token represents a font size utility.
 */
export const isFontSizeClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("text-")) return false
	const suffix = base.slice("text-".length)
	if (!suffix) return false
	// Handle arbitrary values - only accept size-like values (e.g., [44px], [1.5rem])
	if (/^\[[^\]]+\]$/.test(suffix)) {
		const inner = suffix.slice(1, -1)
		return isSizeLikeArbitraryValue(inner)
	}
	return /^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(suffix)
}

/**
 * Check whether a Tailwind token represents a font weight utility.
 */
export const isFontWeightClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("font-")) return false
	const suffix = base.slice("font-".length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(suffix)
}

const FONT_FAMILY_TOKENS = new Set(["lexend", "unbounded", "mono"])

/**
 * Check whether a Tailwind token represents an allowed font family utility.
 */
export const isFontFamilyClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("font-")) return false
	const suffix = base.slice("font-".length)
	return FONT_FAMILY_TOKENS.has(suffix)
}

/**
 * Check whether a Tailwind token represents a line-height utility.
 */
export const isLineHeightClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("leading-")) return false
	const suffix = base.slice("leading-".length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(none|tight|snug|normal|relaxed|loose|\d+)$/.test(suffix)
}

/**
 * Check whether a Tailwind token represents a letter-spacing utility.
 */
export const isLetterSpacingClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("tracking-")) return false
	const suffix = base.slice("tracking-".length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(tighter|tight|normal|wide|wider|widest)$/.test(suffix)
}

const TEXT_ALIGN_TOKENS = new Set(["left", "center", "right", "justify", "start", "end"])

/**
 * Check whether a Tailwind token represents a text-align utility.
 */
export const isTextAlignClass = (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith("text-")) return false
	const suffix = base.slice("text-".length)
	return TEXT_ALIGN_TOKENS.has(suffix)
}

const TEXT_TRANSFORM_TOKENS = new Set(["uppercase", "lowercase", "capitalize", "normal-case"])

/**
 * Check whether a Tailwind token represents a text-transform utility.
 */
export const isTextTransformClass = (token: string) => {
	if (!isBaseToken(token)) return false
	return TEXT_TRANSFORM_TOKENS.has(getUtility(token))
}

const FONT_STYLE_TOKENS = new Set(["italic", "not-italic"])

/**
 * Check whether a Tailwind token represents a font-style utility.
 */
export const isFontStyleClass = (token: string) => {
	if (!isBaseToken(token)) return false
	return FONT_STYLE_TOKENS.has(getUtility(token))
}

const TEXT_DECORATION_TOKENS = new Set(["underline", "line-through", "overline", "no-underline"])

/**
 * Check whether a Tailwind token represents a text-decoration utility.
 */
export const isTextDecorationClass = (token: string) => {
	if (!isBaseToken(token)) return false
	return TEXT_DECORATION_TOKENS.has(getUtility(token))
}

/**
 * Create a predicate that checks whether a token represents a padding utility for a given prefix.
 */
export const isPaddingClass = (prefix: string) => (token: string) => {
	if (!isBaseToken(token)) return false
	const base = getUtility(token)
	if (!base.startsWith(prefix)) return false
	const suffix = base.slice(prefix.length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(px|\d+(?:\.\d+)?)$/.test(suffix)
}
