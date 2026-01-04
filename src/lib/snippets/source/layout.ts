import { loadBabelParser } from "../babel-parser"

export type SnippetLayoutTranslateRequest = {
	source: string
	line: number
	column: number
	translateX: number
	translateY: number
	alignX?: "left" | "center" | "right" | null
	alignY?: "top" | "center" | "bottom" | null
	width?: number
	height?: number
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

const normalizeTranslateValue = (value: number) => {
	if (!Number.isFinite(value)) return 0
	const rounded = Math.round(value * 100) / 100
	return Math.abs(rounded) < 0.005 ? 0 : rounded
}

const formatTranslateValue = (x: number, y: number) => `${formatNumber(x)}px ${formatNumber(y)}px`

const normalizeSizeValue = (value: number) => {
	if (!Number.isFinite(value)) return 0
	const rounded = Math.round(value * 100) / 100
	return Math.max(0, Math.abs(rounded) < 0.005 ? 0 : rounded)
}

const formatSizeValue = (value: number) => `${formatNumber(value)}px`

const trimTrailingComma = (value: string) => value.replace(/\s*,\s*$/, "")

const replaceRange = (source: string, start: number, end: number, replacement: string) =>
	source.slice(0, start) + replacement + source.slice(end)

const ALIGNMENT_X_CLASSES = new Set(["ml-auto", "mr-auto", "mx-auto"])
const ALIGNMENT_Y_CLASSES = new Set(["mt-auto", "mb-auto", "my-auto"])
const TRANSLATE_EPSILON = 0.5

const getAlignmentClassX = (alignX?: "left" | "center" | "right" | null) => {
	if (alignX === "center") return "mx-auto"
	if (alignX === "right") return "ml-auto"
	if (alignX === "left") return "mr-auto"
	return null
}

const getAlignmentClassY = (alignY?: "top" | "center" | "bottom" | null) => {
	if (alignY === "center") return "my-auto"
	if (alignY === "bottom") return "mt-auto"
	if (alignY === "top") return "mb-auto"
	return null
}

const normalizeClassName = (
	value: string,
	updateX: boolean,
	updateY: boolean,
	alignClassX: string | null,
	alignClassY: string | null,
) => {
	const tokens = value.split(/\s+/).filter(Boolean)
	const next = tokens.filter((token) => {
		if (updateX && ALIGNMENT_X_CLASSES.has(token)) return false
		if (updateY && ALIGNMENT_Y_CLASSES.has(token)) return false
		return true
	})
	if (alignClassX) {
		next.push(alignClassX)
	}
	if (alignClassY) {
		next.push(alignClassY)
	}
	return next.join(" ")
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

type StyleUpdate = {
	key: string
	value?: string | null
	remove?: boolean
}

type ObjectExpressionUpdateResult =
	| { updated: false; value: null; removedKeys: boolean; isEmpty: boolean }
	| { updated: true; value: string; removedKeys: boolean; isEmpty: boolean }

const buildUpdatedObjectExpression = (
	source: string,
	objectNode: Record<string, unknown>,
	updates: StyleUpdate[],
): ObjectExpressionUpdateResult => {
	const properties = Array.isArray(objectNode.properties) ? objectNode.properties : []
	const entries: string[] = []
	const updateMap = new Map<string, StyleUpdate>()
	for (const update of updates) {
		updateMap.set(update.key, update)
	}
	let updated = false
	let removedKeys = false

	for (const entry of properties) {
		if (!entry || typeof entry !== "object") continue
		const prop = entry as Record<string, unknown>
		if (!hasValidRange(prop)) {
			return {
				updated: false,
				value: null,
				removedKeys: false,
				isEmpty: false,
			}
		}
		if (prop.type === "ObjectProperty") {
			const key = getObjectPropertyKey(prop)
			const update = key ? updateMap.get(key) : null
			if (key && update) {
				updateMap.delete(key)
				if (update.remove) {
					updated = true
					removedKeys = true
					continue
				}
				if (update.value !== null && update.value !== undefined) {
					entries.push(`${key}: "${update.value}"`)
					updated = true
					continue
				}
			}
		}
		const raw = trimTrailingComma(source.slice(prop.start as number, prop.end as number))
		if (raw) {
			entries.push(raw)
		}
	}

	for (const update of updateMap.values()) {
		if (update.remove) {
			removedKeys = true
			continue
		}
		if (update.value !== null && update.value !== undefined) {
			entries.push(`${update.key}: "${update.value}"`)
			updated = true
		}
	}

	if (!updated && !removedKeys) {
		return {
			updated: false,
			value: null,
			removedKeys: false,
			isEmpty: false,
		}
	}

	const objectSource = source.slice(objectNode.start as number, objectNode.end as number)
	const multiline = objectSource.includes("\n")
	const indent = multiline ? getIndentationAt(source, objectNode.start as number) : ""
	const innerIndent = multiline ? `${indent}  ` : ""
	const joined = multiline
		? entries.map((entry) => `${innerIndent}${entry}`).join(",\n")
		: entries.join(", ")
	const value = multiline ? `{\n${joined}\n${indent}}` : `{ ${joined} }`
	return { updated: true, value, removedKeys, isEmpty: entries.length === 0 }
}

type SourceUpdate = {
	start: number
	end: number
	replacement: string
}

type ClassNameUpdateResult = {
	update: SourceUpdate | null
	applied: boolean
}

const readStaticClassNameValue = (valueNode: Record<string, unknown> | null | undefined) => {
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

const buildClassNameUpdate = (
	openingElement: Record<string, unknown>,
	attributes: Record<string, unknown>[],
	updateX: boolean,
	updateY: boolean,
	alignClassX: string | null,
	alignClassY: string | null,
): ClassNameUpdateResult => {
	if (!updateX && !updateY) return { update: null, applied: false }
	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})

	if (!classAttribute) {
		const nextValue = normalizeClassName("", updateX, updateY, alignClassX, alignClassY)
		if (!nextValue) {
			return { update: null, applied: true }
		}
		const isSelfClosing = Boolean(openingElement.selfClosing)
		const insertAt = isSelfClosing
			? Math.max(0, (openingElement.end as number) - 2)
			: Math.max(0, (openingElement.end as number) - 1)
		return {
			update: { start: insertAt, end: insertAt, replacement: ` className="${nextValue}"` },
			applied: true,
		}
	}

	if (!hasValidRange(classAttribute)) {
		return { update: null, applied: false }
	}

	const valueNode = classAttribute.value as Record<string, unknown> | null | undefined
	const currentValue = readStaticClassNameValue(valueNode)
	if (currentValue === null) {
		return { update: null, applied: false }
	}

	const nextValue = normalizeClassName(currentValue, updateX, updateY, alignClassX, alignClassY)
	if (nextValue === currentValue) {
		return { update: null, applied: true }
	}

	const attributeName = getAttributeName(classAttribute) ?? "className"
	return {
		update: {
			start: classAttribute.start as number,
			end: classAttribute.end as number,
			replacement: nextValue ? `${attributeName}="${nextValue}"` : "",
		},
		applied: true,
	}
}

const buildStyleUpdate = (
	source: string,
	openingElement: Record<string, unknown>,
	attributes: Record<string, unknown>[],
	updates: StyleUpdate[],
): SourceUpdate | null => {
	const styleAttribute = attributes.find((attr) => getAttributeName(attr) === "style")
	const valueUpdates = updates.filter(
		(update) => !update.remove && update.value !== null && update.value !== undefined,
	)
	const hasValueUpdates = valueUpdates.length > 0
	const inlineEntries = valueUpdates.map((update) => `${update.key}: "${update.value}"`)
	const inlineStyle = inlineEntries.length > 0 ? `style={{ ${inlineEntries.join(", ")} }}` : null

	if (!styleAttribute) {
		if (!hasValueUpdates || !inlineStyle) return null
		const isSelfClosing = Boolean(openingElement.selfClosing)
		const insertAt = isSelfClosing
			? Math.max(0, (openingElement.end as number) - 2)
			: Math.max(0, (openingElement.end as number) - 1)
		return {
			start: insertAt,
			end: insertAt,
			replacement: ` ${inlineStyle}`,
		}
	}

	if (!hasValidRange(styleAttribute)) {
		return null
	}

	const styleValue = styleAttribute.value as Record<string, unknown> | null | undefined
	if (!styleValue) {
		if (!hasValueUpdates || !inlineStyle) {
			return {
				start: styleAttribute.start as number,
				end: styleAttribute.end as number,
				replacement: "",
			}
		}
		return {
			start: styleAttribute.start as number,
			end: styleAttribute.end as number,
			replacement: inlineStyle,
		}
	}

	if (styleValue.type === "JSXExpressionContainer") {
		const expression = styleValue.expression as Record<string, unknown> | null | undefined
		if (expression?.type === "ObjectExpression" && hasValidRange(expression)) {
			const { value, removedKeys, updated, isEmpty } = buildUpdatedObjectExpression(
				source,
				expression,
				updates,
			)
			if (!updated) {
				return null
			}
			if (isEmpty && removedKeys) {
				return {
					start: styleAttribute.start as number,
					end: styleAttribute.end as number,
					replacement: "",
				}
			}
			return {
				start: expression.start as number,
				end: expression.end as number,
				replacement: value,
			}
		}

		if (expression?.type === "NullLiteral") {
			if (!hasValueUpdates || !inlineStyle) {
				return {
					start: styleAttribute.start as number,
					end: styleAttribute.end as number,
					replacement: "",
				}
			}
			return {
				start: styleAttribute.start as number,
				end: styleAttribute.end as number,
				replacement: inlineStyle,
			}
		}

		if (expression && hasValidRange(expression)) {
			if (!hasValueUpdates || inlineEntries.length === 0) {
				return null
			}
			const expressionText = source
				.slice(expression.start as number, expression.end as number)
				.trim()
			const mergedExpression = `{ ...${expressionText}, ${inlineEntries.join(", ")} }`
			return {
				start: expression.start as number,
				end: expression.end as number,
				replacement: mergedExpression,
			}
		}
	}

	if (!hasValueUpdates || !inlineStyle) {
		return {
			start: styleAttribute.start as number,
			end: styleAttribute.end as number,
			replacement: "",
		}
	}
	return {
		start: styleAttribute.start as number,
		end: styleAttribute.end as number,
		replacement: inlineStyle,
	}
}

export const applySnippetTranslate = async ({
	source,
	line,
	column,
	translateX,
	translateY,
	alignX,
	alignY,
	width,
	height,
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

	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []
	const updateX = alignX !== null && alignX !== undefined
	const updateY = alignY !== null && alignY !== undefined
	const alignClassX = getAlignmentClassX(alignX)
	const alignClassY = getAlignmentClassY(alignY)
	const normalizedX = normalizeTranslateValue(translateX)
	const normalizedY = normalizeTranslateValue(translateY)
	const xIsZero = Math.abs(normalizedX) <= TRANSLATE_EPSILON
	const yIsZero = Math.abs(normalizedY) <= TRANSLATE_EPSILON
	const shouldAlignX = updateX && xIsZero
	const shouldAlignY = updateY && yIsZero
	const classUpdateResult =
		shouldAlignX || shouldAlignY
			? buildClassNameUpdate(
					openingElement,
					attributes,
					shouldAlignX,
					shouldAlignY,
					shouldAlignX ? alignClassX : null,
					shouldAlignY ? alignClassY : null,
				)
			: { update: null, applied: false }
	const alignXApplied = shouldAlignX && classUpdateResult.applied
	const alignYApplied = shouldAlignY && classUpdateResult.applied

	const nextTranslateX = alignXApplied || xIsZero ? 0 : translateX
	const nextTranslateY = alignYApplied || yIsZero ? 0 : translateY
	const nextNormalizedX = normalizeTranslateValue(nextTranslateX)
	const nextNormalizedY = normalizeTranslateValue(nextTranslateY)
	const removeTranslate = nextNormalizedX === 0 && nextNormalizedY === 0
	const translateValue = formatTranslateValue(nextNormalizedX, nextNormalizedY)
	const widthValue =
		typeof width === "number" && Number.isFinite(width)
			? formatSizeValue(normalizeSizeValue(width))
			: null
	const heightValue =
		typeof height === "number" && Number.isFinite(height)
			? formatSizeValue(normalizeSizeValue(height))
			: null

	const updates: SourceUpdate[] = []
	if (classUpdateResult.update) {
		updates.push(classUpdateResult.update)
	}

	const styleUpdates: StyleUpdate[] = []
	if (removeTranslate) {
		styleUpdates.push({ key: "translate", remove: true })
	} else {
		styleUpdates.push({ key: "translate", value: translateValue })
	}
	if (widthValue !== null) {
		styleUpdates.push({ key: "width", value: widthValue })
	}
	if (heightValue !== null) {
		styleUpdates.push({ key: "height", value: heightValue })
	}
	const styleUpdate = buildStyleUpdate(source, openingElement, attributes, styleUpdates)
	if (styleUpdate) {
		updates.push(styleUpdate)
	}

	if (updates.length === 0) {
		if (!removeTranslate) {
			return { source, changed: false, reason: "Unable to update layout styles." }
		}
		return { source, changed: false }
	}

	const orderedUpdates = updates.sort((a, b) => b.start - a.start)
	const updatedSource = orderedUpdates.reduce(
		(current, update) => replaceRange(current, update.start, update.end, update.replacement),
		source,
	)
	return { source: updatedSource, changed: updatedSource !== source }
}
