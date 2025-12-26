import { beforeEach, describe, expect, it, setSystemTime } from "bun:test"
import {
	clearSnippetRenderCache,
	getSnippetRenderCache,
	getSnippetRenderCacheKey,
	setSnippetRenderCache,
} from "@/lib/asset-library/snippet-render-cache"

describe("snippet render cache", () => {
	beforeEach(() => {
		clearSnippetRenderCache()
		setSystemTime(new Date("2024-01-01T00:00:00.000Z"))
	})

	it("generates stable keys for equivalent props", () => {
		const keyA = getSnippetRenderCacheKey({
			assetId: "asset",
			version: 1,
			props: { a: 1, b: 2 },
		})
		const keyB = getSnippetRenderCacheKey({
			assetId: "asset",
			version: 1,
			props: { b: 2, a: 1 },
		})
		expect(keyA).toBe(keyB)
	})

	it("evicts oldest entries when capacity is exceeded", () => {
		setSnippetRenderCache("first", "data:first", { maxEntries: 1 })
		setSnippetRenderCache("second", "data:second", { maxEntries: 1 })

		expect(getSnippetRenderCache("first", { maxEntries: 1 })).toBeNull()
		expect(getSnippetRenderCache("second", { maxEntries: 1 })?.dataUrl).toBe("data:second")
	})

	it("expires entries past maxAgeMs", () => {
		setSnippetRenderCache("key", "data", { maxAgeMs: 500 })
		setSystemTime(new Date("2024-01-01T00:00:01.000Z"))

		expect(getSnippetRenderCache("key", { maxAgeMs: 500 })).toBeNull()
	})
})
