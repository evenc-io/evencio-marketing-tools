import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { deriveSnippetPropsFromAllExports } from "@/lib/snippets"
import { DEFAULT_DEFAULT_PROPS, DEFAULT_PROPS_SCHEMA } from "@/routes/-snippets/new/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"
import type { SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"

interface DerivedSnippetProps {
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	duplicateKeys: string[]
}

interface UseDerivedSnippetPropsOptions {
	source: string
	form: UseFormReturn<CustomSnippetValues>
}

export function useDerivedSnippetProps({ source, form }: UseDerivedSnippetPropsOptions) {
	const [derivedProps, setDerivedProps] = useState<DerivedSnippetProps>(() => ({
		propsSchema: DEFAULT_PROPS_SCHEMA,
		defaultProps: DEFAULT_DEFAULT_PROPS,
		duplicateKeys: [],
	}))
	const derivedPropsRef = useRef(derivedProps)
	const deriveVersionRef = useRef(0)

	useEffect(() => {
		let isCancelled = false
		const version = ++deriveVersionRef.current
		const timer = setTimeout(async () => {
			try {
				const derived = await deriveSnippetPropsFromAllExports(source)
				if (isCancelled || version !== deriveVersionRef.current) return

				const propsSchemaJson = JSON.stringify(derived.propsSchema, null, 2)
				const defaultPropsJson = JSON.stringify(derived.defaultProps, null, 2)
				const currentDerived = derivedPropsRef.current
				const shouldUpdateDerived =
					JSON.stringify(currentDerived.propsSchema, null, 2) !== propsSchemaJson ||
					JSON.stringify(currentDerived.defaultProps, null, 2) !== defaultPropsJson ||
					currentDerived.duplicateKeys.join("|") !== derived.duplicateKeys.join("|")

				if (shouldUpdateDerived) {
					derivedPropsRef.current = derived
					setDerivedProps(derived)
				}

				if (form.getValues("propsSchema") !== propsSchemaJson) {
					form.setValue("propsSchema", propsSchemaJson, {
						shouldValidate: true,
						shouldDirty: false,
					})
				}
				if (form.getValues("defaultProps") !== defaultPropsJson) {
					form.setValue("defaultProps", defaultPropsJson, {
						shouldValidate: true,
						shouldDirty: false,
					})
				}
			} catch {
				// Ignore derive errors; form keeps last valid state
			}
		}, 400)

		return () => {
			isCancelled = true
			clearTimeout(timer)
		}
	}, [form, source])

	return derivedProps
}
