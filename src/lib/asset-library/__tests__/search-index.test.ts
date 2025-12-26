import { describe, expect, it } from "bun:test"
import { SAMPLE_ASSETS, SAMPLE_TAG } from "@/lib/asset-library/sample-data"
import { buildAssetSearchIndex, filterAssetSearchIndex } from "@/lib/asset-library/search-index"
import type { Asset } from "@/types/asset-library"

describe("asset search index", () => {
	it("builds searchable tokens and filters by type and search", () => {
		const assets = structuredClone(SAMPLE_ASSETS) as Asset[]
		const entries = buildAssetSearchIndex(assets, [SAMPLE_TAG])

		const results = filterAssetSearchIndex(entries, {
			search: "launch hero",
			types: ["snippet"],
		})

		expect(results).toHaveLength(1)
		expect(results[0].asset.id).toBe("asset_snippet_01")
	})

	it("filters by tags and scope", () => {
		const assets = structuredClone(SAMPLE_ASSETS) as Asset[]
		const entries = buildAssetSearchIndex(assets, [SAMPLE_TAG])

		const tagged = filterAssetSearchIndex(entries, {
			tagIds: [SAMPLE_TAG.id],
			scopes: ["org"],
		})

		expect(tagged.map((entry) => entry.asset.id)).toEqual(["asset_image_01", "asset_snippet_01"])
	})
})
