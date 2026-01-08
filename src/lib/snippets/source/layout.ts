import {
	findJsxElementAt,
	getAttributeName,
	getIndentationAt,
	getObjectPropertyKey,
	hasValidRange,
} from "./ast"
import { parseSnippetTsxSource } from "./parse-tsx"

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
	notice?: string
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

const splitVariants = (value: string) => {
	let bracketDepth = 0
	let lastColon = -1
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index]
		if (char === "[") bracketDepth += 1
		if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1)
		if (char === ":" && bracketDepth === 0) lastColon = index
	}
	return lastColon >= 0 ? value.slice(lastColon + 1) : value
}

const stripImportantPrefix = (value: string) => {
	let next = value
	while (next.startsWith("!")) {
		next = next.slice(1)
	}
	return next
}

const stripNegativePrefix = (value: string) => (value.startsWith("-") ? value.slice(1) : value)

const isTranslateClass = (token: string) => {
	const utility = stripImportantPrefix(splitVariants(token))
	const base = stripNegativePrefix(utility)
	if (base.startsWith("translate-x-")) return true
	if (base.startsWith("translate-y-")) return true
	if (base.startsWith("translate-z-")) return false
	return base.startsWith("translate-")
}

const isWidthClass = (token: string) => {
	const utility = stripImportantPrefix(splitVariants(token))
	const base = stripNegativePrefix(utility)
	return (
		base.startsWith("w-") ||
		base.startsWith("min-w-") ||
		base.startsWith("max-w-") ||
		base.startsWith("size-")
	)
}

const isHeightClass = (token: string) => {
	const utility = stripImportantPrefix(splitVariants(token))
	const base = stripNegativePrefix(utility)
	return (
		base.startsWith("h-") ||
		base.startsWith("min-h-") ||
		base.startsWith("max-h-") ||
		base.startsWith("size-")
	)
}

const isAlignmentXClass = (token: string) => {
	const utility = stripImportantPrefix(splitVariants(token))
	return ALIGNMENT_X_CLASSES.has(utility)
}

const isAlignmentYClass = (token: string) => {
	const utility = stripImportantPrefix(splitVariants(token))
	return ALIGNMENT_Y_CLASSES.has(utility)
}

const formatArbitraryClass = (prefix: string, value: string) => `${prefix}-[${value}]`

const buildTranslateClasses = (x: number, y: number) => {
	const classes: string[] = []
	if (x !== 0) {
		classes.push(formatArbitraryClass("translate-x", `${formatNumber(x)}px`))
	}
	if (y !== 0) {
		classes.push(formatArbitraryClass("translate-y", `${formatNumber(y)}px`))
	}
	return classes
}

const buildSizeClasses = (widthValue: string | null, heightValue: string | null) => {
	const classes: string[] = []
	if (widthValue) {
		classes.push(formatArbitraryClass("w", widthValue))
	}
	if (heightValue) {
		classes.push(formatArbitraryClass("h", heightValue))
	}
	return classes
}

const normalizeTailwindClassName = (
	value: string,
	options: {
		updateAlignX: boolean
		updateAlignY: boolean
		alignClassX: string | null
		alignClassY: string | null
		updateTranslate: boolean
		translateClasses: string[]
		updateWidth: boolean
		updateHeight: boolean
		sizeClasses: string[]
	},
) => {
	const tokens = value.split(/\s+/).filter(Boolean)
	const next: string[] = []
	const seen = new Set<string>()

	const push = (token: string) => {
		if (!token) return
		if (seen.has(token)) return
		seen.add(token)
		next.push(token)
	}

	for (const token of tokens) {
		if (options.updateAlignX && isAlignmentXClass(token)) continue
		if (options.updateAlignY && isAlignmentYClass(token)) continue
		if (options.updateTranslate && isTranslateClass(token)) continue
		if (options.updateWidth && isWidthClass(token)) continue
		if (options.updateHeight && isHeightClass(token)) continue
		push(token)
	}

	if (options.alignClassX) push(options.alignClassX)
	if (options.alignClassY) push(options.alignClassY)

	for (const token of options.translateClasses) push(token)
	for (const token of options.sizeClasses) push(token)

	return next.join(" ")
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
	notice?: string
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

const isCnCallExpression = (node: Record<string, unknown> | null | undefined) => {
	if (!node || node.type !== "CallExpression") return false
	const callee = node.callee as Record<string, unknown> | null | undefined
	if (!callee) return false
	if (callee.type === "Identifier") {
		return callee.name === "cn"
	}
	return false
}

const buildClassNameUpdate = (
	openingElement: Record<string, unknown>,
	attributes: Record<string, unknown>[],
	options: {
		updateAlignX: boolean
		updateAlignY: boolean
		alignClassX: string | null
		alignClassY: string | null
		updateTranslate: boolean
		translateClasses: string[]
		updateWidth: boolean
		updateHeight: boolean
		sizeClasses: string[]
	},
): ClassNameUpdateResult => {
	const shouldUpdate =
		options.updateAlignX ||
		options.updateAlignY ||
		options.updateTranslate ||
		options.updateWidth ||
		options.updateHeight
	if (!shouldUpdate) return { update: null, applied: false }
	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})

	if (!classAttribute) {
		const nextValue = normalizeTailwindClassName("", {
			updateAlignX: options.updateAlignX,
			updateAlignY: options.updateAlignY,
			alignClassX: options.alignClassX,
			alignClassY: options.alignClassY,
			updateTranslate: options.updateTranslate,
			translateClasses: options.translateClasses,
			updateWidth: options.updateWidth,
			updateHeight: options.updateHeight,
			sizeClasses: options.sizeClasses,
		})
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
		const expression =
			valueNode?.type === "JSXExpressionContainer"
				? (valueNode.expression as Record<string, unknown> | null | undefined)
				: null
		const usesCn = Boolean(expression && isCnCallExpression(expression))
		return {
			update: null,
			applied: false,
			notice: usesCn
				? "Layout mode couldn't rewrite className={cn(...)} safely. Falling back to inline styles."
				: "Layout mode couldn't rewrite a dynamic className expression. Falling back to inline styles.",
		}
	}

	const nextValue = normalizeTailwindClassName(currentValue, {
		updateAlignX: options.updateAlignX,
		updateAlignY: options.updateAlignY,
		alignClassX: options.alignClassX,
		alignClassY: options.alignClassY,
		updateTranslate: options.updateTranslate,
		translateClasses: options.translateClasses,
		updateWidth: options.updateWidth,
		updateHeight: options.updateHeight,
		sizeClasses: options.sizeClasses,
	})
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
	const ast = await parseSnippetTsxSource(source)
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
	let notice: string | undefined

	const nextTranslateX = xIsZero ? 0 : translateX
	const nextTranslateY = yIsZero ? 0 : translateY
	const nextNormalizedX = normalizeTranslateValue(nextTranslateX)
	const nextNormalizedY = normalizeTranslateValue(nextTranslateY)
	const removeTranslate = nextNormalizedX === 0 && nextNormalizedY === 0
	const widthValue =
		typeof width === "number" && Number.isFinite(width)
			? formatSizeValue(normalizeSizeValue(width))
			: null
	const heightValue =
		typeof height === "number" && Number.isFinite(height)
			? formatSizeValue(normalizeSizeValue(height))
			: null

	const updates: SourceUpdate[] = []
	const translateClasses = removeTranslate
		? []
		: buildTranslateClasses(nextNormalizedX, nextNormalizedY)
	const sizeClasses = buildSizeClasses(widthValue, heightValue)
	const classUpdateResult = buildClassNameUpdate(openingElement, attributes, {
		updateAlignX: shouldAlignX,
		updateAlignY: shouldAlignY,
		alignClassX: shouldAlignX ? alignClassX : null,
		alignClassY: shouldAlignY ? alignClassY : null,
		updateTranslate: true,
		translateClasses,
		updateWidth: widthValue !== null,
		updateHeight: heightValue !== null,
		sizeClasses,
	})

	if (classUpdateResult.notice) {
		notice = classUpdateResult.notice
	}

	const canWriteTailwindClasses = classUpdateResult.applied

	if (canWriteTailwindClasses && classUpdateResult.update) {
		updates.push(classUpdateResult.update)
	}

	const styleUpdates: StyleUpdate[] = []
	if (canWriteTailwindClasses) {
		styleUpdates.push({ key: "translate", remove: true })
		if (widthValue !== null) {
			styleUpdates.push({ key: "width", remove: true })
		}
		if (heightValue !== null) {
			styleUpdates.push({ key: "height", remove: true })
		}
	} else {
		const translateValue = formatTranslateValue(nextNormalizedX, nextNormalizedY)
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
	}

	const styleUpdate =
		styleUpdates.length > 0
			? buildStyleUpdate(source, openingElement, attributes, styleUpdates)
			: null
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
	return { source: updatedSource, changed: updatedSource !== source, notice }
}
