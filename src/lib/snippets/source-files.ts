export type ParsedSnippetFiles = {
	mainSource: string
	files: Record<string, string>
	hasFileBlocks: boolean
}

const FILE_START = /^\s*\/\/\s*@snippet-file\s+(.+?)\s*$/
const FILE_END = /^\s*\/\/\s*@snippet-file-end\s*$/
const IMPORT_LINE = /^\s*\/\/\s*@import\s+(.+?)\s*$/

export const parseSnippetFiles = (source: string): ParsedSnippetFiles => {
	if (!source) {
		return { mainSource: "", files: {}, hasFileBlocks: false }
	}

	const lines = source.split(/\r?\n/)
	const files: Record<string, string> = {}
	const mainLines: string[] = []
	let currentFile: string | null = null
	let currentLines: string[] = []
	let hasFileBlocks = false

	for (const line of lines) {
		if (!currentFile) {
			const startMatch = line.match(FILE_START)
			if (startMatch) {
				currentFile = startMatch[1]?.trim() || null
				currentLines = []
				hasFileBlocks = true
				continue
			}
			mainLines.push(line)
			continue
		}

		if (FILE_END.test(line)) {
			if (currentFile) {
				files[currentFile] = currentLines.join("\n").trimEnd()
			}
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
	}
}

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

export const expandSnippetSource = (source: string): string => {
	const { mainSource, files } = parseSnippetFiles(source)
	const lines = mainSource.split(/\r?\n/)
	const expanded: string[] = []

	for (const line of lines) {
		const match = line.match(IMPORT_LINE)
		if (match) {
			const fileName = match[1]?.trim()
			if (fileName && files[fileName]) {
				expanded.push(files[fileName].trimEnd())
				continue
			}
		}
		expanded.push(line)
	}

	return expanded.join("\n").trimEnd()
}

export const extractSnippetImports = (source: string): string[] => {
	const { mainSource } = parseSnippetFiles(source)
	const lines = mainSource.split(/\r?\n/)
	const imports: string[] = []
	for (const line of lines) {
		const match = line.match(IMPORT_LINE)
		if (match) {
			const fileName = match[1]?.trim()
			if (fileName) imports.push(fileName)
		}
	}
	return imports
}
