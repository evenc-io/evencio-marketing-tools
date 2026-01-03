import { describe, expect, it } from "bun:test"
import {
	isDraftNewerThanAsset,
	normalizeSnippetSourceForComparison,
	shouldIgnoreDraftForAsset,
	shouldRestoreDraftForAsset,
} from "@/routes/-snippets/editor/snippet-draft-resolution"

describe("snippet-draft-resolution", () => {
	it("normalizes snippet source for comparison", () => {
		expect(normalizeSnippetSourceForComparison("  \r\nhello\r\n  ")).toBe("hello")
	})

	it("compares draft and asset updatedAt timestamps", () => {
		expect(isDraftNewerThanAsset("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(true)
		expect(isDraftNewerThanAsset("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(
			false,
		)
		expect(isDraftNewerThanAsset("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(
			false,
		)
	})

	it("ignores starter drafts when the asset has non-starter source", () => {
		expect(
			shouldIgnoreDraftForAsset({
				draftSource: " \r\nstarter\r\n ",
				assetSource: "custom",
				starterSource: "starter",
			}),
		).toBe(true)

		expect(
			shouldIgnoreDraftForAsset({
				draftSource: "starter",
				assetSource: "starter",
				starterSource: "starter",
			}),
		).toBe(false)

		expect(
			shouldIgnoreDraftForAsset({
				draftSource: "custom",
				assetSource: "starter",
				starterSource: "starter",
			}),
		).toBe(false)
	})

	it("restores drafts only when newer and not ignored", () => {
		const base = {
			draftUpdatedAt: "2026-01-02T00:00:00.000Z",
			assetUpdatedAt: "2026-01-01T00:00:00.000Z",
			starterSource: "starter",
		}

		expect(
			shouldRestoreDraftForAsset({
				...base,
				draftSource: "custom",
				assetSource: "custom",
			}),
		).toBe(true)

		expect(
			shouldRestoreDraftForAsset({
				...base,
				draftSource: "starter",
				assetSource: "custom",
			}),
		).toBe(false)

		expect(
			shouldRestoreDraftForAsset({
				...base,
				draftUpdatedAt: "2026-01-01T00:00:00.000Z",
				assetUpdatedAt: "2026-01-02T00:00:00.000Z",
				draftSource: "custom",
				assetSource: "custom",
			}),
		).toBe(false)
	})
})
