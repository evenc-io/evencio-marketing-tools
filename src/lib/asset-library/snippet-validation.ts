import { z } from "zod"
import type {
	SnippetPropDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
} from "@/types/asset-library"

const buildPropSchema = (definition: SnippetPropDefinition) => {
	switch (definition.type) {
		case "string":
			return z.string()
		case "number":
			return z.number()
		case "boolean":
			return z.boolean()
		case "color":
			return z.string()
		case "image":
			return z.string()
		case "enum":
			return definition.enumValues && definition.enumValues.length > 0
				? z.enum(definition.enumValues as [string, ...string[]])
				: z.string()
		case "object":
			return z.record(z.string(), z.unknown())
		case "array":
			return z.array(z.unknown())
		default:
			return z.unknown()
	}
}

export function buildSnippetPropsSchema(definition: SnippetPropsSchemaDefinition) {
	const shape: Record<string, z.ZodTypeAny> = {}
	for (const prop of definition.props) {
		const baseSchema = buildPropSchema(prop)
		shape[prop.key] = prop.required ? baseSchema : baseSchema.optional()
	}
	return z.object(shape).strict()
}

export function resolveSnippetProps(
	definition: SnippetPropsSchemaDefinition,
	baseProps: SnippetProps = {},
	incomingProps: SnippetProps = {},
): SnippetProps {
	const resolved: SnippetProps = {
		...baseProps,
		...incomingProps,
	}

	for (const prop of definition.props) {
		if (resolved[prop.key] === undefined && prop.default !== undefined) {
			resolved[prop.key] = prop.default
		}
	}

	return resolved
}

export function validateSnippetProps(
	definition: SnippetPropsSchemaDefinition,
	props: SnippetProps,
) {
	const schema = buildSnippetPropsSchema(definition)
	return schema.safeParse(props)
}
