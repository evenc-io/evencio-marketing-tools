import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { applySnippetStyleUpdateInEngine } from "@/lib/engine/client"
import type { StyleUpdateRequest } from "@/lib/engine/protocol"
import { getSnippetIntrinsicTagRule, isSnippetIntrinsicTag } from "@/lib/snippets/editing"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"

const writeE2EDebug = (update: unknown) => {
	if (typeof window === "undefined") return
	const win = window as unknown as {
		__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__?: { lastUpdate?: unknown }
	}
	if (!win.__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__) return
	win.__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__.lastUpdate = update
}

type UseSnippetInspectStyleOptions = {
	target: SnippetInspectTextRequest | null
	getSourceForFile: (fileId: SnippetEditorFileId) => string
	applySourceForFile: (
		fileId: SnippetEditorFileId,
		nextFileSource: string,
		label: string,
	) => boolean
	onApplied?: (payload: {
		fileId: SnippetEditorFileId
		line: number
		column: number
		source: string
		label: string
	}) => void
}

type UseSnippetInspectStyleResult = {
	canEdit: boolean
	tagLabel: string | null
	isApplying: boolean
	applyStyleUpdate: (
		payload: Omit<StyleUpdateRequest, "source" | "line" | "column">,
		label: string,
		targetOverride?: SnippetInspectTextRequest,
	) => void
}

export const useSnippetInspectStyle = ({
	target,
	getSourceForFile,
	applySourceForFile,
	onApplied,
}: UseSnippetInspectStyleOptions): UseSnippetInspectStyleResult => {
	const queueRef = useRef<Promise<void>>(Promise.resolve())
	const noticesSeenRef = useRef(new Set<string>())
	const pendingCountRef = useRef(0)
	const [isApplying, setIsApplying] = useState(false)
	const mountedRef = useRef(true)

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const canEdit = Boolean(target && isSnippetIntrinsicTag(target.elementName))

	const tagLabel = useMemo(() => {
		if (!target?.elementName) return null
		if (!isSnippetIntrinsicTag(target.elementName)) return `<${target.elementName}>`
		return getSnippetIntrinsicTagRule(target.elementName)?.label ?? `<${target.elementName}>`
	}, [target?.elementName])

	const enqueue = useCallback((task: () => Promise<void>) => {
		pendingCountRef.current += 1
		if (mountedRef.current) {
			setIsApplying(true)
		}
		const next = queueRef.current
			.catch(() => {})
			.then(() => (mountedRef.current ? task() : Promise.resolve()))
			.finally(() => {
				pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
				if (pendingCountRef.current === 0 && mountedRef.current) {
					setIsApplying(false)
				}
			})
		queueRef.current = next
		return next
	}, [])

	const applyStyleUpdate = useCallback(
		(
			payload: Omit<StyleUpdateRequest, "source" | "line" | "column">,
			label: string,
			targetOverride?: SnippetInspectTextRequest,
		) => {
			const currentTarget = targetOverride ?? target
			if (!currentTarget) return
			if (!isSnippetIntrinsicTag(currentTarget.elementName)) {
				toast.error("Only intrinsic HTML tags are editable in v1.")
				return
			}

			enqueue(async () => {
				if (!mountedRef.current) return
				const fileSource = getSourceForFile(currentTarget.fileId)
				if (!fileSource.trim()) {
					toast.error("Selected element source is empty.")
					return
				}

				try {
					writeE2EDebug({
						phase: "request",
						label,
						fileId: currentTarget.fileId,
						line: currentTarget.line,
						column: currentTarget.column,
						payload,
					})
					const result = await applySnippetStyleUpdateInEngine({
						source: fileSource,
						line: currentTarget.line,
						column: currentTarget.column,
						...payload,
					})
					if (!mountedRef.current) return
					writeE2EDebug({
						phase: "response",
						label,
						changed: result.changed,
						reason: result.reason ?? null,
						notice: result.notice ?? null,
					})
					if (!result.changed) {
						if (result.reason) {
							toast.error(result.reason)
						}
						return
					}

					if (!mountedRef.current) return
					const applied = applySourceForFile(currentTarget.fileId, result.source, label)
					writeE2EDebug({
						phase: "applied",
						label,
						applied,
					})
					if (applied) {
						if (!mountedRef.current) return
						onApplied?.({
							fileId: currentTarget.fileId,
							line: currentTarget.line,
							column: currentTarget.column,
							source: result.source,
							label,
						})
					}
					if (applied && result.notice && !noticesSeenRef.current.has(result.notice)) {
						noticesSeenRef.current.add(result.notice)
						toast(result.notice)
					}
				} catch (err) {
					writeE2EDebug({
						phase: "error",
						label,
						error: err instanceof Error ? err.message : String(err),
					})
					toast.error(err instanceof Error ? err.message : "Failed to update styles.")
				}
			})
		},
		[applySourceForFile, enqueue, getSourceForFile, onApplied, target],
	)

	return { canEdit, tagLabel, isApplying, applyStyleUpdate }
}
