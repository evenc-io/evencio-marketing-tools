import { describe, expect, it } from "bun:test"
import type { Object as FabricObject } from "fabric"
import {
	generateLayerId,
	generateLayerName,
	getLayerId,
	getLayerName,
	getObjectType,
	getObjectTypeLabel,
	setLayerId,
	setLayerName,
} from "@/lib/layers"

describe("layers", () => {
	it("maps fabric types to object types", () => {
		const obj = { type: "textbox" } as FabricObject
		expect(getObjectType(obj)).toBe("text")
		expect(getObjectType({ type: "rect" } as FabricObject)).toBe("rect")
		expect(getObjectType({ type: "unknown" } as FabricObject)).toBe("unknown")
	})

	it("generates readable labels and unique names", () => {
		expect(getObjectTypeLabel("triangle")).toBe("Triangle")
		const name = generateLayerName("text", ["Text 1", "Text 2"])
		expect(name).toBe("Text 3")
	})

	it("sets and reads layer metadata on objects", () => {
		const obj = {
			type: "rect",
			set(key: string, value: string) {
				;(this as Record<string, string>)[key] = value
			},
		} as unknown as FabricObject

		const layerId = generateLayerId()
		setLayerId(obj, layerId)
		setLayerName(obj, "Rectangle 1")

		expect(getLayerId(obj)).toBe(layerId)
		expect(getLayerName(obj)).toBe("Rectangle 1")
	})
})
