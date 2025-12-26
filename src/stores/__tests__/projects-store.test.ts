import { afterAll, beforeEach, describe, expect, it, vi } from "bun:test"
import { SOCIAL_DIMENSIONS } from "@/types/editor"
import type { Project, Slide } from "@/types/project"

const storageModule = await import("@/lib/storage")
const storageMocks = {
	addSlide: vi.spyOn(storageModule, "addSlide"),
	createProject: vi.spyOn(storageModule, "createProject"),
	deleteProject: vi.spyOn(storageModule, "deleteProject"),
	deleteSlide: vi.spyOn(storageModule, "deleteSlide"),
	duplicateSlide: vi.spyOn(storageModule, "duplicateSlide"),
	getProject: vi.spyOn(storageModule, "getProject"),
	listProjects: vi.spyOn(storageModule, "listProjects"),
	reorderSlides: vi.spyOn(storageModule, "reorderSlides"),
	setActiveSlide: vi.spyOn(storageModule, "setActiveSlide"),
	updateProject: vi.spyOn(storageModule, "updateProject"),
	updateSlide: vi.spyOn(storageModule, "updateSlide"),
}

const { useProjectsStore } = await import("@/stores/projects-store")

const createSlide = (overrides?: Partial<Slide>): Slide => {
	const now = "2024-01-01T00:00:00.000Z"
	return {
		id: "slide-1",
		name: "Slide 1",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["instagram-post"],
		fabricJSON: "{}",
		thumbnailDataUrl: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	}
}

const createProject = (slideOverrides?: Partial<Slide>): Project => {
	const now = "2024-01-01T00:00:00.000Z"
	const slide = createSlide(slideOverrides)
	return {
		id: "project-1",
		name: "Project",
		slides: [slide],
		activeSlideId: slide.id,
		createdAt: now,
		updatedAt: now,
	}
}

describe("projects store", () => {
	beforeEach(() => {
		useProjectsStore.setState({
			projects: [],
			currentProject: null,
			isLoading: false,
			error: null,
			pendingSave: false,
			lastSavedAt: null,
		})
		for (const key of Object.keys(storageMocks) as Array<keyof typeof storageMocks>) {
			storageMocks[key].mockReset()
		}
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	it("rolls back optimistic slide updates on storage failure", async () => {
		const initial = createProject()
		const server = createProject({ name: "Server Slide" })

		storageMocks.updateSlide.mockRejectedValue(new Error("boom"))
		storageMocks.getProject.mockResolvedValue(server)

		useProjectsStore.setState({
			...useProjectsStore.getState(),
			currentProject: initial,
			projects: [
				{
					id: initial.id,
					name: initial.name,
					slideCount: initial.slides.length,
					thumbnailDataUrl: initial.slides[0]?.thumbnailDataUrl ?? null,
					updatedAt: initial.updatedAt,
				},
			],
		})

		await useProjectsStore.getState().updateSlide("slide-1", { name: "Optimistic" })

		const state = useProjectsStore.getState()
		expect(state.error).toBe("boom")
		expect(state.currentProject?.slides[0].name).toBe("Server Slide")
	})

	it("tracks dirty and saved state", () => {
		useProjectsStore.getState().markDirty()
		expect(useProjectsStore.getState().pendingSave).toBe(true)

		useProjectsStore.getState().markSaved()
		expect(useProjectsStore.getState().pendingSave).toBe(false)
		expect(useProjectsStore.getState().lastSavedAt).not.toBeNull()
	})
})
