import { describe, expect, it, vi } from "bun:test"
import type { Canvas } from "fabric"
import { serializeCanvas } from "@/lib/canvas/serialize"

type FakeObject = {
	type?: string
	data?: { isArtboard?: boolean }
	layerId?: string
	layerName?: string
	left?: number
	top?: number
	scaleX?: number
	scaleY?: number
	set: (key: string, value: unknown) => void
	setCoords: () => void
	getObjects?: () => FakeObject[]
	triggerLayout?: (options?: { deep?: boolean }) => void
}

const createObject = (input: Partial<FakeObject> & { type?: string }) => {
	const obj: FakeObject = {
		...input,
		set(key, value) {
			;(this as Record<string, unknown>)[key] = value
		},
		setCoords: input.setCoords ?? vi.fn(),
	}
	return obj
}

describe("serializeCanvas", () => {
	it("adds layer metadata, strips artboard, and normalizes group output", () => {
		const artboard = createObject({ type: "rect", data: { isArtboard: true } })
		const child = createObject({ type: "rect", layerId: "child-1", layerName: "Rectangle 1" })
		const group = createObject({
			type: "group",
			layerId: "group-1",
			layerName: "Group 1",
			left: 40,
			top: 60,
			scaleX: 2,
			scaleY: 2,
			getObjects: () => [child],
			triggerLayout: vi.fn(),
		})
		const text = createObject({ type: "textbox" })

		const canvas = {
			_currentTransform: {},
			endCurrentTransform: vi.fn(),
			getObjects: () => [artboard, group, text],
			toJSON: () => ({
				objects: [
					{
						type: "group",
						layerId: group.layerId,
						layerName: group.layerName,
						left: 0,
						top: 0,
						objects: [{ type: "rect", layerId: child.layerId, layerName: child.layerName }],
					},
					{ type: "rect", layerId: child.layerId, layerName: child.layerName },
					{
						type: "textbox",
						layerId: text.layerId,
						layerName: text.layerName,
					},
					{ type: "rect", data: { isArtboard: true } },
				],
			}),
		}

		const result = JSON.parse(serializeCanvas(canvas as unknown as Canvas)) as {
			objects: Array<Record<string, unknown>>
		}

		const topLevelIds = result.objects.map((obj) => obj.layerId).filter(Boolean)
		expect(topLevelIds).toContain("group-1")
		expect(topLevelIds).not.toContain("child-1")

		const groupSerialized = result.objects.find((obj) => obj.layerId === "group-1")
		expect(groupSerialized?.left).toBe(40)
		expect(groupSerialized?.top).toBe(60)

		const textSerialized = result.objects.find((obj) => obj.type === "textbox")
		expect(typeof textSerialized?.layerId).toBe("string")
		expect(textSerialized?.layerName).toBe("Text 1")
	})
})
