import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { applySnippetStyleUpdateInEngine } from "@/lib/engine/client"
import type { StyleUpdateRequest } from "@/lib/engine/protocol"
import { getSnippetIntrinsicTagRule, isSnippetIntrinsicTag } from "@/lib/snippets/editing"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"

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
		(payload: Omit<StyleUpdateRequest, "source" | "line" | "column">, label: string) => {
			if (!target) return
			if (!isSnippetIntrinsicTag(target.elementName)) {
				toast.error("Only intrinsic HTML tags are editable in v1.")
				return
			}

			enqueue(async () => {
				if (!mountedRef.current) return
				const fileSource = getSourceForFile(target.fileId)
				if (!fileSource.trim()) {
					toast.error("Selected element source is empty.")
					return
				}

				try {
					const result = await applySnippetStyleUpdateInEngine({
						source: fileSource,
						line: target.line,
						column: target.column,
						...payload,
					})
					if (!mountedRef.current) return
					if (!result.changed) {
						if (result.reason) {
							toast.error(result.reason)
						}
						return
					}

					if (!mountedRef.current) return
					const applied = applySourceForFile(target.fileId, result.source, label)
					if (applied) {
						if (!mountedRef.current) return
						onApplied?.({
							fileId: target.fileId,
							line: target.line,
							column: target.column,
							source: result.source,
							label,
						})
					}
					if (applied && result.notice && !noticesSeenRef.current.has(result.notice)) {
						noticesSeenRef.current.add(result.notice)
						toast(result.notice)
					}
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed to update styles.")
				}
			})
		},
		[applySourceForFile, enqueue, getSourceForFile, onApplied, target],
	)

	return { canEdit, tagLabel, isApplying, applyStyleUpdate }
}
