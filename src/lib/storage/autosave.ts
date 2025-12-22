import type { Canvas } from "fabric"
import { serializeCanvas } from "@/lib/canvas/serialize"
import type { ProjectId, SlideId } from "@/types/project"
import { saveCanvasState } from "./storage-adapter"
import { generateThumbnail } from "./thumbnail"

/** Debounce delay for autosave in milliseconds */
const AUTOSAVE_DEBOUNCE_MS = 2000

/** Interval for thumbnail updates in milliseconds */
const THUMBNAIL_UPDATE_INTERVAL_MS = 30000

/** Number of saves before forcing thumbnail update */
const THUMBNAIL_SAVE_COUNT = 10

interface AutosaveState {
	timeoutId: ReturnType<typeof setTimeout> | null
	saveCount: number
	lastThumbnailUpdate: number
	saveQueue: Promise<void>
}

const state: AutosaveState = {
	timeoutId: null,
	saveCount: 0,
	lastThumbnailUpdate: 0,
	saveQueue: Promise.resolve(),
}

export interface AutosaveOptions {
	/** Skip debounce and save immediately */
	immediate?: boolean
	/** Force thumbnail generation */
	forceThumbnail?: boolean
}

/**
 * Schedule an autosave for the current canvas state.
 * Debounces multiple calls to avoid excessive writes.
 */
export function scheduleAutosave(
	projectId: ProjectId,
	slideId: SlideId,
	canvas: Canvas,
	options?: AutosaveOptions,
): Promise<void> | void {
	// Clear pending save
	if (state.timeoutId) {
		clearTimeout(state.timeoutId)
		state.timeoutId = null
	}

	const performSave = async () => {
		try {
			const fabricJSON = serializeCanvas(canvas)

			// Determine if we should update thumbnail
			const now = Date.now()
			const shouldUpdateThumbnail =
				options?.forceThumbnail ||
				state.saveCount >= THUMBNAIL_SAVE_COUNT ||
				now - state.lastThumbnailUpdate > THUMBNAIL_UPDATE_INTERVAL_MS

			let thumbnailDataUrl: string | null | undefined
			if (shouldUpdateThumbnail) {
				thumbnailDataUrl = generateThumbnail(canvas)
				state.saveCount = 0
				state.lastThumbnailUpdate = now
			} else {
				state.saveCount++
			}

			await saveCanvasState(projectId, slideId, fabricJSON, thumbnailDataUrl)
		} catch (error) {
			console.error("[Autosave] Failed to save:", error)
		}
	}

	const enqueueSave = (task: () => Promise<void>) => {
		state.saveQueue = state.saveQueue.then(task, task)
		return state.saveQueue
	}

	if (options?.immediate) {
		return enqueueSave(performSave)
	}

	state.timeoutId = setTimeout(() => {
		void enqueueSave(performSave)
	}, AUTOSAVE_DEBOUNCE_MS)
}

/**
 * Cancel any pending autosave.
 */
export function cancelAutosave(): void {
	if (state.timeoutId) {
		clearTimeout(state.timeoutId)
		state.timeoutId = null
	}
}

/**
 * Reset autosave state (e.g., when switching slides).
 */
export function resetAutosaveState(): void {
	cancelAutosave()
	state.saveCount = 0
	state.lastThumbnailUpdate = 0
}

/**
 * Force an immediate save with thumbnail update.
 * Use before closing the editor or switching slides.
 */
export function flushAutosave(projectId: ProjectId, slideId: SlideId, canvas: Canvas): void {
	cancelAutosave()
	scheduleAutosave(projectId, slideId, canvas, { immediate: true, forceThumbnail: true })
}
