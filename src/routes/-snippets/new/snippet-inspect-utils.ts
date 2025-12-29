import { parse } from "@babel/parser"
import {
	buildSnippetLineMapSegments,
	type SnippetLineMapSegment,
} from "@/lib/snippets/source-files"
import { scanAutoImportOffsetWasmSync } from "@/lib/wasm/snippet-wasm"
import type { SnippetEditorFileId } from "@/routes/-snippets/new/snippet-editor-types"
import { toComponentFileId } from "@/routes/-snippets/new/snippet-file-utils"

export interface SnippetInspectTarget {
	fileId: SnippetEditorFileId
	fileName: string | null
	line: number
	column: number
}

export interface SnippetTextRange {
	startLine: number
	startColumn: number
	endLine: number
	endColumn: number
}

export interface SnippetInspectHighlight extends SnippetInspectTarget {
	kind: "hover" | "select"
	startLine: number
	endLine: number
	textRanges: SnippetTextRange[]
}

export interface SnippetInspectTextRequest extends SnippetInspectTarget {
	range: SnippetTextRange | null
	elementRange: SnippetTextRange | null
	elementType: "element" | "fragment" | null
	elementName: string | null
}

export type SnippetTextQuote = "'" | '"' | null
export type SnippetElementContext = "jsx" | "expression"

const getAutoImportOffsetFallback = (mainSource: string) => {
	const lines = mainSource.split(/\r?\n/)
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

	return index
}

const getAutoImportOffset = (mainSource: string) =>
	scanAutoImportOffsetWasmSync(mainSource) ?? getAutoImportOffsetFallback(mainSource)

export const buildSnippetInspectMap = (
	mainSource: string,
	files: Record<string, string>,
	lineMapSegments?: SnippetLineMapSegment[],
) => {
	const segments = lineMapSegments ?? buildSnippetLineMapSegments(mainSource, files)
	const autoImportOffset = getAutoImportOffset(mainSource)

	const resolve = (lineNumber: number, columnNumber?: number): SnippetInspectTarget | null => {
		if (!Number.isFinite(lineNumber) || lineNumber <= 0) return null
		for (const segment of segments) {
			const segmentEnd = segment.expandedStartLine + segment.lineCount - 1
			if (lineNumber < segment.expandedStartLine || lineNumber > segmentEnd) continue
			const column = Math.max(1, Math.floor(columnNumber ?? 1))
			const offset = lineNumber - segment.expandedStartLine
			const originalLine = segment.originalStartLine + offset

			if (segment.fileName) {
				return {
					fileId: toComponentFileId(segment.fileName),
					fileName: segment.fileName,
					line: originalLine,
					column,
				}
			}

			const mappedLine = originalLine - autoImportOffset
			if (mappedLine <= 0) return null
			return {
				fileId: "source",
				fileName: null,
				line: mappedLine,
				column,
			}
		}
		return null
	}

	return { resolve }
}

type SourceLocation = {
	start: { line: number; column: number }
	end: { line: number; column: number }
}

type SnippetElementMatch = {
	startLine: number
	endLine: number
	textRanges: SnippetTextRange[]
	elementRange: SnippetTextRange
	elementType: "element" | "fragment"
	elementName: string | null
}

const isJsxNodeType = (type: string) => type === "JSXElement" || type === "JSXFragment"

const toTextRangeFromLoc = (loc: SourceLocation): SnippetTextRange => ({
	startLine: loc.start.line,
	startColumn: loc.start.column + 1,
	endLine: loc.end.line,
	endColumn: loc.end.column + 1,
})

const isWithinLocation = (loc: SourceLocation, line: number, column: number) => {
	if (line < loc.start.line || line > loc.end.line) return false
	if (line === loc.start.line && column < loc.start.column) return false
	if (line === loc.end.line && column > loc.end.column) return false
	return true
}

const getSpanScore = (loc: SourceLocation) => {
	const lineSpan = loc.end.line - loc.start.line
	const columnSpan = lineSpan === 0 ? loc.end.column - loc.start.column : 10000 + lineSpan
	return { lineSpan, columnSpan }
}

export const createSnippetElementLocator = (source: string) => {
	let ast: ReturnType<typeof parse> | null = null
	const jsxNodes: Array<{ node: Record<string, unknown>; loc: SourceLocation }> = []

	if (source.trim().length > 0) {
		try {
			ast = parse(source, {
				sourceType: "module",
				plugins: ["typescript", "jsx"],
				errorRecovery: true,
				allowReturnOutsideFunction: true,
			})
		} catch {
			ast = null
		}
	}

	const formatJsxName = (node: Record<string, unknown>): string | null => {
		const type = node.type
		if (type === "JSXIdentifier") {
			return typeof node.name === "string" ? node.name : null
		}
		if (type === "JSXMemberExpression") {
			const object = node.object as Record<string, unknown> | undefined
			const property = node.property as Record<string, unknown> | undefined
			const objectName = object ? formatJsxName(object) : null
			const propertyName = property ? formatJsxName(property) : null
			if (!objectName || !propertyName) return null
			return `${objectName}.${propertyName}`
		}
		if (type === "JSXNamespacedName") {
			const namespace = node.namespace as Record<string, unknown> | undefined
			const name = node.name as Record<string, unknown> | undefined
			const namespaceName = namespace ? formatJsxName(namespace) : null
			const nameValue = name ? formatJsxName(name) : null
			if (!namespaceName || !nameValue) return null
			return `${namespaceName}:${nameValue}`
		}
		return null
	}

	const getJsxElementName = (node: Record<string, unknown>) => {
		const openingElement = node.openingElement as Record<string, unknown> | undefined
		const nameNode = openingElement?.name as Record<string, unknown> | undefined
		if (!nameNode) return null
		return formatJsxName(nameNode)
	}

	const collectJsxNodes = (node: unknown) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		const loc = record.loc as SourceLocation | null | undefined
		if (loc && isJsxNodeType(type)) {
			jsxNodes.push({ node: record, loc })
		}

		for (const value of Object.values(record)) {
			if (!value) continue
			if (Array.isArray(value)) {
				for (const entry of value) {
					collectJsxNodes(entry)
				}
			} else if (typeof value === "object") {
				collectJsxNodes(value)
			}
		}
	}

	if (ast) {
		collectJsxNodes(ast)
	}

	const MAX_TEXT_RANGES = 120

	const collectTextRanges = (node: Record<string, unknown>, ranges: SourceLocation[]) => {
		const type = node.type
		if (type === "JSXText") {
			const value = typeof node.value === "string" ? node.value : ""
			if (value.trim().length === 0) return
			const loc = node.loc as SourceLocation | null | undefined
			if (loc) {
				ranges.push(loc)
			}
			return
		}

		if (type === "JSXExpressionContainer") {
			const expression = node.expression as Record<string, unknown> | undefined
			if (!expression || expression.type === "JSXEmptyExpression") return
			if (expression.type === "StringLiteral") {
				const literalValue = typeof expression.value === "string" ? expression.value : ""
				if (literalValue.trim().length === 0) return
				const loc = expression.loc as SourceLocation | null | undefined
				if (loc) {
					ranges.push(loc)
				}
				return
			}
			return
		}

		if (type === "JSXElement" || type === "JSXFragment") {
			const children = node.children
			if (Array.isArray(children)) {
				for (const child of children) {
					if (ranges.length >= MAX_TEXT_RANGES) return
					if (child && typeof child === "object") {
						collectTextRanges(child as Record<string, unknown>, ranges)
					}
				}
			}
		}
	}

	const findMatch = (lineNumber: number, columnNumber = 1): SnippetElementMatch | null => {
		if (!ast || jsxNodes.length === 0) return null
		const line = Math.max(1, Math.floor(lineNumber))
		const column = Math.max(0, Math.floor(columnNumber) - 1)
		let best: (typeof jsxNodes)[number] | null = null

		for (const entry of jsxNodes) {
			const loc = entry.loc
			if (!isWithinLocation(loc, line, column)) continue
			if (!best) {
				best = entry
				continue
			}
			const bestScore = getSpanScore(best.loc)
			const candidateScore = getSpanScore(loc)
			const isSmaller =
				candidateScore.lineSpan < bestScore.lineSpan ||
				(candidateScore.lineSpan === bestScore.lineSpan &&
					candidateScore.columnSpan < bestScore.columnSpan)
			if (isSmaller) {
				best = entry
			}
		}

		if (!best) return null
		const bestType = best.node.type
		const isFragment = bestType === "JSXFragment"
		const elementName = isFragment ? null : getJsxElementName(best.node)
		const elementType: SnippetElementMatch["elementType"] = isFragment ? "fragment" : "element"
		const textRanges: SourceLocation[] = []
		collectTextRanges(best.node, textRanges)
		return {
			startLine: best.loc.start.line,
			endLine: best.loc.end.line,
			textRanges: textRanges.slice(0, MAX_TEXT_RANGES).map(toTextRangeFromLoc),
			elementRange: toTextRangeFromLoc(best.loc),
			elementType,
			elementName,
		}
	}

	return { findMatch }
}

export const resolveSnippetElementContext = (
	source: string,
	range: SnippetTextRange,
): SnippetElementContext | null => {
	if (!source.trim()) return null
	let ast: ReturnType<typeof parse> | null = null

	try {
		ast = parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true,
			allowReturnOutsideFunction: true,
		})
	} catch {
		return null
	}

	let bestLoc: SourceLocation | null = null
	let bestParentType: string | null = null

	const containsRange = (loc: SourceLocation) => {
		const startColumn = Math.max(0, range.startColumn - 1)
		const endColumn = Math.max(0, range.endColumn - 1)
		return (
			isWithinLocation(loc, range.startLine, startColumn) &&
			isWithinLocation(loc, range.endLine, endColumn)
		)
	}

	const visit = (node: unknown, parentType: string | null) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		const loc = record.loc as SourceLocation | null | undefined
		if (loc && isJsxNodeType(type) && containsRange(loc)) {
			if (!bestLoc) {
				bestLoc = loc
				bestParentType = parentType
			} else {
				const bestScore = getSpanScore(bestLoc)
				const candidateScore = getSpanScore(loc)
				const isSmaller =
					candidateScore.lineSpan < bestScore.lineSpan ||
					(candidateScore.lineSpan === bestScore.lineSpan &&
						candidateScore.columnSpan < bestScore.columnSpan)
				if (isSmaller) {
					bestLoc = loc
					bestParentType = parentType
				}
			}
		}

		for (const value of Object.values(record)) {
			if (!value) continue
			if (Array.isArray(value)) {
				for (const entry of value) {
					visit(entry, type)
				}
			} else if (typeof value === "object") {
				visit(value, type)
			}
		}
	}

	visit(ast, null)

	if (!bestLoc) return null
	if (bestParentType === "JSXElement" || bestParentType === "JSXFragment") {
		return "jsx"
	}
	return "expression"
}

const getOffsetForPosition = (source: string, lineNumber: number, columnNumber: number) => {
	const targetLine = Math.max(1, Math.floor(lineNumber))
	const targetColumn = Math.max(1, Math.floor(columnNumber))
	let line = 1
	let lineStart = 0

	for (let index = 0; index <= source.length; index += 1) {
		if (index === source.length || source[index] === "\n") {
			if (line === targetLine) {
				const lineEnd = index
				const lineLength = Math.max(0, lineEnd - lineStart)
				const clampedColumn = Math.min(Math.max(targetColumn, 1), lineLength + 1)
				return lineStart + clampedColumn - 1
			}
			line += 1
			lineStart = index + 1
		}
	}

	return source.length
}

const getRangeOffsets = (source: string, range: SnippetTextRange) => {
	const startOffset = getOffsetForPosition(source, range.startLine, range.startColumn)
	const endOffset = getOffsetForPosition(source, range.endLine, range.endColumn)
	const start = Math.min(startOffset, endOffset)
	const end = Math.max(startOffset, endOffset)
	return { start, end }
}

const isQuote = (value: string) => value === "'" || value === '"'

const escapeForQuote = (value: string, quote: Exclude<SnippetTextQuote, null>) =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/\r/g, "\\r")
		.replace(/\n/g, "\\n")
		.replace(quote === "'" ? /'/g : /"/g, `\\${quote}`)

export const getSnippetTextRangeValue = (
	source: string,
	range: SnippetTextRange,
): {
	raw: string
	text: string
	quote: SnippetTextQuote
} => {
	const { start, end } = getRangeOffsets(source, range)
	const raw = source.slice(start, end)
	const quote =
		raw.length >= 2 && raw[0] === raw[raw.length - 1] && isQuote(raw[0])
			? (raw[0] as Exclude<SnippetTextQuote, null>)
			: null
	const text = quote ? raw.slice(1, -1) : raw
	return { raw, text, quote }
}

export const buildSnippetTextLiteral = (text: string, quote: SnippetTextQuote) => {
	if (!quote) return text
	return `${quote}${escapeForQuote(text, quote)}${quote}`
}

export const replaceSnippetTextRange = (
	source: string,
	range: SnippetTextRange,
	nextText: string,
	quote: SnippetTextQuote,
) => {
	const { start, end } = getRangeOffsets(source, range)
	const replacement = buildSnippetTextLiteral(nextText, quote)
	return source.slice(0, start) + replacement + source.slice(end)
}
