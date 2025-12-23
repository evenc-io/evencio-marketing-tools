export interface RenderViewport {
	width: number
	height: number
	deviceScaleFactor: number
}

export interface RenderFontConfig {
	families: string[]
	fallback: string
}

export interface RenderDeterminismConfig {
	viewport: RenderViewport
	fonts: RenderFontConfig
	locale: string
	timeZone: string
	fixedDateISO: string
	disableAnimations: boolean
	randomSeed: string
	networkAccess: "disabled"
}

export const SNIPPET_RENDER_DETERMINISM: RenderDeterminismConfig = {
	viewport: {
		width: 1200,
		height: 630,
		deviceScaleFactor: 1,
	},
	fonts: {
		families: ["Inter", "Lexend Exa", "Unbounded"],
		fallback: "Inter",
	},
	locale: "en-US",
	timeZone: "UTC",
	fixedDateISO: "2024-01-01T00:00:00.000Z",
	disableAnimations: true,
	randomSeed: "evencio-snippet-render",
	networkAccess: "disabled",
}
