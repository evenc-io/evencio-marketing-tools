import { useEffect, useRef, useState } from "react"
import { readSnippetStyleStateInEngine } from "@/lib/engine/client"
import type { StyleReadResponse } from "@/lib/engine/protocol"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"

type UseSnippetInspectStyleStateOptions = {
	enabled: boolean
	target: SnippetInspectTextRequest | null
	source: string
	debounceMs?: number
	suspend?: {
		fileId: SnippetEditorFileId
		line: number
		column: number
		source: string
		until: number
	} | null
}

type UseSnippetInspectStyleStateResult = {
	state: StyleReadResponse | null
	isReading: boolean
}

export const useSnippetInspectStyleState = ({
	enabled,
	target,
	source,
	debounceMs = 120,
	suspend = null,
}: UseSnippetInspectStyleStateOptions): UseSnippetInspectStyleStateResult => {
	const [state, setState] = useState<StyleReadResponse | null>(null)
	const [isReading, setIsReading] = useState(false)
	const requestIdRef = useRef(0)
	const targetKeyRef = useRef<string | null>(null)

	useEffect(() => {
		if (!enabled || !target) {
			setState(null)
			setIsReading(false)
			targetKeyRef.current = null
			return
		}

		const nextTargetKey = `${target.fileId}:${target.line}:${target.column}`
		if (targetKeyRef.current !== nextTargetKey) {
			targetKeyRef.current = nextTargetKey
			setState(null)
		}

		if (!source.trim()) {
			setState({
				found: false,
				reason: "Selected element source is empty.",
				elementName: target.elementName ?? null,
				classNameKind: "none",
				editable: false,
				properties: {
					backgroundColor: { present: false, value: null },
					borderWidth: { present: false, value: null },
					borderColor: { present: false, value: null },
					borderRadius: { present: false, value: null },
					textColor: { present: false, value: null },
					fontFamily: { present: false, value: null },
					fontSize: { present: false, value: null },
					fontWeight: { present: false, value: null },
					lineHeight: { present: false, value: null },
					letterSpacing: { present: false, value: null },
					textAlign: { present: false, value: null },
					textTransform: { present: false, value: null },
					fontStyle: { present: false, value: null },
					textDecoration: { present: false, value: null },
					padding: { present: false, value: null },
					paddingX: { present: false, value: null },
					paddingY: { present: false, value: null },
					paddingTop: { present: false, value: null },
					paddingRight: { present: false, value: null },
					paddingBottom: { present: false, value: null },
					paddingLeft: { present: false, value: null },
				},
			})
			setIsReading(false)
			return
		}

		const requestId = ++requestIdRef.current

		const now = Date.now()
		const isSuspended =
			suspend &&
			suspend.fileId === target.fileId &&
			suspend.line === target.line &&
			suspend.column === target.column &&
			suspend.source === source &&
			suspend.until > now
		const suspendMs = isSuspended ? Math.max(0, suspend.until - now) : 0
		const timerId = setTimeout(() => {
			setIsReading(true)
			readSnippetStyleStateInEngine({
				source,
				line: target.line,
				column: target.column,
			})
				.then((result) => {
					if (requestIdRef.current !== requestId) return
					setState((prev) => {
						const prevProps = prev?.properties
						const nextProps = result.properties
						const sameProps =
							Boolean(prevProps) &&
							prevProps?.backgroundColor.present === nextProps.backgroundColor.present &&
							prevProps?.backgroundColor.value === nextProps.backgroundColor.value &&
							prevProps?.borderWidth.present === nextProps.borderWidth.present &&
							prevProps?.borderWidth.value === nextProps.borderWidth.value &&
							prevProps?.borderColor.present === nextProps.borderColor.present &&
							prevProps?.borderColor.value === nextProps.borderColor.value &&
							prevProps?.borderRadius.present === nextProps.borderRadius.present &&
							prevProps?.borderRadius.value === nextProps.borderRadius.value &&
							prevProps?.textColor.present === nextProps.textColor.present &&
							prevProps?.textColor.value === nextProps.textColor.value &&
							prevProps?.fontFamily.present === nextProps.fontFamily.present &&
							prevProps?.fontFamily.value === nextProps.fontFamily.value &&
							prevProps?.fontSize.present === nextProps.fontSize.present &&
							prevProps?.fontSize.value === nextProps.fontSize.value &&
							prevProps?.fontWeight.present === nextProps.fontWeight.present &&
							prevProps?.fontWeight.value === nextProps.fontWeight.value &&
							prevProps?.lineHeight.present === nextProps.lineHeight.present &&
							prevProps?.lineHeight.value === nextProps.lineHeight.value &&
							prevProps?.letterSpacing.present === nextProps.letterSpacing.present &&
							prevProps?.letterSpacing.value === nextProps.letterSpacing.value &&
							prevProps?.textAlign.present === nextProps.textAlign.present &&
							prevProps?.textAlign.value === nextProps.textAlign.value &&
							prevProps?.textTransform.present === nextProps.textTransform.present &&
							prevProps?.textTransform.value === nextProps.textTransform.value &&
							prevProps?.fontStyle.present === nextProps.fontStyle.present &&
							prevProps?.fontStyle.value === nextProps.fontStyle.value &&
							prevProps?.textDecoration.present === nextProps.textDecoration.present &&
							prevProps?.textDecoration.value === nextProps.textDecoration.value &&
							prevProps?.padding.present === nextProps.padding.present &&
							prevProps?.padding.value === nextProps.padding.value &&
							prevProps?.paddingX.present === nextProps.paddingX.present &&
							prevProps?.paddingX.value === nextProps.paddingX.value &&
							prevProps?.paddingY.present === nextProps.paddingY.present &&
							prevProps?.paddingY.value === nextProps.paddingY.value &&
							prevProps?.paddingTop.present === nextProps.paddingTop.present &&
							prevProps?.paddingTop.value === nextProps.paddingTop.value &&
							prevProps?.paddingRight.present === nextProps.paddingRight.present &&
							prevProps?.paddingRight.value === nextProps.paddingRight.value &&
							prevProps?.paddingBottom.present === nextProps.paddingBottom.present &&
							prevProps?.paddingBottom.value === nextProps.paddingBottom.value &&
							prevProps?.paddingLeft.present === nextProps.paddingLeft.present &&
							prevProps?.paddingLeft.value === nextProps.paddingLeft.value

						if (
							prev &&
							prev.found === result.found &&
							prev.reason === result.reason &&
							prev.elementName === result.elementName &&
							prev.classNameKind === result.classNameKind &&
							prev.editable === result.editable &&
							sameProps
						) {
							return prev
						}
						return result
					})
				})
				.catch((err) => {
					if (requestIdRef.current !== requestId) return
					setState({
						found: false,
						reason: err instanceof Error ? err.message : "Failed to read styles.",
						elementName: target.elementName ?? null,
						classNameKind: "none",
						editable: false,
						properties: {
							backgroundColor: { present: false, value: null },
							borderWidth: { present: false, value: null },
							borderColor: { present: false, value: null },
							borderRadius: { present: false, value: null },
							textColor: { present: false, value: null },
							fontFamily: { present: false, value: null },
							fontSize: { present: false, value: null },
							fontWeight: { present: false, value: null },
							lineHeight: { present: false, value: null },
							letterSpacing: { present: false, value: null },
							textAlign: { present: false, value: null },
							textTransform: { present: false, value: null },
							fontStyle: { present: false, value: null },
							textDecoration: { present: false, value: null },
							padding: { present: false, value: null },
							paddingX: { present: false, value: null },
							paddingY: { present: false, value: null },
							paddingTop: { present: false, value: null },
							paddingRight: { present: false, value: null },
							paddingBottom: { present: false, value: null },
							paddingLeft: { present: false, value: null },
						},
					})
				})
				.finally(() => {
					if (requestIdRef.current !== requestId) return
					setIsReading(false)
				})
		}, Math.max(0, debounceMs) + suspendMs)

		return () => {
			requestIdRef.current += 1
			clearTimeout(timerId)
		}
	}, [debounceMs, enabled, source, suspend, target])

	return { state, isReading }
}
