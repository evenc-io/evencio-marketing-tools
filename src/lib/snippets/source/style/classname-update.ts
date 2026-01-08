import { getAttributeName, hasValidRange, readStaticClassNameValue } from "./ast"
import { normalizeTailwindClassName, type TailwindStyleUpdateOptions } from "./normalize-classname"
import type { SourceUpdate } from "./source-update"

type ClassNameUpdateResult = {
	update: SourceUpdate | null
	applied: boolean
	notice?: string
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

export const buildClassNameUpdate = (
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
		options.fontFamily !== undefined ||
		options.fontSize !== undefined ||
		options.fontWeight !== undefined ||
		options.lineHeight !== undefined ||
		options.letterSpacing !== undefined ||
		options.textAlign !== undefined ||
		options.textTransform !== undefined ||
		options.fontStyle !== undefined ||
		options.textDecoration !== undefined ||
		options.padding !== undefined ||
		options.paddingX !== undefined ||
		options.paddingY !== undefined ||
		options.paddingTop !== undefined ||
		options.paddingRight !== undefined ||
		options.paddingBottom !== undefined ||
		options.paddingLeft !== undefined
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
