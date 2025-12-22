import { Canvas as FabricCanvas, Rect, type TMat2D } from "fabric"
import { useCallback, useEffect, useRef } from "react"
import { isArtboard } from "@/lib/artboard"
import { CANVAS_PADDING } from "@/lib/constants/canvas"
import {
	generateLayerId,
	generateLayerName,
	getLayerId,
	getObjectType,
	setLayerId,
	setLayerName,
} from "@/lib/layers"
import { useEditorStore } from "@/stores/editor-store"
import { useViewportStore } from "@/stores/viewport-store"

interface EditorCanvasProps {
	className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const fabricRef = useRef<FabricCanvas | null>(null)

	const dimensions = useEditorStore((s) => s.dimensions)
	const dimensionsRef = useRef(dimensions)
	const projectId = useEditorStore((s) => s.projectId)
	const setCanvas = useEditorStore((s) => s.setCanvas)
	const setSelectedObjects = useEditorStore((s) => s.setSelectedObjects)
	const setIsDirty = useEditorStore((s) => s.setIsDirty)
	const incrementLayerVersion = useEditorStore((s) => s.incrementLayerVersion)
	const layerVersion = useEditorStore((s) => s.layerVersion)

	const isPanning = useViewportStore((s) => s.isPanning)
	const isMiddleMouseDown = useViewportStore((s) => s.isMiddleMouseDown)
	const zoom = useViewportStore((s) => s.zoom)
	const panX = useViewportStore((s) => s.panX)
	const panY = useViewportStore((s) => s.panY)

	useEffect(() => {
		dimensionsRef.current = dimensions
	}, [dimensions])

	const initCanvas = useCallback(() => {
		if (!canvasRef.current || !projectId) return

		// Dispose existing canvas when re-initializing for a new project.
		if (fabricRef.current) {
			void fabricRef.current.dispose().catch(() => {})
		}

		// Canvas size includes padding around the artboard for overflow visibility
		const { width, height } = dimensionsRef.current
		const canvasWidth = width + CANVAS_PADDING * 2
		const canvasHeight = height + CANVAS_PADDING * 2

		// Create canvas with transparent background (grid shows through)
		const canvas = new FabricCanvas(canvasRef.current, {
			width: canvasWidth,
			height: canvasHeight,
			backgroundColor: "transparent",
			preserveObjectStacking: true,
		})

		// Add artboard rect (the white document area)
		const artboard = new Rect({
			left: CANVAS_PADDING,
			top: CANVAS_PADDING,
			width,
			height,
			fill: "#ffffff",
			selectable: false,
			evented: false,
			excludeFromExport: false,
			// Mark as artboard so we can identify it later
			data: { isArtboard: true },
		})
		canvas.add(artboard)
		// Send artboard to back so all other objects render on top
		canvas.sendObjectToBack(artboard)

		// Event listeners
		canvas.on("selection:created", (e) => {
			setSelectedObjects(e.selected ?? [])
		})

		canvas.on("selection:updated", (e) => {
			setSelectedObjects(e.selected ?? [])
		})

		canvas.on("selection:cleared", () => {
			setSelectedObjects([])
		})

		canvas.on("object:modified", () => {
			setIsDirty(true)
		})

		canvas.on("object:added", (e) => {
			const obj = e.target
			if (obj) {
				// Skip artboard - it's not a user-created object
				if (isArtboard(obj)) {
					return
				}

				// Assign layer ID if not present
				if (!getLayerId(obj)) {
					setLayerId(obj, generateLayerId())
				}

				// Assign layer name if not present
				const existingNames = canvas.getObjects().map((o) => {
					const name = (o as typeof o & { layerName?: string }).layerName
					return name || ""
				})
				if (!(obj as typeof obj & { layerName?: string }).layerName) {
					const type = getObjectType(obj)
					setLayerName(obj, generateLayerName(type, existingNames))
				}
			}
			setIsDirty(true)
			incrementLayerVersion()
		})

		canvas.on("object:removed", () => {
			setIsDirty(true)
			incrementLayerVersion()
		})

		// Constrain object movement to canvas bounds (includes padding for overflow)
		canvas.on("object:moving", (e) => {
			const obj = e.target
			if (!obj) return

			// Skip artboard itself
			if (isArtboard(obj)) return

			const bounds = obj.getBoundingRect()
			const canvasWidth = canvas.getWidth()
			const canvasHeight = canvas.getHeight()

			// Calculate offset between object origin and bounding box (handles rotation/scaling)
			const offsetX = (obj.left || 0) - bounds.left
			const offsetY = (obj.top || 0) - bounds.top

			// Calculate valid range for bounding box position (allow pasteboard overflow)
			const minBoundsLeft = 0
			const minBoundsTop = 0
			const maxBoundsLeft = Math.max(minBoundsLeft, canvasWidth - bounds.width)
			const maxBoundsTop = Math.max(minBoundsTop, canvasHeight - bounds.height)

			// Clamp bounds position to valid range
			const clampedBoundsLeft = Math.max(minBoundsLeft, Math.min(maxBoundsLeft, bounds.left))
			const clampedBoundsTop = Math.max(minBoundsTop, Math.min(maxBoundsTop, bounds.top))

			// Only update if position changed (avoids unnecessary setCoords calls)
			if (clampedBoundsLeft !== bounds.left || clampedBoundsTop !== bounds.top) {
				obj.set({
					left: clampedBoundsLeft + offsetX,
					top: clampedBoundsTop + offsetY,
				})
				obj.setCoords()
			}
		})

		fabricRef.current = canvas
		setCanvas(canvas, projectId)

		return () => {
			void canvas.dispose().catch(() => {})
			setCanvas(null, null)
		}
	}, [projectId, setCanvas, setIsDirty, setSelectedObjects, incrementLayerVersion])

	useEffect(() => {
		const cleanup = initCanvas()
		return cleanup
	}, [initCanvas])

	// Keep the existing canvas in sync with dimension changes without re-creating it.
	useEffect(() => {
		const canvas = fabricRef.current
		if (!canvas) return

		const canvasWidth = dimensions.width + CANVAS_PADDING * 2
		const canvasHeight = dimensions.height + CANVAS_PADDING * 2

		if (canvas.getWidth() !== canvasWidth || canvas.getHeight() !== canvasHeight) {
			canvas.setDimensions({ width: canvasWidth, height: canvasHeight })
		}

		const artboard = canvas.getObjects().find(isArtboard)
		if (artboard) {
			artboard.set({
				left: CANVAS_PADDING,
				top: CANVAS_PADDING,
				width: dimensions.width,
				height: dimensions.height,
			})
			artboard.setCoords()
			canvas.sendObjectToBack(artboard)
		}

		canvas.renderAll()
	}, [dimensions.height, dimensions.width])

	// Disable object selection during pan mode
	// biome-ignore lint/correctness/useExhaustiveDependencies: layerVersion triggers re-computation when layers change (e.g., after loadSlideToCanvas)
	useEffect(() => {
		if (!fabricRef.current) return
		const canvas = fabricRef.current
		const isActivePanning = isPanning || isMiddleMouseDown

		canvas.selection = !isActivePanning
		canvas.forEachObject((obj) => {
			// Skip artboard - it should never be selectable or evented
			if (isArtboard(obj)) return

			obj.selectable = !isActivePanning
			obj.evented = !isActivePanning
		})
	}, [isPanning, isMiddleMouseDown, layerVersion])

	// Sync viewport transform to Fabric.js
	// This allows Fabric.js to correctly transform pointer coordinates at any zoom/pan level
	useEffect(() => {
		if (!fabricRef.current) return
		const canvas = fabricRef.current

		// Fabric.js viewport transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
		const viewportTransform: TMat2D = [zoom, 0, 0, zoom, panX, panY]
		canvas.setViewportTransform(viewportTransform)
		canvas.requestRenderAll()
	}, [zoom, panX, panY])

	return (
		<div className={className}>
			<canvas ref={canvasRef} className="block" />
		</div>
	)
}
