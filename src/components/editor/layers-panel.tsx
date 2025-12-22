import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core"
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { ActiveSelection, type Object as FabricObject, type Group } from "fabric"
import { Layers } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCanvasLayers } from "@/hooks/use-canvas-layers"
import { isArtboard } from "@/lib/artboard"
import { useEditorStore } from "@/stores/editor-store"
import type { LayerInfo } from "@/types/layers"
import { EmptyState } from "../ui/empty-state"
import { LayerItem } from "./layer-item"

export function LayersPanel() {
	const { layers, selectedLayerIds } = useCanvasLayers()
	const canvas = useEditorStore((s) => s.canvas)
	const incrementLayerVersion = useEditorStore((s) => s.incrementLayerVersion)
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
	const [selectedLayerIdSet, setSelectedLayerIdSet] = useState<Set<string>>(() => new Set())
	const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

	// Sync selected layer IDs from store to component state
	useEffect(() => {
		setSelectedLayerIdSet(new Set(selectedLayerIds))
	}, [selectedLayerIds])

	// Handle ESC key to clear selection
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setSelectedLayerIdSet(new Set())
				if (canvas) {
					canvas.discardActiveObject()
					canvas.renderAll()
				}
			}
		}
		window.addEventListener("keydown", handleEsc)
		return () => window.removeEventListener("keydown", handleEsc)
	}, [canvas])

	const markCanvasModified = useCallback(
		(target?: FabricObject) => {
			if (!canvas) return
			canvas.fire("object:modified", { target })
		},
		[canvas],
	)

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event
			if (!over || active.id === over.id || !canvas) return

			const activeLayer = layers.find((layer) => layer.layerId === active.id)
			const overLayer = layers.find((layer) => layer.layerId === over.id)
			if (!activeLayer || !overLayer) return

			const topLevelLayers = layers.filter((layer) => layer.parentLayerId === null)
			const isActiveNested = activeLayer.parentLayerId !== null

			if (!isActiveNested) {
				const isOverChild = overLayer.parentLayerId !== null
				const isOverGroup = overLayer.parentLayerId === null && overLayer.objectType === "group"
				const canInsertIntoGroup =
					activeLayer.objectType !== "group" && (isOverChild || isOverGroup)

				if (canInsertIntoGroup) {
					const targetGroupId = overLayer.parentLayerId ?? overLayer.layerId
					const groupLayer = layers.find((layer) => layer.layerId === targetGroupId)
					const group = groupLayer?.object as Group | undefined
					if (group) {
						const maybeGrouped = activeLayer.object as FabricObject & { group?: Group | null }
						if (maybeGrouped.group && maybeGrouped.group !== group) {
							maybeGrouped.group.remove(activeLayer.object)
						}
						canvas.remove(activeLayer.object)

						let insertIndex = group.getObjects?.()?.length ?? 0

						if (isOverChild) {
							const siblings = layers.filter((layer) => layer.parentLayerId === targetGroupId)
							const overDisplayIndex = siblings.findIndex((layer) => layer.layerId === over.id)
							if (overDisplayIndex >= 0) {
								insertIndex = siblings.length - overDisplayIndex
							}
						}

						group.insertAt(insertIndex, activeLayer.object)
						canvas.renderAll()
						incrementLayerVersion()
						markCanvasModified(group)
						return
					}
				}

				const overTopLevelId = overLayer.parentLayerId ?? overLayer.layerId
				const oldDisplayIndex = topLevelLayers.findIndex(
					(layer) => layer.layerId === activeLayer.layerId,
				)
				const newDisplayIndex = topLevelLayers.findIndex(
					(layer) => layer.layerId === overTopLevelId,
				)

				if (oldDisplayIndex === -1 || newDisplayIndex === -1) return

				// Get artboard and user objects separately to preserve artboard z-order
				const allObjects = canvas.getObjects()
				const artboard = allObjects.find((obj) => isArtboard(obj))
				const userObjects = allObjects.filter((obj) => !isArtboard(obj))
				const totalUserObjects = userObjects.length

				// Convert display index (reversed) to actual index within user objects
				// Display: 0 = top (highest index in user objects)
				const actualOldIndex = totalUserObjects - 1 - oldDisplayIndex
				const actualNewIndex = totalUserObjects - 1 - newDisplayIndex

				const obj = userObjects[actualOldIndex]
				if (!obj) return

				// Create new order by removing and reinserting
				const reorderedUserObjects = [...userObjects]
				reorderedUserObjects.splice(actualOldIndex, 1)
				reorderedUserObjects.splice(actualNewIndex, 0, obj)

				// Clear canvas and rebuild: artboard first (at back), then user objects
				canvas.remove(...allObjects)
				if (artboard) {
					canvas.add(artboard)
				}
				for (const o of reorderedUserObjects) {
					canvas.add(o)
				}

				canvas.renderAll()
				incrementLayerVersion()
				return
			}

			const parentLayerId = activeLayer.parentLayerId
			if (!parentLayerId) return

			const isSameParent = overLayer.parentLayerId === parentLayerId
			if (isSameParent) {
				const groupLayer = layers.find((layer) => layer.layerId === parentLayerId)
				const group = groupLayer?.object as Group | undefined
				if (!group) return

				const siblings = layers.filter((layer) => layer.parentLayerId === parentLayerId)
				const oldDisplayIndex = siblings.findIndex((layer) => layer.layerId === active.id)
				const newDisplayIndex = siblings.findIndex((layer) => layer.layerId === over.id)
				if (oldDisplayIndex === -1 || newDisplayIndex === -1) return

				const totalChildren = siblings.length
				const actualNewIndex = totalChildren - 1 - newDisplayIndex

				group.moveObjectTo(activeLayer.object, actualNewIndex)
				canvas.renderAll()
				incrementLayerVersion()
				markCanvasModified(group)
				return
			}

			const isOverChild = overLayer.parentLayerId !== null
			const isOverGroup = overLayer.parentLayerId === null && overLayer.objectType === "group"
			const canInsertIntoGroup = activeLayer.objectType !== "group" && (isOverChild || isOverGroup)

			if (canInsertIntoGroup) {
				const targetGroupId = overLayer.parentLayerId ?? overLayer.layerId
				const targetGroupLayer = layers.find((layer) => layer.layerId === targetGroupId)
				const targetGroup = targetGroupLayer?.object as Group | undefined
				if (!targetGroup) return

				const sourceGroupLayer = layers.find((layer) => layer.layerId === parentLayerId)
				const sourceGroup = sourceGroupLayer?.object as Group | undefined
				if (!sourceGroup) return

				sourceGroup.remove(activeLayer.object)
				const remainingChildren = sourceGroup.getObjects?.() ?? []
				if (remainingChildren.length === 0 && sourceGroup.canvas) {
					canvas.remove(sourceGroup)
				}

				let insertIndex = targetGroup.getObjects?.()?.length ?? 0

				if (isOverChild) {
					const siblings = layers.filter((layer) => layer.parentLayerId === targetGroupId)
					const overDisplayIndex = siblings.findIndex((layer) => layer.layerId === over.id)
					if (overDisplayIndex >= 0) {
						insertIndex = siblings.length - overDisplayIndex
					}
				}

				targetGroup.insertAt(insertIndex, activeLayer.object)
				canvas.renderAll()
				incrementLayerVersion()
				markCanvasModified(targetGroup)
				return
			}

			const groupLayer = layers.find((layer) => layer.layerId === parentLayerId)
			const group = groupLayer?.object as Group | undefined
			if (!group) return

			const overIndex = layers.findIndex((layer) => layer.layerId === over.id)
			if (overIndex === -1) return

			const topLevelBeforeDrop = layers
				.slice(0, overIndex)
				.filter((layer) => layer.parentLayerId === null).length

			const groupTopIndex = topLevelLayers.findIndex((layer) => layer.layerId === parentLayerId)

			group.remove(activeLayer.object)
			const remainingChildren = group.getObjects?.() ?? []
			const shouldRemoveGroup = remainingChildren.length === 0
			if (shouldRemoveGroup && group.canvas) {
				canvas.remove(group)
			}

			const nextTopLevelLayers = shouldRemoveGroup
				? topLevelLayers.filter((layer) => layer.layerId !== parentLayerId)
				: topLevelLayers

			let targetTopLevelIndex = topLevelBeforeDrop
			if (shouldRemoveGroup && groupTopIndex !== -1 && groupTopIndex < targetTopLevelIndex) {
				targetTopLevelIndex -= 1
			}

			const displayTopLevelObjects = nextTopLevelLayers.map((layer) => layer.object)
			const clampedIndex = Math.max(0, Math.min(targetTopLevelIndex, displayTopLevelObjects.length))
			displayTopLevelObjects.splice(clampedIndex, 0, activeLayer.object)

			const actualOrder = [...displayTopLevelObjects].reverse()

			const allObjects = canvas.getObjects()
			const artboard = allObjects.find((obj) => isArtboard(obj))
			canvas.remove(...allObjects)
			if (artboard) {
				canvas.add(artboard)
			}
			for (const obj of actualOrder) {
				canvas.add(obj)
			}

			canvas.renderAll()
			incrementLayerVersion()
		},
		[canvas, layers, incrementLayerVersion, markCanvasModified],
	)

	const handleSelectLayer = useCallback(
		(layer: LayerInfo, event: React.MouseEvent) => {
			if (!canvas) return

			// Check for modifier keys:
			// - Ctrl (Windows/Linux) or Cmd (⌘) on Mac for toggle selection
			// - Shift for range selection
			const isMultiSelectKey = event.ctrlKey || event.metaKey
			const isRangeSelectKey = event.shiftKey

			if (isMultiSelectKey) {
				// Toggle selection with Ctrl/Cmd + click
				const nextSelected = new Set(selectedLayerIdSet)
				if (nextSelected.has(layer.layerId)) {
					nextSelected.delete(layer.layerId)
				} else {
					nextSelected.add(layer.layerId)
				}
				setSelectedLayerIdSet(nextSelected)

				// Update Fabric.js canvas
				if (nextSelected.size === 0) {
					canvas.discardActiveObject()
				} else {
					const selectedLayers = layers.filter((l) => nextSelected.has(l.layerId))
					const objects = selectedLayers.map((l) => l.object)
					const selection = new ActiveSelection(objects, { canvas })
					canvas.setActiveObject(selection)
				}
				event.preventDefault()
			} else if (isRangeSelectKey && lastSelectedIndex !== null) {
				// Range selection with Shift + click
				const currentIndex = layers.findIndex((l) => l.layerId === layer.layerId)
				if (currentIndex !== -1) {
					const start = Math.min(lastSelectedIndex, currentIndex)
					const end = Math.max(lastSelectedIndex, currentIndex)
					const range = layers.slice(start, end + 1)
					const nextSelected = new Set(range.map((l) => l.layerId))
					setSelectedLayerIdSet(nextSelected)

					// Update Fabric.js canvas
					const selectedLayers = layers.filter((l) => nextSelected.has(l.layerId))
					const objects = selectedLayers.map((l) => l.object)
					const selection = new ActiveSelection(objects, { canvas })
					canvas.setActiveObject(selection)
				}
				event.preventDefault()
			} else {
				// Plain click: clear and select single
				setSelectedLayerIdSet(new Set([layer.layerId]))
				setLastSelectedIndex(layers.findIndex((l) => l.layerId === layer.layerId))

				// Try selecting the layer directly
				const prevActive = canvas.getActiveObject()
				canvas.setActiveObject(layer.object)
				const newActive = canvas.getActiveObject()

				// If selection didn't change and layer is nested, try selecting parent group
				if (prevActive === newActive && layer.parentLayerId) {
					const parent = layers.find((item) => item.layerId === layer.parentLayerId)
					if (parent) {
						canvas.setActiveObject(parent.object)
					}
				}
			}

			canvas.renderAll()
		},
		[canvas, layers, selectedLayerIdSet, lastSelectedIndex],
	)

	const handleToggleVisibility = useCallback(
		(layer: LayerInfo) => {
			if (!canvas) return
			layer.object.set("visible", !layer.object.visible)
			canvas.renderAll()
			incrementLayerVersion()
			markCanvasModified(layer.object)
		},
		[canvas, incrementLayerVersion, markCanvasModified],
	)

	const handleDeleteLayer = useCallback(
		(layer: LayerInfo) => {
			if (!canvas) return

			if (layer.parentLayerId === null) {
				canvas.remove(layer.object)
				canvas.discardActiveObject()
				canvas.renderAll()
				return
			}

			const groupLayer = layers.find((item) => item.layerId === layer.parentLayerId)
			const group = groupLayer?.object as Group | undefined
			if (!group) return

			group.remove(layer.object)
			const remainingChildren = group.getObjects?.() ?? []
			if (remainingChildren.length === 0 && group.canvas) {
				canvas.remove(group)
			}

			canvas.discardActiveObject()
			canvas.renderAll()
			incrementLayerVersion()
			if (group.canvas) {
				markCanvasModified(group)
			}
		},
		[canvas, layers, incrementLayerVersion, markCanvasModified],
	)

	const handleDuplicateLayer = useCallback(
		async (layer: LayerInfo) => {
			if (!canvas) return
			if (layer.parentLayerId !== null) return

			const cloned = await layer.object.clone()

			// CRITICAL: Clear inherited layer properties so object:added assigns fresh ones
			// Clone copies all properties including layerId/layerName from the original
			;(cloned as typeof cloned & { layerId?: string }).layerId = undefined
			;(cloned as typeof cloned & { layerName?: string }).layerName = undefined

			// Offset the clone slightly
			cloned.set({
				left: (cloned.left || 0) + 20,
				top: (cloned.top || 0) + 20,
			})
			canvas.add(cloned)
			canvas.setActiveObject(cloned)
			canvas.renderAll()
		},
		[canvas],
	)

	const groupIdsWithChildren = useMemo(() => {
		const ids = new Set<string>()
		for (const layer of layers) {
			if (layer.parentLayerId) {
				ids.add(layer.parentLayerId)
			}
		}
		return ids
	}, [layers])

	const visibleLayers = useMemo(
		() =>
			layers.filter(
				(layer) => layer.parentLayerId === null || !collapsedGroups.has(layer.parentLayerId),
			),
		[layers, collapsedGroups],
	)

	const handleToggleGroup = useCallback((layerId: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(layerId)) {
				next.delete(layerId)
			} else {
				next.add(layerId)
			}
			return next
		})
	}, [])

	if (layers.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4">
				<EmptyState
					icon={<Layers className="h-5 w-5" />}
					title="No layers"
					description="Add shapes or text from the toolbar to create layers"
				/>
			</div>
		)
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext
				items={visibleLayers.map((layer) => layer.layerId)}
				strategy={verticalListSortingStrategy}
			>
				<div className="flex flex-col">
					{visibleLayers.map((layer) => (
						<LayerItem
							key={layer.layerId}
							layer={layer}
							isSelected={selectedLayerIdSet.has(layer.layerId)}
							onSelect={(event) => handleSelectLayer(layer, event)}
							onToggleVisibility={() => handleToggleVisibility(layer)}
							onDelete={() => handleDeleteLayer(layer)}
							onDuplicate={() => handleDuplicateLayer(layer)}
							canDuplicate={layer.parentLayerId === null}
							showGroupToggle={
								layer.parentLayerId === null &&
								layer.objectType === "group" &&
								groupIdsWithChildren.has(layer.layerId)
							}
							isGroupExpanded={!collapsedGroups.has(layer.layerId)}
							onToggleGroup={() => handleToggleGroup(layer.layerId)}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}
