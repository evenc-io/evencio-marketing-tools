import type {
	SnippetPropDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetPropType,
} from "@/types/asset-library"
import { loadBabelParser } from "../../babel-parser"
import { expandSnippetSource } from "../files"
import {
	buildTypeMapFromProgram,
	extractLiteralValue,
	getIdentifierName,
	getNodeType,
	getPropertyKeyName,
	isNodeType,
	resolveParamTypeInfo,
	type TypeInfoMap,
	unwrapExpression,
} from "./ast"
import { buildFunctionMap, collectExportNames, getExportedFunction } from "./exports"
import { DEFAULT_SNIPPET_EXPORT } from "./types"

type DerivedPropEntry = {
	definition: SnippetPropDefinition
	defaultValue?: unknown
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

/**
 * Derive a snippet props schema + defaults for a specific export from source.
 */
export const deriveSnippetPropsFromSource = async (
	source: string,
	entryExport: string = DEFAULT_SNIPPET_EXPORT,
): Promise<{ propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }> => {
	const normalizedSource = expandSnippetSource(source)
	if (!normalizedSource.trim()) return emptyResult()

	const parser = await loadBabelParser()
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

/**
 * Derive snippet props schema + defaults by inspecting every exported component in a parsed program.
 */
export const deriveSnippetPropsFromProgram = (program: {
	body: unknown[]
}): {
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	duplicateKeys: string[]
} => {
	try {
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

/**
 * Derive snippet props schema + defaults by parsing source and inspecting all component exports.
 */
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

	const parser = await loadBabelParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})

	const program = ast.program as { body: unknown[] }
	return deriveSnippetPropsFromProgram(program)
}
