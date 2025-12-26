import type { Canvas, FabricObject } from "fabric"
import { useEffect, useState } from "react"
import { isArtboard } from "@/lib/artboard"
import { getLayerId, getLayerName } from "@/lib/layers"

export interface ObjectInfo {
	/** The Fabric.js object */
	object: FabricObject
	/** Layer ID if present */
	layerId: string | null
	/** Layer name if present */
	layerName: string | null
	/** Object dimensions in design space (artboard coordinates) */
	width: number
	height: number
	/** Distance from object edges to artboard edges (in design space) */
	distanceTop: number
	distanceRight: number
	distanceBottom: number
	distanceLeft: number
	/** Object position and size in design space (for positioning overlay elements) */
	designRect: {
		top: number
		left: number
		width: number
		height: number
	}
	/** Object position in screen space (for positioning DOM overlay) */
	screenRect: {
		top: number
		left: number
		width: number
		height: number
	}
}

export interface ObjectGap {
	/** Horizontal gap between objects (0 if overlapping horizontally) */
	horizontalGap: number
	/** Vertical gap between objects (0 if overlapping vertically) */
	verticalGap: number
	/** Line positioning for horizontal gap line (screen coordinates) */
	horizontalLine: {
		x1: number
		x2: number
		y: number
	} | null
	/** Line positioning for vertical gap line (screen coordinates) */
	verticalLine: {
		y1: number
		y2: number
		x: number
	} | null
	/** When true, objects are diagonally separated - use L-shape connector */
	isDiagonal: boolean
}

/**
 * Calculates edge-to-edge gaps between two objects.
 * Returns horizontal and vertical gaps with line positions for rendering.
 */
export function calculateObjectGap(
	rect1: ObjectInfo["designRect"],
	rect2: ObjectInfo["designRect"],
	screenRect1: ObjectInfo["screenRect"],
	screenRect2: ObjectInfo["screenRect"],
): ObjectGap {
	// Object 1 edges (design space for gap values)
	const left1 = rect1.left
	const right1 = rect1.left + rect1.width
	const top1 = rect1.top
	const bottom1 = rect1.top + rect1.height

	// Object 2 edges (design space for gap values)
	const left2 = rect2.left
	const right2 = rect2.left + rect2.width
	const top2 = rect2.top
	const bottom2 = rect2.top + rect2.height

	// Screen coordinates for line positioning
	const sLeft1 = screenRect1.left
	const sRight1 = screenRect1.left + screenRect1.width
	const sTop1 = screenRect1.top
	const sBottom1 = screenRect1.top + screenRect1.height

	const sLeft2 = screenRect2.left
	const sRight2 = screenRect2.left + screenRect2.width
	const sTop2 = screenRect2.top
	const sBottom2 = screenRect2.top + screenRect2.height

	// Check horizontal separation
	const hasHorizontalGap = right1 <= left2 || right2 <= left1
	// Check vertical separation
	const hasVerticalGap = bottom1 <= top2 || bottom2 <= top1

	// Diagonal = both gaps exist
	const isDiagonal = hasHorizontalGap && hasVerticalGap

	let horizontalGap = 0
	let horizontalLine: ObjectGap["horizontalLine"] = null
	let verticalGap = 0
	let verticalLine: ObjectGap["verticalLine"] = null

	if (isDiagonal) {
		// L-shape connector
		const obj1IsLeft = right1 <= left2
		const obj1IsAbove = bottom1 <= top2

		if (obj1IsLeft && obj1IsAbove) {
			horizontalGap = left2 - right1
			verticalGap = top2 - bottom1
			horizontalLine = { x1: sRight1, x2: sLeft2, y: sBottom1 }
			verticalLine = { y1: sBottom1, y2: sTop2, x: sLeft2 }
		} else if (obj1IsLeft && !obj1IsAbove) {
			horizontalGap = left2 - right1
			verticalGap = top1 - bottom2
			horizontalLine = { x1: sRight1, x2: sLeft2, y: sTop1 }
			verticalLine = { y1: sBottom2, y2: sTop1, x: sLeft2 }
		} else if (!obj1IsLeft && obj1IsAbove) {
			horizontalGap = left1 - right2
			verticalGap = top2 - bottom1
			horizontalLine = { x1: sRight2, x2: sLeft1, y: sBottom1 }
			verticalLine = { y1: sBottom1, y2: sTop2, x: sRight2 }
		} else {
			horizontalGap = left1 - right2
			verticalGap = top1 - bottom2
			horizontalLine = { x1: sRight2, x2: sLeft1, y: sTop1 }
			verticalLine = { y1: sBottom2, y2: sTop1, x: sRight2 }
		}
	} else {
		if (hasHorizontalGap) {
			if (right1 <= left2) {
				horizontalGap = left2 - right1
				const y = (Math.max(sTop1, sTop2) + Math.min(sBottom1, sBottom2)) / 2
				horizontalLine = { x1: sRight1, x2: sLeft2, y }
			} else if (right2 <= left1) {
				horizontalGap = left1 - right2
				const y = (Math.max(sTop1, sTop2) + Math.min(sBottom1, sBottom2)) / 2
				horizontalLine = { x1: sRight2, x2: sLeft1, y }
			}
		}

		if (hasVerticalGap) {
			if (bottom1 <= top2) {
				verticalGap = top2 - bottom1
				const x = (Math.max(sLeft1, sLeft2) + Math.min(sRight1, sRight2)) / 2
				verticalLine = { y1: sBottom1, y2: sTop2, x }
			} else if (bottom2 <= top1) {
				verticalGap = top1 - bottom2
				const x = (Math.max(sLeft1, sLeft2) + Math.min(sRight1, sRight2)) / 2
				verticalLine = { y1: sBottom2, y2: sTop1, x }
			}
		}
	}

	return {
		horizontalGap: Math.round(horizontalGap),
		verticalGap: Math.round(verticalGap),
		horizontalLine,
		verticalLine,
		isDiagonal,
	}
}

export interface ArtboardScreenRect {
	top: number
	left: number
	width: number
	height: number
}

export interface CanvasInspectState {
	/** Currently hovered object info */
	hoveredInfo: ObjectInfo | null
	/** Currently selected object info (from Fabric.js selection) */
	selectedInfo: ObjectInfo | null
	/** Artboard position in screen coordinates (for edge distance lines) */
	artboardScreenRect: ArtboardScreenRect | null
}

interface UseCanvasInspectOptions {
	canvas: Canvas | null
	enabled: boolean
	artboardWidth: number
	artboardHeight: number
	canvasPadding: number
}

/**
 * Gets object info from a Fabric.js object.
 * All design values are in artboard coordinate space.
 */
function getObjectInfo(
	object: FabricObject,
	canvas: Canvas,
	artboardWidth: number,
	artboardHeight: number,
	canvasPadding: number,
): ObjectInfo {
	const bounds = object.getBoundingRect()
	const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
	const zoom = vpt[0]
	const panX = vpt[4]
	const panY = vpt[5]

	// Convert canvas coordinates to design space (relative to artboard)
	// Object bounds are in canvas coordinates, artboard starts at canvasPadding
	const designLeft = bounds.left - canvasPadding
	const designTop = bounds.top - canvasPadding
	const designWidth = bounds.width
	const designHeight = bounds.height

	// Screen coordinates for overlay positioning
	// Apply viewport transform: screen = canvas * zoom + pan
	const screenLeft = bounds.left * zoom + panX
	const screenTop = bounds.top * zoom + panY
	const screenWidth = bounds.width * zoom
	const screenHeight = bounds.height * zoom

	return {
		object,
		layerId: getLayerId(object) ?? null,
		layerName: getLayerName(object) ?? null,
		width: Math.round(designWidth),
		height: Math.round(designHeight),
		distanceTop: Math.round(designTop),
		distanceRight: Math.round(artboardWidth - designLeft - designWidth),
		distanceBottom: Math.round(artboardHeight - designTop - designHeight),
		distanceLeft: Math.round(designLeft),
		designRect: {
			top: designTop,
			left: designLeft,
			width: designWidth,
			height: designHeight,
		},
		screenRect: {
			top: screenTop,
			left: screenLeft,
			width: screenWidth,
			height: screenHeight,
		},
	}
}

/**
 * Hook that tracks hover and selection within a Fabric.js canvas.
 * Returns information about hovered and selected objects including
 * dimensions and distances to artboard edges.
 *
 * All dimension values are in the artboard coordinate system.
 */
/**
 * Calculates the artboard's position in screen coordinates.
 */
function getArtboardScreenRect(
	canvas: Canvas,
	artboardWidth: number,
	artboardHeight: number,
	canvasPadding: number,
): ArtboardScreenRect {
	const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
	const zoom = vpt[0]
	const panX = vpt[4]
	const panY = vpt[5]

	// Artboard is at (canvasPadding, canvasPadding) in canvas coordinates
	return {
		top: canvasPadding * zoom + panY,
		left: canvasPadding * zoom + panX,
		width: artboardWidth * zoom,
		height: artboardHeight * zoom,
	}
}

export function useCanvasInspect({
	canvas,
	enabled,
	artboardWidth,
	artboardHeight,
	canvasPadding,
}: UseCanvasInspectOptions): CanvasInspectState {
	const [hoveredInfo, setHoveredInfo] = useState<ObjectInfo | null>(null)
	const [selectedInfo, setSelectedInfo] = useState<ObjectInfo | null>(null)
	const [artboardScreenRect, setArtboardScreenRect] = useState<ArtboardScreenRect | null>(null)

	// Update all screen positions when canvas viewport changes (zoom/pan)
	useEffect(() => {
		if (!canvas || !enabled) {
			setArtboardScreenRect(null)
			return
		}

		const updateScreenPositions = () => {
			// Update artboard screen rect
			setArtboardScreenRect(
				getArtboardScreenRect(canvas, artboardWidth, artboardHeight, canvasPadding),
			)

			// Recalculate hovered object's screen position (object reference unchanged)
			setHoveredInfo((prev) => {
				if (!prev) return null
				return getObjectInfo(prev.object, canvas, artboardWidth, artboardHeight, canvasPadding)
			})

			// Recalculate selected object's screen position (object reference unchanged)
			setSelectedInfo((prev) => {
				if (!prev) return null
				return getObjectInfo(prev.object, canvas, artboardWidth, artboardHeight, canvasPadding)
			})
		}

		// Initial calculation
		updateScreenPositions()

		// Listen for viewport changes (zoom/pan)
		canvas.on("after:render", updateScreenPositions)

		return () => {
			canvas.off("after:render", updateScreenPositions)
		}
	}, [canvas, enabled, artboardWidth, artboardHeight, canvasPadding])

	// Update selected info when Fabric.js selection changes
	useEffect(() => {
		if (!canvas || !enabled) {
			setSelectedInfo(null)
			return
		}

		const updateSelected = () => {
			const activeObject = canvas.getActiveObject()
			if (activeObject && !isArtboard(activeObject)) {
				setSelectedInfo(
					getObjectInfo(activeObject, canvas, artboardWidth, artboardHeight, canvasPadding),
				)
			} else {
				setSelectedInfo(null)
			}
		}

		// Initial check
		updateSelected()

		// Listen for selection changes
		canvas.on("selection:created", updateSelected)
		canvas.on("selection:updated", updateSelected)
		canvas.on("selection:cleared", () => setSelectedInfo(null))
		canvas.on("object:modified", updateSelected)

		return () => {
			canvas.off("selection:created", updateSelected)
			canvas.off("selection:updated", updateSelected)
			canvas.off("selection:cleared")
			canvas.off("object:modified", updateSelected)
		}
	}, [canvas, enabled, artboardWidth, artboardHeight, canvasPadding])

	// Handle mouse hover using Fabric.js mouse events (handles coordinate conversion)
	useEffect(() => {
		if (!canvas || !enabled) {
			setHoveredInfo(null)
			return
		}

		const handleMouseMove = (opt: {
			e: MouseEvent | TouchEvent
			scenePoint?: { x: number; y: number }
		}) => {
			// Use Fabric.js's already-converted pointer coordinates
			const pointer = opt.scenePoint || canvas.getScenePoint(opt.e)
			if (!pointer) {
				setHoveredInfo(null)
				return
			}

			// Find object at point (in canvas coordinates)
			const objects = canvas.getObjects()
			let foundObject: FabricObject | null = null

			// Search from top to bottom (reverse order)
			for (let i = objects.length - 1; i >= 0; i--) {
				const obj = objects[i]
				if (isArtboard(obj)) continue
				if (!obj.visible) continue

				const bounds = obj.getBoundingRect()
				if (
					pointer.x >= bounds.left &&
					pointer.x <= bounds.left + bounds.width &&
					pointer.y >= bounds.top &&
					pointer.y <= bounds.top + bounds.height
				) {
					foundObject = obj
					break
				}
			}

			if (!foundObject) {
				setHoveredInfo(null)
				return
			}

			// Don't show hover for the selected object
			const activeObject = canvas.getActiveObject()
			if (activeObject && foundObject === activeObject) {
				setHoveredInfo(null)
				return
			}

			setHoveredInfo(
				getObjectInfo(foundObject, canvas, artboardWidth, artboardHeight, canvasPadding),
			)
		}

		const handleMouseOut = () => {
			setHoveredInfo(null)
		}

		canvas.on("mouse:move", handleMouseMove)
		canvas.on("mouse:out", handleMouseOut)

		return () => {
			canvas.off("mouse:move", handleMouseMove)
			canvas.off("mouse:out", handleMouseOut)
		}
	}, [canvas, enabled, artboardWidth, artboardHeight, canvasPadding])

	// Clear state when disabled
	useEffect(() => {
		if (!enabled) {
			setHoveredInfo(null)
			setSelectedInfo(null)
		}
	}, [enabled])

	return {
		hoveredInfo: enabled ? hoveredInfo : null,
		selectedInfo: enabled ? selectedInfo : null,
		artboardScreenRect: enabled ? artboardScreenRect : null,
	}
}
