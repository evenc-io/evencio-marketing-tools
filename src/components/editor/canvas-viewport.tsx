import {
	CircleIcon,
	Group as GroupIcon,
	Plus,
	Scan,
	Square,
	Trash2,
	TriangleIcon,
	Type,
	Ungroup,
} from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	addCircleToCanvas,
	addRectToCanvas,
	addTextToCanvas,
	addTriangleToCanvas,
} from "@/lib/canvas/add-objects"
import { deleteSelection, groupSelection, ungroupSelection } from "@/lib/canvas/selection-actions"
import { CANVAS_PADDING, DEFAULT_BLEED_PX } from "@/lib/constants/canvas"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"
import { useViewportStore } from "@/stores/viewport-store"
import { InspectOverlay } from "./inspect"

interface CanvasViewportProps {
	children: ReactNode
	className?: string
}

// Grid pattern constants
const GRID_DOT_SIZE = 1
const GRID_SPACING = 20

type ContextMenuMode = "selection" | "canvas"

type ContextMenuState = {
	open: boolean
	x: number
	y: number
	selectionCount: number
	hasGroups: boolean
	mode: ContextMenuMode
}

export function CanvasViewport({ children, className }: CanvasViewportProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const lastMousePos = useRef({ x: 0, y: 0 })
	// Track if initial fit has been done to avoid re-fitting on every render
	const hasInitialFit = useRef(false)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const [contextMenu, setContextMenu] = useState<ContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		selectionCount: 0,
		hasGroups: false,
		mode: "canvas",
	})

	const canvas = useEditorStore((s) => s.canvas)
	const dimensions = useEditorStore((s) => s.dimensions)
	const contentType = useEditorStore((s) => s.contentType)
	const inspectMode = useEditorStore((s) => s.inspectMode)
	const toggleInspectMode = useEditorStore((s) => s.toggleInspectMode)
	const previewMode = useEditorStore((s) => s.previewMode)
	const togglePreviewMode = useEditorStore((s) => s.togglePreviewMode)

	const zoom = useViewportStore((s) => s.zoom)
	const panX = useViewportStore((s) => s.panX)
	const panY = useViewportStore((s) => s.panY)
	const isPanning = useViewportStore((s) => s.isPanning)
	const isMiddleMouseDown = useViewportStore((s) => s.isMiddleMouseDown)
	const zoomToPoint = useViewportStore((s) => s.zoomToPoint)
	const relativePan = useViewportStore((s) => s.relativePan)
	const setIsPanning = useViewportStore((s) => s.setIsPanning)
	const setIsMiddleMouseDown = useViewportStore((s) => s.setIsMiddleMouseDown)
	const fitToScreen = useViewportStore((s) => s.fitToScreen)

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (!canvas) return
			e.preventDefault()

			const target = canvas.findTarget(e.nativeEvent)
			const activeObjects = canvas.getActiveObjects()
			const isTargetInSelection = target ? activeObjects.includes(target) : false

			if (target && !isTargetInSelection) {
				canvas.setActiveObject(target)
				canvas.renderAll()
			}

			const updatedObjects = canvas.getActiveObjects()
			const selectionCount = updatedObjects.length
			const hasGroups = updatedObjects.some((obj) => obj.type?.toLowerCase() === "group")

			setContextMenu({
				open: true,
				x: e.clientX,
				y: e.clientY,
				selectionCount,
				hasGroups,
				mode: target ? "selection" : "canvas",
			})
		},
		[canvas],
	)

	const handleContextMenuOpenChange = useCallback((open: boolean) => {
		setContextMenu((prev) => ({ ...prev, open }))
	}, [])

	const handleGroupSelection = useCallback(() => {
		if (!canvas) return
		groupSelection(canvas)
	}, [canvas])

	const handleUngroupSelection = useCallback(() => {
		if (!canvas) return
		ungroupSelection(canvas)
	}, [canvas])

	const handleDeleteSelection = useCallback(() => {
		if (!canvas) return
		deleteSelection(canvas)
	}, [canvas])

	const handleAddText = useCallback(() => {
		if (!canvas) return
		addTextToCanvas(canvas)
	}, [canvas])

	const handleAddRect = useCallback(() => {
		if (!canvas) return
		addRectToCanvas(canvas)
	}, [canvas])

	const handleAddCircle = useCallback(() => {
		if (!canvas) return
		addCircleToCanvas(canvas)
	}, [canvas])

	const handleAddTriangle = useCallback(() => {
		if (!canvas) return
		addTriangleToCanvas(canvas)
	}, [canvas])

	// Fit to screen on mount and when dimensions change
	// Uses ResizeObserver to get valid container dimensions, then calls fitToScreen directly
	// Avoids state to prevent re-mount issues during navigation
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		// Reset initial fit flag when dimensions change
		hasInitialFit.current = false

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry) {
				const { width, height } = entry.contentRect
				// Only fit if dimensions are valid
				if (width > 0 && height > 0) {
					setContainerSize((prev) =>
						prev.width === width && prev.height === height ? prev : { width, height },
					)
					// Call fitToScreen directly to avoid state-based re-render cycles
					fitToScreen(width, height, dimensions.width, dimensions.height)
					hasInitialFit.current = true
				}
			}
		})

		observer.observe(container)
		return () => observer.disconnect()
	}, [dimensions.width, dimensions.height, fitToScreen])

	// Spacebar pan activation and keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't activate shortcuts if typing in input/textarea
			const target = e.target as HTMLElement
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
				return
			}

			if (e.code === "Space" && !e.repeat) {
				e.preventDefault()
				setIsPanning(true)
			}

			// Toggle inspect mode with "I" key
			if (e.code === "KeyI" && !e.repeat && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				toggleInspectMode()
			}

			// Toggle preview mode with "P" key
			if (e.code === "KeyP" && !e.repeat && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				togglePreviewMode()
			}
		}
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				setIsPanning(false)
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("keyup", handleKeyUp)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("keyup", handleKeyUp)
		}
	}, [setIsPanning, toggleInspectMode, togglePreviewMode])

	// Mouse wheel / trackpad handling (native listener for passive: false)
	// - Mouse wheel = zoom
	// - Trackpad two-finger scroll = pan
	// - Trackpad pinch (Ctrl/Cmd + wheel) = zoom
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const handleWheel = (e: WheelEvent) => {
			e.preventDefault()
			const rect = container.getBoundingClientRect()
			const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }

			// Pinch zoom (Ctrl/Cmd + wheel) - always zoom
			if (e.ctrlKey || e.metaKey) {
				zoomToPoint(point, e.deltaY)
				return
			}

			// Horizontal scroll present = trackpad two-finger scroll = pan
			if (Math.abs(e.deltaX) > 0) {
				relativePan(-e.deltaX, -e.deltaY)
				return
			}

			// Vertical only: distinguish mouse wheel vs trackpad
			// Mouse wheels: deltaMode=1 (lines) or large discrete deltaY (typically 100-120 per click)
			// Trackpads: deltaMode=0 (pixels) with smaller smooth values
			const isMouseWheel = e.deltaMode === 1 || Math.abs(e.deltaY) >= 40

			if (isMouseWheel) {
				// Mouse wheel = zoom
				zoomToPoint(point, e.deltaY)
			} else {
				// Trackpad vertical scroll = pan
				relativePan(0, -e.deltaY)
			}
		}

		// passive: false is required to call preventDefault() on wheel events in Chrome
		container.addEventListener("wheel", handleWheel, { passive: false })
		return () => container.removeEventListener("wheel", handleWheel)
	}, [zoomToPoint, relativePan])

	// Mouse down for panning
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.button === 1) {
				// Middle mouse
				e.preventDefault()
				setIsMiddleMouseDown(true)
				lastMousePos.current = { x: e.clientX, y: e.clientY }
			} else if (isPanning && e.button === 0) {
				// Left click while spacebar
				lastMousePos.current = { x: e.clientX, y: e.clientY }
			}
		},
		[isPanning, setIsMiddleMouseDown],
	)

	// Mouse move for panning
	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (isMiddleMouseDown || (isPanning && e.buttons === 1)) {
				const dx = e.clientX - lastMousePos.current.x
				const dy = e.clientY - lastMousePos.current.y
				relativePan(dx, dy)
				lastMousePos.current = { x: e.clientX, y: e.clientY }
			}
		},
		[isMiddleMouseDown, isPanning, relativePan],
	)

	// Mouse up
	const handleMouseUp = useCallback(
		(e: React.MouseEvent) => {
			if (e.button === 1) {
				setIsMiddleMouseDown(false)
			}
		},
		[setIsMiddleMouseDown],
	)

	// Grid pattern style (scales with zoom)
	const scaledSpacing = GRID_SPACING * zoom
	const gridStyle = {
		backgroundImage: `radial-gradient(circle, #d4d4d4 ${GRID_DOT_SIZE}px, transparent ${GRID_DOT_SIZE}px)`,
		backgroundSize: `${scaledSpacing}px ${scaledSpacing}px`,
		backgroundPosition: `${panX % scaledSpacing}px ${panY % scaledSpacing}px`,
	}

	// Cursor style
	const isActivePanning = isPanning || isMiddleMouseDown
	const cursorClass = isActivePanning ? "cursor-grab active:cursor-grabbing" : ""

	const showBleed = contentType === "poster" && !previewMode
	const bleedOffset = showBleed ? DEFAULT_BLEED_PX * zoom : 0
	const artboardLeft = CANVAS_PADDING * zoom + panX
	const artboardTop = CANVAS_PADDING * zoom + panY
	const artboardWidth = dimensions.width * zoom
	const artboardHeight = dimensions.height * zoom
	const artboardRight = artboardLeft + artboardWidth
	const artboardBottom = artboardTop + artboardHeight

	const maskTop = Math.max(0, artboardTop)
	const maskBottom = Math.max(0, containerSize.height - artboardBottom)
	const maskLeft = Math.max(0, artboardLeft)
	const maskRight = Math.max(0, containerSize.width - artboardRight)
	const maskMiddleHeight = Math.max(0, containerSize.height - maskTop - maskBottom)

	const canGroup = contextMenu.selectionCount >= 2
	const canUngroup = contextMenu.hasGroups
	const canDelete = contextMenu.selectionCount >= 1
	const isSelectionMenu = contextMenu.mode === "selection"

	return (
		<div
			ref={containerRef}
			role="application"
			aria-label="Canvas viewport - use mouse wheel to zoom, spacebar to pan"
			className={cn("relative h-full w-full overflow-hidden", cursorClass, className)}
			style={gridStyle}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={() => setIsMiddleMouseDown(false)}
			onContextMenu={handleContextMenu}
		>
			{/* Canvas wrapper - Fabric.js handles viewport transform internally */}
			<div className="pointer-events-auto">{children}</div>

			{/* Bleed guide (poster sizes only) */}
			{showBleed && (
				<div
					className="pointer-events-none absolute border border-dashed border-neutral-400/70"
					style={{
						left: artboardLeft - bleedOffset,
						top: artboardTop - bleedOffset,
						width: artboardWidth + bleedOffset * 2,
						height: artboardHeight + bleedOffset * 2,
					}}
				/>
			)}

			{/* Preview mask (clips to artboard) */}
			{previewMode && containerSize.width > 0 && containerSize.height > 0 && (
				<div className="pointer-events-none absolute inset-0">
					<div
						className="absolute left-0 top-0 w-full bg-neutral-100/95"
						style={{ height: maskTop }}
					/>
					<div
						className="absolute bottom-0 left-0 w-full bg-neutral-100/95"
						style={{ height: maskBottom }}
					/>
					<div
						className="absolute left-0 bg-neutral-100/95"
						style={{ top: maskTop, height: maskMiddleHeight, width: maskLeft }}
					/>
					<div
						className="absolute right-0 bg-neutral-100/95"
						style={{ top: maskTop, height: maskMiddleHeight, width: maskRight }}
					/>
				</div>
			)}

			<DropdownMenu open={contextMenu.open} onOpenChange={handleContextMenuOpenChange}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						className="pointer-events-none fixed h-px w-px opacity-0"
						style={{ left: contextMenu.x, top: contextMenu.y }}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					sideOffset={4}
					className={cn("w-48", isSelectionMenu && "w-40")}
				>
					{isSelectionMenu ? (
						<>
							<DropdownMenuItem
								disabled={!canGroup}
								onSelect={() => {
									handleGroupSelection()
								}}
							>
								<GroupIcon className="h-4 w-4" />
								Group
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!canUngroup}
								onSelect={() => {
									handleUngroupSelection()
								}}
							>
								<Ungroup className="h-4 w-4" />
								Ungroup
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={!canDelete}
								onSelect={() => {
									handleDeleteSelection()
								}}
							>
								<Trash2 className="h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</>
					) : (
						<>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<Plus className="h-4 w-4" />
									Add
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuItem
										onSelect={() => {
											handleAddText()
										}}
									>
										<Type className="h-4 w-4" />
										Text
									</DropdownMenuItem>
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<Square className="h-4 w-4" />
											Shapes
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem
												onSelect={() => {
													handleAddRect()
												}}
											>
												<Square className="h-4 w-4" />
												Rectangle
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={() => {
													handleAddCircle()
												}}
											>
												<CircleIcon className="h-4 w-4" />
												Circle
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={() => {
													handleAddTriangle()
												}}
											>
												<TriangleIcon className="h-4 w-4" />
												Triangle
											</DropdownMenuItem>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								checked={inspectMode}
								onCheckedChange={() => toggleInspectMode()}
							>
								<Scan className="h-4 w-4" />
								Inspect Mode
							</DropdownMenuCheckboxItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Figma-style inspect overlay */}
			<InspectOverlay
				canvas={canvas}
				dimensions={dimensions}
				enabled={inspectMode && !previewMode}
			/>
		</div>
	)
}
