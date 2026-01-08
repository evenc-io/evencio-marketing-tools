const SIZE_LIKE_ARBITRARY_VALUE_PATTERN =
	/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|ch|ex|lh|rlh|cap|ic|cqw|cqh|cqi|cqb|cqmin|cqmax|cm|mm|in|pt|pc)$/i

/**
 * Check whether an arbitrary value (inside `[...]`) looks like a size rather than a color.
 * Matches values like `44px`, `1.5rem`, `2em`, `100%`, etc.
 */
export const isSizeLikeArbitraryValue = (inner: string) =>
	SIZE_LIKE_ARBITRARY_VALUE_PATTERN.test(inner)
