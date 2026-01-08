const SIZE_LIKE_ARBITRARY_VALUE_PATTERN =
	/^-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|ch|ex|lh|rlh|cap|ic|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|in|pt|pc)$/i
const UNITLESS_ZERO_PATTERN = /^-?(?:0+(?:\.0*)?|\.0+)$/
const SIZE_LIKE_FUNCTION_PATTERN = /^(clamp|calc|min|max)\(/i
const COLOR_FUNCTION_PATTERN = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i
const VAR_FUNCTION_PATTERN = /^var\((.+)\)$/i
const VAR_REFERENCE_PATTERN = /var\(([^)]+)\)/gi
const LENGTH_TOKEN_PATTERN =
	/-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|ch|ex|lh|rlh|cap|ic|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|in|pt|pc)/i
const SIZE_NAME_HINT_PATTERN = /(font|size|text|leading|tracking|line|lh|fs)/i
const COLOR_NAME_HINT_PATTERN =
	/(color|foreground|background|bg|fg|border|outline|ring|fill|stroke|accent|primary|secondary|muted|destructive)/i

const splitArbitraryModifier = (value: string) => {
	const trimmed = value.trim()
	const colonIndex = trimmed.indexOf(":")
	if (colonIndex <= 0) {
		return { modifier: "", expression: trimmed }
	}
	return {
		modifier: trimmed.slice(0, colonIndex).trim().toLowerCase(),
		expression: trimmed.slice(colonIndex + 1).trim(),
	}
}

const isSizeLikeVarExpression = (expression: string) => {
	const match = expression.match(VAR_FUNCTION_PATTERN)
	if (!match) return false
	const inner = match[1]?.trim() ?? ""
	if (!inner) return false
	const commaIndex = inner.indexOf(",")
	const name = (commaIndex === -1 ? inner : inner.slice(0, commaIndex)).trim()
	const fallback = (commaIndex === -1 ? "" : inner.slice(commaIndex + 1)).trim()
	if (name && COLOR_NAME_HINT_PATTERN.test(name)) return false
	if (name && SIZE_NAME_HINT_PATTERN.test(name)) return true
	if (fallback) return isSizeLikeArbitraryValue(fallback)
	return false
}

const hasSizeLikeVarReference = (expression: string) => {
	VAR_REFERENCE_PATTERN.lastIndex = 0
	let match: RegExpExecArray | null = VAR_REFERENCE_PATTERN.exec(expression)
	while (match) {
		if (isSizeLikeVarExpression(`var(${match[1] ?? ""})`)) {
			return true
		}
		match = VAR_REFERENCE_PATTERN.exec(expression)
	}
	return false
}

/**
 * Check whether an arbitrary value (inside `[...]`) looks like a size rather than a color.
 * Matches values like `44px`, `1.5rem`, `2em`, `100%`, etc.
 */
export const isSizeLikeArbitraryValue = (inner: string) => {
	const { modifier, expression } = splitArbitraryModifier(inner)
	if (!expression) return false
	if (modifier === "color") return false
	if (COLOR_FUNCTION_PATTERN.test(expression)) return false
	if (UNITLESS_ZERO_PATTERN.test(expression)) return true
	if (SIZE_LIKE_ARBITRARY_VALUE_PATTERN.test(expression)) return true
	if (modifier === "length" || modifier === "size" || modifier === "font-size") return true
	if (isSizeLikeVarExpression(expression)) return true
	if (SIZE_LIKE_FUNCTION_PATTERN.test(expression)) {
		return LENGTH_TOKEN_PATTERN.test(expression) || hasSizeLikeVarReference(expression)
	}
	return false
}
