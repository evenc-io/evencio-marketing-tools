import { create } from "zustand"
import { CANVAS_PADDING } from "@/lib/constants/canvas"

// Zoom limits
const MIN_ZOOM = 0.1 // 10%
const MAX_ZOOM = 4.0 // 400%
const ZOOM_STEP = 0.1 // 10% per button click

interface ViewportState {
	zoom: number
	panX: number
	panY: number
	isPanning: boolean
	isMiddleMouseDown: boolean
}

interface ViewportActions {
	setZoom: (zoom: number) => void
	zoomIn: () => void
	zoomOut: () => void
	zoomToPoint: (point: { x: number; y: number }, delta: number) => void
	setPan: (x: number, y: number) => void
	relativePan: (dx: number, dy: number) => void
	setIsPanning: (isPanning: boolean) => void
	togglePanning: () => void
	setIsMiddleMouseDown: (isDown: boolean) => void
	fitToScreen: (
		containerWidth: number,
		containerHeight: number,
		docWidth: number,
		docHeight: number,
	) => void
	resetView: () => void
}

const initialState: ViewportState = {
	zoom: 1,
	panX: 0,
	panY: 0,
	isPanning: false,
	isMiddleMouseDown: false,
}

export const useViewportStore = create<ViewportState & ViewportActions>((set, get) => ({
	...initialState,

	setZoom: (zoom) =>
		set({
			zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
		}),

	zoomIn: () => {
		const { zoom } = get()
		set({ zoom: Math.min(MAX_ZOOM, zoom + ZOOM_STEP) })
	},

	zoomOut: () => {
		const { zoom } = get()
		set({ zoom: Math.max(MIN_ZOOM, zoom - ZOOM_STEP) })
	},

	zoomToPoint: (point, delta) => {
		// Zoom toward cursor position
		const { zoom, panX, panY } = get()
		const factor = 0.999 ** delta
		const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor))

		// Adjust pan to keep point stable under cursor
		const zoomRatio = newZoom / zoom
		const newPanX = point.x - (point.x - panX) * zoomRatio
		const newPanY = point.y - (point.y - panY) * zoomRatio

		set({ zoom: newZoom, panX: newPanX, panY: newPanY })
	},

	setPan: (x, y) => set({ panX: x, panY: y }),

	relativePan: (dx, dy) => {
		const { panX, panY } = get()
		set({ panX: panX + dx, panY: panY + dy })
	},

	setIsPanning: (isPanning) => set({ isPanning }),

	togglePanning: () => {
		const { isPanning } = get()
		set({ isPanning: !isPanning })
	},

	setIsMiddleMouseDown: (isDown) => set({ isMiddleMouseDown: isDown }),

	fitToScreen: (containerWidth, containerHeight, docWidth, docHeight) => {
		const viewPadding = 80 // px padding around artboard in viewport
		const availableWidth = containerWidth - viewPadding * 2
		const availableHeight = containerHeight - viewPadding * 2
		const zoom = Math.min(availableWidth / docWidth, availableHeight / docHeight, 1)

		// Center the artboard (accounting for canvas padding offset)
		// The artboard starts at CANVAS_PADDING from the canvas origin
		const panX = (containerWidth - docWidth * zoom) / 2 - CANVAS_PADDING * zoom
		const panY = (containerHeight - docHeight * zoom) / 2 - CANVAS_PADDING * zoom

		set({ zoom, panX, panY })
	},

	resetView: () => set(initialState),
}))

export { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP }
