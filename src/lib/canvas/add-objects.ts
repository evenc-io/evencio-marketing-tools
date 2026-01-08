import { type Canvas, Circle, IText, Rect, Triangle } from "fabric"
import { CANVAS_PADDING } from "@/lib/constants/canvas"

const DEFAULT_OFFSET = 100
const DEFAULT_FILL = "#e5e5e5"
const DEFAULT_STROKE = "#a3a3a3"
const DEFAULT_STROKE_WIDTH = 1

const DEFAULT_TEXT_COLOR = "#171717"
const DEFAULT_FONT_SIZE = 32
const DEFAULT_FONT_FAMILY = "Inter"

function getDefaultPosition() {
	return {
		left: CANVAS_PADDING + DEFAULT_OFFSET,
		top: CANVAS_PADDING + DEFAULT_OFFSET,
	}
}

/**
 * Add a new editable text object to the canvas at a default position.
 */
export function addTextToCanvas(canvas: Canvas): void {
	const { left, top } = getDefaultPosition()
	// Fabric 7 defaults to center origin; we need left/top for consistent positioning
	const text = new IText("Edit this text", {
		left,
		top,
		fontSize: DEFAULT_FONT_SIZE,
		fontFamily: DEFAULT_FONT_FAMILY,
		fill: DEFAULT_TEXT_COLOR,
		originX: "left",
		originY: "top",
	})

	canvas.add(text)
	canvas.setActiveObject(text)
	canvas.renderAll()
}

/**
 * Add a new rectangle object to the canvas at a default position.
 */
export function addRectToCanvas(canvas: Canvas): void {
	const { left, top } = getDefaultPosition()
	// Fabric 7 defaults to center origin; we need left/top for consistent positioning
	const rect = new Rect({
		left,
		top,
		width: 200,
		height: 150,
		fill: DEFAULT_FILL,
		stroke: DEFAULT_STROKE,
		strokeWidth: DEFAULT_STROKE_WIDTH,
		originX: "left",
		originY: "top",
	})

	canvas.add(rect)
	canvas.setActiveObject(rect)
	canvas.renderAll()
}

/**
 * Add a new circle object to the canvas at a default position.
 */
export function addCircleToCanvas(canvas: Canvas): void {
	const { left, top } = getDefaultPosition()
	// Fabric 7 defaults to center origin; we need left/top for consistent positioning
	const circle = new Circle({
		left,
		top,
		radius: 75,
		fill: DEFAULT_FILL,
		stroke: DEFAULT_STROKE,
		strokeWidth: DEFAULT_STROKE_WIDTH,
		originX: "left",
		originY: "top",
	})

	canvas.add(circle)
	canvas.setActiveObject(circle)
	canvas.renderAll()
}

/**
 * Add a new triangle object to the canvas at a default position.
 */
export function addTriangleToCanvas(canvas: Canvas): void {
	const { left, top } = getDefaultPosition()
	// Fabric 7 defaults to center origin; we need left/top for consistent positioning
	const triangle = new Triangle({
		left,
		top,
		width: 150,
		height: 130,
		fill: DEFAULT_FILL,
		stroke: DEFAULT_STROKE,
		strokeWidth: DEFAULT_STROKE_WIDTH,
		originX: "left",
		originY: "top",
	})

	canvas.add(triangle)
	canvas.setActiveObject(triangle)
	canvas.renderAll()
}
