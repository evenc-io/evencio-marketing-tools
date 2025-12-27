import { Buffer } from "node:buffer"
import { createError, defineEventHandler, readBody, setHeader } from "h3"
import { z } from "zod"
import {
	getSnippetRenderCache,
	getSnippetRenderCacheKey,
	renderSnippetToHtmlDocument,
	SNIPPET_RENDER_DETERMINISM,
	setSnippetRenderCache,
} from "@/lib/asset-library"
import { assetSchema, snippetPropsSchema } from "@/lib/asset-library/schemas"
import { resolveSnippetProps, validateSnippetProps } from "@/lib/asset-library/snippet-validation"
import type { SnippetAsset } from "@/types/asset-library"
import { injectSnippetFonts } from "../../../lib/snippet-fonts"
import { renderHtmlToPng } from "../../../lib/snippet-png"

const requestSchema = z
	.object({
		asset: assetSchema,
		props: snippetPropsSchema.optional(),
	})
	.strict()

const toPngDataUrl = (bytes: Uint8Array) => {
	const base64 = Buffer.from(bytes).toString("base64")
	return `data:image/png;base64,${base64}`
}

const dataUrlToBytes = (dataUrl: string) => {
	const [, base64] = dataUrl.split(",")
	if (!base64) {
		throw createError({
			statusCode: 500,
			statusMessage: "Invalid cached PNG data",
		})
	}
	return Buffer.from(base64, "base64")
}

export default defineEventHandler(async (event) => {
	const body = await readBody(event)
	const parsed = requestSchema.safeParse(body)

	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid render request",
			data: parsed.error.flatten(),
		})
	}

	if (parsed.data.asset.type !== "snippet") {
		throw createError({
			statusCode: 400,
			statusMessage: "Asset must be a snippet",
		})
	}

	const asset = parsed.data.asset as SnippetAsset
	if (asset.snippet.source) {
		throw createError({
			statusCode: 422,
			statusMessage: "Custom snippet rendering is not supported yet",
		})
	}
	const incomingProps = parsed.data.props ?? {}
	const resolvedProps = resolveSnippetProps(
		asset.snippet.propsSchema,
		asset.defaultProps,
		incomingProps,
	)
	const validation = validateSnippetProps(asset.snippet.propsSchema, resolvedProps)

	if (!validation.success) {
		throw createError({
			statusCode: 422,
			statusMessage: "Snippet props failed validation",
			data: validation.error.flatten(),
		})
	}

	const cacheKey = getSnippetRenderCacheKey({
		assetId: asset.id,
		version: asset.version,
		props: resolvedProps,
		determinism: SNIPPET_RENDER_DETERMINISM,
	})

	const cached = getSnippetRenderCache(cacheKey)
	if (cached) {
		setHeader(event, "Content-Type", "image/png")
		setHeader(event, "X-Snippet-Cache", "hit")
		return dataUrlToBytes(cached.dataUrl)
	}

	const allowDisabledFeatureFlag = process.env.NODE_ENV !== "production"
	const html = await renderSnippetToHtmlDocument(asset, resolvedProps, {
		determinism: SNIPPET_RENDER_DETERMINISM,
		allowDisabledFeatureFlag,
	})
	const pngBytes = await renderHtmlToPng(injectSnippetFonts(html), SNIPPET_RENDER_DETERMINISM)
	const dataUrl = toPngDataUrl(pngBytes)

	setSnippetRenderCache(cacheKey, dataUrl)

	setHeader(event, "Content-Type", "image/png")
	setHeader(event, "X-Snippet-Cache", "miss")
	return pngBytes
})
