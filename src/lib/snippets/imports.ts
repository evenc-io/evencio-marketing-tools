export interface AvailableFont {
	id: string
	name: string
	usage: string
	classNameLabel: string
	previewClassName?: string
}

export interface TrustedFontProvider {
	id: string
	label: string
	cssUrl: string
	styleSrc: string
	fontSrc: string
	status: "active" | "available"
}

export const AVAILABLE_FONTS: AvailableFont[] = [
	{
		id: "inter",
		name: "Inter",
		usage: "Body and UI text",
		classNameLabel: "Default body font",
	},
	{
		id: "lexend-exa",
		name: "Lexend Exa",
		usage: "Headlines and display",
		classNameLabel: "font-lexend",
		previewClassName: "font-lexend",
	},
	{
		id: "unbounded",
		name: "Unbounded",
		usage: "Wordmark only",
		classNameLabel: "font-unbounded",
		previewClassName: "font-unbounded uppercase tracking-[-0.02em]",
	},
]

export const TRUSTED_FONT_PROVIDERS: TrustedFontProvider[] = [
	{
		id: "google-fonts",
		label: "Google Fonts",
		cssUrl:
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend+Exa:wght@700&family=Unbounded:wght@400&display=swap",
		styleSrc: "https://fonts.googleapis.com",
		fontSrc: "https://fonts.gstatic.com",
		status: "active",
	},
]
