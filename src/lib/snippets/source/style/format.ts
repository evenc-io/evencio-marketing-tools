import { isColorSuffix } from "./colors"

/**
 * Format a number for use in Tailwind arbitrary values (rounded and without trailing zeros).
 */
export const formatNumber = (value: number) => {
	if (!Number.isFinite(value)) return "0"
	const rounded = Math.round(value * 100) / 100
	const normalized = Math.abs(rounded) < 0.005 ? 0 : rounded
	return normalized.toFixed(2).replace(/\.?0+$/, "")
}

/**
 * Format a Tailwind color utility class with support for theme tokens and arbitrary values.
 */
export const formatTailwindColorClass = (prefix: string, value: string) => {
	if (value === "transparent") return `${prefix}-transparent`
	if (value === "current") return `${prefix}-current`
	if (value === "black" || value === "white") return `${prefix}-${value}`
	if (value.startsWith("#")) return `${prefix}-[${value}]`
	if (value.startsWith("[") && value.endsWith("]")) return `${prefix}-${value}`
	if (isColorSuffix(value)) return `${prefix}-${value}`
	return `${prefix}-[${value}]`
}

/**
 * Format a Tailwind `border-*` width class from a pixel width.
 */
export const formatBorderWidthClass = (value: number) => {
	if (!Number.isFinite(value)) return null
	const formatted = formatNumber(value)
	const numeric = Number(formatted)
	if (numeric <= 0) return null
	if (numeric === 1) return "border"
	if (numeric === 2 || numeric === 4 || numeric === 8) return `border-${numeric}`
	return `border-[${formatted}px]`
}

/**
 * Format a Tailwind `rounded-*` class from a radius token or pixel value.
 */
export const formatRadiusClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		if (trimmed === "DEFAULT") return "rounded"
		return `rounded-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const formatted = formatNumber(value)
	const numeric = Number(formatted)
	if (numeric <= 0) return null
	return `rounded-[${formatted}px]`
}

/**
 * Format a Tailwind `text-*` font-size class from a token or pixel value.
 */
export const formatFontSizeClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		return `text-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const formatted = formatNumber(value)
	const numeric = Number(formatted)
	if (numeric <= 0) return null
	return `text-[${formatted}px]`
}

/**
 * Format a Tailwind `font-*` weight class from a token or numeric weight.
 */
export const formatFontWeightClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		if (trimmed.startsWith("font-")) return trimmed
		return `font-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const rounded = Math.round(value)
	if (rounded <= 0) return null
	const clamp = Math.min(1000, Math.max(1, rounded))
	const token = (() => {
		switch (clamp) {
			case 100:
				return "thin"
			case 200:
				return "extralight"
			case 300:
				return "light"
			case 400:
				return "normal"
			case 500:
				return "medium"
			case 600:
				return "semibold"
			case 700:
				return "bold"
			case 800:
				return "extrabold"
			case 900:
				return "black"
			default:
				return null
		}
	})()
	if (token) return `font-${token}`
	return `font-[${clamp}]`
}

/**
 * Format a Tailwind `font-*` family class from a token.
 */
export const formatFontFamilyClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("font-")) return trimmed
	return `font-${trimmed}`
}

/**
 * Format a Tailwind `leading-*` class from a token or numeric line-height.
 */
export const formatLineHeightClass = (value: number | string) => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (!trimmed) return null
		if (trimmed.startsWith("leading-")) return trimmed
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) return `leading-${trimmed}`
		return `leading-${trimmed}`
	}
	if (!Number.isFinite(value)) return null
	const formatted = formatNumber(value)
	const numeric = Number(formatted)
	if (numeric <= 0) return null
	if (Number.isInteger(numeric) && numeric >= 3 && numeric <= 10) {
		return `leading-${numeric}`
	}
	return `leading-[${formatted}]`
}

/**
 * Format a Tailwind `tracking-*` class from a token or arbitrary value.
 */
export const formatLetterSpacingClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("tracking-")) return trimmed
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return `tracking-${trimmed}`
	return `tracking-${trimmed}`
}

/**
 * Format a Tailwind `text-*` alignment class from a token.
 */
export const formatTextAlignClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("text-")) return trimmed
	return `text-${trimmed}`
}

/**
 * Format a Tailwind padding class for a given prefix (`p-`, `px-`, etc.).
 */
export const formatPaddingClass = (prefix: string, value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith(`${prefix}-`)) return trimmed
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return `${prefix}-${trimmed}`
	return `${prefix}-${trimmed}`
}

/**
 * Format a Tailwind text-transform class token.
 */
export const formatTextTransformClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

/**
 * Format a Tailwind font-style class token.
 */
export const formatFontStyleClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

/**
 * Format a Tailwind text-decoration class token.
 */
export const formatTextDecorationClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

/**
 * Format a pixel length for inline styles.
 */
export const formatPxStyle = (value: number) => `${formatNumber(value)}px`

/**
 * Normalize a color string for inline style values.
 */
export const formatColorStyle = (value: string) => {
	if (value === "current") return "currentColor"
	return value
}
