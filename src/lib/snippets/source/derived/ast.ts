import type { SnippetPropType } from "@/types/asset-library"

export type TypeInfo = {
	type: SnippetPropType
	enumValues?: string[]
	optional?: boolean
}

export type TypeInfoMap = Record<string, TypeInfo>

/**
 * Type guard for Babel AST nodes by `type` string.
 */
export const isNodeType = (node: unknown, type: string) =>
	Boolean(node && typeof node === "object" && (node as { type?: string }).type === type)

/**
 * Read the `type` string from a Babel AST node, if present.
 */
export const getNodeType = (node: unknown) =>
	node && typeof node === "object" ? (node as { type?: string }).type : undefined

/**
 * Read an identifier name from a node, or null if not an Identifier.
 */
export const getIdentifierName = (node: unknown): string | null => {
	if (isNodeType(node, "Identifier")) {
		return (node as { name: string }).name
	}
	return null
}

/**
 * Read an object property key name from `Identifier`, `StringLiteral`, or `NumericLiteral`.
 */
export const getPropertyKeyName = (node: unknown): string | null => {
	if (!node || typeof node !== "object") return null
	if (isNodeType(node, "Identifier")) return (node as { name: string }).name
	if (isNodeType(node, "StringLiteral")) return (node as { value: string }).value
	if (isNodeType(node, "NumericLiteral")) return String((node as { value: number }).value)
	return null
}

/**
 * Remove non-semantic wrapper expressions (casts, non-null assertions, parentheses) from a node.
 */
export const unwrapExpression = (node: unknown): unknown => {
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

/**
 * Extract a static literal value from an expression (string/number/boolean/null/array/object).
 */
export const extractLiteralValue = (node: unknown): unknown | undefined => {
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

/**
 * Build a `key -> TypeInfo` map from a TypeScript object type literal.
 */
export const buildTypeInfoMapFromLiteral = (node: unknown): TypeInfoMap => {
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

/**
 * Collect a map of named type aliases/interfaces to their object-literal TypeInfo maps.
 */
export const buildTypeMapFromProgram = (program: { body: unknown[] }) => {
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

/**
 * Resolve parameter type info from a function parameter node using a pre-built type map.
 */
export const resolveParamTypeInfo = (
	param: unknown,
	typeMap: Map<string, TypeInfoMap>,
): TypeInfoMap => {
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
