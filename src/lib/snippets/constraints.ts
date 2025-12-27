import type { SnippetViewport } from "@/types/asset-library"

export const SNIPPET_SOURCE_MAX_CHARS = 20_000
export const SNIPPET_TAILWIND_MAX_CANDIDATES = 800
export const SNIPPET_TAILWIND_MAX_CSS_CHARS = 150_000

export const SNIPPET_DIMENSION_LIMITS = {
	min: 100,
	max: 6000,
	maxArea: 36_000_000,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const clampSnippetViewport = (viewport: SnippetViewport): SnippetViewport => {
	const width = clamp(
		Math.round(viewport.width),
		SNIPPET_DIMENSION_LIMITS.min,
		SNIPPET_DIMENSION_LIMITS.max,
	)
	const height = clamp(
		Math.round(viewport.height),
		SNIPPET_DIMENSION_LIMITS.min,
		SNIPPET_DIMENSION_LIMITS.max,
	)
	return { width, height }
}

export const getSnippetViewportError = (viewport: SnippetViewport): string | null => {
	const { min, max, maxArea } = SNIPPET_DIMENSION_LIMITS
	if (viewport.width < min || viewport.height < min) {
		return `Min ${min}px per side`
	}
	if (viewport.width > max || viewport.height > max) {
		return `Max ${max}px per side`
	}
	if (viewport.width * viewport.height > maxArea) {
		return `Max ${Math.round(maxArea / 1_000_000)}MP total area`
	}
	return null
}
