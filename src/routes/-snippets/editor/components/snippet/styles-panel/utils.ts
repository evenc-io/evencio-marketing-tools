import type { ColorDraft } from "@/routes/-snippets/editor/components/snippet/styles-panel/types"

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

export const toColorDraft = (value: string | null): ColorDraft => {
	if (!value) return { mode: "token", token: "", hex: "#000000" }
	if (value.startsWith("#")) {
		const normalized = normalizeHexColor(value)
		return { mode: "custom", token: "", hex: normalized ?? value }
	}
	return { mode: "token", token: value, hex: "#000000" }
}

export const parseOptionalNumber = (raw: string): number | null | "invalid" => {
	const trimmed = raw.trim()
	if (!trimmed) return null
	const parsed = Number(trimmed)
	if (!Number.isFinite(parsed)) return "invalid"
	return parsed
}

export const ensureOption = <T extends { value: string; label: string }>(
	options: T[],
	value: string,
	labelPrefix: string,
) => {
	if (!value) return options
	if (options.some((option) => option.value === value)) return options
	return [{ value, label: `${labelPrefix}: ${value}` } as T, ...options]
}
