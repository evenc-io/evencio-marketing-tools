import { normalizeColorValue } from "./colors"

const unwrapArbitraryValue = (raw: string) => {
	if (!raw.startsWith("[") || !raw.endsWith("]")) return null
	return raw.slice(1, -1)
}

export const readColorSuffix = (suffix: string): string | null => {
	if (!suffix) return null
	const arbitrary = unwrapArbitraryValue(suffix)
	if (arbitrary !== null) {
		return normalizeColorValue(arbitrary)
	}
	return normalizeColorValue(suffix)
}

export const readBorderWidthValue = (base: string): number | null => {
	if (base === "border") return 1
	const matchFixed = base.match(/^border-(0|2|4|8)$/)
	if (matchFixed) return Number(matchFixed[1])
	const bracket = base.match(/^border-\[([^\]]+)\]$/)
	if (!bracket) return null
	const inner = bracket[1] ?? ""
	const px = inner.match(/^(\d+(?:\.\d+)?)px$/)
	if (!px) return null
	return Number(px[1])
}

export const readRadiusValue = (base: string): number | string | null => {
	if (base === "rounded") return "DEFAULT"
	if (!base.startsWith("rounded-")) return null
	const suffix = base.slice("rounded-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const px = bracket.match(/^(\d+(?:\.\d+)?)px$/)
		if (px) return Number(px[1])
		return `[${bracket}]`
	}
	return suffix || null
}

export const readFontSizeValue = (base: string): number | string | null => {
	if (!base.startsWith("text-")) return null
	const suffix = base.slice("text-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const px = bracket.match(/^(\d+(?:\.\d+)?)px$/)
		if (px) return Number(px[1])
		return `[${bracket}]`
	}
	return suffix || null
}

export const readFontWeightValue = (base: string): number | string | null => {
	if (!base.startsWith("font-")) return null
	const suffix = base.slice("font-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const numeric = bracket.match(/^(\d+(?:\.\d+)?)$/)
		if (numeric) return Number(numeric[1])
		return `[${bracket}]`
	}
	return suffix || null
}

export const readFontFamilyValue = (base: string): string | null => {
	if (!base.startsWith("font-")) return null
	const suffix = base.slice("font-".length)
	return suffix || null
}

export const readLineHeightValue = (base: string): number | string | null => {
	if (!base.startsWith("leading-")) return null
	const suffix = base.slice("leading-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) {
		const numeric = bracket.match(/^(-?\d+(?:\.\d+)?)$/)
		if (numeric) return Number(numeric[1])
		return `[${bracket}]`
	}
	return suffix || null
}

export const readLetterSpacingValue = (base: string): string | null => {
	if (!base.startsWith("tracking-")) return null
	const suffix = base.slice("tracking-".length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) return `[${bracket}]`
	return suffix || null
}

export const readTextAlignValue = (base: string): string | null => {
	if (!base.startsWith("text-")) return null
	const suffix = base.slice("text-".length)
	return suffix || null
}

export const readPaddingValue = (base: string, prefix: string): string | null => {
	if (!base.startsWith(prefix)) return null
	const suffix = base.slice(prefix.length)
	const bracket = unwrapArbitraryValue(suffix)
	if (bracket !== null) return `[${bracket}]`
	return suffix || null
}
