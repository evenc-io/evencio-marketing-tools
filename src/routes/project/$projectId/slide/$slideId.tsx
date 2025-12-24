import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, Eraser, Image, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EditorCanvas } from "../../../../components/editor/canvas"
import { CanvasViewport } from "../../../../components/editor/canvas-viewport"
import { DimensionsPanel } from "../../../../components/editor/dimensions-panel"
import { ExportPanel } from "../../../../components/editor/export-panel"
import { LayersPanel } from "../../../../components/editor/layers-panel"
import { EditorToolbar } from "../../../../components/editor/toolbar"
import { ZoomControls } from "../../../../components/editor/zoom-controls"
import { EditorLayout } from "../../../../components/layout/editor-layout"
import { Button } from "../../../../components/ui/button"
import { getUserObjects } from "../../../../lib/artboard"
import { resetAutosaveState, scheduleAutosave } from "../../../../lib/storage"
import { cn } from "../../../../lib/utils"
import { useEditorStore } from "../../../../stores/editor-store"
import { useProjectsStore } from "../../../../stores/projects-store"
import type { CanvasDimensions, ContentType } from "../../../../types/editor"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "../../../../types/editor"

export const Route = createFileRoute("/project/$projectId/slide/$slideId")({
	component: SlideEditorPage,
})

function SlideEditorPage() {
	const { projectId, slideId } = Route.useParams()
	const navigate = useNavigate()

	const currentProject = useProjectsStore((s) => s.currentProject)
	const setActiveSlide = useProjectsStore((s) => s.setActiveSlide)
	const addSlide = useProjectsStore((s) => s.addSlide)
	const deleteSlide = useProjectsStore((s) => s.deleteSlide)

	const canvas = useEditorStore((s) => s.canvas)
	const dimensions = useEditorStore((s) => s.dimensions)
	const setProjectContext = useEditorStore((s) => s.setProjectContext)
	const getCanvasJSON = useEditorStore((s) => s.getCanvasJSON)
	const loadSlideToCanvas = useEditorStore((s) => s.loadSlideToCanvas)
	const setDimensions = useEditorStore((s) => s.setDimensions)
	const setContentType = useEditorStore((s) => s.setContentType)
	const setIsDirty = useEditorStore((s) => s.setIsDirty)
	const isSlideHydratedRef = useRef(false)

	// Get current slide
	const currentSlide = currentProject?.slides.find((s) => s.id === slideId)
	const currentSlideId = currentSlide?.id ?? null
	const currentSlideWidth = currentSlide?.dimensions.width ?? null
	const currentSlideHeight = currentSlide?.dimensions.height ?? null
	const currentSlideLabel = currentSlide?.dimensions.label ?? null
	const currentSlideContentType = currentSlide?.contentType ?? null
	const currentSlideFabricJSON = currentSlide?.fabricJSON ?? null

	// Set project context and load slide
	useEffect(() => {
		setProjectContext(projectId, slideId)
		resetAutosaveState()

		return () => {
			setProjectContext(null, null)
		}
	}, [projectId, slideId, setProjectContext])

	// Load slide content into canvas
	useEffect(() => {
		isSlideHydratedRef.current = false
		if (
			!canvas ||
			!currentSlideId ||
			currentSlideWidth === null ||
			currentSlideHeight === null ||
			!currentSlideLabel ||
			!currentSlideContentType ||
			!currentSlideFabricJSON
		)
			return

		const needsResize =
			dimensions.width !== currentSlideWidth || dimensions.height !== currentSlideHeight
		const slideDimensions: CanvasDimensions = {
			width: currentSlideWidth,
			height: currentSlideHeight,
			label: currentSlideLabel,
		}

		if (needsResize) {
			// Update editor state first to trigger canvas re-init at new size
			setDimensions(slideDimensions)
			setContentType(currentSlideContentType)
			setActiveSlide(currentSlideId)
			return
		}

		const currentCanvasJSON = getCanvasJSON()
		if (currentCanvasJSON && currentCanvasJSON === currentSlideFabricJSON) {
			isSlideHydratedRef.current = true
			setContentType(currentSlideContentType)
			setActiveSlide(currentSlideId)
			return
		}

		let cancelled = false
		void (async () => {
			// Only load once canvas size matches the slide dimensions
			await loadSlideToCanvas(currentSlideFabricJSON, slideDimensions)
			if (!cancelled) {
				isSlideHydratedRef.current = true
			}
		})()
		setContentType(currentSlideContentType)
		setActiveSlide(currentSlideId)

		return () => {
			cancelled = true
		}
	}, [
		canvas,
		currentSlideContentType,
		currentSlideFabricJSON,
		currentSlideHeight,
		currentSlideId,
		currentSlideLabel,
		currentSlideWidth,
		dimensions.height,
		dimensions.width,
		getCanvasJSON,
		loadSlideToCanvas,
		setActiveSlide,
		setContentType,
		setDimensions,
	])

	// Set up canvas change listeners for autosave
	useEffect(() => {
		if (!canvas || !projectId || !slideId) return

		const handleChange = () => {
			if (!isSlideHydratedRef.current) return
			setIsDirty(true)
			scheduleAutosave(projectId, slideId, canvas)
		}

		canvas.on("object:modified", handleChange)
		canvas.on("object:added", handleChange)
		canvas.on("object:removed", handleChange)

		return () => {
			canvas.off("object:modified", handleChange)
			canvas.off("object:added", handleChange)
			canvas.off("object:removed", handleChange)
		}
	}, [canvas, projectId, slideId, setIsDirty])

	const handleSlideClick = useCallback(
		(id: string) => {
			navigate({
				to: "/project/$projectId/slide/$slideId",
				params: { projectId, slideId: id },
			})
		},
		[navigate, projectId],
	)

	const handleAddSlide = useCallback(async () => {
		const newSlideId = await addSlide(
			"social-image" as ContentType,
			SOCIAL_DIMENSIONS["instagram-post"] as CanvasDimensions,
		)
		navigate({
			to: "/project/$projectId/slide/$slideId",
			params: { projectId, slideId: newSlideId },
		})
	}, [addSlide, navigate, projectId])

	const handleDeleteSlide = useCallback(
		async (id: string) => {
			const slides = currentProject?.slides ?? []

			// Last slide - reset/clear it instead of deleting
			if (slides.length <= 1) {
				if (canvas) {
					// Clear all user objects from canvas, preserving the artboard
					const userObjects = getUserObjects(canvas)
					if (userObjects.length > 0) {
						canvas.remove(...userObjects)
						canvas.discardActiveObject()
						canvas.renderAll()
						// Autosave will persist the empty state
					}
				}
				return
			}

			// If deleting the current slide, navigate away FIRST
			if (id === slideId) {
				const remainingSlides = slides.filter((s) => s.id !== id)
				const nextSlide = remainingSlides[0]
				if (nextSlide) {
					// Navigate first, wait for it to complete
					await navigate({
						to: "/project/$projectId/slide/$slideId",
						params: { projectId, slideId: nextSlide.id },
					})
				}
			}

			// Now safe to delete (component has navigated away if needed)
			await deleteSlide(id)
		},
		[canvas, currentProject?.slides, deleteSlide, navigate, projectId, slideId],
	)

	// Create tabs for left sidebar
	const leftSidebarTabs = useMemo(
		() => [
			{
				id: "slides",
				label: "Slides",
				content: (
					<SlidesSidebar
						slides={currentProject?.slides ?? []}
						activeSlideId={slideId}
						onSlideClick={handleSlideClick}
						onAddSlide={handleAddSlide}
						onDeleteSlide={handleDeleteSlide}
					/>
				),
			},
			{
				id: "layers",
				label: "Layers",
				content: <LayersPanel />,
			},
		],
		[currentProject?.slides, slideId, handleSlideClick, handleAddSlide, handleDeleteSlide],
	)

	if (!currentProject || !currentSlide) {
		return (
			<div className="flex h-[calc(100vh-56px)] items-center justify-center pt-14">
				<p className="text-neutral-500">Slide not found</p>
			</div>
		)
	}

	return (
		<EditorLayout leftSidebarTabs={leftSidebarTabs} rightSidebar={<PropertiesPanel />}>
			{/* Canvas Area */}
			<div className="relative flex h-full flex-col">
				<div className="flex-1 overflow-hidden" data-viewport-container>
					<CanvasViewport>
						<EditorCanvas />
					</CanvasViewport>
				</div>
				<div className="flex items-center justify-between border-t border-neutral-200 bg-white p-2">
					<div className="w-32" />
					<EditorToolbar />
					<ZoomControls />
				</div>
			</div>
		</EditorLayout>
	)
}

// Slides Sidebar Component
interface SlidesSidebarProps {
	slides: Array<{
		id: string
		name: string
		thumbnailDataUrl: string | null
	}>
	activeSlideId: string
	onSlideClick: (id: string) => void
	onAddSlide: () => void
	onDeleteSlide: (id: string) => void
}

const DELETE_CONFIRM_TIMEOUT = 2000

function SlidesSidebar({
	slides,
	activeSlideId,
	onSlideClick,
	onAddSlide,
	onDeleteSlide,
}: SlidesSidebarProps) {
	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 space-y-2 overflow-auto p-3">
				{slides.map((slide, index) => (
					<SlideItem
						key={slide.id}
						slide={slide}
						index={index}
						isActive={slide.id === activeSlideId}
						isLastSlide={slides.length === 1}
						onClick={() => onSlideClick(slide.id)}
						onDelete={() => onDeleteSlide(slide.id)}
					/>
				))}
			</div>

			{/* Add Slide Button */}
			<div className="border-t border-neutral-200 p-3">
				<Button variant="outline" size="sm" onClick={onAddSlide} className="w-full gap-1.5">
					<Plus className="h-3.5 w-3.5" />
					Add Slide
				</Button>
			</div>
		</div>
	)
}

// Slide Item Component with double-click delete confirmation
interface SlideItemProps {
	slide: {
		id: string
		name: string
		thumbnailDataUrl: string | null
	}
	index: number
	isActive: boolean
	isLastSlide: boolean
	onClick: () => void
	onDelete: () => void
}

function SlideItem({ slide, index, isActive, isLastSlide, onClick, onDelete }: SlideItemProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Clear timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleDeleteClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()

			if (confirmingDelete) {
				// Second click - confirm deletion/clear
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current)
				}
				setConfirmingDelete(false)
				onDelete()
			} else {
				// First click - show confirmation state
				setConfirmingDelete(true)
				timeoutRef.current = setTimeout(() => {
					setConfirmingDelete(false)
				}, DELETE_CONFIRM_TIMEOUT)
			}
		},
		[confirmingDelete, onDelete],
	)

	return (
		<div
			className={cn(
				"group relative w-full rounded border p-1 text-left transition-colors",
				isActive
					? "border-neutral-900 bg-neutral-50"
					: "border-neutral-200 hover:border-neutral-300",
			)}
		>
			<button type="button" onClick={onClick} className="w-full text-left">
				<div className="relative aspect-video w-full overflow-hidden rounded bg-neutral-100">
					{slide.thumbnailDataUrl ? (
						<img
							src={slide.thumbnailDataUrl}
							alt={slide.name}
							className="h-full w-full object-contain"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<Image className="h-4 w-4 text-neutral-300" />
						</div>
					)}
				</div>
				<p className="mt-1 truncate px-1 text-[10px] text-neutral-500">
					{index + 1}. {slide.name}
				</p>
			</button>

			{/* Delete/Clear button */}
			<Button
				variant={confirmingDelete ? "destructive" : "ghost"}
				size="icon-sm"
				className={cn(
					"absolute right-1.5 top-1.5 h-5 w-5 transition-all",
					!confirmingDelete && "opacity-0 group-hover:opacity-100",
					confirmingDelete && "animate-pulse",
				)}
				onClick={handleDeleteClick}
				title={
					confirmingDelete ? "Click again to confirm" : isLastSlide ? "Clear slide" : "Delete slide"
				}
			>
				{confirmingDelete ? (
					<Check className="h-2.5 w-2.5" />
				) : isLastSlide ? (
					<Eraser className="h-2.5 w-2.5" />
				) : (
					<Trash2 className="h-2.5 w-2.5" />
				)}
			</Button>
		</div>
	)
}

// Properties Panel Component
function PropertiesPanel() {
	const contentType = useEditorStore((s) => s.contentType)
	const dimensions = useEditorStore((s) => s.dimensions)
	const [isAdditionsOpen, setIsAdditionsOpen] = useState(false)
	const [isDimensionsOpen, setIsDimensionsOpen] = useState(true)

	const presetEntries = useMemo(() => {
		if (contentType === "social-image") {
			return Object.entries(SOCIAL_DIMENSIONS)
		}
		return Object.entries(POSTER_DIMENSIONS).filter(([key]) => key !== "custom")
	}, [contentType])

	const isPresetMatch = useMemo(
		() =>
			presetEntries.some(
				([, dim]) => dim.width === dimensions.width && dim.height === dimensions.height,
			),
		[dimensions.height, dimensions.width, presetEntries],
	)

	useEffect(() => {
		if (!isPresetMatch) {
			setIsAdditionsOpen(true)
			setIsDimensionsOpen(true)
		}
	}, [isPresetMatch])

	return (
		<div className="flex h-full flex-col">
			{/* Additions Section */}
			<div className="border-b border-neutral-200">
				<button
					type="button"
					onClick={() => setIsAdditionsOpen((prev) => !prev)}
					className="flex w-full items-center justify-between px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-neutral-400"
				>
					Additions
					<span
						className={cn(
							"text-[10px] text-neutral-400 transition-transform",
							isAdditionsOpen && "rotate-180",
						)}
					>
						v
					</span>
				</button>
				{isAdditionsOpen ? (
					<div className="border-t border-neutral-200">
						<button
							type="button"
							onClick={() => setIsDimensionsOpen((prev) => !prev)}
							className="flex w-full items-center justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400"
						>
							Dimensions
							<span
								className={cn(
									"text-[10px] text-neutral-400 transition-transform",
									isDimensionsOpen && "rotate-180",
								)}
							>
								v
							</span>
						</button>
						{isDimensionsOpen ? (
							<div className="px-4 pb-4">
								<DimensionsPanel />
							</div>
						) : null}
					</div>
				) : null}
			</div>

			{/* Export Section */}
			<div className="p-4">
				<h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
					Export
				</h3>
				<ExportPanel />
			</div>
		</div>
	)
}
