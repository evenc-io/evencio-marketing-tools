import type { Canvas, TMat2D } from "fabric"
import { CANVAS_PADDING, DEFAULT_BLEED_PX, DEFAULT_DPI } from "@/lib/constants/canvas"
import type { CanvasDimensions, ExportOptions } from "@/types/editor"

export async function exportCanvas(
	canvas: Canvas,
	dimensions: CanvasDimensions,
	options: ExportOptions,
): Promise<Blob> {
	const { format, quality = 0.92, scale = 1, includeBleed = false } = options
	const bleedPx = includeBleed ? DEFAULT_BLEED_PX : 0
	const exportWidth = dimensions.width + bleedPx * 2
	const exportHeight = dimensions.height + bleedPx * 2

	// Save current viewport transform and reset to 1:1 for export
	const currentVT = canvas.viewportTransform?.slice() as TMat2D | undefined
	const identityVT: TMat2D = [1, 0, 0, 1, 0, 0]
	canvas.setViewportTransform(identityVT)
	canvas.renderAll()

	// Get the canvas element (now rendered at 1:1 scale)
	const canvasElement =
		"getElement" in canvas && typeof canvas.getElement === "function"
			? canvas.getElement()
			: (canvas as Canvas & { lowerCanvasEl?: HTMLCanvasElement }).lowerCanvasEl
	if (!canvasElement) {
		// Restore viewport before throwing
		if (currentVT) {
			canvas.setViewportTransform(currentVT)
			canvas.renderAll()
		}
		throw new Error("Failed to access canvas element")
	}

	// Create a temporary canvas at full resolution
	const tempCanvas = document.createElement("canvas")
	tempCanvas.width = exportWidth * scale
	tempCanvas.height = exportHeight * scale

	const ctx = tempCanvas.getContext("2d")
	if (!ctx) {
		// Restore viewport before throwing
		if (currentVT) {
			canvas.setViewportTransform(currentVT)
			canvas.renderAll()
		}
		throw new Error("Failed to get canvas context")
	}

	// Calculate source offset (artboard starts at CANVAS_PADDING)
	// With identity viewport, zoom is 1.0
	const retinaScale =
		"getRetinaScaling" in canvas && typeof canvas.getRetinaScaling === "function"
			? canvas.getRetinaScaling()
			: 1
	const sourceX = (CANVAS_PADDING - bleedPx) * retinaScale
	const sourceY = (CANVAS_PADDING - bleedPx) * retinaScale
	const sourceWidth = exportWidth * retinaScale
	const sourceHeight = exportHeight * retinaScale

	// Draw the artboard area (optionally including bleed)
	ctx.drawImage(
		canvasElement,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		0,
		0,
		exportWidth * scale,
		exportHeight * scale,
	)

	// Restore viewport transform
	if (currentVT) {
		canvas.setViewportTransform(currentVT)
		canvas.renderAll()
	}

	if (format === "pdf") {
		return exportToPdf(
			tempCanvas,
			{ ...dimensions, width: exportWidth, height: exportHeight },
			scale,
		)
	}

	// Convert to blob
	return new Promise((resolve, reject) => {
		tempCanvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob)
				} else {
					try {
						const mime = format === "jpeg" ? "image/jpeg" : "image/png"
						const dataUrl = tempCanvas.toDataURL(mime, format === "jpeg" ? quality : undefined)
						resolve(dataUrlToBlob(dataUrl))
					} catch (_error) {
						reject(new Error("Failed to create blob"))
					}
				}
			},
			format === "jpeg" ? "image/jpeg" : "image/png",
			format === "jpeg" ? quality : undefined,
		)
	})
}

async function exportToPdf(
	canvas: HTMLCanvasElement,
	dimensions: CanvasDimensions,
	scale: number,
): Promise<Blob> {
	const { width, height } = dimensions
	const { jsPDF } = await import("jspdf")

	// Determine orientation
	const orientation = width > height ? "landscape" : "portrait"

	// Create PDF with dimensions in mm (assuming 300 DPI)
	const dpi = DEFAULT_DPI
	const mmPerInch = 25.4
	const pxPerMm = dpi / mmPerInch

	const widthMm = (width * scale) / pxPerMm
	const heightMm = (height * scale) / pxPerMm

	const pdf = new jsPDF({
		orientation,
		unit: "mm",
		format: [widthMm, heightMm],
	})

	// Add the canvas as an image
	const imgData = canvas.toDataURL("image/png")
	pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm)

	return pdf.output("blob")
}

function dataUrlToBlob(dataUrl: string): Blob {
	const [header, base64] = dataUrl.split(",")
	const mimeMatch = header?.match(/data:(.*?);base64/)
	const mime = mimeMatch?.[1] ?? "application/octet-stream"
	const binary = atob(base64 || "")
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i)
	}
	return new Blob([bytes], { type: mime })
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

export function getFilename(baseName: string, format: ExportOptions["format"]): string {
	const timestamp = new Date().toISOString().slice(0, 10)
	const extension = format === "pdf" ? "pdf" : format === "jpeg" ? "jpg" : "png"
	return `${baseName}-${timestamp}.${extension}`
}
