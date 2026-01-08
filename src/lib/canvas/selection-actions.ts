import type { Canvas, Object as FabricObject } from "fabric"
import { Group } from "fabric"
import { isArtboard } from "@/lib/artboard"

const isGroupObject = (obj: FabricObject) => obj.type?.toLowerCase() === "group"

const getActiveUserObjects = (canvas: Canvas) =>
	canvas.getActiveObjects().filter((obj) => !isArtboard(obj))

const getInsertIndex = (
	allObjects: FabricObject[],
	selectionSet: Set<FabricObject>,
	orderedSelection: FabricObject[],
) => {
	const indexMap = new Map<FabricObject, number>()
	allObjects.forEach((obj, index) => {
		indexMap.set(obj, index)
	})

	const topMostIndex = Math.max(...orderedSelection.map((obj) => indexMap.get(obj) ?? 0))
	const remainingObjects = allObjects.filter((obj) => !selectionSet.has(obj))
	const nextAboveIndex = remainingObjects.findIndex(
		(obj) => (indexMap.get(obj) ?? 0) > topMostIndex,
	)

	return nextAboveIndex === -1 ? remainingObjects.length : nextAboveIndex
}

/**
 * Delete the active selection from the canvas (excluding the artboard).
 */
export const deleteSelection = (canvas: Canvas) => {
	const activeObjects = getActiveUserObjects(canvas)
	if (activeObjects.length === 0) return

	for (const obj of activeObjects) {
		canvas.remove(obj)
	}
	canvas.discardActiveObject()
	canvas.renderAll()
}

/**
 * Group the active selection, flattening nested groups when needed (excluding the artboard).
 */
export const groupSelection = (canvas: Canvas) => {
	const activeObjects = getActiveUserObjects(canvas)
	if (activeObjects.length < 2) return

	const allObjects = canvas.getObjects()
	const selectionSet = new Set(activeObjects)
	const orderedSelection = allObjects.filter((obj) => selectionSet.has(obj))
	const insertIndex = getInsertIndex(allObjects, selectionSet, orderedSelection)

	const groupObjects = orderedSelection.filter(isGroupObject)
	const nonGroupObjects = orderedSelection.filter((obj) => !isGroupObject(obj))

	canvas.discardActiveObject()

	if (groupObjects.length === 1 && nonGroupObjects.length > 0) {
		const targetGroup = groupObjects[0] as Group
		const targetIndex = orderedSelection.indexOf(targetGroup)
		const belowGroupObjects = orderedSelection
			.slice(0, targetIndex)
			.filter((obj) => obj !== targetGroup)
		const aboveGroupObjects = orderedSelection
			.slice(targetIndex + 1)
			.filter((obj) => obj !== targetGroup)

		for (const obj of orderedSelection) {
			if (obj.canvas) {
				canvas.remove(obj)
			}
		}

		if (belowGroupObjects.length > 0) {
			targetGroup.insertAt(0, ...belowGroupObjects)
		}
		if (aboveGroupObjects.length > 0) {
			targetGroup.add(...aboveGroupObjects)
		}

		canvas.insertAt(insertIndex, targetGroup)
		canvas.setActiveObject(targetGroup)
		canvas.renderAll()
		return
	}

	const flattenedSelection: FabricObject[] = []
	for (const obj of orderedSelection) {
		if (isGroupObject(obj)) {
			const group = obj as Group
			const children = group.getObjects()
			if (children.length > 0) {
				group.remove(...children)
				flattenedSelection.push(...children)
			}
		} else {
			flattenedSelection.push(obj)
		}
	}

	for (const obj of orderedSelection) {
		if (obj.canvas) {
			canvas.remove(obj)
		}
	}

	if (flattenedSelection.length === 0) {
		canvas.renderAll()
		return
	}

	if (flattenedSelection.length === 1) {
		const solo = flattenedSelection[0]
		canvas.insertAt(insertIndex, solo)
		canvas.setActiveObject(solo)
		canvas.renderAll()
		return
	}

	// Fabric 7 defaults to center origin; we need left/top for consistent positioning
	const newGroup = new Group(flattenedSelection, { originX: "left", originY: "top" })
	canvas.insertAt(insertIndex, newGroup)
	canvas.setActiveObject(newGroup)
	canvas.renderAll()
}

/**
 * Ungroup the selected groups, inserting their children back into the canvas object stack.
 */
export const ungroupSelection = (canvas: Canvas) => {
	const activeObjects = getActiveUserObjects(canvas)
	const selectedGroups = activeObjects.filter(isGroupObject) as Group[]
	if (selectedGroups.length === 0) return

	const allObjects = canvas.getObjects()
	const indexMap = new Map<FabricObject, number>()
	allObjects.forEach((obj, index) => {
		indexMap.set(obj, index)
	})

	const groupsWithIndex = selectedGroups
		.map((group) => ({ group, index: indexMap.get(group) ?? -1 }))
		.filter((entry) => entry.index >= 0)
		.sort((a, b) => b.index - a.index)

	canvas.discardActiveObject()

	for (const { group, index } of groupsWithIndex) {
		const children = group.getObjects()
		if (children.length > 0) {
			group.remove(...children)
		}

		if (group.canvas) {
			canvas.remove(group)
		}

		let insertIndex = index
		for (const obj of children) {
			canvas.insertAt(insertIndex, obj)
			insertIndex += 1
		}
	}

	canvas.renderAll()
}
