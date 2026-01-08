import { type MutableRefObject, useCallback, useEffect, useRef } from "react"
import type { SnippetInspectTextRequest } from "@/routes/-snippets/editor/snippet-inspect-utils"
import type { StyleUpdatePayload } from "../types"

type ApplySchedulerArgs = {
	open: boolean
	canApply: boolean
	target: SnippetInspectTextRequest | null
	onApply: (payload: StyleUpdatePayload, label: string, target: SnippetInspectTextRequest) => void
	focusedFieldRef: MutableRefObject<string | null>
}

export type SnippetStylesApplyScheduler = {
	scheduleApply: (
		payload: StyleUpdatePayload,
		label: string,
		options?: { immediate?: boolean },
	) => void
	flushPending: () => void
	clearPending: () => void
}

export const useSnippetStylesApplyScheduler = ({
	open,
	canApply,
	target,
	onApply,
	focusedFieldRef,
}: ApplySchedulerArgs): SnippetStylesApplyScheduler => {
	const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastLabelRef = useRef("Update styles")
	const wasOpenRef = useRef(open)
	const pendingPayloadRef = useRef<StyleUpdatePayload>({})
	const pendingTargetRef = useRef<typeof target>(null)
	const targetRef = useRef(target)
	const onApplyRef = useRef(onApply)

	targetRef.current = target
	onApplyRef.current = onApply

	const clearPending = useCallback(() => {
		if (applyTimerRef.current) {
			clearTimeout(applyTimerRef.current)
			applyTimerRef.current = null
		}
		pendingPayloadRef.current = {}
		pendingTargetRef.current = null
	}, [])

	useEffect(() => {
		return () => {
			clearPending()
		}
	}, [clearPending])

	const flushPending = useCallback(() => {
		if (applyTimerRef.current) {
			clearTimeout(applyTimerRef.current)
			applyTimerRef.current = null
		}

		const payload = pendingPayloadRef.current
		const keys = Object.keys(payload)
		if (keys.length === 0) return
		const pendingTarget = pendingTargetRef.current ?? targetRef.current
		if (!pendingTarget) return
		pendingPayloadRef.current = {}
		pendingTargetRef.current = null
		onApplyRef.current(payload, lastLabelRef.current, pendingTarget)
	}, [])

	const scheduleApply = useCallback(
		(payload: StyleUpdatePayload, label: string, options?: { immediate?: boolean }) => {
			if (!canApply) return
			pendingTargetRef.current = targetRef.current
			lastLabelRef.current = label
			pendingPayloadRef.current = { ...pendingPayloadRef.current, ...payload }
			if (options?.immediate) {
				flushPending()
				return
			}
			if (applyTimerRef.current) {
				clearTimeout(applyTimerRef.current)
			}
			applyTimerRef.current = setTimeout(() => {
				applyTimerRef.current = null
				flushPending()
			}, 200)
		},
		[canApply, flushPending],
	)

	useEffect(() => {
		if (wasOpenRef.current && !open) {
			flushPending()
			clearPending()
			focusedFieldRef.current = null
		}
		wasOpenRef.current = open
	}, [clearPending, flushPending, focusedFieldRef, open])

	return { scheduleApply, flushPending, clearPending }
}
