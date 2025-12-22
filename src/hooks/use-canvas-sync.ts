import { useEffect, useRef } from "react"
import { flushAutosave, resetAutosaveState, scheduleAutosave } from "@/lib/storage"
import { useEditorStore } from "@/stores/editor-store"
import { useProjectsStore } from "@/stores/projects-store"

/**
 * Hook to synchronize canvas changes with storage.
 * Sets up autosave on canvas modifications and handles cleanup.
 */
export function useCanvasSync() {
	const canvas = useEditorStore((s) => s.canvas)
	const projectId = useEditorStore((s) => s.projectId)
	const slideId = useEditorStore((s) => s.slideId)
	const setIsDirty = useEditorStore((s) => s.setIsDirty)

	const markSaved = useProjectsStore((s) => s.markSaved)

	// Keep refs to avoid stale closures
	const projectIdRef = useRef(projectId)
	const slideIdRef = useRef(slideId)

	useEffect(() => {
		projectIdRef.current = projectId
		slideIdRef.current = slideId
	}, [projectId, slideId])

	// Set up canvas event listeners for autosave
	useEffect(() => {
		if (!canvas || !projectId || !slideId) return

		const handleChange = () => {
			const currentProjectId = projectIdRef.current
			const currentSlideId = slideIdRef.current
			if (!currentProjectId || !currentSlideId) return
			setIsDirty(true)
			scheduleAutosave(currentProjectId, currentSlideId, canvas)
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

	// Flush on slide change
	useEffect(() => {
		return () => {
			if (canvas && projectIdRef.current && slideIdRef.current) {
				flushAutosave(projectIdRef.current, slideIdRef.current, canvas)
				markSaved()
			}
			resetAutosaveState()
		}
	}, [canvas, markSaved])
}

export default useCanvasSync
