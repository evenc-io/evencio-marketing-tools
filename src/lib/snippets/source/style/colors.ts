import { isSizeLikeArbitraryValue } from "./size-check"

const THEME_COLOR_TOKENS = new Set([
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"destructive-foreground",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
])

const isPaletteColorToken = (suffix: string) => {
	if (!/^[a-z]+(?:-[a-z]+)*-\d{2,3}(?:\/\d{1,3})?$/.test(suffix)) return false
	if (suffix.startsWith("opacity-")) return false
	return true
}

/**
 * Check whether a Tailwind class suffix represents a supported color token/value.
 */
export const isColorSuffix = (suffix: string) => {
	if (!suffix) return false
	if (
		suffix === "transparent" ||
		suffix === "current" ||
		suffix === "black" ||
		suffix === "white"
	) {
		return true
	}
	// Handle arbitrary values in brackets (e.g., [#ff0000], [rgb(0,0,0)])
	if (/^\[[^\]]+\]$/.test(suffix)) {
		const inner = suffix.slice(1, -1)
		// Reject size-like values (e.g., 44px, 1.5rem) - these are font sizes, not colors
		if (isSizeLikeArbitraryValue(inner)) return false
		// Accept other arbitrary values (colors, CSS variables, etc.)
		return true
	}
	const base = suffix.includes("/") ? (suffix.split("/")[0] ?? "") : suffix
	if (THEME_COLOR_TOKENS.has(base)) return true
	return isPaletteColorToken(suffix)
}

/**
 * Normalize a hex color value to `#rrggbb` or `#rrggbbaa` (returns null if invalid).
 */
export const normalizeHexColor = (raw: string) => {
	const value = raw.trim()
	if (!value.startsWith("#")) return null
	const hex = value.slice(1)
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null
	if (![3, 4, 6, 8].includes(hex.length)) return null
	const expand = (input: string) =>
		input
			.split("")
			.map((char) => `${char}${char}`)
			.join("")
	const normalized = hex.length === 3 || hex.length === 4 ? expand(hex) : hex.toLowerCase()
	return `#${normalized.toLowerCase()}`
}

/**
 * Normalize a color value to a stable representation for Tailwind/inline style usage.
 */
export const normalizeColorValue = (raw: string) => {
	const trimmed = raw.trim()
	if (!trimmed) return null
	const lowered = trimmed.toLowerCase()
	if (lowered === "transparent") return "transparent"
	if (lowered === "current" || lowered === "currentcolor") return "current"
	if (lowered === "black" || lowered === "white") return lowered
	const hex = normalizeHexColor(trimmed)
	if (hex) return hex
	return trimmed
}

/**
 * Normalize a color input token, returning null for empty values.
 */
export const normalizeColorToken = (value: string | null | undefined): string | null => {
	if (value === null) return null
	const trimmed = typeof value === "string" ? value.trim() : ""
	if (!trimmed) return null
	return normalizeColorValue(trimmed)
}
