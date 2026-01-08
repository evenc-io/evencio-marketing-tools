import { loadBabelParser } from "../../babel-parser"
import { expandSnippetSource } from "../files"
import { getIdentifierName, isNodeType } from "./ast"
import {
	DEFAULT_SNIPPET_EXPORT,
	type SnippetComponentExport,
	type SnippetComponentSourceMap,
} from "./types"

const VALID_EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const RESERVED_EXPORT_NAMES = new Set(["__proto__", "prototype", "constructor", "default"])

const isValidExportName = (value: string) =>
	VALID_EXPORT_NAME.test(value) && !RESERVED_EXPORT_NAMES.has(value)

const unwrapExportDefaultDeclaration = (
	declaration: unknown,
	program: { body: unknown[] },
): unknown => {
	if (!declaration) return null
	if (isNodeType(declaration, "FunctionDeclaration")) return declaration
	if (isNodeType(declaration, "ArrowFunctionExpression")) return declaration
	if (isNodeType(declaration, "FunctionExpression")) return declaration

	if (isNodeType(declaration, "Identifier")) {
		const name = (declaration as { name: string }).name
		for (const node of program.body) {
			if (
				isNodeType(node, "FunctionDeclaration") &&
				(node as { id?: { name?: string } }).id?.name === name
			) {
				return node
			}
			if (isNodeType(node, "VariableDeclaration")) {
				const declarationNode = node as { declarations: Array<{ id: unknown; init?: unknown }> }
				for (const decl of declarationNode.declarations) {
					const idName = getIdentifierName(decl.id)
					if (idName !== name) continue
					if (
						decl.init &&
						(isNodeType(decl.init, "FunctionExpression") ||
							isNodeType(decl.init, "ArrowFunctionExpression"))
					) {
						return decl.init
					}
				}
			}
		}
	}

	if (isNodeType(declaration, "CallExpression")) {
		const call = declaration as { arguments: unknown[] }
		const firstArg = call.arguments[0]
		if (firstArg) {
			return unwrapExportDefaultDeclaration(firstArg, program)
		}
	}

	return null
}

const isFunctionNode = (node: unknown): boolean =>
	isNodeType(node, "FunctionDeclaration") ||
	isNodeType(node, "FunctionExpression") ||
	isNodeType(node, "ArrowFunctionExpression")

const resolveFunctionNode = (node: unknown, program: { body: unknown[] }): unknown | null => {
	const resolved = unwrapExportDefaultDeclaration(node, program)
	if (resolved && isFunctionNode(resolved)) {
		return resolved
	}
	return null
}

/**
 * Build a map of function names to their AST node declarations within a program.
 */
export const buildFunctionMap = (program: { body: unknown[] }) => {
	const map = new Map<string, unknown>()
	for (const node of program.body) {
		if (isNodeType(node, "ExportDefaultDeclaration")) {
			const declaration = (node as { declaration?: unknown }).declaration
			if (declaration && isNodeType(declaration, "FunctionDeclaration")) {
				const name = (declaration as { id?: { name?: string } }).id?.name
				if (name) map.set(name, declaration)
			}
		}

		if (isNodeType(node, "ExportNamedDeclaration")) {
			const exportNode = node as { declaration?: unknown }
			const decl = exportNode.declaration
			if (decl && isNodeType(decl, "FunctionDeclaration")) {
				const name = (decl as { id?: { name?: string } }).id?.name
				if (name) map.set(name, decl)
			}
			if (decl && isNodeType(decl, "VariableDeclaration")) {
				const declarationNode = decl as {
					declarations: Array<{ id: unknown; init?: unknown }>
				}
				for (const variable of declarationNode.declarations) {
					const idName = getIdentifierName(variable.id)
					if (!idName || !variable.init) continue
					const resolved = resolveFunctionNode(variable.init, program)
					if (resolved) {
						map.set(idName, resolved)
					}
				}
			}
		}

		if (isNodeType(node, "FunctionDeclaration")) {
			const name = (node as { id?: { name?: string } }).id?.name
			if (name) map.set(name, node)
		}

		if (isNodeType(node, "VariableDeclaration")) {
			const declarationNode = node as { declarations: Array<{ id: unknown; init?: unknown }> }
			for (const decl of declarationNode.declarations) {
				const idName = getIdentifierName(decl.id)
				if (!idName || !decl.init) continue
				const resolved = resolveFunctionNode(decl.init, program)
				if (resolved) {
					map.set(idName, resolved)
				}
			}
		}
	}
	return map
}

/**
 * Compute a human-friendly label for a default export (resolving identifiers/calls when possible).
 */
export const getDefaultExportDisplayName = (
	declaration: unknown,
	program: { body: unknown[] },
): string | null => {
	if (isNodeType(declaration, "Identifier")) {
		return (declaration as { name: string }).name
	}
	if (
		isNodeType(declaration, "FunctionDeclaration") ||
		isNodeType(declaration, "FunctionExpression")
	) {
		const name = (declaration as { id?: { name?: string } }).id?.name
		if (name) return name
	}
	if (isNodeType(declaration, "CallExpression")) {
		const call = declaration as { arguments: unknown[] }
		const firstArg = call.arguments[0]
		if (firstArg) {
			return getDefaultExportDisplayName(firstArg, program)
		}
	}
	const resolved = resolveFunctionNode(declaration, program)
	if (resolved && isNodeType(resolved, "FunctionDeclaration")) {
		return (resolved as { id?: { name?: string } }).id?.name ?? null
	}
	return null
}

const getNamedExportedFunction = (
	program: { body: unknown[] },
	exportName: string,
	functionMap?: Map<string, unknown>,
): unknown | null => {
	const resolvedFunctionMap = functionMap ?? buildFunctionMap(program)

	for (const node of program.body) {
		if (!isNodeType(node, "ExportNamedDeclaration")) continue
		const exportNode = node as {
			declaration?: unknown
			specifiers?: Array<{ exported?: unknown; local?: unknown }>
		}

		if (exportNode.declaration) {
			const decl = exportNode.declaration
			if (isNodeType(decl, "FunctionDeclaration")) {
				const name = (decl as { id?: { name?: string } }).id?.name
				if (name === exportName) return decl
			}
			if (isNodeType(decl, "VariableDeclaration")) {
				const declarationNode = decl as {
					declarations: Array<{ id: unknown; init?: unknown }>
				}
				for (const variable of declarationNode.declarations) {
					const idName = getIdentifierName(variable.id)
					if (idName !== exportName) continue
					const init = variable.init
					if (
						init &&
						(isNodeType(init, "FunctionExpression") || isNodeType(init, "ArrowFunctionExpression"))
					) {
						return init
					}
					const resolved = resolvedFunctionMap.get(idName)
					if (resolved) return resolved
				}
			}
		}

		if (exportNode.specifiers && exportNode.specifiers.length > 0) {
			for (const specifier of exportNode.specifiers) {
				const exportedName = getIdentifierName(specifier.exported)
				if (exportedName !== exportName) continue
				const localName = getIdentifierName(specifier.local)
				if (!localName) continue
				const resolved = resolvedFunctionMap.get(localName)
				if (resolved) return resolved
			}
		}
	}

	return null
}

/**
 * Resolve a function AST node for an export (default export or named export).
 */
export const getExportedFunction = (
	program: { body: unknown[] },
	entryExport: string = DEFAULT_SNIPPET_EXPORT,
	functionMap?: Map<string, unknown>,
): unknown => {
	if (!entryExport || entryExport === DEFAULT_SNIPPET_EXPORT) {
		const exportNode = program.body.find((node) => isNodeType(node, "ExportDefaultDeclaration")) as
			| { declaration?: unknown }
			| undefined

		if (!exportNode?.declaration) return null
		return unwrapExportDefaultDeclaration(exportNode.declaration, program)
	}

	return getNamedExportedFunction(program, entryExport, functionMap)
}

/**
 * List snippet component exports from a parsed program, including default export when present.
 */
export const listSnippetComponentExportsFromProgram = (program: { body: unknown[] }) => {
	const exportEntries: SnippetComponentExport[] = []
	const seen = new Set<string>()

	const addExport = (exportName: string, label: string, isDefault: boolean) => {
		if (seen.has(exportName)) return
		exportEntries.push({ exportName, label, isDefault })
		seen.add(exportName)
	}

	const defaultExportNode = program.body.find((node) =>
		isNodeType(node, "ExportDefaultDeclaration"),
	) as { declaration?: unknown } | undefined

	if (defaultExportNode?.declaration) {
		const displayName = getDefaultExportDisplayName(defaultExportNode.declaration, program)
		const label = displayName ? `Default (${displayName})` : "Default export"
		addExport(DEFAULT_SNIPPET_EXPORT, label, true)
	}

	const functionMap = buildFunctionMap(program)

	for (const node of program.body) {
		if (!isNodeType(node, "ExportNamedDeclaration")) continue
		const exportNode = node as {
			declaration?: unknown
			specifiers?: Array<{ exported?: unknown; local?: unknown }>
		}

		if (exportNode.declaration) {
			const decl = exportNode.declaration
			if (isNodeType(decl, "FunctionDeclaration")) {
				const name = (decl as { id?: { name?: string } }).id?.name
				if (name && isValidExportName(name)) {
					addExport(name, name, false)
				}
			}
			if (isNodeType(decl, "VariableDeclaration")) {
				const declarationNode = decl as {
					declarations: Array<{ id: unknown; init?: unknown }>
				}
				for (const variable of declarationNode.declarations) {
					const name = getIdentifierName(variable.id)
					if (!name || !isValidExportName(name)) continue
					const init = variable.init
					const isDirectFunction =
						Boolean(init) &&
						(isNodeType(init, "FunctionExpression") || isNodeType(init, "ArrowFunctionExpression"))
					if (isDirectFunction || functionMap.has(name)) {
						addExport(name, name, false)
					}
				}
			}
		}

		if (exportNode.specifiers && exportNode.specifiers.length > 0) {
			for (const specifier of exportNode.specifiers) {
				const exportedName = getIdentifierName(specifier.exported)
				if (!exportedName || !isValidExportName(exportedName)) continue
				const localName = getIdentifierName(specifier.local)
				if (!localName) continue
				if (functionMap.has(localName)) {
					addExport(exportedName, exportedName, false)
				}
			}
		}
	}

	return exportEntries
}

/**
 * Parse snippet source and list available component exports.
 */
export const listSnippetComponentExports = async (
	source: string,
): Promise<SnippetComponentExport[]> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return []

	const parser = await loadBabelParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	const program = ast.program as { body: unknown[] }
	return listSnippetComponentExportsFromProgram(program)
}

/**
 * Collect export names for functions/components that can be analyzed in a snippet program.
 */
export const collectExportNames = (
	program: { body: unknown[] },
	functionMap: Map<string, unknown>,
) => {
	const exportNames: string[] = []
	const seen = new Set<string>()
	const addName = (name: string) => {
		if (seen.has(name)) return
		seen.add(name)
		exportNames.push(name)
	}

	const defaultExportNode = program.body.find((node) =>
		isNodeType(node, "ExportDefaultDeclaration"),
	) as { declaration?: unknown } | undefined

	if (defaultExportNode?.declaration) {
		addName(DEFAULT_SNIPPET_EXPORT)
	}

	for (const node of program.body) {
		if (!isNodeType(node, "ExportNamedDeclaration")) continue
		const exportNode = node as {
			declaration?: unknown
			specifiers?: Array<{ exported?: unknown; local?: unknown }>
		}

		if (exportNode.declaration) {
			const decl = exportNode.declaration
			if (isNodeType(decl, "FunctionDeclaration")) {
				const name = (decl as { id?: { name?: string } }).id?.name
				if (name && isValidExportName(name)) addName(name)
			}
			if (isNodeType(decl, "VariableDeclaration")) {
				const declarationNode = decl as {
					declarations: Array<{ id: unknown; init?: unknown }>
				}
				for (const variable of declarationNode.declarations) {
					const name = getIdentifierName(variable.id)
					if (!name || !isValidExportName(name)) continue
					const init = variable.init
					const isDirectFunction =
						Boolean(init) &&
						(isNodeType(init, "FunctionExpression") || isNodeType(init, "ArrowFunctionExpression"))
					if (isDirectFunction || functionMap.has(name)) {
						addName(name)
					}
				}
			}
		}

		if (exportNode.specifiers && exportNode.specifiers.length > 0) {
			for (const specifier of exportNode.specifiers) {
				const exportedName = getIdentifierName(specifier.exported)
				if (!exportedName || !isValidExportName(exportedName)) continue
				const localName = getIdentifierName(specifier.local)
				if (!localName) continue
				if (functionMap.has(localName)) {
					addName(exportedName)
				}
			}
		}
	}

	return exportNames
}

type RemoveComponentResult = {
	source: string
	removed: boolean
	reason?: string
}

const removeRange = (source: string, start: number, end: number) =>
	source.slice(0, start) + source.slice(end)

const normalizeRemovalRange = (source: string, start: number, end: number) => {
	let nextStart = start
	let nextEnd = end

	const after = source.slice(end)
	const before = source.slice(0, start)
	const afterNonWhitespace = after.search(/\S/)
	if (afterNonWhitespace >= 0 && after[afterNonWhitespace] === ",") {
		nextEnd = end + afterNonWhitespace + 1
		return { start: nextStart, end: nextEnd }
	}

	const beforeTrimmed = before.replace(/\s+$/, "")
	if (beforeTrimmed.endsWith(",")) {
		const commaIndex = beforeTrimmed.lastIndexOf(",")
		if (commaIndex >= 0) {
			nextStart = commaIndex
		}
	}
	return { start: nextStart, end: nextEnd }
}

const hasValidRange = <T extends { start?: number; end?: number }>(
	node: T | null | undefined,
): node is T & { start: number; end: number } =>
	Boolean(node && typeof node.start === "number" && typeof node.end === "number")

/**
 * Build a map of export name -> exported source snippet for named exports in a module.
 */
export const getSnippetComponentSourceMap = async (
	source: string,
): Promise<SnippetComponentSourceMap> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return {}

	const parser = await loadBabelParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})
	const program = ast.program as { body: unknown[] }
	const map: SnippetComponentSourceMap = {}

	for (const node of program.body) {
		if (!isNodeType(node, "ExportNamedDeclaration")) continue
		const exportNode = node as {
			declaration?: unknown
			specifiers?: Array<{ exported?: unknown; local?: unknown }>
			source?: unknown
			start?: number
			end?: number
		}

		if (!exportNode.declaration || !hasValidRange(exportNode)) {
			continue
		}

		const decl = exportNode.declaration
		if (isNodeType(decl, "FunctionDeclaration")) {
			const name = (decl as { id?: { name?: string } }).id?.name
			if (name && isValidExportName(name)) {
				map[name] = normalizedSource.slice(exportNode.start, exportNode.end).trim()
			}
		}

		if (isNodeType(decl, "VariableDeclaration")) {
			const declarationNode = decl as {
				declarations: Array<{ id: unknown }>
			}
			if (declarationNode.declarations.length !== 1) continue
			const name = getIdentifierName(declarationNode.declarations[0]?.id)
			if (name && isValidExportName(name)) {
				map[name] = normalizedSource.slice(exportNode.start, exportNode.end).trim()
			}
		}
	}

	return map
}

/**
 * Remove a named export from source and return the updated module text plus a removal result.
 */
export const removeSnippetComponentExport = async (
	source: string,
	exportName: string,
): Promise<RemoveComponentResult> => {
	if (!source.trim()) {
		return { source, removed: false, reason: "Source is empty." }
	}
	if (!isValidExportName(exportName) || exportName === DEFAULT_SNIPPET_EXPORT) {
		return { source, removed: false, reason: "Default exports cannot be removed." }
	}

	const parser = await loadBabelParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})
	const program = ast.program as { body: unknown[] }

	for (const node of program.body) {
		if (!isNodeType(node, "ExportNamedDeclaration")) continue
		const exportNode = node as {
			declaration?: unknown
			specifiers?: Array<{ exported?: unknown; local?: unknown; start?: number; end?: number }>
			source?: unknown
			start?: number
			end?: number
		}

		if (exportNode.declaration) {
			const decl = exportNode.declaration
			if (isNodeType(decl, "FunctionDeclaration")) {
				const name = (decl as { id?: { name?: string } }).id?.name
				if (name === exportName && hasValidRange(exportNode)) {
					return {
						source: removeRange(source, exportNode.start, exportNode.end),
						removed: true,
					}
				}
			}
			if (isNodeType(decl, "VariableDeclaration")) {
				const declarationNode = decl as {
					declarations: Array<{ id: unknown; start?: number; end?: number }>
				}
				const matchingDecls = declarationNode.declarations.filter(
					(variable) => getIdentifierName(variable.id) === exportName,
				)
				if (matchingDecls.length === 1) {
					if (declarationNode.declarations.length === 1 && hasValidRange(exportNode)) {
						return {
							source: removeRange(source, exportNode.start, exportNode.end),
							removed: true,
						}
					}
					const target = matchingDecls[0]
					if (hasValidRange(target)) {
						const { start, end } = normalizeRemovalRange(source, target.start, target.end)
						return { source: removeRange(source, start, end), removed: true }
					}
				}
			}
		}

		if (exportNode.source) continue
		if (exportNode.specifiers && exportNode.specifiers.length > 0) {
			const match = exportNode.specifiers.find(
				(specifier) => getIdentifierName(specifier.exported) === exportName,
			)
			if (match && hasValidRange(match)) {
				if (exportNode.specifiers.length === 1 && hasValidRange(exportNode)) {
					return {
						source: removeRange(source, exportNode.start, exportNode.end),
						removed: true,
					}
				}
				const { start, end } = normalizeRemovalRange(source, match.start, match.end)
				return { source: removeRange(source, start, end), removed: true }
			}
		}
	}

	return {
		source,
		removed: false,
		reason: `Export "${exportName}" could not be removed automatically.`,
	}
}
