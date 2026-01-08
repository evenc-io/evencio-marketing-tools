export type ParsedSnippetFiles = {
	mainSource: string
	files: Record<string, string>
	hasFileBlocks: boolean
}

export type SnippetLineMapSegment = {
	fileName: string | null
	expandedStartLine: number
	originalStartLine: number
	lineCount: number
}

export type SnippetFileScanResult = ParsedSnippetFiles & {
	expandedSource: string
	lineMapSegments: SnippetLineMapSegment[]
	fileOrder: string[]
}

const FILE_START = /^\s*\/\/\s*@snippet-file\s+(.+?)\s*$/
const FILE_END = /^\s*\/\/\s*@snippet-file-end\s*$/
const IMPORT_LINE = /^\s*\/\/\s*@import\s+(.+?)\s*$/

const MAX_IMPORT_DEPTH = 20

const splitLines = (value: string) => (value ? value.split(/\r?\n/) : [])

const countLines = (value: string) => (value ? value.split("\n").length : 0)

const trimSegments = (segments: SnippetLineMapSegment[], lineCount: number) => {
	if (lineCount === 0) {
		segments.length = 0
		return
	}
	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index]
		if (segment.expandedStartLine > lineCount) {
			segments.length = index
			return
		}
		const segmentEnd = segment.expandedStartLine + segment.lineCount - 1
		if (segmentEnd > lineCount) {
			segment.lineCount = lineCount - segment.expandedStartLine + 1
			segments.length = index + 1
			return
		}
	}
}

const appendSegmentLine = (
	segments: SnippetLineMapSegment[],
	fileName: string | null,
	expandedLine: number,
	originalLine: number,
) => {
	const last = segments[segments.length - 1]
	if (
		last &&
		last.fileName === fileName &&
		last.expandedStartLine + last.lineCount === expandedLine &&
		last.originalStartLine + last.lineCount === originalLine
	) {
		last.lineCount += 1
		return
	}
	segments.push({
		fileName,
		expandedStartLine: expandedLine,
		originalStartLine: originalLine,
		lineCount: 1,
	})
}

const parseSnippetFilesSync = (source: string) => {
	if (!source) {
		return { mainSource: "", files: {}, hasFileBlocks: false, fileOrder: [] as string[] }
	}

	const lines = splitLines(source)
	const files: Record<string, string> = {}
	const fileOrder: string[] = []
	const seenFiles = new Set<string>()
	const mainLines: string[] = []
	let currentFile: string | null = null
	let currentLines: string[] = []
	let hasFileBlocks = false

	for (const line of lines) {
		if (!currentFile) {
			const startMatch = line.match(FILE_START)
			if (startMatch) {
				currentFile = startMatch[1]?.trim() || null
				if (!currentFile) {
					currentFile = null
					continue
				}
				currentLines = []
				hasFileBlocks = true
				if (!seenFiles.has(currentFile)) {
					seenFiles.add(currentFile)
					fileOrder.push(currentFile)
				}
				continue
			}
			mainLines.push(line)
			continue
		}

		if (FILE_END.test(line)) {
			files[currentFile] = currentLines.join("\n").trimEnd()
			currentFile = null
			currentLines = []
			continue
		}

		currentLines.push(line)
	}

	if (currentFile) {
		files[currentFile] = currentLines.join("\n").trimEnd()
	}

	return {
		mainSource: mainLines.join("\n").trimEnd(),
		files,
		hasFileBlocks,
		fileOrder,
	}
}

const expandSnippetSourceWithMap = (mainSource: string, files: Record<string, string>) => {
	const expandedLines: string[] = []
	const segments: SnippetLineMapSegment[] = []
	let expandedLine = 1

	const stack: string[] = []
	const stackSet = new Set<string>()

	const expandFile = (fileName: string | null, source: string, depth: number) => {
		const lines = splitLines(source)
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index]
			const match = line.match(IMPORT_LINE)
			const importName = match?.[1]?.trim()
			if (
				importName &&
				Object.hasOwn(files, importName) &&
				depth < MAX_IMPORT_DEPTH &&
				!stackSet.has(importName)
			) {
				const nextSource = files[importName]
				if (typeof nextSource === "string") {
					stack.push(importName)
					stackSet.add(importName)
					expandFile(importName, nextSource, depth + 1)
					stack.pop()
					stackSet.delete(importName)
					continue
				}
			}

			expandedLines.push(line)
			appendSegmentLine(segments, fileName, expandedLine, index + 1)
			expandedLine += 1
		}
	}

	expandFile(null, mainSource, 0)

	const expandedSource = expandedLines.join("\n").trimEnd()
	const lineCount = countLines(expandedSource)
	trimSegments(segments, lineCount)

	return { expandedSource, lineMapSegments: segments }
}

let lastSyncSource: string | null = null
let lastSyncResult: SnippetFileScanResult | null = null

/**
 * Scan snippet source for `@snippet-file` blocks and expand `@import` directives (synchronous + cached).
 */
export const scanSnippetFilesSync = (source: string): SnippetFileScanResult => {
	if (!source) {
		return {
			mainSource: "",
			files: {},
			hasFileBlocks: false,
			expandedSource: "",
			lineMapSegments: [],
			fileOrder: [],
		}
	}

	if (lastSyncSource === source && lastSyncResult) {
		return lastSyncResult
	}

	const parsed = parseSnippetFilesSync(source)
	const expanded = expandSnippetSourceWithMap(parsed.mainSource, parsed.files)
	const result: SnippetFileScanResult = {
		...parsed,
		...expanded,
	}
	lastSyncSource = source
	lastSyncResult = result
	return result
}

/**
 * Parse snippet source into a main source string plus named file blocks.
 */
export const parseSnippetFiles = (source: string): ParsedSnippetFiles => {
	const parsed = parseSnippetFilesSync(source)
	return {
		mainSource: parsed.mainSource,
		files: parsed.files,
		hasFileBlocks: parsed.hasFileBlocks,
	}
}

/**
 * Serialize a main source string plus named file blocks back into a single source string.
 */
export const serializeSnippetFiles = (
	mainSource: string,
	files: Record<string, string>,
): string => {
	const cleanedMain = mainSource.trimEnd()
	const fileEntries = Object.entries(files)
		.filter(([name]) => name.trim().length > 0)
		.sort(([a], [b]) => a.localeCompare(b))

	let output = cleanedMain
	if (fileEntries.length > 0) {
		if (output.trim().length > 0) {
			output += "\n\n"
		}
		for (const [name, content] of fileEntries) {
			output += `// @snippet-file ${name}\n`
			output += `${content?.trimEnd() ?? ""}\n`
			output += "// @snippet-file-end\n\n"
		}
	}

	return output.trimEnd()
}

/**
 * Expand snippet source by inlining `@import` file blocks into a single source string.
 */
export const expandSnippetSource = (source: string): string =>
	scanSnippetFilesSync(source).expandedSource

/**
 * Build a line map between expanded source lines and original file lines.
 */
export const buildSnippetLineMapSegments = (
	mainSource: string,
	files: Record<string, string>,
): SnippetLineMapSegment[] => expandSnippetSourceWithMap(mainSource, files).lineMapSegments

/**
 * Extract all `@import` file names referenced within snippet source and file blocks.
 */
export const extractSnippetImports = (source: string): string[] => {
	const parsed = parseSnippetFilesSync(source)
	const imports = new Set<string>()
	const scanLines = (value: string) => {
		for (const line of splitLines(value)) {
			const match = line.match(IMPORT_LINE)
			const fileName = match?.[1]?.trim()
			if (fileName) {
				imports.add(fileName)
			}
		}
	}

	scanLines(parsed.mainSource)
	for (const fileSource of Object.values(parsed.files)) {
		scanLines(fileSource)
	}

	return [...imports]
}
