import { parse } from "@babel/parser"

export type SnippetTextRange = {
	startLine: number
	startColumn: number
	endLine: number
	endColumn: number
}

export type SnippetInspectIndexEntry = {
	elementRange: SnippetTextRange
	textRanges: SnippetTextRange[]
	elementType: "element" | "fragment"
	elementName: string | null
}

export type SnippetInspectIndex = {
	version: 1
	elements: SnippetInspectIndexEntry[]
}

export type SnippetInspectLookupEntry = {
	range: SnippetTextRange
	textRanges: SnippetTextRange[]
	elementRange: SnippetTextRange
	elementType: "element" | "fragment"
	elementName: string | null
}

const isJsxNodeType = (type: string) => type === "JSXElement" || type === "JSXFragment"

const toTextRange = (loc: {
	start: { line: number; column: number }
	end: { line: number; column: number }
}): SnippetTextRange => ({
	startLine: loc.start.line,
	startColumn: loc.start.column + 1,
	endLine: loc.end.line,
	endColumn: loc.end.column + 1,
})

const isWithinRange = (range: SnippetTextRange, line: number, column: number) => {
	if (line < range.startLine || line > range.endLine) return false
	if (line === range.startLine && column < range.startColumn) return false
	if (line === range.endLine && column > range.endColumn) return false
	return true
}

const getSpanScore = (range: SnippetTextRange) => {
	const lineSpan = range.endLine - range.startLine
	const columnSpan = lineSpan === 0 ? range.endColumn - range.startColumn : 10000 + lineSpan
	return { lineSpan, columnSpan }
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

const MAX_TEXT_RANGES = 120

const collectTextRanges = (
	node: Record<string, unknown>,
	ranges: Array<{ start: { line: number; column: number }; end: { line: number; column: number } }>,
) => {
	const type = node.type
	if (type === "JSXText") {
		const value = typeof node.value === "string" ? node.value : ""
		if (value.trim().length === 0) return
		const loc = node.loc as
			| { start: { line: number; column: number }; end: { line: number; column: number } }
			| null
			| undefined
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
			const loc = expression.loc as
				| { start: { line: number; column: number }; end: { line: number; column: number } }
				| null
				| undefined
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

/**
 * Build an inspect index from snippet source for mapping editor selections to JSX element ranges.
 */
export const buildSnippetInspectIndex = (source: string): SnippetInspectIndex | null => {
	if (!source || source.trim().length === 0) {
		return { version: 1, elements: [] }
	}

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

	const elements: SnippetInspectIndexEntry[] = []

	const visit = (node: unknown) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		const loc = record.loc as
			| { start: { line: number; column: number }; end: { line: number; column: number } }
			| null
			| undefined
		if (loc && isJsxNodeType(type)) {
			const isFragment = type === "JSXFragment"
			const elementName = isFragment ? null : getJsxElementName(record)
			const textRanges: Array<{
				start: { line: number; column: number }
				end: { line: number; column: number }
			}> = []
			collectTextRanges(record, textRanges)
			elements.push({
				elementRange: toTextRange(loc),
				textRanges: textRanges.slice(0, MAX_TEXT_RANGES).map(toTextRange),
				elementType: isFragment ? "fragment" : "element",
				elementName,
			})
		}

		for (const value of Object.values(record)) {
			if (!value) continue
			if (Array.isArray(value)) {
				for (const entry of value) {
					visit(entry)
				}
			} else if (typeof value === "object") {
				visit(value)
			}
		}
	}

	visit(ast)

	return { version: 1, elements }
}

/**
 * Create a lookup helper for finding the smallest JSX element that contains a line/column position.
 */
export const createInspectLookup = (index: SnippetInspectIndex, _source?: string) => {
	const elements = index.elements

	const findMatch = (lineNumber: number, columnNumber = 1): SnippetInspectLookupEntry | null => {
		if (!Number.isFinite(lineNumber) || lineNumber <= 0) return null
		const line = Math.max(1, Math.floor(lineNumber))
		const column = Math.max(1, Math.floor(columnNumber))
		let best: SnippetInspectIndexEntry | null = null

		for (const entry of elements) {
			if (!isWithinRange(entry.elementRange, line, column)) continue
			if (!best) {
				best = entry
				continue
			}
			const bestScore = getSpanScore(best.elementRange)
			const candidateScore = getSpanScore(entry.elementRange)
			const isSmaller =
				candidateScore.lineSpan < bestScore.lineSpan ||
				(candidateScore.lineSpan === bestScore.lineSpan &&
					candidateScore.columnSpan < bestScore.columnSpan)
			if (isSmaller) {
				best = entry
			}
		}

		if (!best) return null
		return {
			range: best.elementRange,
			textRanges: best.textRanges,
			elementRange: best.elementRange,
			elementType: best.elementType,
			elementName: best.elementName,
		}
	}

	return { findMatch }
}
