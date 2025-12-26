import type {
	SnippetPropDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetPropType,
} from "@/types/asset-library"

let parserPromise: Promise<typeof import("@babel/parser")> | null = null

const loadParser = async () => {
	if (!parserPromise) {
		parserPromise = import("@babel/parser")
	}
	return parserPromise
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

const getExportedFunction = (program: { body: unknown[] }): unknown => {
	const exportNode = program.body.find((node) => isNodeType(node, "ExportDefaultDeclaration")) as
		| { declaration?: unknown }
		| undefined

	if (!exportNode?.declaration) return null
	return unwrapExportDefaultDeclaration(exportNode.declaration, program)
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

export const deriveSnippetPropsFromSource = async (
	source: string,
): Promise<{ propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }> => {
	if (!source.trim()) return emptyResult()

	const parser = await loadParser()
	const ast = parser.parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	try {
		const program = ast.program as { body: unknown[] }
		const typeMap = buildTypeMapFromProgram(program)
		const exportedFn = getExportedFunction(program)
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
