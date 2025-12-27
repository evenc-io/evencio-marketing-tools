import type {
	SnippetPropDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetPropType,
} from "@/types/asset-library"
import { expandSnippetSource } from "./source-files"

let parserPromise: Promise<typeof import("@babel/parser")> | null = null

const loadParser = async () => {
	if (!parserPromise) {
		parserPromise = import("@babel/parser")
	}
	return parserPromise
}

export const DEFAULT_SNIPPET_EXPORT = "default"

const VALID_EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const RESERVED_EXPORT_NAMES = new Set(["__proto__", "prototype", "constructor", "default"])

export type SnippetComponentExport = {
	exportName: string
	label: string
	isDefault: boolean
}

const emptyResult = (): {
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
} => {
	const propsSchema: SnippetPropsSchemaDefinition = { version: 1, props: [] }
	return {
		propsSchema,
		defaultProps: {},
	}
}

const toLabel = (key: string) => {
	const spaced = key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
	if (!spaced) return key
	return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const inferType = (value: unknown): SnippetPropType => {
	if (Array.isArray(value)) return "array"
	if (value === null || value === undefined) return "string"
	if (typeof value === "string") return "string"
	if (typeof value === "number") return "number"
	if (typeof value === "boolean") return "boolean"
	if (typeof value === "object") return "object"
	return "string"
}

type TypeInfo = {
	type: SnippetPropType
	enumValues?: string[]
	optional?: boolean
}

type TypeInfoMap = Record<string, TypeInfo>

type DerivedPropEntry = {
	definition: SnippetPropDefinition
	defaultValue?: unknown
}

const isNodeType = (node: unknown, type: string) =>
	Boolean(node && typeof node === "object" && (node as { type?: string }).type === type)

const getNodeType = (node: unknown) =>
	node && typeof node === "object" ? (node as { type?: string }).type : undefined

const getIdentifierName = (node: unknown): string | null => {
	if (isNodeType(node, "Identifier")) {
		return (node as { name: string }).name
	}
	return null
}

const getPropertyKeyName = (node: unknown): string | null => {
	if (!node || typeof node !== "object") return null
	if (isNodeType(node, "Identifier")) return (node as { name: string }).name
	if (isNodeType(node, "StringLiteral")) return (node as { value: string }).value
	if (isNodeType(node, "NumericLiteral")) return String((node as { value: number }).value)
	return null
}

const unwrapExpression = (node: unknown): unknown => {
	if (!node || typeof node !== "object") return node
	if (isNodeType(node, "TSAsExpression") || isNodeType(node, "TSTypeAssertion")) {
		return unwrapExpression((node as { expression: unknown }).expression)
	}
	if (isNodeType(node, "TSNonNullExpression")) {
		return unwrapExpression((node as { expression: unknown }).expression)
	}
	if (isNodeType(node, "ParenthesizedExpression")) {
		return unwrapExpression((node as { expression: unknown }).expression)
	}
	return node
}

const extractLiteralValue = (node: unknown): unknown | undefined => {
	const expr = unwrapExpression(node)
	if (!expr || typeof expr !== "object") return undefined

	if (isNodeType(expr, "StringLiteral")) return (expr as { value: string }).value
	if (isNodeType(expr, "NumericLiteral")) return (expr as { value: number }).value
	if (isNodeType(expr, "BooleanLiteral")) return (expr as { value: boolean }).value
	if (isNodeType(expr, "NullLiteral")) return null
	if (isNodeType(expr, "TemplateLiteral")) {
		const literal = expr as { quasis: Array<{ value: { cooked: string } }>; expressions: unknown[] }
		if (literal.expressions.length === 0) {
			return literal.quasis.map((q) => q.value.cooked).join("")
		}
		return undefined
	}
	if (isNodeType(expr, "UnaryExpression")) {
		const unary = expr as { operator: string; argument: unknown }
		const value = extractLiteralValue(unary.argument)
		if (typeof value === "number" && unary.operator === "-") return -value
	}
	if (isNodeType(expr, "ArrayExpression")) {
		const arrayExpr = expr as { elements: Array<unknown> }
		const values: unknown[] = []
		for (const element of arrayExpr.elements) {
			if (!element) return undefined
			const value = extractLiteralValue(element)
			if (value === undefined) return undefined
			values.push(value)
		}
		return values
	}
	if (isNodeType(expr, "ObjectExpression")) {
		const objExpr = expr as { properties: Array<unknown> }
		const result: Record<string, unknown> = {}
		for (const prop of objExpr.properties) {
			if (!isNodeType(prop, "ObjectProperty")) return undefined
			const property = prop as { key: unknown; value: unknown; computed?: boolean }
			if (property.computed) return undefined
			const key = getPropertyKeyName(property.key)
			if (!key) return undefined
			const value = extractLiteralValue(property.value)
			if (value === undefined) return undefined
			result[key] = value
		}
		return result
	}
	return undefined
}

const parseTypeAnnotation = (node: unknown): TypeInfo | null => {
	if (!node || typeof node !== "object") return null
	const type = getNodeType(node)
	if (!type) return null

	if (type === "TSStringKeyword") return { type: "string" }
	if (type === "TSNumberKeyword") return { type: "number" }
	if (type === "TSBooleanKeyword") return { type: "boolean" }
	if (type === "TSArrayType" || type === "TSTupleType") return { type: "array" }
	if (type === "TSTypeLiteral") return { type: "object" }
	if (type === "TSUnionType") {
		const union = node as { types: unknown[] }
		let optional = false
		const literalValues: string[] = []
		let baseType: SnippetPropType | null = null

		for (const entry of union.types) {
			const entryType = getNodeType(entry)
			if (entryType === "TSUndefinedKeyword") {
				optional = true
				continue
			}
			if (entryType === "TSNullKeyword") {
				continue
			}
			const literal = extractLiteralValue(entry)
			if (
				typeof literal === "string" ||
				typeof literal === "number" ||
				typeof literal === "boolean"
			) {
				literalValues.push(String(literal))
				continue
			}
			const parsed = parseTypeAnnotation(entry)
			if (parsed) {
				baseType = parsed.type
			}
		}

		if (
			literalValues.length > 0 &&
			literalValues.length === union.types.length - (optional ? 1 : 0)
		) {
			return { type: "enum", enumValues: literalValues, optional }
		}

		if (baseType) return { type: baseType, optional }
		return { type: "string", optional }
	}

	return null
}

const buildTypeInfoMapFromLiteral = (node: unknown): TypeInfoMap => {
	const map: TypeInfoMap = {}
	if (!isNodeType(node, "TSTypeLiteral")) return map
	const literal = node as { members: unknown[] }
	for (const member of literal.members) {
		if (!isNodeType(member, "TSPropertySignature")) continue
		const signature = member as {
			key: unknown
			typeAnnotation?: { typeAnnotation?: unknown }
			optional?: boolean
		}
		const key = getPropertyKeyName(signature.key)
		if (!key) continue
		const typeInfo = parseTypeAnnotation(signature.typeAnnotation?.typeAnnotation)
		if (!typeInfo) continue
		map[key] = {
			...typeInfo,
			optional: Boolean(signature.optional) || typeInfo.optional,
		}
	}
	return map
}

const buildTypeMapFromProgram = (program: { body: unknown[] }) => {
	const map = new Map<string, TypeInfoMap>()
	for (const node of program.body) {
		if (isNodeType(node, "TSTypeAliasDeclaration")) {
			const alias = node as { id: { name: string }; typeAnnotation: unknown }
			map.set(alias.id.name, buildTypeInfoMapFromLiteral(alias.typeAnnotation))
		}
		if (isNodeType(node, "TSInterfaceDeclaration")) {
			const iface = node as { id: { name: string }; body: { body: unknown[] } }
			map.set(
				iface.id.name,
				buildTypeInfoMapFromLiteral({ type: "TSTypeLiteral", members: iface.body.body }),
			)
		}
	}
	return map
}

const resolveParamTypeInfo = (param: unknown, typeMap: Map<string, TypeInfoMap>): TypeInfoMap => {
	if (!param || typeof param !== "object") return {}
	const typeAnnotationNode = (param as { typeAnnotation?: { typeAnnotation?: unknown } })
		.typeAnnotation?.typeAnnotation
	if (!typeAnnotationNode) return {}

	if (isNodeType(typeAnnotationNode, "TSTypeLiteral")) {
		return buildTypeInfoMapFromLiteral(typeAnnotationNode)
	}

	if (isNodeType(typeAnnotationNode, "TSTypeReference")) {
		const typeRef = typeAnnotationNode as { typeName?: unknown }
		const name = getIdentifierName(typeRef.typeName)
		if (name && typeMap.has(name)) {
			return typeMap.get(name) ?? {}
		}
	}

	return {}
}

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

const buildFunctionMap = (program: { body: unknown[] }) => {
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

const getDefaultExportDisplayName = (
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

const getExportedFunction = (
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

const getObjectPatternParam = (fnNode: unknown): unknown | null => {
	if (!fnNode || typeof fnNode !== "object") return null
	const params = (fnNode as { params?: unknown[] }).params ?? []
	if (params.length === 0) return null

	const first = params[0]
	if (isNodeType(first, "ObjectPattern")) return first
	if (isNodeType(first, "AssignmentPattern")) {
		const assignment = first as { left: unknown }
		if (isNodeType(assignment.left, "ObjectPattern")) return assignment.left
	}
	return null
}

const getParamIdentifierName = (fnNode: unknown): string | null => {
	if (!fnNode || typeof fnNode !== "object") return null
	const params = (fnNode as { params?: unknown[] }).params ?? []
	if (params.length === 0) return null
	const first = params[0]
	if (isNodeType(first, "Identifier")) return (first as { name: string }).name
	if (isNodeType(first, "AssignmentPattern")) {
		const assignment = first as { left: unknown }
		return getIdentifierName(assignment.left)
	}
	return null
}

const isPropsReference = (node: unknown, propsName: string): boolean => {
	const expr = unwrapExpression(node)
	const directName = getIdentifierName(expr)
	if (directName === propsName) return true

	if (isNodeType(expr, "LogicalExpression")) {
		const logical = expr as { left: unknown; operator: string }
		if (logical.operator === "??" || logical.operator === "||" || logical.operator === "&&") {
			return getIdentifierName(logical.left) === propsName
		}
	}

	return false
}

const collectObjectPatternsFromBody = (node: unknown, propsName: string, patterns: unknown[]) => {
	if (!node || typeof node !== "object") return
	if (Array.isArray(node)) {
		for (const child of node) collectObjectPatternsFromBody(child, propsName, patterns)
		return
	}

	if (isNodeType(node, "VariableDeclarator")) {
		const declarator = node as { id: unknown; init?: unknown }
		if (
			isNodeType(declarator.id, "ObjectPattern") &&
			isPropsReference(declarator.init, propsName)
		) {
			patterns.push(declarator.id)
		}
	}

	if (isNodeType(node, "AssignmentExpression")) {
		const assignment = node as { left: unknown; right: unknown }
		if (
			isNodeType(assignment.left, "ObjectPattern") &&
			isPropsReference(assignment.right, propsName)
		) {
			patterns.push(assignment.left)
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
		collectObjectPatternsFromBody(value, propsName, patterns)
	}
}

const extractDefaultFromPattern = (value: unknown) => {
	if (!value || typeof value !== "object") return { defaultValue: undefined, target: value }
	if (isNodeType(value, "AssignmentPattern")) {
		const assignment = value as { left: unknown; right: unknown }
		return { defaultValue: extractLiteralValue(assignment.right), target: assignment.left }
	}
	return { defaultValue: undefined, target: value }
}

const deriveNestedDefaults = (pattern: unknown): Record<string, unknown> => {
	if (!isNodeType(pattern, "ObjectPattern")) return {}
	const result: Record<string, unknown> = {}
	const properties = (pattern as { properties: unknown[] }).properties
	for (const prop of properties) {
		if (isNodeType(prop, "RestElement")) continue
		if (!isNodeType(prop, "ObjectProperty")) continue
		const property = prop as { key: unknown; value: unknown }
		const key = getPropertyKeyName(property.key)
		if (!key) continue
		const { defaultValue, target } = extractDefaultFromPattern(property.value)
		if (defaultValue !== undefined) {
			result[key] = defaultValue
			continue
		}
		if (isNodeType(target, "ObjectPattern")) {
			const nested = deriveNestedDefaults(target)
			if (Object.keys(nested).length > 0) {
				result[key] = nested
			}
		}
	}
	return result
}

const deriveFromPattern = (pattern: unknown, typeInfoMap: TypeInfoMap) => {
	const entries: Record<string, DerivedPropEntry> = {}
	const properties = (pattern as { properties: unknown[] }).properties

	for (const prop of properties) {
		if (isNodeType(prop, "RestElement")) continue
		if (!isNodeType(prop, "ObjectProperty")) continue

		const property = prop as { key: unknown; value: unknown }
		const key = getPropertyKeyName(property.key)
		if (!key) continue

		const { defaultValue, target } = extractDefaultFromPattern(property.value)
		const typeInfo = typeInfoMap[key]
		const targetType = getNodeType(target)
		const isObjectPattern = targetType === "ObjectPattern"
		const isArrayPattern = targetType === "ArrayPattern"

		let derivedDefault: unknown = defaultValue
		if (isObjectPattern && defaultValue !== undefined) {
			const nested = deriveNestedDefaults(target)
			if (
				typeof defaultValue === "object" &&
				defaultValue !== null &&
				!Array.isArray(defaultValue)
			) {
				derivedDefault = { ...(defaultValue as Record<string, unknown>), ...nested }
			}
		}

		const inferredType =
			defaultValue !== undefined ? inferType(defaultValue) : (typeInfo?.type ?? "string")
		const propType = isObjectPattern ? "object" : isArrayPattern ? "array" : inferredType

		const definition: SnippetPropDefinition = {
			key,
			label: toLabel(key),
			type: propType,
		}

		if (typeInfo?.enumValues && typeInfo.enumValues.length > 0) {
			definition.enumValues = typeInfo.enumValues
		}

		const required = derivedDefault === undefined ? !typeInfo?.optional : false
		definition.required = required

		entries[key] = {
			definition,
			defaultValue: derivedDefault,
		}
	}

	return entries
}

const mergeDerivedEntries = (
	target: Record<string, DerivedPropEntry>,
	source: Record<string, DerivedPropEntry>,
) => {
	for (const [key, entry] of Object.entries(source)) {
		const existing = target[key]
		if (!existing) {
			target[key] = entry
			continue
		}

		if (existing.defaultValue === undefined && entry.defaultValue !== undefined) {
			existing.defaultValue = entry.defaultValue
			existing.definition.required = false
		}

		if (existing.definition.type === "string" && entry.definition.type !== "string") {
			existing.definition.type = entry.definition.type
		}

		if (!existing.definition.enumValues && entry.definition.enumValues) {
			existing.definition.enumValues = entry.definition.enumValues
		}

		if (existing.definition.required && !entry.definition.required) {
			existing.definition.required = false
		}
	}
}

const isValidExportName = (value: string) =>
	VALID_EXPORT_NAME.test(value) && !RESERVED_EXPORT_NAMES.has(value)

export const listSnippetComponentExports = async (
	source: string,
): Promise<SnippetComponentExport[]> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return []

	const parser = await loadParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	const program = ast.program as { body: unknown[] }
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

export type SnippetComponentSourceMap = Record<string, string>

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

export const getSnippetComponentSourceMap = async (
	source: string,
): Promise<SnippetComponentSourceMap> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return {}

	const parser = await loadParser()
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

	const parser = await loadParser()
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

export const deriveSnippetPropsFromSource = async (
	source: string,
	entryExport: string = DEFAULT_SNIPPET_EXPORT,
): Promise<{ propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return emptyResult()

	const parser = await loadParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	try {
		const program = ast.program as { body: unknown[] }
		const typeMap = buildTypeMapFromProgram(program)
		const exportedFn = getExportedFunction(program, entryExport)
		if (!exportedFn) return emptyResult()

		const paramObjectPattern = getObjectPatternParam(exportedFn)
		const paramIdentifier = getParamIdentifierName(exportedFn)
		const patterns: unknown[] = []

		if (paramObjectPattern) {
			patterns.push(paramObjectPattern)
		} else if (paramIdentifier) {
			const body = (exportedFn as { body?: unknown }).body
			collectObjectPatternsFromBody(body, paramIdentifier, patterns)
		}

		if (patterns.length === 0) return emptyResult()

		const typeInfoMap = resolveParamTypeInfo(
			(exportedFn as { params?: unknown[] })?.params?.[0],
			typeMap,
		)

		const derivedEntries: Record<string, DerivedPropEntry> = {}
		for (const pattern of patterns) {
			mergeDerivedEntries(derivedEntries, deriveFromPattern(pattern, typeInfoMap))
		}

		const props: SnippetPropDefinition[] = []
		const defaultProps: SnippetProps = {}

		for (const entry of Object.values(derivedEntries)) {
			props.push(entry.definition)
			if (entry.defaultValue !== undefined) {
				defaultProps[entry.definition.key] = entry.defaultValue
			}
		}

		const propsSchema: SnippetPropsSchemaDefinition = {
			version: 1,
			props,
		}

		return {
			propsSchema,
			defaultProps,
		}
	} catch {
		return emptyResult()
	}
}

const collectExportNames = (program: { body: unknown[] }, functionMap: Map<string, unknown>) => {
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

export const deriveSnippetPropsFromAllExports = async (
	source: string,
): Promise<{
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	duplicateKeys: string[]
}> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) {
		return { ...emptyResult(), duplicateKeys: [] }
	}

	const parser = await loadParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	try {
		const program = ast.program as { body: unknown[] }
		const functionMap = buildFunctionMap(program)
		const exportNames = collectExportNames(program, functionMap)
		if (exportNames.length === 0) {
			return { ...emptyResult(), duplicateKeys: [] }
		}

		const typeMap = buildTypeMapFromProgram(program)
		const derivedEntries: Record<string, DerivedPropEntry> = {}
		const keyCounts = new Map<string, number>()

		for (const exportName of exportNames) {
			const exportedFn = getExportedFunction(program, exportName, functionMap)
			if (!exportedFn) continue

			const paramObjectPattern = getObjectPatternParam(exportedFn)
			const paramIdentifier = getParamIdentifierName(exportedFn)
			const patterns: unknown[] = []

			if (paramObjectPattern) {
				patterns.push(paramObjectPattern)
			} else if (paramIdentifier) {
				const body = (exportedFn as { body?: unknown }).body
				collectObjectPatternsFromBody(body, paramIdentifier, patterns)
			}

			if (patterns.length === 0) continue

			const typeInfoMap = resolveParamTypeInfo(
				(exportedFn as { params?: unknown[] })?.params?.[0],
				typeMap,
			)

			const componentEntries: Record<string, DerivedPropEntry> = {}
			for (const pattern of patterns) {
				mergeDerivedEntries(componentEntries, deriveFromPattern(pattern, typeInfoMap))
			}

			for (const key of Object.keys(componentEntries)) {
				keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
			}
			mergeDerivedEntries(derivedEntries, componentEntries)
		}

		const props: SnippetPropDefinition[] = []
		const defaultProps: SnippetProps = {}
		const seenKeys = new Set<string>()

		for (const entry of Object.values(derivedEntries)) {
			const key = entry.definition.key
			if (seenKeys.has(key)) continue
			seenKeys.add(key)
			props.push(entry.definition)
			if (entry.defaultValue !== undefined) {
				defaultProps[key] = entry.defaultValue
			}
		}

		const duplicateKeys = [...keyCounts.entries()]
			.filter(([, count]) => count > 1)
			.map(([key]) => key)
			.sort((a, b) => a.localeCompare(b))

		return {
			propsSchema: { version: 1, props },
			defaultProps,
			duplicateKeys,
		}
	} catch {
		return { ...emptyResult(), duplicateKeys: [] }
	}
}
