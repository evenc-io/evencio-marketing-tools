import { useEffect, useLayoutEffect, useState } from "react"

export type ScreenGuardConfig = {
	minViewportWidth: number
	minViewportHeight: number
	minScreenWidth: number
	minScreenHeight: number
}

export const SCREEN_GUARD_DEFAULTS: ScreenGuardConfig = {
	minViewportWidth: 1200,
	minViewportHeight: 600,
	minScreenWidth: 1200,
	minScreenHeight: 720,
}

export type ScreenGateStatus = "unknown" | "supported" | "unsupported"

export type ScreenGateInfo = {
	status: ScreenGateStatus
	viewport: { width: number; height: number }
	screen: { width: number; height: number }
}

export const SCREEN_GUARD_EMPTY: ScreenGateInfo = {
	status: "unknown",
	viewport: { width: 0, height: 0 },
	screen: { width: 0, height: 0 },
}

/**
 * Compute the current screen/viewport gate status for the given config.
 */
export const getScreenGateInfo = (
	config: ScreenGuardConfig = SCREEN_GUARD_DEFAULTS,
): ScreenGateInfo => {
	if (typeof window === "undefined") {
		return SCREEN_GUARD_EMPTY
	}

	const viewportWidth = window.innerWidth
	const viewportHeight = window.innerHeight
	const screenWidth = window.screen?.width ?? viewportWidth
	const screenHeight = window.screen?.height ?? viewportHeight
	const isTooSmall =
		viewportWidth < config.minViewportWidth ||
		viewportHeight < config.minViewportHeight ||
		screenWidth < config.minScreenWidth ||
		screenHeight < config.minScreenHeight

	return {
		status: isTooSmall ? "unsupported" : "supported",
		viewport: { width: viewportWidth, height: viewportHeight },
		screen: { width: screenWidth, height: screenHeight },
	}
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * React hook that tracks screen/viewport size and returns whether the app should be gated.
 */
export const useScreenGuard = (
	config: ScreenGuardConfig = SCREEN_GUARD_DEFAULTS,
): ScreenGateInfo => {
	const [gate, setGate] = useState<ScreenGateInfo>(() => getScreenGateInfo(config))

	useIsomorphicLayoutEffect(() => {
		const update = () => {
			setGate(getScreenGateInfo(config))
		}

		update()
		window.addEventListener("resize", update)
		window.addEventListener("orientationchange", update)
		return () => {
			window.removeEventListener("resize", update)
			window.removeEventListener("orientationchange", update)
		}
	}, [config])

	return gate
}
