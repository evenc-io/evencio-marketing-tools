import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

const STORAGE_KEY = "evencio.snippets.new.styles-panel"
const DEFAULT_WIDTH = 304
const MIN_WIDTH = 280
const MIN_EDITOR_WIDTH = 520

type StylesPanelMode = "basic" | "advanced"

type StylesPanelPreferences = {
	mode: StylesPanelMode
	width: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getMaxWidth = (containerWidth: number) =>
	Math.max(MIN_WIDTH, Math.round(containerWidth - MIN_EDITOR_WIDTH))

const readState = (): StylesPanelPreferences | null => {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<StylesPanelPreferences>
		if (!parsed || typeof parsed !== "object") return null
		const mode: StylesPanelMode = parsed.mode === "advanced" ? "advanced" : "basic"
		const width =
			typeof parsed.width === "number" && Number.isFinite(parsed.width)
				? Math.max(MIN_WIDTH, Math.round(parsed.width))
				: DEFAULT_WIDTH
		return { mode, width }
	} catch {
		return null
	}
}

const writeState = (state: StylesPanelPreferences) => {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
	} catch {
		// Ignore storage failures.
	}
}

type UseStylesPanelPreferencesOptions = {
	panelRef: RefObject<HTMLElement | null>
	open: boolean
}

export function useStylesPanelPreferences({ panelRef, open }: UseStylesPanelPreferencesOptions) {
	const [mode, setMode] = useState<StylesPanelMode>("basic")
	const [width, setWidth] = useState(DEFAULT_WIDTH)
	const hydratedRef = useRef(false)
	const isDraggingRef = useRef(false)
	const rafRef = useRef<number | null>(null)
	const lastWidthRef = useRef<number | null>(null)
	const cleanupRef = useRef<(() => void) | null>(null)
	const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const bodyStyleRef = useRef<{ cursor: string; userSelect: string } | null>(null)

	useEffect(() => {
		const stored = readState()
		if (stored) {
			setMode(stored.mode)
			setWidth(stored.width)
		}
		hydratedRef.current = true
	}, [])

	useEffect(() => {
		if (!hydratedRef.current) return
		if (persistRef.current) {
			clearTimeout(persistRef.current)
		}
		persistRef.current = setTimeout(() => {
			writeState({ mode, width })
			persistRef.current = null
		}, 200)
		return () => {
			if (persistRef.current) {
				clearTimeout(persistRef.current)
				persistRef.current = null
			}
		}
	}, [mode, width])

	useEffect(() => () => cleanupRef.current?.(), [])

	useEffect(() => {
		if (open) return
		cleanupRef.current?.()
	}, [open])

	useEffect(() => {
		const panel = panelRef.current
		const container = panel?.parentElement
		if (!container || typeof ResizeObserver === "undefined") return
		let frame: number | null = null
		const observer = new ResizeObserver(() => {
			if (frame !== null) return
			frame = window.requestAnimationFrame(() => {
				frame = null
				if (!open) return
				const bounds = container.getBoundingClientRect()
				const maxWidth = getMaxWidth(bounds.width)
				setWidth((current) => clamp(current, MIN_WIDTH, maxWidth))
			})
		})
		observer.observe(container)
		return () => {
			observer.disconnect()
			if (frame !== null) window.cancelAnimationFrame(frame)
		}
	}, [open, panelRef])

	const applyWidth = useCallback((nextWidth: number) => {
		setWidth(Math.round(nextWidth))
	}, [])

	const scheduleWidth = useCallback(
		(nextWidth: number) => {
			lastWidthRef.current = nextWidth
			if (rafRef.current !== null) return
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null
				const next = lastWidthRef.current
				if (next === null) return
				applyWidth(next)
			})
		},
		[applyWidth],
	)

	const onResizeStart = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (!open || isDraggingRef.current || event.button !== 0) return
			const panel = panelRef.current
			const container = panel?.parentElement
			if (!panel || !container) return

			const containerRect = container.getBoundingClientRect()
			if (!containerRect.width) return
			const maxWidth = getMaxWidth(containerRect.width)

			const pointerId = event.pointerId
			isDraggingRef.current = true

			bodyStyleRef.current = {
				cursor: document.body.style.cursor,
				userSelect: document.body.style.userSelect,
			}
			document.body.style.cursor = "col-resize"
			document.body.style.userSelect = "none"

			const handlePointerMove = (moveEvent: PointerEvent) => {
				if (moveEvent.pointerId !== pointerId) return
				const nextWidth = clamp(containerRect.right - moveEvent.clientX, MIN_WIDTH, maxWidth)
				scheduleWidth(nextWidth)
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				if (upEvent.pointerId !== pointerId) return
				const nextWidth = clamp(containerRect.right - upEvent.clientX, MIN_WIDTH, maxWidth)
				if (rafRef.current !== null) {
					window.cancelAnimationFrame(rafRef.current)
					rafRef.current = null
				}
				applyWidth(nextWidth)
				cleanup()
			}

			const cleanup = () => {
				if (rafRef.current !== null) {
					window.cancelAnimationFrame(rafRef.current)
					rafRef.current = null
				}
				window.removeEventListener("pointermove", handlePointerMove)
				window.removeEventListener("pointerup", handlePointerUp)
				window.removeEventListener("pointercancel", handlePointerUp)
				isDraggingRef.current = false
				lastWidthRef.current = null
				const bodyStyles = bodyStyleRef.current
				if (bodyStyles) {
					document.body.style.cursor = bodyStyles.cursor
					document.body.style.userSelect = bodyStyles.userSelect
				} else {
					document.body.style.cursor = ""
					document.body.style.userSelect = ""
				}
				bodyStyleRef.current = null
				cleanupRef.current = null
			}

			cleanupRef.current = cleanup
			window.addEventListener("pointermove", handlePointerMove)
			window.addEventListener("pointerup", handlePointerUp)
			window.addEventListener("pointercancel", handlePointerUp)
			event.preventDefault()
		},
		[applyWidth, open, panelRef, scheduleWidth],
	)

	const resetWidth = useCallback(() => setWidth(DEFAULT_WIDTH), [])

	return {
		mode,
		setMode,
		width,
		setWidth,
		resetWidth,
		onResizeStart,
	}
}
