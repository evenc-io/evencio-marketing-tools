import type { RenderDeterminismConfig } from "./render-config"

const blockNetworkAccess = () => {
	throw new Error("Network access is disabled in snippet rendering")
}

const createSeedHash = (seed: string) => {
	let hash = 1779033703 ^ seed.length
	for (let i = 0; i < seed.length; i += 1) {
		hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353)
		hash = (hash << 13) | (hash >>> 19)
	}
	return () => {
		hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
		hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
		hash ^= hash >>> 16
		return hash >>> 0
	}
}

const mulberry32 = (seed: number) => {
	let t = seed
	return () => {
		t += 0x6d2b79f5
		let result = Math.imul(t ^ (t >>> 15), t | 1)
		result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * Create a deterministic PRNG seeded from an arbitrary string.
 */
export const createSeededRandom = (seed: string) => {
	const seedHash = createSeedHash(seed)
	return mulberry32(seedHash())
}

/**
 * Build a stable inline `style` string for the snippet root container.
 */
export const buildSnippetContainerStyle = (config: RenderDeterminismConfig) => {
	const fontStack = Array.from(new Set([...(config.fonts.families ?? []), config.fonts.fallback]))
		.filter(Boolean)
		.map((font) => `'${font.replace(/'/g, "\\'")}'`)
		.join(", ")

	return [
		`width:${config.viewport.width}px`,
		`height:${config.viewport.height}px`,
		"display:flex",
		"align-items:stretch",
		"justify-content:stretch",
		"background:#ffffff",
		"overflow:hidden",
		"box-sizing:border-box",
		`font-family:${fontStack}, sans-serif`,
	].join(";")
}

/**
 * Build a small base CSS payload for snippet rendering (and optionally disables animations).
 */
export const buildSnippetBaseCss = (config: RenderDeterminismConfig) => {
	const animationReset = config.disableAnimations
		? `
[data-snippet-root] *,
[data-snippet-root] *::before,
[data-snippet-root] *::after {
	animation: none !important;
	transition: none !important;
}
`
		: ""

	return `
[data-snippet-root] * {
	box-sizing: border-box;
}
${animationReset}
`
}

/**
 * Assemble snippet markup by wrapping rendered inner HTML in a root container and inline styles.
 */
export const buildSnippetMarkup = (innerHtml: string, config: RenderDeterminismConfig) => {
	const style = buildSnippetContainerStyle(config)
	const baseCss = buildSnippetBaseCss(config)
	return `
<div data-snippet-root style="${style}" data-locale="${config.locale}" data-time-zone="${
		config.timeZone
	}">
	<style>${baseCss}</style>
	<div data-snippet-content>${innerHtml}</div>
</div>
`
}

/**
 * Wrap snippet markup into a minimal standalone HTML document for server-side rendering / export.
 */
export const buildSnippetHtmlDocument = (markup: string, config: RenderDeterminismConfig) => {
	return `<!doctype html>
<html lang="${config.locale}">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=${config.viewport.width}, height=${
		config.viewport.height
	}, initial-scale=1" />
	<style>
		html, body { margin: 0; padding: 0; }
		body { width: ${config.viewport.width}px; height: ${
			config.viewport.height
		}px; overflow: hidden; }
	</style>
</head>
<body>
	${markup}
</body>
</html>`
}

/**
 * Throw if the snippet markup contains `http(s)` URLs in HTML attributes or CSS `url(...)`.
 */
export const assertNoExternalUrls = (markup: string) => {
	const urls = new Set<string>()
	const attrPattern = /(src|href)=["'](https?:\/\/[^"']+)["']/gi
	const cssPattern = /url\(\s*(["']?)(https?:\/\/[^"')\s]+)\1\s*\)/gi

	for (let match = attrPattern.exec(markup); match; match = attrPattern.exec(markup)) {
		urls.add(match[2])
	}
	for (let match = cssPattern.exec(markup); match; match = cssPattern.exec(markup)) {
		urls.add(match[2])
	}

	if (urls.size > 0) {
		throw new Error(
			`External URLs are not allowed in snippet markup: ${Array.from(urls).join(", ")}`,
		)
	}
}

/**
 * Temporarily disable network primitives (`fetch`, XHR, WebSocket, etc.) for deterministic rendering.
 */
export const withNetworkDisabled = async <T>(fn: () => Promise<T> | T): Promise<T> => {
	const globals = globalThis as typeof globalThis & {
		fetch?: typeof fetch
		XMLHttpRequest?: typeof XMLHttpRequest
		WebSocket?: typeof WebSocket
		EventSource?: typeof EventSource
		navigator?: Navigator & { sendBeacon?: typeof navigator.sendBeacon }
	}

	const originalFetch = "fetch" in globals ? globals.fetch : undefined
	const originalXHR = "XMLHttpRequest" in globals ? globals.XMLHttpRequest : undefined
	const originalWebSocket = "WebSocket" in globals ? globals.WebSocket : undefined
	const originalEventSource = "EventSource" in globals ? globals.EventSource : undefined
	const originalSendBeacon = globals.navigator?.sendBeacon

	if (originalFetch) globals.fetch = blockNetworkAccess as unknown as typeof fetch
	if (originalXHR) globals.XMLHttpRequest = blockNetworkAccess as unknown as typeof XMLHttpRequest
	if (originalWebSocket) globals.WebSocket = blockNetworkAccess as unknown as typeof WebSocket
	if (originalEventSource) globals.EventSource = blockNetworkAccess as unknown as typeof EventSource
	if (globals.navigator && typeof originalSendBeacon === "function") {
		try {
			globals.navigator.sendBeacon = blockNetworkAccess as unknown as typeof navigator.sendBeacon
		} catch {
			// Ignore if navigator is read-only
		}
	}

	try {
		return await fn()
	} finally {
		if (originalFetch) globals.fetch = originalFetch
		if (originalXHR) globals.XMLHttpRequest = originalXHR
		if (originalWebSocket) globals.WebSocket = originalWebSocket
		if (originalEventSource) globals.EventSource = originalEventSource
		if (globals.navigator && originalSendBeacon) {
			try {
				globals.navigator.sendBeacon = originalSendBeacon
			} catch {
				// Ignore if navigator is read-only
			}
		}
	}
}

/**
 * Run a function with deterministic `Math.random`, `Date`, and `Intl.DateTimeFormat` based on config.
 */
export const withDeterministicEnv = async <T>(
	config: RenderDeterminismConfig,
	fn: () => Promise<T> | T,
): Promise<T> => {
	const originalRandom = Math.random
	const seededRandom = createSeededRandom(config.randomSeed)
	Math.random = seededRandom

	const originalDate = Date
	const fixedTime = new originalDate(config.fixedDateISO).getTime()

	class FixedDate extends originalDate {
		constructor(...args: [] | ConstructorParameters<DateConstructor>) {
			if (args.length === 0) {
				super(fixedTime)
			} else {
				super(...(args as ConstructorParameters<DateConstructor>))
			}
		}

		static now() {
			return fixedTime
		}
	}

	FixedDate.parse = originalDate.parse
	FixedDate.UTC = originalDate.UTC

	const originalDateTimeFormat = Intl.DateTimeFormat
	const patchedDateTimeFormat = (
		_locale?: string | string[],
		options?: Intl.DateTimeFormatOptions,
	) =>
		new originalDateTimeFormat(config.locale, {
			timeZone: config.timeZone,
			...options,
		})
	patchedDateTimeFormat.prototype = originalDateTimeFormat.prototype

	try {
		// @ts-expect-error - overriding global Date for deterministic rendering
		globalThis.Date = FixedDate
		Intl.DateTimeFormat = patchedDateTimeFormat as typeof Intl.DateTimeFormat

		return await fn()
	} finally {
		Math.random = originalRandom
		globalThis.Date = originalDate
		Intl.DateTimeFormat = originalDateTimeFormat
	}
}
