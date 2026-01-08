import { compile } from "tailwindcss"
import tailwindIndexCss from "tailwindcss/index.css?raw"
import { scanTailwindCandidatesWasm } from "@/lib/wasm/snippet-wasm"
import appStylesRaw from "@/styles.css?raw"
import { loadBabelParser } from "./babel-parser"
import { SNIPPET_TAILWIND_MAX_CANDIDATES, SNIPPET_TAILWIND_MAX_CSS_CHARS } from "./constraints"
import { expandSnippetSource } from "./source/files"

let compilerPromise: Promise<Awaited<ReturnType<typeof compile>>> | null = null

const stripImports = (css: string) =>
	css
		.split("\n")
		.filter((line) => !line.trim().startsWith("@import"))
		.join("\n")

const TAILWIND_INPUT_CSS = `${tailwindIndexCss}\n${stripImports(appStylesRaw)}`

const cssCache = new Map<string, string>()

const getCompiler = async (): Promise<Awaited<ReturnType<typeof compile>>> => {
	if (!compilerPromise) {
		compilerPromise = compile(TAILWIND_INPUT_CSS)
	}
	return compilerPromise
}

const isNodeType = (node: unknown, type: string) =>
	Boolean(node && typeof node === "object" && (node as { type?: string }).type === type)

const getNodeType = (node: unknown) =>
	node && typeof node === "object" ? (node as { type?: string }).type : undefined

const getJsxAttributeName = (node: unknown): string | null => {
	if (!node || typeof node !== "object") return null
	if (isNodeType(node, "JSXIdentifier")) return (node as { name: string }).name
	return null
}

const extractStaticString = (node: unknown): string | null => {
	if (!node || typeof node !== "object") return null

	if (isNodeType(node, "StringLiteral")) return (node as { value: string }).value

	if (isNodeType(node, "TemplateLiteral")) {
		const literal = node as { quasis: Array<{ value: { cooked: string } }>; expressions: unknown[] }
		if (literal.expressions.length > 0) return null
		return literal.quasis.map((q) => q.value.cooked).join("")
	}

	if (isNodeType(node, "BinaryExpression")) {
		const expr = node as { operator: string; left: unknown; right: unknown }
		if (expr.operator !== "+") return null
		const left = extractStaticString(expr.left)
		const right = extractStaticString(expr.right)
		if (left === null || right === null) return null
		return left + right
	}

	if (isNodeType(node, "JSXExpressionContainer")) {
		const expr = node as { expression?: unknown }
		return extractStaticString(expr.expression)
	}

	return null
}

const splitCandidates = (value: string) => value.split(/\s+/).map((entry) => entry.trim())

/**
 * Extract Tailwind class candidates from a parsed AST (static `className` strings only).
 */
export const extractTailwindCandidatesFromAst = (ast: unknown): string[] => {
	const candidates = new Set<string>()

	const addCandidates = (value: string) => {
		for (const entry of splitCandidates(value)) {
			if (entry) candidates.add(entry)
		}
	}

	const visit = (node: unknown) => {
		if (!node) return
		if (Array.isArray(node)) {
			for (const child of node) visit(child)
			return
		}
		if (typeof node !== "object") return

		if (isNodeType(node, "JSXAttribute")) {
			const attribute = node as { name?: unknown; value?: unknown }
			const name = getJsxAttributeName(attribute.name)
			if (name === "className" || name === "class") {
				const value = attribute.value
				if (isNodeType(value, "StringLiteral")) {
					addCandidates((value as { value: string }).value)
				} else if (value && getNodeType(value) === "JSXExpressionContainer") {
					const staticValue = extractStaticString(value)
					if (staticValue) addCandidates(staticValue)
				}
			}
		}

		for (const [key, value] of Object.entries(node)) {
			if (
				key === "loc" ||
				key === "comments" ||
				key === "leadingComments" ||
				key === "trailingComments"
			) {
				continue
			}
			if (key === "parent") continue
			if (key === "type" && typeof value === "string") continue
			visit(value)
		}
	}

	visit(ast)

	return Array.from(candidates)
}

/**
 * Parse snippet source and extract Tailwind class candidates from static `className` usages.
 */
export const extractTailwindCandidatesFromSource = async (source: string): Promise<string[]> => {
	try {
		const normalizedSource = expandSnippetSource(source)
		const parser = await loadBabelParser()
		const ast = parser.parse(normalizedSource, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
		})
		return extractTailwindCandidatesFromAst(ast)
	} catch {
		return []
	}
}

/**
 * Extract Tailwind class candidates using WASM scanning when available (returns null on failure).
 */
export const extractTailwindCandidatesFromSourceWasm = async (
	source: string,
	options?: { expanded?: boolean },
): Promise<string[] | null> => {
	const normalizedSource = options?.expanded ? source : expandSnippetSource(source)
	return scanTailwindCandidatesWasm(normalizedSource, { expanded: true })
}

/**
 * Compile Tailwind CSS for a list of class candidates using the app's Tailwind config/styles.
 */
export const buildSnippetTailwindCssFromCandidates = async (
	candidates: string[],
): Promise<string> => {
	const normalized = candidates.filter(Boolean).sort()

	if (normalized.length > SNIPPET_TAILWIND_MAX_CANDIDATES) {
		throw new Error(
			`Snippet uses too many Tailwind classes (limit ${SNIPPET_TAILWIND_MAX_CANDIDATES}).`,
		)
	}

	const cacheKey = normalized.join(" ")
	if (cssCache.has(cacheKey)) {
		return cssCache.get(cacheKey) ?? ""
	}

	const compiler = await getCompiler()
	const rawCss = compiler.build(normalized)
	const css = rawCss.replace(/\/\*!\s*tailwindcss[\s\S]*?\*\//, "").trim()

	if (css.length > SNIPPET_TAILWIND_MAX_CSS_CHARS) {
		throw new Error(
			`Generated Tailwind CSS is too large (limit ${SNIPPET_TAILWIND_MAX_CSS_CHARS} chars).`,
		)
	}

	if (cssCache.size > 50) {
		cssCache.clear()
	}
	cssCache.set(cacheKey, css)

	return css
}

/**
 * Convenience helper: extract Tailwind candidates from source and compile them to CSS.
 */
export const buildSnippetTailwindCss = async (source: string): Promise<string> => {
	const candidates = await extractTailwindCandidatesFromSource(source)
	return buildSnippetTailwindCssFromCandidates(candidates)
}
