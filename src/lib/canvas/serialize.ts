import type { Canvas, Object as FabricObject } from "fabric"
import { isArtboard } from "@/lib/artboard"
import {
	generateLayerId,
	generateLayerName,
	getLayerId,
	getLayerName,
	getObjectType,
	setLayerId,
	setLayerName,
} from "@/lib/layers"

const isGroupObject = (obj: FabricObject) => obj.type?.toLowerCase() === "group"

const syncObjectCoords = (obj: FabricObject) => {
	if (isGroupObject(obj)) {
		const group = obj as FabricObject & {
			getObjects?: () => FabricObject[]
			triggerLayout?: (options?: { deep?: boolean }) => void
		}
		// Ensure group bounds/position are up to date before serialization.
		group.triggerLayout?.({ deep: true })
	}

	obj.setCoords()

	if (isGroupObject(obj)) {
		const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
		const children = group.getObjects?.() ?? []
		for (const child of children) {
			syncObjectCoords(child)
		}
	}
}

const collectExistingLayerNames = (obj: FabricObject, names: Set<string>) => {
	const name = getLayerName(obj)
	if (name) {
		names.add(name)
	}

	if (isGroupObject(obj)) {
		const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
		const children = group.getObjects?.() ?? []
		for (const child of children) {
			collectExistingLayerNames(child, names)
		}
	}
}

const ensureLayerMetadata = (obj: FabricObject, names: Set<string>) => {
	if (!getLayerId(obj)) {
		setLayerId(obj, generateLayerId())
	}

	if (!getLayerName(obj)) {
		const name = generateLayerName(getObjectType(obj), Array.from(names))
		setLayerName(obj, name)
		names.add(name)
	}

	if (isGroupObject(obj)) {
		const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
		const children = group.getObjects?.() ?? []
		for (const child of children) {
			ensureLayerMetadata(child, names)
		}
	}
}

const collectLayerObjects = (obj: FabricObject, map: Map<string, FabricObject>): void => {
	const layerId = (obj as FabricObject & { layerId?: string }).layerId
	if (typeof layerId === "string" && layerId.length > 0) {
		map.set(layerId, obj)
	}

	if (isGroupObject(obj)) {
		const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
		const children = group.getObjects?.() ?? []
		for (const child of children) {
			collectLayerObjects(child, map)
		}
	}
}

const patchSerializedGroupTransforms = (
	serialized: unknown,
	objectMap: Map<string, FabricObject>,
): void => {
	if (!serialized || typeof serialized !== "object") return

	const maybeSerialized = serialized as Record<string, unknown>
	const layerId = maybeSerialized.layerId
	if (typeof layerId === "string") {
		const liveObject = objectMap.get(layerId)
		if (liveObject && isGroupObject(liveObject)) {
			const group = liveObject as FabricObject & {
				left?: number
				top?: number
				scaleX?: number
				scaleY?: number
				angle?: number
				skewX?: number
				skewY?: number
				flipX?: boolean
				flipY?: boolean
				originX?: string
				originY?: string
				width?: number
				height?: number
			}

			if (typeof group.left === "number") {
				maybeSerialized.left = group.left
			}
			if (typeof group.top === "number") {
				maybeSerialized.top = group.top
			}
			if (typeof group.scaleX === "number") {
				maybeSerialized.scaleX = group.scaleX
			}
			if (typeof group.scaleY === "number") {
				maybeSerialized.scaleY = group.scaleY
			}
			if (typeof group.angle === "number") {
				maybeSerialized.angle = group.angle
			}
			if (typeof group.skewX === "number") {
				maybeSerialized.skewX = group.skewX
			}
			if (typeof group.skewY === "number") {
				maybeSerialized.skewY = group.skewY
			}
			if (typeof group.flipX === "boolean") {
				maybeSerialized.flipX = group.flipX
			}
			if (typeof group.flipY === "boolean") {
				maybeSerialized.flipY = group.flipY
			}
			if (typeof group.originX === "string") {
				maybeSerialized.originX = group.originX
			}
			if (typeof group.originY === "string") {
				maybeSerialized.originY = group.originY
			}
			if (typeof group.width === "number") {
				maybeSerialized.width = group.width
			}
			if (typeof group.height === "number") {
				maybeSerialized.height = group.height
			}
		}
	}

	const children = maybeSerialized.objects
	if (Array.isArray(children)) {
		for (const child of children) {
			patchSerializedGroupTransforms(child, objectMap)
		}
	}
}

const finalizeActiveTransform = (canvas: Canvas) => {
	const maybeCanvas = canvas as Canvas & {
		_currentTransform?: unknown
		endCurrentTransform?: () => void
	}
	if (maybeCanvas._currentTransform && typeof maybeCanvas.endCurrentTransform === "function") {
		maybeCanvas.endCurrentTransform()
	}
}

const normalizeSerializedObjects = (objects: Array<Record<string, unknown>>) => {
	const descendantLayerIds = new Set<string>()
	const seenLayerIds = new Set<string>()

	const collectDescendants = (obj: Record<string, unknown>) => {
		const children = obj.objects
		if (!Array.isArray(children)) return

		for (const child of children) {
			if (!child || typeof child !== "object") continue
			const layerId = (child as { layerId?: string }).layerId
			if (typeof layerId === "string" && layerId.length > 0) {
				descendantLayerIds.add(layerId)
			}
			collectDescendants(child as Record<string, unknown>)
		}
	}

	for (const obj of objects) {
		collectDescendants(obj)
	}

	const dedupe = (
		items: Array<Record<string, unknown>>,
		isTopLevel: boolean,
	): Array<Record<string, unknown>> => {
		const cleaned: Array<Record<string, unknown>> = []

		for (const item of items) {
			const layerId = (item as { layerId?: string }).layerId
			if (typeof layerId === "string" && layerId.length > 0) {
				if (isTopLevel && descendantLayerIds.has(layerId)) {
					continue
				}
				if (seenLayerIds.has(layerId)) {
					continue
				}
				seenLayerIds.add(layerId)
			}

			const children = item.objects
			if (Array.isArray(children)) {
				item.objects = dedupe(children as Array<Record<string, unknown>>, false)
			}
			cleaned.push(item)
		}

		return cleaned
	}

	return dedupe(objects, true)
}

export const serializeCanvas = (canvas: Canvas): string => {
	finalizeActiveTransform(canvas)

	const objects = canvas.getObjects()
	const nameSet = new Set<string>()
	for (const obj of objects) {
		if (!isArtboard(obj)) {
			collectExistingLayerNames(obj, nameSet)
		}
	}

	for (const obj of objects) {
		if (!isArtboard(obj)) {
			ensureLayerMetadata(obj, nameSet)
		}
	}

	for (const obj of objects) {
		if (!isArtboard(obj)) {
			syncObjectCoords(obj)
		}
	}

	// @ts-expect-error - Fabric.js v6 types don't include legacy toJSON propertiesToInclude signature
	const json = canvas.toJSON(["width", "height", "layerId", "layerName", "data"]) as {
		objects: Array<Record<string, unknown>>
	}
	const objectMap = new Map<string, FabricObject>()
	for (const obj of objects) {
		collectLayerObjects(obj, objectMap)
	}
	for (const obj of json.objects) {
		patchSerializedGroupTransforms(obj, objectMap)
	}
	json.objects = json.objects.filter(
		(obj) => !("data" in obj && (obj.data as { isArtboard?: boolean })?.isArtboard),
	)
	json.objects = normalizeSerializedObjects(json.objects as Array<Record<string, unknown>>)

	return JSON.stringify(json)
}
