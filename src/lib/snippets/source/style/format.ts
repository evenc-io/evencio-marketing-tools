import { isColorSuffix } from "./colors"

export const formatNumber = (value: number) => {
	if (!Number.isFinite(value)) return "0"
	const rounded = Math.round(value * 100) / 100
	const normalized = Math.abs(rounded) < 0.005 ? 0 : rounded
	return normalized.toFixed(2).replace(/\.?0+$/, "")
}

export const formatTailwindColorClass = (prefix: string, value: string) => {
	if (value === "transparent") return `${prefix}-transparent`
	if (value === "current") return `${prefix}-current`
	if (value === "black" || value === "white") return `${prefix}-${value}`
	if (value.startsWith("#")) return `${prefix}-[${value}]`
	if (value.startsWith("[") && value.endsWith("]")) return `${prefix}-${value}`
	if (isColorSuffix(value)) return `${prefix}-${value}`
	return `${prefix}-[${value}]`
}

export const formatBorderWidthClass = (value: number) => {
	if (!Number.isFinite(value)) return null
	const formatted = formatNumber(value)
	const numeric = Number(formatted)
	if (numeric <= 0) return null
	if (numeric === 1) return "border"
	if (numeric === 2 || numeric === 4 || numeric === 8) return `border-${numeric}`
	return `border-[${formatted}px]`
}

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

export const formatFontFamilyClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("font-")) return trimmed
	return `font-${trimmed}`
}

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

export const formatLetterSpacingClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("tracking-")) return trimmed
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return `tracking-${trimmed}`
	return `tracking-${trimmed}`
}

export const formatTextAlignClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith("text-")) return trimmed
	return `text-${trimmed}`
}

export const formatPaddingClass = (prefix: string, value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith(`${prefix}-`)) return trimmed
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return `${prefix}-${trimmed}`
	return `${prefix}-${trimmed}`
}

export const formatTextTransformClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

export const formatFontStyleClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

export const formatTextDecorationClass = (value: string) => {
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
}

export const formatPxStyle = (value: number) => `${formatNumber(value)}px`

export const formatColorStyle = (value: string) => {
	if (value === "current") return "currentColor"
	return value
}
