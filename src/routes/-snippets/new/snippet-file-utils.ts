import type { SnippetEditorFileId } from "@/routes/-snippets/new/snippet-editor-types"

const COMPONENT_FILE_PREFIX = "component:"

export const toComponentFileId = (fileName: string): SnippetEditorFileId =>
	`${COMPONENT_FILE_PREFIX}${fileName}`

export const isComponentFileId = (fileId: SnippetEditorFileId): fileId is `component:${string}` =>
	fileId.startsWith(COMPONENT_FILE_PREFIX)

export const getComponentFileName = (fileId: SnippetEditorFileId) =>
	isComponentFileId(fileId) ? fileId.slice(COMPONENT_FILE_PREFIX.length) : null

export const getExportNameFromFile = (fileName: string) => fileName.replace(/\.[^/.]+$/, "")

export const getComponentExportName = (fileId: SnippetEditorFileId) => {
	const fileName = getComponentFileName(fileId)
	return fileName ? getExportNameFromFile(fileName) : null
}

export const stripSnippetFileDirectives = (source: string) =>
	source
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^(\s*\/\/\s*@snippet-file(\s|$))/.test(line) &&
				!/^(\s*\/\/\s*@snippet-file-end\s*)$/.test(line),
		)
		.join("\n")

export const stripAutoImportBlock = (source: string) => {
	const lines = stripSnippetFileDirectives(source).split(/\r?\n/)
	let index = 0
	let sawImport = false
	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}
	return lines.slice(index).join("\n")
}

export const extractPrimaryNamedExport = (source: string) => {
	const match = source.match(/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/m)
	return match?.[1] ?? null
}

export const extractNamedExports = (source: string) => {
	const matches = source.matchAll(
		/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
	)
	const names = new Set<string>()
	for (const match of matches) {
		const name = match[1]
		if (name) names.add(name)
	}
	return [...names]
}

export const syncImportBlock = (source: string, fileNames: string[]) => {
	const sortedFiles = [...fileNames].sort((a, b) => a.localeCompare(b))
	const cleaned = stripAutoImportBlock(source)
	const lines = cleaned.split(/\r?\n/)
	if (sortedFiles.length === 0) {
		return lines.join("\n").trimEnd()
	}
	const importLines = [
		"// Auto-managed imports (do not edit).",
		...sortedFiles.map((fileName) => `// @import ${fileName}`),
		"",
	]
	return [...importLines, ...lines].join("\n").trimEnd()
}
