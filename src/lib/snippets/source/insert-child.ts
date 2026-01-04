import { loadBabelParser } from "../babel-parser"

export type SnippetInsertChildRequest = {
	source: string
	line: number
	column: number
	jsx: string
}

export type SnippetInsertChildResponse =
	| {
			source: string
			changed: true
			insertedAt: { line: number; column: number }
	  }
	| {
			source: string
			changed: false
			reason?: string
	  }

type SourceLocation = {
	start: { line: number; column: number }
	end: { line: number; column: number }
}

const hasValidRange = (node: { start?: number; end?: number } | null | undefined) =>
	typeof node?.start === "number" && typeof node?.end === "number"

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

type JsxTarget = {
	node: Record<string, unknown>
	loc: SourceLocation
}

const findJsxElementAt = (ast: unknown, line: number, column: number): JsxTarget | null => {
	let best: JsxTarget | null = null

	const visit = (node: unknown) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		const loc = record.loc as SourceLocation | null | undefined
		if (loc && type === "JSXElement") {
			if (isWithinLocation(loc, line, column)) {
				if (!best) {
					best = { node: record, loc }
				} else {
					const bestScore = getSpanScore(best.loc)
					const candidateScore = getSpanScore(loc)
					const isSmaller =
						candidateScore.lineSpan < bestScore.lineSpan ||
						(candidateScore.lineSpan === bestScore.lineSpan &&
							candidateScore.columnSpan < bestScore.columnSpan)
					if (isSmaller) {
						best = { node: record, loc }
					}
				}
			}
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
	return best
}

const getIndentationAt = (source: string, index: number) => {
	const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1
	const prefix = source.slice(lineStart, Math.max(lineStart, index))
	return prefix.match(/^\s*/)?.[0] ?? ""
}

const VOID_HTML_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
])

const DISALLOWED_SVG_TAGS = new Set([
	"svg",
	"path",
	"rect",
	"circle",
	"line",
	"polyline",
	"polygon",
	"g",
	"defs",
	"use",
	"text",
	"tspan",
	"mask",
	"clipPath",
	"pattern",
	"linearGradient",
	"radialGradient",
	"stop",
])

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

const indentMultiline = (value: string, indent: string) => {
	const trimmed = value.trim()
	if (!trimmed) return ""
	const lines = trimmed.split(/\r?\n/)
	return lines.map((line) => `${indent}${line.trimEnd()}`).join("\n")
}

export const insertSnippetChild = async ({
	source,
	line,
	column,
	jsx,
}: SnippetInsertChildRequest): Promise<SnippetInsertChildResponse> => {
	if (!source.trim()) {
		return { source, changed: false, reason: "Source is empty." }
	}
	const trimmedJsx = jsx.trim()
	if (!trimmedJsx) {
		return { source, changed: false, reason: "Nothing to insert." }
	}

	const parser = await loadBabelParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
		errorRecovery: true,
		allowReturnOutsideFunction: true,
	})

	const targetLine = Math.max(1, Math.floor(line))
	const targetColumn = Math.max(0, Math.floor(column) - 1)
	const target = findJsxElementAt(ast, targetLine, targetColumn)
	if (!target) {
		return { source, changed: false, reason: "Unable to locate JSX element." }
	}

	const openingElement = target.node.openingElement as Record<string, unknown> | undefined
	const closingElement = target.node.closingElement as Record<string, unknown> | undefined
	if (!openingElement || !hasValidRange(openingElement)) {
		return { source, changed: false, reason: "Selected element is missing a JSX opening tag." }
	}
	if (openingElement.selfClosing || !closingElement || !hasValidRange(closingElement)) {
		return { source, changed: false, reason: "Selected element does not accept children." }
	}

	const elementName = getJsxElementName(target.node)
	if (elementName && /^[a-z]/.test(elementName)) {
		if (VOID_HTML_TAGS.has(elementName)) {
			return { source, changed: false, reason: `Cannot insert children into <${elementName}>.` }
		}
		if (DISALLOWED_SVG_TAGS.has(elementName)) {
			return { source, changed: false, reason: `Cannot insert children into <${elementName}>.` }
		}
	}

	const openIndent = getIndentationAt(source, openingElement.start as number)
	const childIndent = `${openIndent}  `
	const indentedChild = indentMultiline(trimmedJsx, childIndent)
	if (!indentedChild) {
		return { source, changed: false, reason: "Nothing to insert." }
	}

	const openLine = (openingElement.loc as SourceLocation | undefined)?.start.line ?? null
	const closeLine = (closingElement.loc as SourceLocation | undefined)?.start.line ?? null
	const closingStart = closingElement.start as number

	if (openLine !== null && closeLine !== null && closeLine === openLine) {
		const between = source.slice(openingElement.end as number, closingStart)
		if (between.trim().length > 0) {
			return { source, changed: false, reason: "Inline children are not supported yet." }
		}

		const insertion = `\n${indentedChild}\n${openIndent}`
		const nextSource = source.slice(0, closingStart) + insertion + source.slice(closingStart)
		return {
			source: nextSource,
			changed: nextSource !== source,
			insertedAt: { line: openLine + 1, column: childIndent.length + 1 },
		}
	}

	const closingLineStart = source.lastIndexOf("\n", closingStart - 1) + 1
	const insertion = `${indentedChild}\n`
	const nextSource = source.slice(0, closingLineStart) + insertion + source.slice(closingLineStart)

	const insertedLine =
		openLine !== null && closeLine !== null && closeLine > openLine ? closeLine : targetLine
	return {
		source: nextSource,
		changed: nextSource !== source,
		insertedAt: { line: insertedLine, column: childIndent.length + 1 },
	}
}
