import { parse } from "@babel/parser"
import { DEFAULT_SNIPPET_EXPORT } from "@/lib/snippets/source/derived"
import {
	extractLiteralValue,
	isNodeType,
	unwrapExpression,
} from "@/lib/snippets/source/derived/ast"
import { buildFunctionMap, getExportedFunction } from "@/lib/snippets/source/derived/exports"
import { scanComponentTreeWasm } from "@/lib/wasm/snippet-wasm"

export type SnippetComponentTreeNode = {
	id: string
	name: string
	className: string | null
	source: { line: number; column: number } | null
	children: SnippetComponentTreeNode[]
}

type ComponentTreeEntry = {
	id: number
	parentId: number | null
	startLine: number
	startColumn: number
	kind: "element" | "fragment"
	name: string | null
	className: string | null
}

type SourceLocation = {
	start: { line: number; column: number }
	end: { line: number; column: number }
}

type RootParseResult = {
	roots: Record<string, unknown>[]
	parseFailed: boolean
}

const isFunctionNode = (node: unknown) =>
	isNodeType(node, "FunctionDeclaration") ||
	isNodeType(node, "FunctionExpression") ||
	isNodeType(node, "ArrowFunctionExpression")

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

const getClassNameValue = (node: Record<string, unknown>) => {
	const openingElement = node.openingElement as Record<string, unknown> | undefined
	const attributes = openingElement?.attributes
	if (!Array.isArray(attributes)) return null
	for (const entry of attributes) {
		if (!entry || typeof entry !== "object") continue
		if (!isNodeType(entry, "JSXAttribute")) continue
		const nameNode = (entry as { name?: { name?: string } }).name
		const attrName = nameNode?.name
		if (attrName !== "className" && attrName !== "class") continue
		const value = (entry as { value?: unknown }).value
		if (!value || typeof value !== "object") return null
		if (isNodeType(value, "StringLiteral")) {
			return (value as { value: string }).value
		}
		if (isNodeType(value, "JSXExpressionContainer")) {
			const expression = (value as { expression?: unknown }).expression
			const literal = extractLiteralValue(expression)
			return typeof literal === "string" ? literal : null
		}
	}
	return null
}

const collectJsxNodesFromExpression = (expression: unknown, bucket: Record<string, unknown>[]) => {
	const resolved = unwrapExpression(expression)
	if (!resolved || typeof resolved !== "object") return
	if (isNodeType(resolved, "JSXElement") || isNodeType(resolved, "JSXFragment")) {
		bucket.push(resolved as Record<string, unknown>)
		return
	}
	const type = (resolved as { type?: string }).type
	if (type === "ConditionalExpression") {
		collectJsxNodesFromExpression((resolved as { consequent?: unknown }).consequent, bucket)
		collectJsxNodesFromExpression((resolved as { alternate?: unknown }).alternate, bucket)
		return
	}
	if (type === "LogicalExpression") {
		collectJsxNodesFromExpression((resolved as { left?: unknown }).left, bucket)
		collectJsxNodesFromExpression((resolved as { right?: unknown }).right, bucket)
		return
	}
	if (type === "ArrayExpression") {
		const elements = (resolved as { elements?: unknown[] }).elements
		if (Array.isArray(elements)) {
			for (const element of elements) {
				collectJsxNodesFromExpression(element, bucket)
			}
		}
		return
	}
	if (type === "SequenceExpression") {
		const expressions = (resolved as { expressions?: unknown[] }).expressions
		if (Array.isArray(expressions)) {
			for (const entry of expressions) {
				collectJsxNodesFromExpression(entry, bucket)
			}
		}
	}
}

const collectReturnExpressions = (node: unknown, rootFunction: unknown, bucket: unknown[]) => {
	if (!node || typeof node !== "object") return
	if (node !== rootFunction && isFunctionNode(node)) return
	if (isNodeType(node, "ReturnStatement")) {
		const argument = (node as { argument?: unknown }).argument
		if (argument) {
			bucket.push(argument)
		}
		return
	}
	for (const value of Object.values(node as Record<string, unknown>)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const entry of value) {
				collectReturnExpressions(entry, rootFunction, bucket)
			}
		} else if (typeof value === "object") {
			collectReturnExpressions(value, rootFunction, bucket)
		}
	}
}

const resolveComponentRoots = (componentNode: unknown): Record<string, unknown>[] => {
	if (!componentNode || typeof componentNode !== "object") return []
	if (isNodeType(componentNode, "JSXElement") || isNodeType(componentNode, "JSXFragment")) {
		return [componentNode as Record<string, unknown>]
	}
	if (!isFunctionNode(componentNode)) return []

	const functionNode = componentNode as { body?: unknown }
	const expressions: unknown[] = []
	if (isNodeType(componentNode, "ArrowFunctionExpression") && functionNode.body) {
		const body = functionNode.body as { type?: string }
		if (body.type !== "BlockStatement") {
			expressions.push(body)
		} else {
			collectReturnExpressions(body, componentNode, expressions)
		}
	} else if (functionNode.body) {
		collectReturnExpressions(functionNode.body, componentNode, expressions)
	}

	const roots: Record<string, unknown>[] = []
	for (const expression of expressions) {
		collectJsxNodesFromExpression(expression, roots)
	}
	return roots
}

const getComponentRootsFromSource = (source: string, entryExport?: string): RootParseResult => {
	if (!source || !source.trim()) return { roots: [], parseFailed: false }
	let ast: ReturnType<typeof parse> | null = null
	try {
		ast = parse(source, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
			errorRecovery: true,
			allowReturnOutsideFunction: true,
		})
	} catch {
		return { roots: [], parseFailed: true }
	}

	const program = ast.program as { body: unknown[] }
	const functionMap = buildFunctionMap(program)
	const exportName =
		entryExport && entryExport.trim().length > 0 ? entryExport : DEFAULT_SNIPPET_EXPORT
	const componentNode = getExportedFunction(program, exportName, functionMap)
	return { roots: resolveComponentRoots(componentNode), parseFailed: false }
}

const buildTreeNode = (node: Record<string, unknown>, path: string): SnippetComponentTreeNode => {
	const isFragment = node.type === "JSXFragment"
	const name = isFragment ? "Fragment" : (getJsxElementName(node) ?? "Unknown")
	const className = isFragment ? null : getClassNameValue(node)
	const loc = node.loc as SourceLocation | null | undefined
	const source = loc
		? {
				line: loc.start.line,
				column: loc.start.column,
			}
		: null

	const children: SnippetComponentTreeNode[] = []
	const rawChildren = node.children
	if (Array.isArray(rawChildren)) {
		let childIndex = 0
		for (const child of rawChildren) {
			if (!child || typeof child !== "object") continue
			if (isNodeType(child, "JSXElement") || isNodeType(child, "JSXFragment")) {
				children.push(buildTreeNode(child as Record<string, unknown>, `${path}.${childIndex}`))
				childIndex += 1
				continue
			}
			if (isNodeType(child, "JSXExpressionContainer")) {
				const bucket: Record<string, unknown>[] = []
				collectJsxNodesFromExpression((child as { expression?: unknown }).expression, bucket)
				for (const nested of bucket) {
					children.push(buildTreeNode(nested, `${path}.${childIndex}`))
					childIndex += 1
				}
			}
		}
	}

	return { id: path, name, className, source, children }
}

const buildComponentTreeFromRoots = (roots: Record<string, unknown>[]) =>
	roots.map((root, index) => buildTreeNode(root, String(index)))

const getRootLocationKey = (node: Record<string, unknown>): string | null => {
	const loc = node.loc as SourceLocation | null | undefined
	if (!loc) return null
	const line = loc.start.line
	const column = loc.start.column
	if (!Number.isFinite(line) || !Number.isFinite(column)) return null
	return `${String(line)}:${String(column)}`
}

const filterEntriesForRoots = (
	entries: ComponentTreeEntry[],
	roots: Record<string, unknown>[],
): ComponentTreeEntry[] | null => {
	if (!entries || entries.length === 0) return null
	const rootKeys = new Set<string>()
	for (const root of roots) {
		const key = getRootLocationKey(root)
		if (key) rootKeys.add(key)
	}
	if (rootKeys.size === 0) return null

	const rootIds = new Set<number>()
	const children = new Map<number, number[]>()
	for (const entry of entries) {
		if (rootKeys.has(`${entry.startLine}:${entry.startColumn}`)) {
			rootIds.add(entry.id)
		}
		if (entry.parentId !== null && entry.parentId >= 0) {
			const list = children.get(entry.parentId)
			if (list) {
				list.push(entry.id)
			} else {
				children.set(entry.parentId, [entry.id])
			}
		}
	}

	if (rootIds.size === 0) return null

	const includeIds = new Set<number>()
	const stack = [...rootIds]
	while (stack.length > 0) {
		const id = stack.pop()
		if (id === undefined || includeIds.has(id)) continue
		includeIds.add(id)
		const next = children.get(id)
		if (next) {
			for (const childId of next) {
				if (!includeIds.has(childId)) {
					stack.push(childId)
				}
			}
		}
	}

	return entries.filter((entry) => includeIds.has(entry.id))
}

/**
 * Build a component tree for a snippet source by parsing and extracting JSX roots.
 */
export const buildComponentTreeFromSource = (
	source: string,
	entryExport?: string,
): SnippetComponentTreeNode[] => {
	const { roots } = getComponentRootsFromSource(source, entryExport)
	if (roots.length === 0) return []

	return buildComponentTreeFromRoots(roots)
}

/**
 * Build a component tree from pre-scanned component tree entries.
 */
export const buildComponentTreeFromEntries = (
	entries: ComponentTreeEntry[],
): SnippetComponentTreeNode[] => {
	if (!entries || entries.length === 0) return []
	const nodes = new Map<number, SnippetComponentTreeNode>()
	const roots: SnippetComponentTreeNode[] = []

	for (const entry of entries) {
		if (!Number.isFinite(entry.id)) continue
		const name =
			entry.kind === "fragment" || !entry.name || entry.name.trim().length === 0
				? "Fragment"
				: entry.name
		const source =
			Number.isFinite(entry.startLine) && Number.isFinite(entry.startColumn)
				? { line: entry.startLine, column: entry.startColumn }
				: null
		const node: SnippetComponentTreeNode = {
			id: String(entry.id),
			name,
			className: entry.className && entry.className.trim().length > 0 ? entry.className : null,
			source,
			children: [],
		}
		nodes.set(entry.id, node)

		if (entry.parentId === null || entry.parentId < 0) {
			roots.push(node)
			continue
		}

		const parent = nodes.get(entry.parentId)
		if (parent) {
			parent.children.push(node)
		} else {
			roots.push(node)
		}
	}

	return roots
}

const isBrowserRuntime = () => typeof window !== "undefined" || typeof self !== "undefined"

/**
 * Build a snippet component tree, using WASM scanning in the browser when available.
 */
export const buildSnippetComponentTree = async ({
	source,
	entryExport,
}: {
	source: string
	entryExport?: string
}): Promise<SnippetComponentTreeNode[]> => {
	if (!source || !source.trim()) return []
	const { roots, parseFailed } = getComponentRootsFromSource(source, entryExport)
	if (isBrowserRuntime()) {
		const hasDirectives = /^\s*\/\/\s*@snippet-file/m.test(source)
		const entries = await scanComponentTreeWasm(source, { expanded: !hasDirectives })
		if (entries) {
			if (parseFailed) {
				return buildComponentTreeFromEntries(entries)
			}
			if (roots.length === 0) return []
			const filtered = filterEntriesForRoots(entries, roots)
			if (filtered && filtered.length > 0) {
				return buildComponentTreeFromEntries(filtered)
			}
			return buildComponentTreeFromRoots(roots)
		}
	}
	if (parseFailed || roots.length === 0) return []
	return buildComponentTreeFromRoots(roots)
}
