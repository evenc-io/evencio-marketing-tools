export type SelectOption = { value: string; label: string }

export const BORDER_WIDTH_SCALE: Array<{ value: number; label: string }> = [
	{ value: 1, label: "1px (border)" },
	{ value: 2, label: "2px (border-2)" },
	{ value: 4, label: "4px (border-4)" },
	{ value: 8, label: "8px (border-8)" },
]

export const RADIUS_SCALE: SelectOption[] = [
	{ value: "none", label: "none (rounded-none)" },
	{ value: "sm", label: "sm (rounded-sm)" },
	{ value: "DEFAULT", label: "base (rounded)" },
	{ value: "md", label: "md (rounded-md)" },
	{ value: "lg", label: "lg (rounded-lg)" },
	{ value: "xl", label: "xl (rounded-xl)" },
	{ value: "2xl", label: "2xl (rounded-2xl)" },
	{ value: "3xl", label: "3xl (rounded-3xl)" },
	{ value: "full", label: "full (rounded-full)" },
]

export const FONT_SIZE_SCALE: SelectOption[] = [
	{ value: "xs", label: "xs (text-xs)" },
	{ value: "sm", label: "sm (text-sm)" },
	{ value: "base", label: "base (text-base)" },
	{ value: "lg", label: "lg (text-lg)" },
	{ value: "xl", label: "xl (text-xl)" },
	{ value: "2xl", label: "2xl (text-2xl)" },
	{ value: "3xl", label: "3xl (text-3xl)" },
	{ value: "4xl", label: "4xl (text-4xl)" },
	{ value: "5xl", label: "5xl (text-5xl)" },
	{ value: "6xl", label: "6xl (text-6xl)" },
	{ value: "7xl", label: "7xl (text-7xl)" },
	{ value: "8xl", label: "8xl (text-8xl)" },
	{ value: "9xl", label: "9xl (text-9xl)" },
]

export const FONT_WEIGHT_SCALE: SelectOption[] = [
	{ value: "thin", label: "100 (thin)" },
	{ value: "extralight", label: "200 (extra light)" },
	{ value: "light", label: "300 (light)" },
	{ value: "normal", label: "400 (normal)" },
	{ value: "medium", label: "500 (medium)" },
	{ value: "semibold", label: "600 (semibold)" },
	{ value: "bold", label: "700 (bold)" },
	{ value: "extrabold", label: "800 (extra bold)" },
	{ value: "black", label: "900 (black)" },
]

export const LINE_HEIGHT_SCALE: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "none", label: "none (leading-none)" },
	{ value: "tight", label: "tight (leading-tight)" },
	{ value: "snug", label: "snug (leading-snug)" },
	{ value: "normal", label: "normal (leading-normal)" },
	{ value: "relaxed", label: "relaxed (leading-relaxed)" },
	{ value: "loose", label: "loose (leading-loose)" },
	{ value: "3", label: "3 (leading-3)" },
	{ value: "4", label: "4 (leading-4)" },
	{ value: "5", label: "5 (leading-5)" },
	{ value: "6", label: "6 (leading-6)" },
	{ value: "7", label: "7 (leading-7)" },
	{ value: "8", label: "8 (leading-8)" },
	{ value: "9", label: "9 (leading-9)" },
	{ value: "10", label: "10 (leading-10)" },
]

export const LETTER_SPACING_SCALE: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "tighter", label: "tighter (tracking-tighter)" },
	{ value: "tight", label: "tight (tracking-tight)" },
	{ value: "normal", label: "normal (tracking-normal)" },
	{ value: "wide", label: "wide (tracking-wide)" },
	{ value: "wider", label: "wider (tracking-wider)" },
	{ value: "widest", label: "widest (tracking-widest)" },
]

export const FONT_FAMILY_OPTIONS: SelectOption[] = [
	{ value: "", label: "Default (Inter)" },
	{ value: "lexend", label: "Lexend Exa (font-lexend)" },
	{ value: "unbounded", label: "Unbounded (font-unbounded)" },
	{ value: "mono", label: "Monospace (font-mono)" },
]

export const TEXT_ALIGN_OPTIONS: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "left", label: "Left (text-left)" },
	{ value: "center", label: "Center (text-center)" },
	{ value: "right", label: "Right (text-right)" },
	{ value: "justify", label: "Justify (text-justify)" },
]

export const TEXT_TRANSFORM_OPTIONS: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "uppercase", label: "Uppercase (uppercase)" },
	{ value: "lowercase", label: "Lowercase (lowercase)" },
	{ value: "capitalize", label: "Capitalize (capitalize)" },
	{ value: "normal-case", label: "Normal case (normal-case)" },
]

export const FONT_STYLE_OPTIONS: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "italic", label: "Italic (italic)" },
	{ value: "not-italic", label: "Normal (not-italic)" },
]

export const TEXT_DECORATION_OPTIONS: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "underline", label: "Underline (underline)" },
	{ value: "line-through", label: "Strikethrough (line-through)" },
	{ value: "overline", label: "Overline (overline)" },
	{ value: "no-underline", label: "None (no-underline)" },
]

export const SPACING_SCALE: SelectOption[] = [
	{ value: "", label: "Default" },
	{ value: "0", label: "0" },
	{ value: "px", label: "px" },
	{ value: "0.5", label: "0.5" },
	{ value: "1", label: "1" },
	{ value: "1.5", label: "1.5" },
	{ value: "2", label: "2" },
	{ value: "2.5", label: "2.5" },
	{ value: "3", label: "3" },
	{ value: "3.5", label: "3.5" },
	{ value: "4", label: "4" },
	{ value: "5", label: "5" },
	{ value: "6", label: "6" },
	{ value: "7", label: "7" },
	{ value: "8", label: "8" },
	{ value: "9", label: "9" },
	{ value: "10", label: "10" },
	{ value: "11", label: "11" },
	{ value: "12", label: "12" },
	{ value: "14", label: "14" },
	{ value: "16", label: "16" },
	{ value: "20", label: "20" },
	{ value: "24", label: "24" },
	{ value: "28", label: "28" },
	{ value: "32", label: "32" },
	{ value: "36", label: "36" },
	{ value: "40", label: "40" },
	{ value: "44", label: "44" },
	{ value: "48", label: "48" },
	{ value: "52", label: "52" },
	{ value: "56", label: "56" },
	{ value: "60", label: "60" },
	{ value: "64", label: "64" },
	{ value: "72", label: "72" },
	{ value: "80", label: "80" },
	{ value: "96", label: "96" },
]
