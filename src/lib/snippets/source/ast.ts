export type SourceLocation = {
	start: { line: number; column: number }
	end: { line: number; column: number }
}

export type JsxTarget = {
	node: Record<string, unknown>
	loc: SourceLocation
}

export const hasValidRange = (node: { start?: number; end?: number } | null | undefined) =>
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

export const findJsxElementAt = (ast: unknown, line: number, column: number): JsxTarget | null => {
	let best: JsxTarget | null = null

	const visit = (node: unknown) => {
		if (!node || typeof node !== "object") return
		const record = node as Record<string, unknown>
		const type = record.type
		if (typeof type !== "string") return

		const loc = record.loc as SourceLocation | null | undefined
		if (loc && !isWithinLocation(loc, line, column)) {
			return
		}

		if (loc && type === "JSXElement") {
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

		for (const key in record) {
			if (key === "loc" || key === "start" || key === "end") continue
			const value = record[key]
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

export const getAttributeName = (node: Record<string, unknown>) => {
	const nameNode = node.name as Record<string, unknown> | undefined
	if (!nameNode || nameNode.type !== "JSXIdentifier") return null
	return typeof nameNode.name === "string" ? nameNode.name : null
}

export const getObjectPropertyKey = (node: Record<string, unknown>) => {
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

export const readStaticClassNameValue = (valueNode: Record<string, unknown> | null | undefined) => {
	if (!valueNode) return ""
	if (valueNode.type === "StringLiteral") {
		return typeof valueNode.value === "string" ? valueNode.value : ""
	}
	if (valueNode.type === "JSXExpressionContainer") {
		const expression = valueNode.expression as Record<string, unknown> | null | undefined
		if (expression?.type === "StringLiteral") {
			return typeof expression.value === "string" ? expression.value : ""
		}
		if (expression?.type === "TemplateLiteral") {
			const quasis = Array.isArray(expression.quasis) ? expression.quasis : []
			const hasExpressions =
				Array.isArray(expression.expressions) && expression.expressions.length > 0
			if (hasExpressions) return null
			if (quasis.length === 1) {
				const cooked = (quasis[0] as Record<string, unknown>)?.value as
					| { cooked?: string }
					| undefined
				return typeof cooked?.cooked === "string" ? cooked.cooked : ""
			}
		}
		return null
	}
	return null
}

export const readOpeningElementName = (
	openingElement: Record<string, unknown> | null | undefined,
) => {
	const nameNode = openingElement?.name as Record<string, unknown> | null | undefined
	if (!nameNode) return null
	if (nameNode.type === "JSXIdentifier") {
		return typeof nameNode.name === "string" ? nameNode.name : null
	}
	if (nameNode.type === "JSXMemberExpression") {
		return null
	}
	return null
}

export const getIndentationAt = (source: string, index: number) => {
	const lineStart = source.lastIndexOf("\n", Math.max(0, index - 1)) + 1
	const prefix = source.slice(lineStart, Math.max(lineStart, index))
	return prefix.match(/^\s*/)?.[0] ?? ""
}
