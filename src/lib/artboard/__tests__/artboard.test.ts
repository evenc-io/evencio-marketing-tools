import { describe, expect, it } from "bun:test"
import type { Object as FabricObject } from "fabric"
import { getArtboard, getUserObjects, isArtboard } from "@/lib/artboard"

describe("artboard utilities", () => {
	it("identifies artboard objects and filters user objects", () => {
		const artboard = { data: { isArtboard: true } } as unknown as FabricObject
		const userObject = { data: { isArtboard: false } } as unknown as FabricObject
		const canvas = {
			getObjects: () => [artboard, userObject],
		}

		expect(isArtboard(artboard)).toBe(true)
		expect(isArtboard(userObject)).toBe(false)
		expect(getArtboard(canvas)).toBe(artboard)
		expect(getUserObjects(canvas)).toEqual([userObject])
	})
})
