import { loadBabelParser } from "../babel-parser"

export type SnippetStyleUpdateRequest = {
	source: string
	line: number
	column: number
	backgroundColor?: string | null
	borderWidth?: number | null
	borderColor?: string | null
	borderRadius?: number | string | null
	textColor?: string | null
	fontSize?: number | string | null
	fontWeight?: number | string | null
}

export type SnippetStyleUpdateResult = {
	source: string
	changed: boolean
	reason?: string
	notice?: string
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

const replaceRange = (source: string, start: number, end: number, replacement: string) =>
	source.slice(0, start) + replacement + source.slice(end)

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

const getUtility = (token: string) => stripImportantPrefix(splitVariants(token))

const THEME_COLOR_TOKENS = new Set([
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"destructive-foreground",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
])

const isPaletteColorToken = (suffix: string) => {
	if (!/^[a-z]+(?:-[a-z]+)*-\d{2,3}(?:\/\d{1,3})?$/.test(suffix)) return false
	if (suffix.startsWith("opacity-")) return false
	return true
}

const isColorSuffix = (suffix: string) => {
	if (!suffix) return false
	if (
		suffix === "transparent" ||
		suffix === "current" ||
		suffix === "black" ||
		suffix === "white"
	) {
		return true
	}
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	const base = suffix.includes("/") ? (suffix.split("/")[0] ?? "") : suffix
	if (THEME_COLOR_TOKENS.has(base)) return true
	return isPaletteColorToken(suffix)
}

const isBackgroundClass = (token: string) => {
	const base = getUtility(token)
	if (!base.startsWith("bg-")) return false
	return isColorSuffix(base.slice("bg-".length))
}

const isBorderWidthClass = (token: string) => {
	const base = getUtility(token)
	if (base === "border") return true
	if (/^border-(0|2|4|8)$/.test(base)) return true
	return /^border-\[[^\]]+\]$/.test(base)
}

const BORDER_COLOR_BLOCKLIST = new Set([
	"solid",
	"dashed",
	"dotted",
	"double",
	"hidden",
	"none",
	"collapse",
	"separate",
	"x",
	"y",
	"t",
	"r",
	"b",
	"l",
	"s",
	"e",
])

const isBorderColorClass = (token: string) => {
	const base = getUtility(token)
	if (!base.startsWith("border-")) return false
	if (isBorderWidthClass(token)) return false
	const suffix = base.slice("border-".length)
	if (!suffix) return false
	if (BORDER_COLOR_BLOCKLIST.has(suffix)) return false
	if (suffix.startsWith("spacing-")) return false
	if (/^\d+$/.test(suffix)) return false
	return isColorSuffix(suffix)
}

const isRadiusClass = (token: string) => getUtility(token).startsWith("rounded")

const isTextColorClass = (token: string) => {
	const base = getUtility(token)
	if (!base.startsWith("text-")) return false
	const suffix = base.slice("text-".length)
	return isColorSuffix(suffix)
}

const isFontSizeClass = (token: string) => {
	const base = getUtility(token)
	if (!base.startsWith("text-")) return false
	const suffix = base.slice("text-".length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(suffix)
}

const isFontWeightClass = (token: string) => {
	const base = getUtility(token)
	if (!base.startsWith("font-")) return false
	const suffix = base.slice("font-".length)
	if (!suffix) return false
	if (/^\[[^\]]+\]$/.test(suffix)) return true
	return /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(suffix)
}

type TailwindStyleUpdateOptions = {
	background?: string | null
	borderWidth?: string | null
	borderColor?: string | null
	radius?: string | null
	textColor?: string | null
	fontSize?: string | null
	fontWeight?: string | null
}

const normalizeTailwindClassName = (value: string, options: TailwindStyleUpdateOptions) => {
	const tokens = value.split(/\s+/).filter(Boolean)
	const next: string[] = []
	const seen = new Set<string>()

	const push = (token: string) => {
		if (!token) return
		if (seen.has(token)) return
		seen.add(token)
		next.push(token)
	}

	const shouldUpdateBackground = options.background !== undefined
	const shouldUpdateBorderWidth = options.borderWidth !== undefined
	const shouldUpdateBorderColor = options.borderColor !== undefined
	const shouldUpdateRadius = options.radius !== undefined
	const shouldUpdateTextColor = options.textColor !== undefined
	const shouldUpdateFontSize = options.fontSize !== undefined
	const shouldUpdateFontWeight = options.fontWeight !== undefined

	for (const token of tokens) {
		if (shouldUpdateBackground && isBackgroundClass(token)) continue
		if (shouldUpdateBorderWidth && isBorderWidthClass(token)) continue
		if (shouldUpdateBorderColor && isBorderColorClass(token)) continue
		if (shouldUpdateRadius && isRadiusClass(token)) continue
		if (shouldUpdateTextColor && isTextColorClass(token)) continue
		if (shouldUpdateFontSize && isFontSizeClass(token)) continue
		if (shouldUpdateFontWeight && isFontWeightClass(token)) continue
		push(token)
	}

	const additions = [
		options.background,
		options.borderWidth,
		options.borderColor,
		options.radius,
		options.textColor,
		options.fontSize,
		options.fontWeight,
	].filter((token): token is string => typeof token === "string" && token.length > 0)

	for (const token of additions) push(token)

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
	options: TailwindStyleUpdateOptions,
): ClassNameUpdateResult => {
	const shouldUpdate =
		options.background !== undefined ||
		options.borderWidth !== undefined ||
		options.borderColor !== undefined ||
		options.radius !== undefined ||
		options.textColor !== undefined ||
		options.fontSize !== undefined ||
		options.fontWeight !== undefined
	if (!shouldUpdate) return { update: null, applied: false }

	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})

	if (!classAttribute) {
		const nextValue = normalizeTailwindClassName("", options)
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
				? "Styles panel couldn't rewrite className={cn(...)} safely. Falling back to inline styles."
				: "Styles panel couldn't rewrite a dynamic className expression. Falling back to inline styles.",
		}
	}

	const nextValue = normalizeTailwindClassName(currentValue, options)
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

const normalizeHexColor = (raw: string) => {
	const value = raw.trim()
	if (!value.startsWith("#")) return null
	const hex = value.slice(1)
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null
	if (![3, 4, 6, 8].includes(hex.length)) return null
	const expand = (input: string) =>
		input
			.split("")
			.map((char) => `${char}${char}`)
			.join("")
	const normalized = hex.length === 3 || hex.length === 4 ? expand(hex) : hex.toLowerCase()
	return `#${normalized.toLowerCase()}`
}

const normalizeColorToken = (value: string | null | undefined): string | null => {
	if (value === null) return null
	const trimmed = typeof value === "string" ? value.trim() : ""
	if (!trimmed) return null
	const lowered = trimmed.toLowerCase()
	if (lowered === "transparent") return "transparent"
	if (lowered === "current" || lowered === "currentcolor") return "current"
	if (lowered === "black" || lowered === "white") return lowered
	const hex = normalizeHexColor(trimmed)
	if (hex) return hex
	return trimmed
}

const formatTailwindColorClass = (prefix: string, value: string) => {
	if (value === "transparent") return `${prefix}-transparent`
	if (value === "current") return `${prefix}-current`
	if (value === "black" || value === "white") return `${prefix}-${value}`
	if (value.startsWith("#")) return `${prefix}-[${value}]`
	if (value.startsWith("[") && value.endsWith("]")) return `${prefix}-${value}`
	if (isColorSuffix(value)) return `${prefix}-${value}`
	return `${prefix}-[${value}]`
}

const formatBorderWidthClass = (value: number) => {
	if (!Number.isFinite(value)) return null
	const rounded = Math.round(value)
	if (rounded <= 0) return null
	if (rounded === 1) return "border"
	if (rounded === 2 || rounded === 4 || rounded === 8) return `border-${rounded}`
	return `border-[${rounded}px]`
}

const formatRadiusClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		if (trimmed === "DEFAULT") return "rounded"
		return `rounded-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const rounded = Math.max(0, Math.round(value))
	if (rounded <= 0) return null
	return `rounded-[${rounded}px]`
}

const formatFontSizeClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		return `text-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const rounded = Math.max(0, Math.round(value))
	if (rounded <= 0) return null
	return `text-[${rounded}px]`
}

const formatFontWeightClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		return `font-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const rounded = Math.round(value)
	if (rounded <= 0) return null
	const clamp = Math.min(1000, Math.max(1, rounded))
	const token = (() => {
		switch (clamp) {
			case 100:
				return "thin"
			case 200:
				return "extralight"
			case 300:
				return "light"
			case 400:
				return "normal"
			case 500:
				return "medium"
			case 600:
				return "semibold"
			case 700:
				return "bold"
			case 800:
				return "extrabold"
			case 900:
				return "black"
			default:
				return null
		}
	})()
	if (token) return `font-${token}`
	return `font-[${clamp}]`
}

const formatPxStyle = (value: number) => `${formatNumber(value)}px`

const formatColorStyle = (value: string) => {
	if (value === "current") return "currentColor"
	return value
}

export const applySnippetStyleUpdate = async ({
	source,
	line,
	column,
	backgroundColor,
	borderWidth,
	borderColor,
	borderRadius,
	textColor,
	fontSize,
	fontWeight,
}: SnippetStyleUpdateRequest): Promise<SnippetStyleUpdateResult> => {
	if (!source.trim()) {
		return { source, changed: false, reason: "Source is empty." }
	}

	const hasUpdates =
		backgroundColor !== undefined ||
		borderWidth !== undefined ||
		borderColor !== undefined ||
		borderRadius !== undefined ||
		textColor !== undefined ||
		fontSize !== undefined ||
		fontWeight !== undefined
	if (!hasUpdates) {
		return { source, changed: false }
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

	const nextBackground =
		backgroundColor !== undefined ? normalizeColorToken(backgroundColor) : undefined
	const nextBorderColor = borderColor !== undefined ? normalizeColorToken(borderColor) : undefined
	const nextTextColor = textColor !== undefined ? normalizeColorToken(textColor) : undefined

	const nextBorderWidth =
		borderWidth !== undefined && borderWidth !== null && Number.isFinite(borderWidth)
			? borderWidth > 0
				? borderWidth
				: null
			: borderWidth === null
				? null
				: borderWidth === undefined
					? undefined
					: null
	const nextBorderRadius =
		borderRadius === undefined
			? undefined
			: borderRadius === null
				? null
				: typeof borderRadius === "number"
					? Number.isFinite(borderRadius) && borderRadius > 0
						? borderRadius
						: null
					: typeof borderRadius === "string"
						? borderRadius.trim() || null
						: null
	const nextFontSize =
		fontSize === undefined
			? undefined
			: fontSize === null
				? null
				: typeof fontSize === "number"
					? Number.isFinite(fontSize) && fontSize > 0
						? fontSize
						: null
					: typeof fontSize === "string"
						? fontSize.trim() || null
						: null
	const nextFontWeight =
		fontWeight === undefined
			? undefined
			: fontWeight === null
				? null
				: typeof fontWeight === "number"
					? Number.isFinite(fontWeight) && fontWeight > 0
						? fontWeight
						: null
					: typeof fontWeight === "string"
						? fontWeight.trim() || null
						: null

	let notice: string | undefined

	const classUpdateResult = buildClassNameUpdate(openingElement, attributes, {
		background:
			nextBackground === undefined
				? undefined
				: nextBackground
					? formatTailwindColorClass("bg", nextBackground)
					: null,
		borderWidth:
			nextBorderWidth === undefined
				? undefined
				: nextBorderWidth === null
					? null
					: formatBorderWidthClass(nextBorderWidth),
		borderColor:
			nextBorderColor === undefined
				? undefined
				: nextBorderColor
					? formatTailwindColorClass("border", nextBorderColor)
					: null,
		radius:
			nextBorderRadius === undefined
				? undefined
				: nextBorderRadius === null
					? null
					: formatRadiusClass(nextBorderRadius),
		textColor:
			nextTextColor === undefined
				? undefined
				: nextTextColor
					? formatTailwindColorClass("text", nextTextColor)
					: null,
		fontSize:
			nextFontSize === undefined
				? undefined
				: nextFontSize === null
					? null
					: formatFontSizeClass(nextFontSize),
		fontWeight:
			nextFontWeight === undefined
				? undefined
				: nextFontWeight === null
					? null
					: formatFontWeightClass(nextFontWeight),
	})

	if (classUpdateResult.notice) {
		notice = classUpdateResult.notice
	}

	const canWriteTailwindClasses = classUpdateResult.applied
	const updates: SourceUpdate[] = []
	if (canWriteTailwindClasses && classUpdateResult.update) {
		updates.push(classUpdateResult.update)
	}

	const styleUpdates: StyleUpdate[] = []

	const recordStyleUpdate = (
		key: string,
		value: string | null | undefined,
		enabled: boolean,
		removeWhenTailwind = true,
	) => {
		if (!enabled) return
		if (canWriteTailwindClasses && removeWhenTailwind) {
			styleUpdates.push({ key, remove: true })
			return
		}
		if (value === null) {
			styleUpdates.push({ key, remove: true })
			return
		}
		if (value === undefined) return
		styleUpdates.push({ key, value })
	}

	recordStyleUpdate(
		"backgroundColor",
		nextBackground !== undefined && nextBackground !== null
			? formatColorStyle(nextBackground)
			: nextBackground,
		backgroundColor !== undefined,
	)
	recordStyleUpdate(
		"borderColor",
		nextBorderColor !== undefined && nextBorderColor !== null
			? formatColorStyle(nextBorderColor)
			: nextBorderColor,
		borderColor !== undefined,
	)
	recordStyleUpdate(
		"color",
		nextTextColor !== undefined && nextTextColor !== null
			? formatColorStyle(nextTextColor)
			: nextTextColor,
		textColor !== undefined,
	)
	recordStyleUpdate(
		"borderWidth",
		nextBorderWidth !== undefined && nextBorderWidth !== null
			? formatPxStyle(nextBorderWidth)
			: nextBorderWidth,
		borderWidth !== undefined,
	)
	recordStyleUpdate(
		"borderRadius",
		nextBorderRadius !== undefined && nextBorderRadius !== null
			? typeof nextBorderRadius === "number"
				? formatPxStyle(nextBorderRadius)
				: nextBorderRadius.startsWith("[") && nextBorderRadius.endsWith("]")
					? nextBorderRadius.slice(1, -1)
					: undefined
			: nextBorderRadius,
		borderRadius !== undefined,
	)
	recordStyleUpdate(
		"fontSize",
		nextFontSize !== undefined && nextFontSize !== null
			? typeof nextFontSize === "number"
				? formatPxStyle(nextFontSize)
				: nextFontSize.startsWith("[") && nextFontSize.endsWith("]")
					? nextFontSize.slice(1, -1)
					: undefined
			: nextFontSize,
		fontSize !== undefined,
	)
	recordStyleUpdate(
		"fontWeight",
		nextFontWeight !== undefined && nextFontWeight !== null
			? typeof nextFontWeight === "number"
				? String(Math.round(nextFontWeight))
				: nextFontWeight.startsWith("[") && nextFontWeight.endsWith("]")
					? nextFontWeight.slice(1, -1)
					: undefined
			: nextFontWeight,
		fontWeight !== undefined,
	)

	const styleUpdate =
		styleUpdates.length > 0
			? buildStyleUpdate(source, openingElement, attributes, styleUpdates)
			: null
	if (styleUpdate) {
		updates.push(styleUpdate)
	}

	if (updates.length === 0) {
		return { source, changed: false }
	}

	const orderedUpdates = updates.sort((a, b) => b.start - a.start)
	const updatedSource = orderedUpdates.reduce(
		(current, update) => replaceRange(current, update.start, update.end, update.replacement),
		source,
	)
	return { source: updatedSource, changed: updatedSource !== source, notice }
}
