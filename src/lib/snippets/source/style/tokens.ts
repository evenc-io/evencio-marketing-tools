/**
 * Split Tailwind variants (e.g. `hover:bg-red-500`) and return the base utility portion.
 */
export const splitVariants = (value: string) => {
	let bracketDepth = 0
	let lastColon = -1
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index]
		if (char === "[") bracketDepth += 1
		if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1)
		if (char === ":" && bracketDepth === 0) lastColon = index
	}
	return lastColon >= 0 ? value.slice(lastColon + 1) : value
}

/**
 * Return true if the token has no variants/prefixes (i.e. it is a "base" token).
 */
export const isBaseToken = (token: string) => splitVariants(token) === token

/**
 * Remove Tailwind `!` important prefixes from a token.
 */
export const stripImportantPrefix = (value: string) => {
	let next = value
	while (next.startsWith("!")) {
		next = next.slice(1)
	}
	return next
}

/**
 * Get the utility portion of a token (no variants and no important prefixes).
 */
export const getUtility = (token: string) => stripImportantPrefix(splitVariants(token))
