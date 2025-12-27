import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { useCallback, useEffect, useRef } from "react"
import { useIsomorphicLayoutEffect } from "@/routes/-snippets/new/editor"

const STORAGE_KEY = "evencio.snippets.new.editor-split"
const DEFAULT_RATIO = 0.6
const MIN_EDITOR_CONTENT = 320
const MIN_PREVIEW_WIDTH = 320
const EXPLORER_WIDTH = 208

type SplitState = {
	editorRatio: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const readSplitRatio = (): number | null => {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<SplitState>
		if (!parsed || typeof parsed !== "object") return null
		const ratio = parsed.editorRatio
		if (typeof ratio !== "number" || !Number.isFinite(ratio)) return null
		if (ratio <= 0 || ratio >= 1) return null
		return ratio
	} catch {
		return null
	}
}

const writeSplitRatio = (ratio: number) => {
	if (typeof window === "undefined") return
	if (!Number.isFinite(ratio)) return
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorRatio: ratio }))
	} catch {
		// Ignore storage failures (private mode, quota exceeded, etc.)
	}
}

const getCollapsedBasis = (explorerCollapsed: boolean) => (explorerCollapsed ? 0 : EXPLORER_WIDTH)

const getBounds = (containerWidth: number, explorerCollapsed: boolean) => {
	const explorerWidth = explorerCollapsed ? 0 : EXPLORER_WIDTH
	const minEditor = MIN_EDITOR_CONTENT + explorerWidth
	const maxEditor = Math.min(
		containerWidth,
		Math.max(minEditor, containerWidth - MIN_PREVIEW_WIDTH),
	)
	return {
		minEditor: Math.max(0, Math.min(minEditor, maxEditor)),
		maxEditor: Math.max(0, maxEditor),
	}
}

interface UseSnippetSplitViewOptions {
	containerRef: RefObject<HTMLDivElement | null>
	editorRef: RefObject<HTMLDivElement | null>
	editorCollapsed: boolean
	explorerCollapsed: boolean
}

export function useSnippetSplitView({
	containerRef,
	editorRef,
	editorCollapsed,
	explorerCollapsed,
}: UseSnippetSplitViewOptions) {
	const ratioRef = useRef(readSplitRatio() ?? DEFAULT_RATIO)
	const isDraggingRef = useRef(false)
	const rafRef = useRef<number | null>(null)
	const lastBasisRef = useRef<number | null>(null)
	const cleanupRef = useRef<(() => void) | null>(null)
	const transitionRef = useRef<string | null>(null)
	const bodyStyleRef = useRef<{ cursor: string; userSelect: string } | null>(null)

	const applyBasis = useCallback(
		(basisPx: number) => {
			const editor = editorRef.current
			if (!editor) return
			const nextBasis = Math.max(0, Math.round(basisPx))
			editor.style.setProperty("--snippet-editor-basis", `${nextBasis}px`)
		},
		[editorRef],
	)

	const scheduleBasis = useCallback(
		(basisPx: number) => {
			lastBasisRef.current = basisPx
			if (rafRef.current !== null) return
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null
				const nextBasis = lastBasisRef.current
				if (nextBasis === null) return
				applyBasis(nextBasis)
			})
		},
		[applyBasis],
	)

	const applyRatio = useCallback(
		(containerWidth: number) => {
			const bounds = getBounds(containerWidth, explorerCollapsed)
			const nextBasis = clamp(containerWidth * ratioRef.current, bounds.minEditor, bounds.maxEditor)
			applyBasis(nextBasis)
		},
		[applyBasis, explorerCollapsed],
	)

	useIsomorphicLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return
		if (editorCollapsed) {
			applyBasis(getCollapsedBasis(explorerCollapsed))
			return
		}
		const width = container.getBoundingClientRect().width
		if (!width) return
		applyRatio(width)
	}, [applyBasis, applyRatio, containerRef, editorCollapsed, explorerCollapsed])

	useEffect(() => {
		const container = containerRef.current
		if (!container || typeof ResizeObserver === "undefined") return
		let frame: number | null = null
		const observer = new ResizeObserver(() => {
			if (frame !== null) return
			frame = window.requestAnimationFrame(() => {
				frame = null
				if (isDraggingRef.current) return
				const width = container.getBoundingClientRect().width
				if (!width) return
				if (editorCollapsed) {
					applyBasis(getCollapsedBasis(explorerCollapsed))
					return
				}
				applyRatio(width)
			})
		})
		observer.observe(container)
		return () => {
			observer.disconnect()
			if (frame !== null) window.cancelAnimationFrame(frame)
		}
	}, [applyBasis, applyRatio, containerRef, editorCollapsed, explorerCollapsed])

	useEffect(() => () => cleanupRef.current?.(), [])

	const onResizeStart = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (editorCollapsed || isDraggingRef.current || event.button !== 0) return
			const container = containerRef.current
			if (!container) return
			const rect = container.getBoundingClientRect()
			if (!rect.width) return

			const bounds = getBounds(rect.width, explorerCollapsed)
			const pointerId = event.pointerId
			isDraggingRef.current = true

			const editor = editorRef.current
			if (editor) {
				transitionRef.current = editor.style.transition
				editor.style.transition = "none"
			}
			bodyStyleRef.current = {
				cursor: document.body.style.cursor,
				userSelect: document.body.style.userSelect,
			}
			document.body.style.cursor = "col-resize"
			document.body.style.userSelect = "none"

			const handlePointerMove = (moveEvent: PointerEvent) => {
				if (moveEvent.pointerId !== pointerId) return
				const nextBasis = clamp(moveEvent.clientX - rect.left, bounds.minEditor, bounds.maxEditor)
				scheduleBasis(nextBasis)
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				if (upEvent.pointerId !== pointerId) return
				const computed = clamp(upEvent.clientX - rect.left, bounds.minEditor, bounds.maxEditor)
				const finalBasis = lastBasisRef.current ?? computed
				if (rafRef.current !== null) {
					window.cancelAnimationFrame(rafRef.current)
					rafRef.current = null
				}
				applyBasis(finalBasis)
				const ratio = rect.width ? finalBasis / rect.width : ratioRef.current
				if (Number.isFinite(ratio) && ratio > 0 && ratio < 1) {
					ratioRef.current = ratio
					writeSplitRatio(ratio)
				}
				cleanup()
			}

			const cleanup = () => {
				window.removeEventListener("pointermove", handlePointerMove)
				window.removeEventListener("pointerup", handlePointerUp)
				window.removeEventListener("pointercancel", handlePointerUp)
				isDraggingRef.current = false
				lastBasisRef.current = null
				if (rafRef.current !== null) {
					window.cancelAnimationFrame(rafRef.current)
					rafRef.current = null
				}
				if (editor) {
					editor.style.transition = transitionRef.current ?? ""
				}
				const bodyStyles = bodyStyleRef.current
				if (bodyStyles) {
					document.body.style.cursor = bodyStyles.cursor
					document.body.style.userSelect = bodyStyles.userSelect
				} else {
					document.body.style.cursor = ""
					document.body.style.userSelect = ""
				}
				bodyStyleRef.current = null
				transitionRef.current = null
				cleanupRef.current = null
			}

			cleanupRef.current = cleanup
			window.addEventListener("pointermove", handlePointerMove)
			window.addEventListener("pointerup", handlePointerUp)
			window.addEventListener("pointercancel", handlePointerUp)
			event.preventDefault()
		},
		[applyBasis, containerRef, editorCollapsed, editorRef, explorerCollapsed, scheduleBasis],
	)

	return { onResizeStart }
}
