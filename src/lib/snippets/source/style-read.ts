import { loadBabelParser } from "../babel-parser"

export type SnippetStyleReadRequest = {
	source: string
	line: number
	column: number
}

export type SnippetStyleReadResponse = {
	found: boolean
	reason?: string
	elementName?: string | null
	classNameKind: "none" | "static" | "dynamic"
	editable: boolean
	properties: {
		backgroundColor: { present: boolean; value: string | null }
		borderWidth: { present: boolean; value: number | null }
		borderColor: { present: boolean; value: string | null }
		borderRadius: { present: boolean; value: number | string | null }
		textColor: { present: boolean; value: string | null }
		fontSize: { present: boolean; value: number | string | null }
		fontWeight: { present: boolean; value: number | string | null }
	}
}

type SourceLocation = {
	start: { line: number; column: number }
	end: { line: number; column: number }
}

type JsxTarget = {
	node: Record<string, unknown>
	loc: SourceLocation
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

const normalizeColorValue = (raw: string) => {
	const trimmed = raw.trim()
	if (!trimmed) return null
	const lowered = trimmed.toLowerCase()
	if (lowered === "transparent") return "transparent"
	if (lowered === "current" || lowered === "currentcolor") return "current"
	if (lowered === "black" || lowered === "white") return lowered
	const hex = normalizeHexColor(trimmed)
	if (hex) return hex
	return trimmed
}

const unwrapArbitraryValue = (raw: string) => {
	if (!raw.startsWith("[") || !raw.endsWith("]")) return null
	return raw.slice(1, -1)
}

const readColorSuffix = (suffix: string): string | null => {
	if (!suffix) return null
	const arbitrary = unwrapArbitraryValue(suffix)
	if (arbitrary !== null) {
		return normalizeColorValue(arbitrary)
	}
	return normalizeColorValue(suffix)
}

const readBorderWidthValue = (base: string): number | null => {
	if (base === "border") return 1
	const matchFixed = base.match(/^border-(0|2|4|8)$/)
	if (matchFixed) return Number(matchFixed[1])
	const bracket = base.match(/^border-\[([^\]]+)\]$/)
	if (!bracket) return null
	const inner = bracket[1] ?? ""
	const px = inner.match(/^(\d+(?:\.\d+)?)px$/)
	if (!px) return null
	return Number(px[1])
}

const readRadiusValue = (base: string): number | string | null => {
	if (base === "rounded") return "DEFAULT"
	if (!base.startsWith("rounded-")) return null
	const suffix = base.slice("rounded-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const px = bracket.match(/^(\d+(?:\.\d+)?)px$/)
		if (px) return Number(px[1])
		return `[${bracket}]`
	}
	return suffix || null
}

const readFontSizeValue = (base: string): number | string | null => {
	if (!base.startsWith("text-")) return null
	const suffix = base.slice("text-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const px = bracket.match(/^(\d+(?:\.\d+)?)px$/)
		if (px) return Number(px[1])
		return `[${bracket}]`
	}
	return suffix || null
}

const readFontWeightValue = (base: string): number | string | null => {
	if (!base.startsWith("font-")) return null
	const suffix = base.slice("font-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const numeric = bracket.match(/^(\d+(?:\.\d+)?)$/)
		if (numeric) return Number(numeric[1])
		return `[${bracket}]`
	}
	return suffix || null
}

const readOpeningElementName = (openingElement: Record<string, unknown> | null | undefined) => {
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

const readInlineStyleObject = (
	styleValue: Record<string, unknown> | null | undefined,
): Partial<Record<string, string | number | null>> => {
	if (!styleValue || styleValue.type !== "JSXExpressionContainer") return {}
	const expression = styleValue.expression as Record<string, unknown> | null | undefined
	if (!expression || expression.type !== "ObjectExpression") return {}
	const properties = Array.isArray(expression.properties) ? expression.properties : []
	const out: Record<string, string | number | null> = {}
	for (const entry of properties) {
		if (!entry || typeof entry !== "object") continue
		const prop = entry as Record<string, unknown>
		if (prop.type !== "ObjectProperty") continue
		const key = getObjectPropertyKey(prop)
		if (!key) continue
		const value = prop.value as Record<string, unknown> | null | undefined
		if (!value) continue
		if (value.type === "StringLiteral") {
			out[key] = typeof value.value === "string" ? value.value : null
			continue
		}
		if (value.type === "NumericLiteral") {
			out[key] = typeof value.value === "number" ? value.value : null
		}
	}
	return out
}

const readInlinePx = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	const px = trimmed.match(/^(\d+(?:\.\d+)?)px$/)
	if (px) return Number(px[1])
	return null
}

const readInlineFontWeight = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	return null
}

export const readSnippetStyleState = async ({
	source,
	line,
	column,
}: SnippetStyleReadRequest): Promise<SnippetStyleReadResponse> => {
	if (!source.trim()) {
		return {
			found: false,
			reason: "Source is empty.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
			},
		}
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
		return {
			found: false,
			reason: "Unable to locate JSX element.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
			},
		}
	}

	const openingElement = target.node.openingElement as Record<string, unknown> | undefined
	if (!openingElement || !hasValidRange(openingElement)) {
		return {
			found: false,
			reason: "Selected element is missing a JSX opening tag.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
			},
		}
	}

	const elementName = readOpeningElementName(openingElement)
	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []

	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})
	const rawClassValue = classAttribute
		? readStaticClassNameValue(classAttribute.value as Record<string, unknown> | null | undefined)
		: ""
	const classNameKind: SnippetStyleReadResponse["classNameKind"] = !classAttribute
		? "none"
		: rawClassValue === null
			? "dynamic"
			: "static"

	const editable = classNameKind !== "dynamic"

	const classTokens =
		classNameKind === "static" && typeof rawClassValue === "string"
			? rawClassValue.split(/\s+/).filter(Boolean)
			: []

	const findLastToken = (predicate: (token: string) => boolean) => {
		for (let index = classTokens.length - 1; index >= 0; index -= 1) {
			const token = classTokens[index]
			if (token && predicate(token)) return token
		}
		return null
	}

	const bgToken = findLastToken(isBackgroundClass)
	const borderWidthToken = findLastToken(isBorderWidthClass)
	const borderColorToken = findLastToken(isBorderColorClass)
	const radiusToken = findLastToken(isRadiusClass)
	const textColorToken = findLastToken(isTextColorClass)
	const fontSizeToken = findLastToken(isFontSizeClass)
	const fontWeightToken = findLastToken(isFontWeightClass)

	const bgValueFromClass =
		bgToken && getUtility(bgToken).startsWith("bg-")
			? readColorSuffix(getUtility(bgToken).slice("bg-".length))
			: null
	const borderColorFromClass =
		borderColorToken && getUtility(borderColorToken).startsWith("border-")
			? readColorSuffix(getUtility(borderColorToken).slice("border-".length))
			: null
	const textColorFromClass =
		textColorToken && getUtility(textColorToken).startsWith("text-")
			? readColorSuffix(getUtility(textColorToken).slice("text-".length))
			: null

	const borderWidthFromClass = borderWidthToken
		? readBorderWidthValue(getUtility(borderWidthToken))
		: null
	const radiusFromClass = radiusToken ? readRadiusValue(getUtility(radiusToken)) : null
	const fontSizeFromClass = fontSizeToken ? readFontSizeValue(getUtility(fontSizeToken)) : null
	const fontWeightFromClass = fontWeightToken
		? readFontWeightValue(getUtility(fontWeightToken))
		: null

	const styleAttribute = attributes.find((attr) => getAttributeName(attr) === "style")
	const inlineStyle = readInlineStyleObject(
		styleAttribute?.value as Record<string, unknown> | null | undefined,
	)

	const inlineBackground = normalizeColorValue(String(inlineStyle.backgroundColor ?? ""))
	const inlineBorderColor = normalizeColorValue(String(inlineStyle.borderColor ?? ""))
	const inlineTextColor = normalizeColorValue(String(inlineStyle.color ?? ""))
	const inlineBorderWidth = readInlinePx(inlineStyle.borderWidth ?? null)
	const inlineRadius = readInlinePx(inlineStyle.borderRadius ?? null)
	const inlineFontSize = readInlinePx(inlineStyle.fontSize ?? null)
	const inlineFontWeight = readInlineFontWeight(inlineStyle.fontWeight ?? null)

	const backgroundValue = inlineBackground ?? bgValueFromClass
	const borderColorValue = inlineBorderColor ?? borderColorFromClass
	const textColorValue = inlineTextColor ?? textColorFromClass
	const borderWidthValue = inlineBorderWidth ?? borderWidthFromClass
	const radiusValue = inlineRadius ?? radiusFromClass
	const fontSizeValue = inlineFontSize ?? fontSizeFromClass
	const fontWeightValue = inlineFontWeight ?? fontWeightFromClass

	const backgroundPresent = Boolean(inlineStyle.backgroundColor !== undefined || bgToken)
	const borderColorPresent = Boolean(inlineStyle.borderColor !== undefined || borderColorToken)
	const textColorPresent = Boolean(inlineStyle.color !== undefined || textColorToken)
	const borderWidthPresent = Boolean(inlineStyle.borderWidth !== undefined || borderWidthToken)
	const radiusPresent = Boolean(inlineStyle.borderRadius !== undefined || radiusToken)
	const fontSizePresent = Boolean(inlineStyle.fontSize !== undefined || fontSizeToken)
	const fontWeightPresent = Boolean(inlineStyle.fontWeight !== undefined || fontWeightToken)

	return {
		found: true,
		elementName,
		classNameKind,
		editable,
		reason: editable ? undefined : "This element uses a dynamic className. Edit styles in code.",
		properties: {
			backgroundColor: { present: backgroundPresent, value: backgroundValue ?? null },
			borderWidth: { present: borderWidthPresent, value: borderWidthValue ?? null },
			borderColor: { present: borderColorPresent, value: borderColorValue ?? null },
			borderRadius: { present: radiusPresent, value: radiusValue ?? null },
			textColor: { present: textColorPresent, value: textColorValue ?? null },
			fontSize: { present: fontSizePresent, value: fontSizeValue ?? null },
			fontWeight: { present: fontWeightPresent, value: fontWeightValue ?? null },
		},
	}
}
