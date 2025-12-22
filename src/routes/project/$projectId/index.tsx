import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Copy, Edit2, Image, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { useProjectsStore } from "@/stores/projects-store"
import type { CanvasDimensions, ContentType } from "@/types/editor"
import { SOCIAL_DIMENSIONS } from "@/types/editor"

export const Route = createFileRoute("/project/$projectId/")({
	component: ProjectOverviewPage,
})

function ProjectOverviewPage() {
	const { projectId } = Route.useParams()
	const navigate = useNavigate()

	const currentProject = useProjectsStore((s) => s.currentProject)
	const addSlide = useProjectsStore((s) => s.addSlide)
	const deleteSlide = useProjectsStore((s) => s.deleteSlide)
	const duplicateSlide = useProjectsStore((s) => s.duplicateSlide)
	const renameSlide = useProjectsStore((s) => s.renameSlide)

	// Navigate to active slide if exists, otherwise to first slide
	// IMPORTANT: Only read slide data when currentProject matches the route projectId
	// This prevents stale data from a previous project causing incorrect redirects
	const isCorrectProject = currentProject?.id === projectId
	const firstSlideId = isCorrectProject ? currentProject?.slides[0]?.id : undefined
	const activeSlideId = isCorrectProject ? currentProject?.activeSlideId : undefined

	useEffect(() => {
		// Only redirect when we have the correct project loaded
		if (!isCorrectProject) return

		const targetSlideId = activeSlideId || firstSlideId
		if (targetSlideId) {
			navigate({
				to: "/project/$projectId/slide/$slideId",
				params: { projectId, slideId: targetSlideId },
			})
		}
	}, [isCorrectProject, activeSlideId, firstSlideId, projectId, navigate])

	const handleAddSlide = async () => {
		const slideId = await addSlide(
			"social-image" as ContentType,
			SOCIAL_DIMENSIONS["instagram-post"] as CanvasDimensions,
		)
		navigate({
			to: "/project/$projectId/slide/$slideId",
			params: { projectId, slideId },
		})
	}

	const handleSlideClick = (slideId: string) => {
		navigate({
			to: "/project/$projectId/slide/$slideId",
			params: { projectId, slideId },
		})
	}

	const handleDuplicate = async (slideId: string) => {
		const newSlideId = await duplicateSlide(slideId)
		navigate({
			to: "/project/$projectId/slide/$slideId",
			params: { projectId, slideId: newSlideId },
		})
	}

	const handleDelete = async (slideId: string) => {
		if (window.confirm("Are you sure you want to delete this slide?")) {
			await deleteSlide(slideId)
		}
	}

	const handleRename = (slideId: string) => {
		const slide = currentProject?.slides.find((s) => s.id === slideId)
		if (!slide) return

		const newName = window.prompt("Enter new name:", slide.name)
		if (newName && newName.trim() !== slide.name) {
			renameSlide(slideId, newName.trim())
		}
	}

	// Wait for correct project to load
	if (!currentProject || !isCorrectProject) {
		return null
	}

	// If no slides, show empty state
	if (currentProject.slides.length === 0) {
		return (
			<div className="flex h-[calc(100vh-56px)] items-center justify-center pt-14">
				<EmptyState
					icon={<Image className="h-6 w-6" />}
					title="No slides yet"
					description="Add your first slide to start designing"
					action={
						<Button onClick={handleAddSlide} className="gap-1.5">
							<Plus className="h-4 w-4" />
							Add Slide
						</Button>
					}
					className="w-full max-w-md"
				/>
			</div>
		)
	}

	// Show slide grid
	return (
		<div className="h-[calc(100vh-56px)] overflow-auto pt-14">
			<div className="mx-auto max-w-5xl p-6">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-lexend text-xl font-bold text-neutral-900">All Slides</h2>
					<Button onClick={handleAddSlide} size="sm" className="gap-1.5">
						<Plus className="h-4 w-4" />
						Add Slide
					</Button>
				</div>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{currentProject.slides.map((slide, _index) => (
						<div
							key={slide.id}
							className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
						>
							{/* Thumbnail */}
							<button
								type="button"
								onClick={() => handleSlideClick(slide.id)}
								className="block w-full"
							>
								<div className="relative aspect-video w-full bg-neutral-100">
									{slide.thumbnailDataUrl ? (
										<img
											src={slide.thumbnailDataUrl}
											alt={slide.name}
											className="h-full w-full object-contain"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center">
											<Image className="h-8 w-8 text-neutral-300" />
										</div>
									)}
								</div>
							</button>

							{/* Info */}
							<div className="flex items-center justify-between border-t border-neutral-100 p-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-neutral-900">{slide.name}</p>
									<p className="text-xs text-neutral-400">{slide.dimensions.label}</p>
								</div>

								{/* Actions */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
										>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => handleRename(slide.id)}>
											<Edit2 className="mr-2 h-4 w-4" />
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleDuplicate(slide.id)}>
											<Copy className="mr-2 h-4 w-4" />
											Duplicate
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => handleDelete(slide.id)}
											className="text-red-600 focus:text-red-600"
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
