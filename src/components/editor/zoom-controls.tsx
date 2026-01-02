import { Hand, Maximize, Minus, Plus } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"
import { MAX_ZOOM, MIN_ZOOM, useViewportStore } from "@/stores/viewport-store"

export function ZoomControls() {
	const containerRef = useRef<HTMLDivElement | null>(null)

	const dimensions = useEditorStore((s) => s.dimensions)

	const zoom = useViewportStore((s) => s.zoom)
	const zoomIn = useViewportStore((s) => s.zoomIn)
	const zoomOut = useViewportStore((s) => s.zoomOut)
	const fitToScreen = useViewportStore((s) => s.fitToScreen)
	const isPanning = useViewportStore((s) => s.isPanning)
	const togglePanning = useViewportStore((s) => s.togglePanning)

	// Store reference to viewport container for fit calculation
	useEffect(() => {
		// Find the viewport container by traversing up
		const viewport = document.querySelector("[data-viewport-container]")
		if (viewport instanceof HTMLDivElement) {
			containerRef.current = viewport
		}
	}, [])

	const handleFit = useCallback(() => {
		if (containerRef.current) {
			const { clientWidth, clientHeight } = containerRef.current
			fitToScreen(clientWidth, clientHeight, dimensions.width, dimensions.height)
		} else {
			// Fallback: estimate from window dimensions
			const containerWidth = window.innerWidth - 400
			const containerHeight = window.innerHeight - 200
			fitToScreen(containerWidth, containerHeight, dimensions.width, dimensions.height)
		}
	}, [dimensions.width, dimensions.height, fitToScreen])

	const zoomPercent = Math.round(zoom * 100)

	// Detect if on Mac for keyboard hint
	const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
	const zoomHint = isMac ? "⌘+scroll or pinch" : "Ctrl+scroll"
	const panHint = isMac ? "Two-finger scroll or Space+drag" : "Two-finger scroll or Space+drag"

	return (
		<div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
			{/* Pan mode toggle */}
			<Button
				variant={isPanning ? "default" : "ghost"}
				size="icon"
				onClick={togglePanning}
				title={`Pan Mode (${panHint})`}
				className={cn(
					"h-7 w-7",
					isPanning && "bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white",
				)}
			>
				<Hand className="h-3.5 w-3.5" />
			</Button>

			<div className="mx-0.5 h-4 w-px bg-neutral-200" />

			<Button
				variant="ghost"
				size="icon"
				onClick={zoomOut}
				disabled={zoom <= MIN_ZOOM}
				title={`Zoom Out (${zoomHint})`}
				className="h-7 w-7"
			>
				<Minus className="h-3.5 w-3.5" />
			</Button>

			<span className="min-w-[3.5rem] text-center text-xs tabular-nums">{zoomPercent}%</span>

			<Button
				variant="ghost"
				size="icon"
				onClick={zoomIn}
				disabled={zoom >= MAX_ZOOM}
				title={`Zoom In (${zoomHint})`}
				className="h-7 w-7"
			>
				<Plus className="h-3.5 w-3.5" />
			</Button>

			<div className="mx-0.5 h-4 w-px bg-neutral-200" />

			<Button
				variant="ghost"
				size="icon"
				onClick={handleFit}
				title="Fit to Screen"
				className="h-7 w-7"
			>
				<Maximize className="h-3.5 w-3.5" />
			</Button>
		</div>
	)
}
