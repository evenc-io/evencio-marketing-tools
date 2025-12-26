import { afterAll, beforeEach, describe, expect, it, vi } from "bun:test"
import { SOCIAL_DIMENSIONS } from "@/types/editor"
import type { Project, Slide } from "@/types/project"

const indexeddbModule = await import("@/lib/storage/indexeddb")
const storageAdapter = await import("@/lib/storage/storage-adapter")
type DbReturn = Awaited<ReturnType<typeof indexeddbModule.getDb>>

const createProject = (): Project => {
	const now = new Date().toISOString()
	const slide: Slide = {
		id: "slide-1",
		name: "Slide 1",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["instagram-post"],
		fabricJSON: "{}",
		thumbnailDataUrl: null,
		createdAt: now,
		updatedAt: now,
	}
	return {
		id: "project-1",
		name: "Project",
		slides: [slide],
		activeSlideId: slide.id,
		createdAt: now,
		updatedAt: now,
	}
}

describe("storage-adapter write queue", () => {
	let project: Project
	let writes: string[]
	let delays: number[]
	const getDbSpy = vi.spyOn(indexeddbModule, "getDb")

	beforeEach(() => {
		project = createProject()
		writes = []
		delays = []
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	const setupModule = async () => {
		const fakeDb = {
			get: async (_store: string, _id: string) => project,
			put: async (_store: string, updated: Project) => {
				const delay = delays.shift() ?? 0
				if (delay > 0) {
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
				project = structuredClone(updated)
				writes.push(project.slides[0].fabricJSON)
			},
		}
		getDbSpy.mockImplementation(async () => fakeDb as unknown as DbReturn)
		return storageAdapter
	}

	it("serializes concurrent saves per slide", async () => {
		delays = [30, 0]
		const { saveCanvasState } = await setupModule()

		await Promise.all([
			saveCanvasState(project.id, project.slides[0].id, "first"),
			saveCanvasState(project.id, project.slides[0].id, "second"),
		])

		expect(writes).toEqual(["first", "second"])
		expect(project.slides[0].fabricJSON).toBe("second")
	})

	it("keeps updateSlide and saveCanvasState ordered", async () => {
		delays = [20, 0]
		const { saveCanvasState, updateSlide } = await setupModule()

		await Promise.all([
			updateSlide(project.id, project.slides[0].id, { fabricJSON: "update" }),
			saveCanvasState(project.id, project.slides[0].id, "canvas"),
		])

		expect(writes).toEqual(["update", "canvas"])
		expect(project.slides[0].fabricJSON).toBe("canvas")
	})
})
