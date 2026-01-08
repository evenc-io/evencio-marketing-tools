import { getAttributeName, getIndentationAt, getObjectPropertyKey, hasValidRange } from "./ast"
import type { SourceUpdate } from "./source-update"

export type StyleUpdate = {
	key: string
	value?: string | null
	remove?: boolean
}

type ObjectExpressionUpdateResult =
	| { updated: false; value: null; removedKeys: boolean; isEmpty: boolean }
	| { updated: true; value: string; removedKeys: boolean; isEmpty: boolean }

const trimTrailingComma = (value: string) => value.replace(/\s*,\s*$/, "")

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

/**
 * Build a `style` attribute update for a JSX opening element based on a set of key/value style updates.
 */
export const buildStyleUpdate = (
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
