/**
 * Thumbnail Font Embedding
 *
 * Fetches Google Fonts and converts them to base64 data URLs for embedding
 * in SVG captures. This ensures fonts render correctly in thumbnails without
 * requiring external network access during capture.
 *
 * Security: Fonts are fetched once from trusted Google Fonts endpoints and
 * cached in memory. The embedded fonts are then included inline in the SVG.
 */

/** Google Fonts CSS URL for the fonts used in snippets */
const GOOGLE_FONTS_CSS_URL =
	"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend+Exa:wght@700&family=Unbounded:wght@400&display=swap"

/** Cache for embedded font styles */
let embeddedFontsCache: string | null = null
let embedFontsPromise: Promise<string> | null = null

/**
 * Get embedded font styles with base64 data URLs.
 *
 * Fetches Google Fonts CSS, extracts font file URLs, fetches the font files,
 * converts them to base64, and returns @font-face rules with data: URLs.
 * Results are cached for subsequent calls.
 *
 * @returns @font-face CSS rules with embedded base64 fonts, or fallback system fonts on failure
 */
export async function getEmbeddedFontStyles(): Promise<string> {
	// Return cached result if available
	if (embeddedFontsCache !== null) {
		return embeddedFontsCache
	}

	// Deduplicate concurrent requests
	if (embedFontsPromise !== null) {
		return embedFontsPromise
	}

	embedFontsPromise = fetchAndEmbedFonts()

	try {
		embeddedFontsCache = await embedFontsPromise
		return embeddedFontsCache
	} finally {
		embedFontsPromise = null
	}
}

/**
 * Fetch Google Fonts CSS and convert font URLs to embedded base64.
 */
async function fetchAndEmbedFonts(): Promise<string> {
	try {
		// Fetch the CSS with a user-agent that returns woff2 format
		const cssResponse = await fetch(GOOGLE_FONTS_CSS_URL, {
			headers: {
				// Modern user-agent to get woff2 format
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		})

		if (!cssResponse.ok) {
			console.warn("[ThumbnailFonts] Failed to fetch Google Fonts CSS:", cssResponse.status)
			return getFallbackFontStyles()
		}

		const cssText = await cssResponse.text()

		// Parse and embed font URLs
		const embeddedCss = await embedFontUrls(cssText)
		return embeddedCss
	} catch (error) {
		console.warn("[ThumbnailFonts] Error fetching fonts:", error)
		return getFallbackFontStyles()
	}
}

/**
 * Parse CSS and replace font URLs with base64 data URLs.
 */
async function embedFontUrls(cssText: string): Promise<string> {
	// Match url() references in the CSS
	const urlRegex = /url\(([^)]+)\)/g
	const fontUrls: Array<{ match: string; url: string }> = []

	const matches = cssText.matchAll(urlRegex)
	for (const match of matches) {
		const url = match[1].replace(/['"]/g, "").trim()
		if (url.startsWith("https://fonts.gstatic.com/")) {
			fontUrls.push({ match: match[0], url })
		}
	}

	if (fontUrls.length === 0) {
		console.warn("[ThumbnailFonts] No font URLs found in CSS")
		return getFallbackFontStyles()
	}

	// Fetch and convert fonts to base64 in parallel
	const fontDataMap = new Map<string, string>()

	await Promise.all(
		fontUrls.map(async ({ url }) => {
			try {
				const fontResponse = await fetch(url)
				if (!fontResponse.ok) {
					console.warn("[ThumbnailFonts] Failed to fetch font:", url, fontResponse.status)
					return
				}

				const fontBlob = await fontResponse.blob()
				const base64 = await blobToBase64(fontBlob)

				// Determine format from URL
				const format = url.includes(".woff2")
					? "woff2"
					: url.includes(".woff")
						? "woff"
						: "truetype"
				const mimeType =
					format === "woff2" ? "font/woff2" : format === "woff" ? "font/woff" : "font/truetype"

				fontDataMap.set(url, `url(data:${mimeType};base64,${base64})`)
			} catch (error) {
				console.warn("[ThumbnailFonts] Error fetching font:", url, error)
			}
		}),
	)

	// Replace URLs in CSS
	let embeddedCss = cssText
	for (const { url } of fontUrls) {
		const dataUrl = fontDataMap.get(url)
		if (dataUrl) {
			embeddedCss = embeddedCss.replace(`url(${url})`, dataUrl)
			embeddedCss = embeddedCss.replace(`url('${url}')`, dataUrl)
			embeddedCss = embeddedCss.replace(`url("${url}")`, dataUrl)
		}
	}

	return embeddedCss
}

/**
 * Convert a Blob to base64 string.
 */
function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			// Remove data URL prefix to get just the base64 part
			const base64 = result.split(",")[1]
			resolve(base64)
		}
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(blob)
	})
}

/**
 * Fallback font styles using system fonts.
 * Used when font embedding fails.
 */
function getFallbackFontStyles(): string {
	return `
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: local('Inter'), local('Inter-Regular'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial'), local('sans-serif');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 500;
  src: local('Inter Medium'), local('Inter-Medium'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial'), local('sans-serif');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  src: local('Inter SemiBold'), local('Inter-SemiBold'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial'), local('sans-serif');
}
@font-face {
  font-family: 'Lexend Exa';
  font-style: normal;
  font-weight: 700;
  src: local('Lexend Exa Bold'), local('LexendExa-Bold'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial'), local('sans-serif');
}
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 400;
  src: local('Unbounded'), local('Unbounded-Regular'), local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Roboto'), local('Helvetica Neue'), local('Arial'), local('sans-serif');
}
`.trim()
}

/**
 * Clear the font cache. Useful for testing or when fonts need to be refreshed.
 */
export function clearFontCache(): void {
	embeddedFontsCache = null
	embedFontsPromise = null
}
