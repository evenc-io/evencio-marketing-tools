import { describe, expect, it } from "bun:test"
import {
	invalidateSelectionToken,
	nextSelectionToken,
} from "@/routes/-snippets/editor/snippet-selection-token"

describe("snippet-selection-token", () => {
	it("detects staleness when token is invalidated", () => {
		const ref = { current: 0 }
		const first = nextSelectionToken(ref)
		expect(first.token).toBe(1)
		expect(first.isStale()).toBe(false)

		invalidateSelectionToken(ref)
		expect(first.isStale()).toBe(true)

		const second = nextSelectionToken(ref)
		expect(second.token).toBe(3)
		expect(second.isStale()).toBe(false)
	})
})
