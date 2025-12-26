import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "bun:test"
import type { Canvas } from "fabric"

const serializeModule = await import("@/lib/canvas/serialize")
const storageAdapterModule = await import("@/lib/storage/storage-adapter")
const thumbnailModule = await import("@/lib/storage/thumbnail")

const serializeCanvas = vi
	.spyOn(serializeModule, "serializeCanvas")
	.mockImplementation((canvas: Canvas) => (canvas as unknown as { id: string }).id)
const saveCanvasState = vi
	.spyOn(storageAdapterModule, "saveCanvasState")
	.mockImplementation(
		async (
			_projectId: string,
			_slideId: string,
			_fabricJSON: string,
			_thumbnail?: string | null,
		) => {},
	)
const generateThumbnail = vi
	.spyOn(thumbnailModule, "generateThumbnail")
	.mockImplementation((_canvas: Canvas) => "thumb")

const autosave = await import("@/lib/storage/autosave")

const { cancelAutosave, resetAutosaveState, scheduleAutosave } = autosave

describe("autosave", () => {
	beforeEach(() => {
		serializeCanvas.mockClear()
		saveCanvasState.mockClear()
		generateThumbnail.mockClear()
		resetAutosaveState()
	})

	afterEach(() => {
		cancelAutosave()
		vi.useRealTimers()
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	it("debounces saves and uses the latest canvas", async () => {
		vi.useFakeTimers()
		const canvasA = { id: "first" } as unknown as Canvas
		const canvasB = { id: "second" } as unknown as Canvas

		scheduleAutosave("project", "slide", canvasA)
		scheduleAutosave("project", "slide", canvasB)

		expect(saveCanvasState).not.toHaveBeenCalled()
		vi.advanceTimersByTime(2000)
		await Promise.resolve()

		expect(saveCanvasState).toHaveBeenCalledTimes(1)
		const [projectId, slideId, fabricJSON] = saveCanvasState.mock.calls[0]
		expect(projectId).toBe("project")
		expect(slideId).toBe("slide")
		expect(fabricJSON).toBe("second")
	})

	it("keeps only the latest immediate save when queued", async () => {
		const canvasA = { id: "first" } as unknown as Canvas
		const canvasB = { id: "second" } as unknown as Canvas

		await Promise.all([
			scheduleAutosave("project", "slide", canvasA, { immediate: true }) as Promise<void>,
			scheduleAutosave("project", "slide", canvasB, { immediate: true }) as Promise<void>,
		])

		expect(saveCanvasState).toHaveBeenCalledTimes(1)
		const [, , fabricJSON] = saveCanvasState.mock.calls[0]
		expect(fabricJSON).toBe("second")
	})

	it("forces thumbnails when requested", async () => {
		const canvas = { id: "thumb" } as unknown as Canvas
		await (scheduleAutosave("project", "slide", canvas, {
			immediate: true,
			forceThumbnail: true,
		}) as Promise<void>)

		expect(generateThumbnail).toHaveBeenCalledTimes(1)
		expect(saveCanvasState).toHaveBeenCalledTimes(1)
		const [, , , thumbnail] = saveCanvasState.mock.calls[0]
		expect(thumbnail).toBe("thumb")
	})
})
