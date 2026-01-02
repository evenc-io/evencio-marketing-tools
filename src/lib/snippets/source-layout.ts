import { loadBabelParser } from "./babel-parser"

export type SnippetLayoutTranslateRequest = {
	source: string
	line: number
	column: number
	translateX: number
	translateY: number
}

export type SnippetLayoutTranslateResult = {
	source: string
	changed: boolean
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

const getIndentationAt = (source: string, index: number) => {
	const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1
	const prefix = source.slice(lineStart, Math.max(lineStart, index))
	return prefix.match(/^\s*/)?.[0] ?? ""
}

const formatNumber = (value: number) => {
	if (!Number.isFinite(value)) return "0"
	const rounded = Math.round(value * 100) / 100
	const normalized = Math.abs(rounded) < 0.005 ? 0 : rounded
	return normalized.toFixed(2).replace(/\.?0+$/, "")
}

const formatTranslateValue = (x: number, y: number) => `${formatNumber(x)}px ${formatNumber(y)}px`

const trimTrailingComma = (value: string) => value.replace(/\s*,\s*$/, "")

const replaceRange = (source: string, start: number, end: number, replacement: string) =>
	source.slice(0, start) + replacement + source.slice(end)

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

const getAttributeName = (node: Record<string, unknown>) => {
	const nameNode = node.name as Record<string, unknown> | undefined
	if (!nameNode || nameNode.type !== "JSXIdentifier") return null
	return typeof nameNode.name === "string" ? nameNode.name : null
}

const getObjectPropertyKey = (node: Record<string, unknown>) => {
	const keyNode = node.key as Record<string, unknown> | undefined
	if (!keyNode) return null
	if (keyNode.type === "Identifier") {
		return typeof keyNode.name === "string" ? keyNode.name : null
	}
	if (keyNode.type === "StringLiteral") {
		return typeof keyNode.value === "string" ? keyNode.value : null
	}
	return null
}

const buildUpdatedObjectExpression = (
	source: string,
	objectNode: Record<string, unknown>,
	translateValue: string,
) => {
	const properties = Array.isArray(objectNode.properties) ? objectNode.properties : []
	const entries: string[] = []
	let updated = false

	for (const entry of properties) {
		if (!entry || typeof entry !== "object") continue
		const prop = entry as Record<string, unknown>
		if (!hasValidRange(prop)) {
			return { updated: false, value: null as string | null }
		}
		if (prop.type === "ObjectProperty") {
			const key = getObjectPropertyKey(prop)
			if (key === "translate") {
				entries.push(`translate: "${translateValue}"`)
				updated = true
				continue
			}
		}
		const raw = trimTrailingComma(source.slice(prop.start as number, prop.end as number))
		if (raw) {
			entries.push(raw)
		}
	}

	if (!updated) {
		entries.push(`translate: "${translateValue}"`)
	}

	const objectSource = source.slice(objectNode.start as number, objectNode.end as number)
	const multiline = objectSource.includes("\n")
	const indent = multiline ? getIndentationAt(source, objectNode.start as number) : ""
	const innerIndent = multiline ? `${indent}  ` : ""
	const joined = multiline
		? entries.map((entry) => `${innerIndent}${entry}`).join(",\n")
		: entries.join(", ")
	const value = multiline ? `{\n${joined}\n${indent}}` : `{ ${joined} }`
	return { updated: true, value }
}

export const applySnippetTranslate = async ({
	source,
	line,
	column,
	translateX,
	translateY,
}: SnippetLayoutTranslateRequest): Promise<SnippetLayoutTranslateResult> => {
	if (!source.trim()) {
		return { source, changed: false, reason: "Source is empty." }
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
	if (!openingElement || !hasValidRange(openingElement)) {
		return { source, changed: false, reason: "Selected element is missing a JSX opening tag." }
	}

	const translateValue = formatTranslateValue(translateX, translateY)
	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []
	const styleAttribute = attributes.find((attr) => getAttributeName(attr) === "style")

	if (!styleAttribute) {
		const isSelfClosing = Boolean(openingElement.selfClosing)
		const insertAt = isSelfClosing
			? Math.max(0, (openingElement.end as number) - 2)
			: Math.max(0, (openingElement.end as number) - 1)
		const insertion = ` style={{ translate: "${translateValue}" }}`
		const updated = replaceRange(source, insertAt, insertAt, insertion)
		return { source: updated, changed: updated !== source }
	}

	if (!hasValidRange(styleAttribute)) {
		return { source, changed: false, reason: "Style attribute location is unavailable." }
	}

	const styleValue = styleAttribute.value as Record<string, unknown> | null | undefined
	if (!styleValue) {
		const updated = replaceRange(
			source,
			styleAttribute.start as number,
			styleAttribute.end as number,
			`style={{ translate: "${translateValue}" }}`,
		)
		return { source: updated, changed: updated !== source }
	}

	if (styleValue.type === "JSXExpressionContainer") {
		const expression = styleValue.expression as Record<string, unknown> | null | undefined
		if (expression?.type === "ObjectExpression" && hasValidRange(expression)) {
			const { value } = buildUpdatedObjectExpression(source, expression, translateValue)
			if (!value) {
				return {
					source,
					changed: false,
					reason: "Unable to update style object expression.",
				}
			}
			const updated = replaceRange(
				source,
				expression.start as number,
				expression.end as number,
				value,
			)
			return { source: updated, changed: updated !== source }
		}

		if (expression?.type === "NullLiteral") {
			const updated = replaceRange(
				source,
				styleAttribute.start as number,
				styleAttribute.end as number,
				`style={{ translate: "${translateValue}" }}`,
			)
			return { source: updated, changed: updated !== source }
		}

		if (expression && hasValidRange(expression)) {
			const expressionText = source
				.slice(expression.start as number, expression.end as number)
				.trim()
			const mergedExpression = `{ ...${expressionText}, translate: "${translateValue}" }`
			const updated = replaceRange(
				source,
				expression.start as number,
				expression.end as number,
				mergedExpression,
			)
			return { source: updated, changed: updated !== source }
		}
	}

	const updated = replaceRange(
		source,
		styleAttribute.start as number,
		styleAttribute.end as number,
		`style={{ translate: "${translateValue}" }}`,
	)
	return { source: updated, changed: updated !== source }
}
