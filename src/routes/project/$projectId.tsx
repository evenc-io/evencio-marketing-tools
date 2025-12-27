import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { AlertCircle, Loader2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { Logo } from "../../components/brand/logo"
import { Navbar } from "../../components/layout/navbar"
import { Button } from "../../components/ui/button"
import { downloadBlob, exportCanvas, getFilename } from "../../lib/export"
import { SCREEN_GUARD_DEFAULTS, useScreenGuard } from "../../lib/screen-guard"
import { flushAutosave, generateThumbnail } from "../../lib/storage"
import { useEditorStore } from "../../stores/editor-store"
import { useProjectsStore } from "../../stores/projects-store"
import { useViewportStore } from "../../stores/viewport-store"

export const Route = createFileRoute("/project/$projectId")({
	component: ProjectLayout,
})

function ProjectLayout() {
	const { projectId } = Route.useParams()
	const navigate = useNavigate()

	const currentProject = useProjectsStore((s) => s.currentProject)
	const isLoading = useProjectsStore((s) => s.isLoading)
	const error = useProjectsStore((s) => s.error)
	const openProject = useProjectsStore((s) => s.openProject)
	const renameProject = useProjectsStore((s) => s.renameProject)
	const closeProject = useProjectsStore((s) => s.closeProject)
	const pendingSave = useProjectsStore((s) => s.pendingSave)
	const updateSlide = useProjectsStore((s) => s.updateSlide)

	const canvas = useEditorStore((s) => s.canvas)
	const slideId = useEditorStore((s) => s.slideId)
	const isDirty = useEditorStore((s) => s.isDirty)
	const isExporting = useEditorStore((s) => s.isExporting)
	const dimensions = useEditorStore((s) => s.dimensions)
	const getCanvasJSON = useEditorStore((s) => s.getCanvasJSON)
	const setIsExporting = useEditorStore((s) => s.setIsExporting)
	const screenGate = useScreenGuard()

	// Refs to avoid infinite loop - these are only used in cleanup
	const canvasRef = useRef(canvas)
	const slideIdRef = useRef(slideId)
	const isDirtyRef = useRef(isDirty)

	useEffect(() => {
		canvasRef.current = canvas
		slideIdRef.current = slideId
		isDirtyRef.current = isDirty
	}, [canvas, slideId, isDirty])

	// Load project on mount
	useEffect(() => {
		// Reset viewport state when switching projects to prevent stale zoom/pan values
		useViewportStore.getState().resetView()
		// Reset editor state to prevent stale canvas/selection/mode issues
		useEditorStore.getState().reset()
		openProject(projectId)

		return () => {
			// Save before closing using refs to get latest values
			if (canvasRef.current && projectId && slideIdRef.current && isDirtyRef.current) {
				flushAutosave(projectId, slideIdRef.current, canvasRef.current)
			}
			closeProject()
			// Reset viewport on unmount to clean up for next project
			useViewportStore.getState().resetView()
			// Reset editor state on unmount
			useEditorStore.getState().reset()
		}
	}, [projectId, openProject, closeProject])

	// Handle project name change
	const handleProjectNameChange = async (name: string) => {
		if (currentProject) {
			await renameProject(currentProject.id, name)
		}
	}

	// Handle save
	const handleSave = async () => {
		if (canvas && projectId && slideId) {
			const fabricJSON = getCanvasJSON()
			const thumbnailDataUrl = generateThumbnail(canvas)
			flushAutosave(projectId, slideId, canvas)
			if (fabricJSON) {
				await updateSlide(slideId, {
					fabricJSON,
					...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
					dimensions,
				})
			}
			useProjectsStore.getState().markSaved()
			useEditorStore.getState().setIsDirty(false)
		}
	}

	// Handle export
	const handleExport = async (format: "png" | "jpeg" | "pdf") => {
		if (!canvas) return
		setIsExporting(true)
		try {
			const blob = await exportCanvas(canvas, dimensions, {
				format,
				quality: 0.92,
				scale: 1,
				includeBleed: false,
			})
			const filename = getFilename("evencio-design", format)
			downloadBlob(blob, filename)
		} catch (error) {
			console.error("Export failed:", error)
		} finally {
			setIsExporting(false)
		}
	}

	if (screenGate.status !== "supported") {
		const isChecking = screenGate.status === "unknown"
		const showMetrics = !isChecking && screenGate.viewport.width > 0

		return (
			<div className="flex h-screen flex-col items-center justify-center bg-white px-6">
				<div
					className="flex w-full max-w-xl flex-col items-center gap-4 text-center"
					role={screenGate.status === "unsupported" ? "alert" : undefined}
				>
					<Logo size="sm" href="/" animateOnHover />
					<div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
						{isChecking ? (
							<Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
						) : (
							<AlertCircle className="h-5 w-5 text-red-500" />
						)}
					</div>
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
							Project editor
						</p>
						<h1 className="text-lg font-semibold text-neutral-900">
							{isChecking ? "Checking screen size..." : "Desktop screen required"}
						</h1>
						<p className="text-sm text-neutral-600">
							{isChecking
								? "Preparing the editor layout."
								: "This editor needs a wide screen and full keyboard support. Open it on a larger display or expand your browser window."}
						</p>
						{showMetrics && (
							<p className="text-xs text-neutral-400">
								Minimum: {SCREEN_GUARD_DEFAULTS.minViewportWidth}x
								{SCREEN_GUARD_DEFAULTS.minViewportHeight} viewport and{" "}
								{SCREEN_GUARD_DEFAULTS.minScreenWidth}x{SCREEN_GUARD_DEFAULTS.minScreenHeight}{" "}
								screen. Current viewport: {screenGate.viewport.width}x{screenGate.viewport.height}.
							</p>
						)}
					</div>
					<Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
						Back to dashboard
					</Button>
				</div>
			</div>
		)
	}

	// Show loading state
	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-white">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
			</div>
		)
	}

	// Show error state
	if (error || !currentProject) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
				<p className="text-neutral-500">{error || "Project not found"}</p>
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="text-sm text-neutral-900 underline"
				>
					Back to Dashboard
				</button>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-white">
			<Navbar
				variant="editor"
				projectName={currentProject.name}
				onProjectNameChange={handleProjectNameChange}
				onSave={handleSave}
				isSaving={false}
				hasUnsavedChanges={isDirty || pendingSave}
				onExport={handleExport}
				isExporting={isExporting}
			/>
			<Outlet />
		</div>
	)
}
