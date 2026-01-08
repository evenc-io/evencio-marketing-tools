export type SourceUpdate = {
	start: number
	end: number
	replacement: string
}

/**
 * Replace a substring range in source and return the updated string.
 */
export const replaceRange = (source: string, start: number, end: number, replacement: string) =>
	source.slice(0, start) + replacement + source.slice(end)
