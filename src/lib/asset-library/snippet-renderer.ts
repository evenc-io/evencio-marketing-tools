import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { getSnippetRegistryEntry } from "@/lib/snippets"
import type { SnippetAsset, SnippetProps } from "@/types/asset-library"
import { ASSET_LIBRARY_FEATURE_FLAGS } from "./feature-flags"
import type { RenderDeterminismConfig } from "./render-config"
import { SNIPPET_RENDER_DETERMINISM } from "./render-config"
import {
	getSnippetRenderCache,
	getSnippetRenderCacheKey,
	type SnippetRenderCacheOptions,
	setSnippetRenderCache,
} from "./snippet-render-cache"
import {
	assertNoExternalUrls,
	buildSnippetHtmlDocument,
	buildSnippetMarkup,
	withDeterministicEnv,
	withNetworkDisabled,
} from "./snippet-runtime"
import { resolveSnippetProps, validateSnippetProps } from "./snippet-validation"

export type SnippetRenderErrorCode =
	| "SNIPPET_RENDERING_DISABLED"
	| "SNIPPET_NOT_FOUND"
	| "SNIPPET_RUNTIME_MISMATCH"
	| "SNIPPET_PROPS_INVALID"
	| "SNIPPET_EXTERNAL_URL"
	| "SNIPPET_PNG_UNSUPPORTED"

export class SnippetRenderError extends Error {
	code: SnippetRenderErrorCode
	details?: Record<string, unknown>

	constructor(code: SnippetRenderErrorCode, message: string, details?: Record<string, unknown>) {
		super(message)
		this.name = "SnippetRenderError"
		this.code = code
		this.details = details
	}
}

export class SnippetValidationError extends SnippetRenderError {
	issues: unknown[]

	constructor(message: string, issues: unknown[]) {
		super("SNIPPET_PROPS_INVALID", message, { issues })
		this.name = "SnippetValidationError"
		this.issues = issues
	}
}

export interface SnippetRenderOptions {
	determinism?: RenderDeterminismConfig
	allowExternalUrls?: boolean
	allowDisabledFeatureFlag?: boolean
	cache?: SnippetRenderCacheOptions & { enabled?: boolean }
	bypassCache?: boolean
}

export interface SnippetPngRenderResult {
	dataUrl: string
	cacheKey: string
	fromCache: boolean
	width: number
	height: number
}

const assertSnippetRenderingEnabled = (options?: SnippetRenderOptions) => {
	if (options?.allowDisabledFeatureFlag) return
	if (!ASSET_LIBRARY_FEATURE_FLAGS.snippetRenderingEnabled) {
		throw new SnippetRenderError(
			"SNIPPET_RENDERING_DISABLED",
			"Snippet rendering is disabled by feature flag",
		)
	}
}

const resolveSnippetComponent = (asset: SnippetAsset) => {
	const entry = getSnippetRegistryEntry(asset.snippet.entry)
	if (!entry) {
		throw new SnippetRenderError("SNIPPET_NOT_FOUND", "Snippet entry is not in the allowlist", {
			entry: asset.snippet.entry,
		})
	}
	if (entry.runtime !== asset.snippet.runtime) {
		throw new SnippetRenderError(
			"SNIPPET_RUNTIME_MISMATCH",
			"Snippet runtime does not match registry",
			{ entry: asset.snippet.entry, runtime: asset.snippet.runtime },
		)
	}
	return entry
}

const resolveAndValidateProps = (asset: SnippetAsset, props?: SnippetProps) => {
	const resolved = resolveSnippetProps(asset.snippet.propsSchema, asset.defaultProps, props)
	const validation = validateSnippetProps(asset.snippet.propsSchema, resolved)
	if (!validation.success) {
		throw new SnippetValidationError("Snippet props failed validation", validation.error.issues)
	}
	return validation.data
}

export async function renderSnippetToMarkup(
	asset: SnippetAsset,
	props?: SnippetProps,
	options?: SnippetRenderOptions,
): Promise<string> {
	assertSnippetRenderingEnabled(options)
	const determinism = options?.determinism ?? SNIPPET_RENDER_DETERMINISM
	const entry = resolveSnippetComponent(asset)
	const resolvedProps = resolveAndValidateProps(asset, props)

	const innerHtml = await withNetworkDisabled(async () =>
		withDeterministicEnv(determinism, () => {
			if (entry.runtime === "react" && entry.Component) {
				return renderToStaticMarkup(createElement(entry.Component, resolvedProps))
			}

			if (entry.runtime === "html" && entry.renderHtml) {
				return entry.renderHtml(resolvedProps)
			}

			throw new SnippetRenderError(
				"SNIPPET_NOT_FOUND",
				"Snippet entry is missing a render implementation",
			)
		}),
	)

	const markup = buildSnippetMarkup(innerHtml, determinism)

	if (!options?.allowExternalUrls) {
		try {
			assertNoExternalUrls(markup)
		} catch (error) {
			throw new SnippetRenderError(
				"SNIPPET_EXTERNAL_URL",
				error instanceof Error ? error.message : "External URLs are not allowed",
			)
		}
	}

	return markup
}

export async function renderSnippetToHtmlDocument(
	asset: SnippetAsset,
	props?: SnippetProps,
	options?: SnippetRenderOptions,
): Promise<string> {
	const determinism = options?.determinism ?? SNIPPET_RENDER_DETERMINISM
	const markup = await renderSnippetToMarkup(asset, props, options)
	return buildSnippetHtmlDocument(markup, determinism)
}

export async function renderSnippetToPng(
	asset: SnippetAsset,
	props?: SnippetProps,
	options?: SnippetRenderOptions,
): Promise<SnippetPngRenderResult> {
	assertSnippetRenderingEnabled(options)
	const determinism = options?.determinism ?? SNIPPET_RENDER_DETERMINISM
	const resolvedProps = resolveAndValidateProps(asset, props)
	const cacheKey = getSnippetRenderCacheKey({
		assetId: asset.id,
		version: asset.version,
		props: resolvedProps,
		determinism,
	})

	if (!options?.bypassCache && options?.cache?.enabled !== false) {
		const cached = getSnippetRenderCache(cacheKey, options?.cache)
		if (cached) {
			return {
				dataUrl: cached.dataUrl,
				cacheKey,
				fromCache: true,
				width: determinism.viewport.width,
				height: determinism.viewport.height,
			}
		}
	}

	if (typeof document === "undefined") {
		throw new SnippetRenderError(
			"SNIPPET_PNG_UNSUPPORTED",
			"PNG rendering requires a browser environment",
		)
	}

	const markup = await renderSnippetToMarkup(asset, resolvedProps, options)
	const wrapper = document.createElement("div")
	wrapper.style.position = "fixed"
	wrapper.style.left = "-10000px"
	wrapper.style.top = "0"
	wrapper.style.width = `${determinism.viewport.width}px`
	wrapper.style.height = `${determinism.viewport.height}px`
	wrapper.style.pointerEvents = "none"
	wrapper.innerHTML = markup
	document.body.appendChild(wrapper)

	try {
		const target = wrapper.querySelector("[data-snippet-root]") as HTMLElement | null
		if (!target) {
			throw new SnippetRenderError("SNIPPET_PNG_UNSUPPORTED", "Snippet root element not found")
		}

		if (document.fonts?.ready) {
			await document.fonts.ready
		}

		const { toPng } = await import("html-to-image")
		const dataUrl = await toPng(target, {
			width: determinism.viewport.width,
			height: determinism.viewport.height,
			pixelRatio: determinism.viewport.deviceScaleFactor,
		})

		if (options?.cache?.enabled !== false) {
			setSnippetRenderCache(cacheKey, dataUrl, options?.cache)
		}

		return {
			dataUrl,
			cacheKey,
			fromCache: false,
			width: determinism.viewport.width,
			height: determinism.viewport.height,
		}
	} finally {
		wrapper.remove()
	}
}
