import { loadBabelParser } from "../babel-parser"

type CacheEntry = { source: string; ast: unknown }

let cacheA: CacheEntry | null = null
let cacheB: CacheEntry | null = null

/**
 * Parse TSX source using Babel parser with a small two-entry cache.
 */
export const parseSnippetTsxSource = async (source: string) => {
	if (cacheA?.source === source) return cacheA.ast

	if (cacheB?.source === source) {
		const prev = cacheA
		cacheA = cacheB
		cacheB = prev
		return cacheA.ast
	}

	const parser = await loadBabelParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
		errorRecovery: true,
		allowReturnOutsideFunction: true,
	})

	cacheB = cacheA
	cacheA = { source, ast }
	return ast
}
