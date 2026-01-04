import type { Dispatch, SetStateAction } from "react"
import { useEffect, useRef } from "react"

const DEFAULT_HOLD_DELAY_MS = 200

const isEditableTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true

	const tagName = target.tagName
	if (tagName === "TEXTAREA") return true

	if (tagName === "INPUT") {
		const input = target as HTMLInputElement
		const type = input.type.toLowerCase()
		return !["button", "checkbox", "color", "radio", "range", "reset", "submit"].includes(type)
	}

	return false
}

interface UsePreviewCameraHotkeyOptions {
	enabled: boolean
	setEnabled: Dispatch<SetStateAction<boolean>>
	scopeEnabled: boolean
	holdDelayMs?: number
}

export function usePreviewCameraHotkey({
	enabled,
	setEnabled,
	scopeEnabled,
	holdDelayMs = DEFAULT_HOLD_DELAY_MS,
}: UsePreviewCameraHotkeyOptions) {
	const enabledRef = useRef(enabled)
	const scopeEnabledRef = useRef(scopeEnabled)

	useEffect(() => {
		enabledRef.current = enabled
	}, [enabled])

	useEffect(() => {
		scopeEnabledRef.current = scopeEnabled
	}, [scopeEnabled])

	useEffect(() => {
		let pressed = false
		let restoreValue = false
		let pressedAt = 0

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.code !== "Space") return
			if (event.repeat) return
			if (!scopeEnabledRef.current) return
			if (isEditableTarget(event.target)) return
			if (pressed) return

			event.preventDefault()
			event.stopPropagation()

			pressed = true
			restoreValue = enabledRef.current
			pressedAt = performance.now()
			setEnabled(true)
		}

		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.code !== "Space") return
			if (!pressed) return

			event.preventDefault()
			event.stopPropagation()

			pressed = false
			const elapsed = Math.max(0, performance.now() - pressedAt)
			setEnabled(elapsed >= holdDelayMs ? restoreValue : !restoreValue)
		}

		const handleWindowBlur = () => {
			if (!pressed) return
			pressed = false
			setEnabled(restoreValue)
		}

		window.addEventListener("keydown", handleKeyDown, { capture: true })
		window.addEventListener("keyup", handleKeyUp, { capture: true })
		window.addEventListener("blur", handleWindowBlur, { capture: true })
		return () => {
			window.removeEventListener("keydown", handleKeyDown, { capture: true })
			window.removeEventListener("keyup", handleKeyUp, { capture: true })
			window.removeEventListener("blur", handleWindowBlur, { capture: true })
		}
	}, [holdDelayMs, setEnabled])
}
