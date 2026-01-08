import { withTimeout } from "./async-timeout"

const PARSER_TIMEOUT_MS = 4000
const PARSER_RETRY_MS = 1500

let parserPromise: Promise<typeof import("@babel/parser")> | null = null
let parserError: Error | null = null
let parserErrorAt = 0

/**
 * Lazily import `@babel/parser` with a timeout and short retry window after failures.
 */
export const loadBabelParser = async (): Promise<typeof import("@babel/parser")> => {
	if (parserPromise) return parserPromise

	if (parserError) {
		const elapsed = Date.now() - parserErrorAt
		if (elapsed < PARSER_RETRY_MS) {
			throw parserError
		}
		parserError = null
	}

	parserPromise = withTimeout(
		import("@babel/parser"),
		PARSER_TIMEOUT_MS,
		"Babel parser load timed out",
	).catch((err) => {
		parserError = err instanceof Error ? err : new Error(String(err))
		parserErrorAt = Date.now()
		parserPromise = null
		throw parserError
	})

	return parserPromise
}
