import type { RenderDeterminismConfig } from "@/lib/asset-library/render-config"

export interface HtmlToPngOptions {
	timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_ARGS = [
	"--disable-dev-shm-usage",
	"--disable-gpu",
	"--no-sandbox",
	"--disable-setuid-sandbox",
]

/**
 * Render an HTML document to a PNG image in a sandboxed headless Chromium instance.
 * Requests are blocked unless they are `data:`, `blob:`, or `about:blank` to keep rendering deterministic.
 */
export async function renderHtmlToPng(
	html: string,
	config: RenderDeterminismConfig,
	options: HtmlToPngOptions = {},
): Promise<Uint8Array> {
	const { chromium } = await import("playwright")
	const browser = await chromium.launch({ headless: true, args: DEFAULT_ARGS })
	const context = await browser.newContext({
		viewport: {
			width: config.viewport.width,
			height: config.viewport.height,
		},
		deviceScaleFactor: config.viewport.deviceScaleFactor,
	})
	const page = await context.newPage()

	try {
		await page.route("**/*", async (route) => {
			const url = route.request().url()
			if (url.startsWith("data:") || url.startsWith("blob:") || url === "about:blank") {
				return route.continue()
			}
			return route.abort()
		})

		await page.setContent(html, {
			waitUntil: "load",
			timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		})

		await page.emulateMedia({ media: "screen" })

		await page.evaluate(async () => {
			if (document.fonts?.ready) {
				await document.fonts.ready
			}
		})

		const buffer = await page.screenshot({
			type: "png",
			clip: {
				x: 0,
				y: 0,
				width: config.viewport.width,
				height: config.viewport.height,
			},
		})

		return buffer
	} finally {
		await page.close()
		await context.close()
		await browser.close()
	}
}
