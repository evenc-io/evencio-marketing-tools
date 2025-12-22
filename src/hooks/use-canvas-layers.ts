import type { Object as FabricObject } from "fabric"
import { useCallback, useEffect, useMemo } from "react"
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
import { useEditorStore } from "@/stores/editor-store"
import type { LayerInfo } from "@/types/layers"

/**
 * Hook that derives layers from the Fabric.js canvas.
 * Layers are returned in display order (top layer first).
 * Excludes the artboard background from the layer list.
 */
export function useCanvasLayers() {
	const canvas = useEditorStore((s) => s.canvas)
	const layerVersion = useEditorStore((s) => s.layerVersion)
	const selectedObjects = useEditorStore((s) => s.selectedObjects)
	const incrementLayerVersion = useEditorStore((s) => s.incrementLayerVersion)

	const isLayerObject = useCallback(
		(obj: FabricObject) => {
			if (!obj) return false
			if (isArtboard(obj)) return false
			const type = obj.type?.toLowerCase()
			if (type === "activeselection") return false
			if (canvas) {
				const objCanvas = (obj as FabricObject & { canvas?: unknown }).canvas
				if (objCanvas && objCanvas !== canvas) return false
				if (!objCanvas) {
					const groupCanvas = (obj as FabricObject & { group?: { canvas?: unknown } | null }).group
						?.canvas
					if (groupCanvas !== canvas) return false
				}
			}
			return true
		},
		[canvas],
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: layerVersion triggers re-computation when layers change
	useEffect(() => {
		if (!canvas) return

		let didUpdate = false
		const existingNames = new Set<string>()

		const collectNames = (obj: FabricObject) => {
			if (!isLayerObject(obj)) return
			const name = getLayerName(obj)
			if (name) {
				existingNames.add(name)
			}
			if (obj.type?.toLowerCase() === "group") {
				const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
				const children = group.getObjects?.() ?? []
				for (const child of children) {
					collectNames(child)
				}
			}
		}

		for (const obj of canvas.getObjects()) {
			collectNames(obj)
		}

		const ensureMetadata = (obj: FabricObject) => {
			let layerId = getLayerId(obj)
			if (!layerId) {
				layerId = generateLayerId()
				setLayerId(obj, layerId)
				didUpdate = true
			}

			let layerName = getLayerName(obj)
			if (!layerName) {
				const name = generateLayerName(getObjectType(obj), Array.from(existingNames))
				setLayerName(obj, name)
				layerName = name
				existingNames.add(name)
				didUpdate = true
			}
		}

		const ensureAll = (obj: FabricObject) => {
			if (!isLayerObject(obj)) return
			ensureMetadata(obj)
			if (obj.type?.toLowerCase() === "group") {
				const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
				const children = group.getObjects?.() ?? []
				for (const child of children) {
					if (isLayerObject(child)) {
						const childGroup = (child as FabricObject & { group?: FabricObject | null }).group
						if (childGroup && childGroup !== group) {
							continue
						}
						ensureAll(child)
					}
				}
			}
		}

		for (const obj of canvas.getObjects()) {
			ensureAll(obj)
		}

		if (didUpdate) {
			incrementLayerVersion()
		}
	}, [canvas, incrementLayerVersion, isLayerObject, layerVersion])

	// biome-ignore lint/correctness/useExhaustiveDependencies: layerVersion triggers re-computation when layers change
	const layers = useMemo<LayerInfo[]>(() => {
		if (!canvas) return []

		// Get objects (excluding artboard) and reverse for display (top layer first)
		const objects = [...canvas.getObjects()].filter((obj) => isLayerObject(obj)).reverse()

		const flattened: LayerInfo[] = []
		const seenLayerIds = new Set<string>()
		const seenObjects = new Set<FabricObject>()

		for (const obj of objects) {
			const layerId = getLayerId(obj)
			const layerName = getLayerName(obj)
			if (!layerId || !layerName) {
				continue
			}
			if (seenLayerIds.has(layerId) || seenObjects.has(obj)) {
				continue
			}
			seenLayerIds.add(layerId)
			seenObjects.add(obj)
			flattened.push({
				layerId,
				layerName,
				objectType: getObjectType(obj),
				visible: obj.visible !== false,
				depth: 0,
				parentLayerId: null,
				object: obj,
			})

			if (obj.type?.toLowerCase() === "group") {
				const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
				const children = group.getObjects?.() ?? []
				const displayChildren = [...children].reverse()
				for (const child of displayChildren) {
					if (!isLayerObject(child)) continue
					const childGroup = (child as FabricObject & { group?: FabricObject | null }).group
					if (childGroup && childGroup !== group) continue
					const childLayerId = getLayerId(child)
					const childLayerName = getLayerName(child)
					if (!childLayerId || !childLayerName) {
						continue
					}
					if (seenLayerIds.has(childLayerId) || seenObjects.has(child)) {
						continue
					}
					seenLayerIds.add(childLayerId)
					seenObjects.add(child)
					flattened.push({
						layerId: childLayerId,
						layerName: childLayerName,
						objectType: getObjectType(child),
						visible: child.visible !== false,
						depth: 1,
						parentLayerId: layerId,
						object: child,
					})
				}
			}
		}

		return flattened
	}, [canvas, layerVersion])

	// Get selected layer IDs
	const selectedLayerIds = useMemo(() => {
		if (!selectedObjects || selectedObjects.length === 0) return []
		return selectedObjects.map((obj) => getLayerId(obj)).filter((id): id is string => id !== null)
	}, [selectedObjects])

	return { layers, selectedLayerIds, selectedObjects }
}
