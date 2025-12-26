import type { Canvas } from "fabric"
import { CANVAS_PADDING } from "@/lib/constants/canvas"

/** Maximum dimension for thumbnails (width or height) */
const THUMBNAIL_MAX_SIZE = 200

/** JPEG quality for thumbnails (0-1, lower = smaller file) */
const THUMBNAIL_QUALITY = 0.3

/**
 * Generate a thumbnail data URL from a Fabric.js canvas.
 * Returns a low-quality JPEG scaled to fit within THUMBNAIL_MAX_SIZE.
 * Only captures the artboard area (excluding canvas padding).
 */
export function generateThumbnail(canvas: Canvas): string | null {
	const identityVT: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]
	const currentVT = canvas.viewportTransform?.slice() as typeof identityVT | undefined
	try {
		const canvasStatus = canvas as unknown as {
			disposed?: boolean
			destroyed?: boolean
			contextContainer?: CanvasRenderingContext2D | null
			lowerCanvasEl?: HTMLCanvasElement | null
			getElement?: () => HTMLCanvasElement | null
		}
		if (canvasStatus.disposed || canvasStatus.destroyed) {
			return null
		}
		const hasContext = Boolean(canvasStatus.contextContainer)
		const canvasElement =
			typeof canvasStatus.getElement === "function"
				? canvasStatus.getElement()
				: canvasStatus.lowerCanvasEl
		const hasElement = Boolean(canvasElement)
		if (!hasContext || !hasElement) {
			return null
		}

		// Normalize viewport to avoid pan/zoom shifts in thumbnails
		canvas.setViewportTransform(identityVT)
		canvas.renderAll()

		const canvasWidth = canvas.getWidth()
		const canvasHeight = canvas.getHeight()

		if (canvasWidth === 0 || canvasHeight === 0) {
			return null
		}

		// Calculate artboard dimensions (canvas minus padding on both sides)
		const artboardWidth = canvasWidth - CANVAS_PADDING * 2
		const artboardHeight = canvasHeight - CANVAS_PADDING * 2

		if (artboardWidth <= 0 || artboardHeight <= 0) {
			return null
		}

		// Calculate scale to fit within max size
		const scale = Math.min(
			THUMBNAIL_MAX_SIZE / artboardWidth,
			THUMBNAIL_MAX_SIZE / artboardHeight,
			1,
		)

		const retinaScale =
			"getRetinaScaling" in canvas && typeof canvas.getRetinaScaling === "function"
				? canvas.getRetinaScaling()
				: 1

		const tempCanvas = document.createElement("canvas")
		tempCanvas.width = artboardWidth * scale
		tempCanvas.height = artboardHeight * scale

		const ctx = tempCanvas.getContext("2d")
		if (!ctx || !canvasElement) {
			return null
		}

		// Draw only the artboard area (crop out padding), accounting for retina scaling
		ctx.drawImage(
			canvasElement,
			CANVAS_PADDING * retinaScale,
			CANVAS_PADDING * retinaScale,
			artboardWidth * retinaScale,
			artboardHeight * retinaScale,
			0,
			0,
			artboardWidth * scale,
			artboardHeight * scale,
		)

		return tempCanvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY)
	} catch (error) {
		console.error("[Thumbnail] Failed to generate thumbnail:", error)
		return null
	} finally {
		if (currentVT) {
			canvas.setViewportTransform(currentVT)
			canvas.renderAll()
		}
	}
}

/**
 * Generate a thumbnail from serialized canvas JSON.
 * Creates a temporary canvas, loads the JSON, generates thumbnail, then disposes.
 * This is more expensive than generateThumbnail but works without an active canvas.
 *
 * @param fabricJSON - The serialized canvas JSON
 * @param width - The document/artboard width (not including canvas padding)
 * @param height - The document/artboard height (not including canvas padding)
 */
export async function generateThumbnailFromJSON(
	fabricJSON: string,
	width: number,
	height: number,
): Promise<string | null> {
	try {
		// Dynamic import to avoid loading Fabric.js at storage layer level
		const { Canvas: FabricCanvas, Rect } = await import("fabric")

		// Canvas size includes padding (same as editor canvas)
		const canvasWidth = width + CANVAS_PADDING * 2
		const canvasHeight = height + CANVAS_PADDING * 2

		// Create temporary canvas element
		const canvasEl = document.createElement("canvas")
		canvasEl.width = canvasWidth
		canvasEl.height = canvasHeight

		// Create Fabric canvas
		const tempCanvas = new FabricCanvas(canvasEl, {
			width: canvasWidth,
			height: canvasHeight,
			renderOnAddRemove: false,
		})

		// Load JSON
		const parsed = JSON.parse(fabricJSON)
		await tempCanvas.loadFromJSON(parsed)

		// Add artboard behind objects for consistent white background
		// Fabric 7 defaults to center origin; we need left/top for consistent positioning
		const artboard = new Rect({
			left: CANVAS_PADDING,
			top: CANVAS_PADDING,
			width,
			height,
			fill: "#ffffff",
			selectable: false,
			evented: false,
			excludeFromExport: false,
			originX: "left",
			originY: "top",
			data: { isArtboard: true },
		})
		tempCanvas.add(artboard)
		tempCanvas.sendObjectToBack(artboard)

		// Ensure dimensions and viewport are normalized
		tempCanvas.setDimensions({ width: canvasWidth, height: canvasHeight })
		tempCanvas.setViewportTransform([1, 0, 0, 1, 0, 0])
		tempCanvas.renderAll()

		// Generate thumbnail (this will crop to artboard area)
		const thumbnail = generateThumbnail(tempCanvas)

		// Cleanup
		tempCanvas.dispose()

		return thumbnail
	} catch (error) {
		console.error("[Thumbnail] Failed to generate from JSON:", error)
		return null
	}
}
