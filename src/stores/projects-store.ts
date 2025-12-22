import { create } from "zustand"
import {
	addSlide as storageAddSlide,
	createProject as storageCreateProject,
	deleteProject as storageDeleteProject,
	deleteSlide as storageDeleteSlide,
	duplicateSlide as storageDuplicateSlide,
	getProject as storageGetProject,
	listProjects as storageListProjects,
	reorderSlides as storageReorderSlides,
	setActiveSlide as storageSetActiveSlide,
	updateProject as storageUpdateProject,
	updateSlide as storageUpdateSlide,
} from "@/lib/storage"
import type { CanvasDimensions, ContentType } from "@/types/editor"
import { SOCIAL_DIMENSIONS } from "@/types/editor"
import type {
	Project,
	ProjectId,
	ProjectListItem,
	Slide,
	SlideCreateInput,
	SlideId,
	SlideUpdateInput,
} from "@/types/project"

interface ProjectsState {
	/** List of projects for dashboard (lightweight) */
	projects: ProjectListItem[]
	/** Currently open project (full data) */
	currentProject: Project | null
	/** Loading state */
	isLoading: boolean
	/** Error message */
	error: string | null
	/** Whether there are unsaved changes */
	pendingSave: boolean
	/** Timestamp of last successful save */
	lastSavedAt: string | null
}

interface ProjectsActions {
	// Initialization
	loadProjects: () => Promise<void>

	// Project CRUD
	openProject: (id: ProjectId) => Promise<void>
	createProject: (
		name: string,
		contentType?: ContentType,
		dimensions?: CanvasDimensions,
	) => Promise<ProjectId>
	renameProject: (id: ProjectId, name: string) => Promise<void>
	deleteProject: (id: ProjectId) => Promise<void>
	closeProject: () => void

	// Slide CRUD
	addSlide: (
		contentType: ContentType,
		dimensions: CanvasDimensions,
		name?: string,
	) => Promise<SlideId>
	renameSlide: (slideId: SlideId, name: string) => Promise<void>
	duplicateSlide: (slideId: SlideId) => Promise<SlideId>
	deleteSlide: (slideId: SlideId) => Promise<void>
	reorderSlides: (slideIds: SlideId[]) => Promise<void>
	setActiveSlide: (slideId: SlideId) => Promise<void>
	updateSlide: (slideId: SlideId, input: SlideUpdateInput) => Promise<void>

	// State management
	markSaved: () => void
	markDirty: () => void
	clearError: () => void
	refreshProject: () => Promise<void>
}

const initialState: ProjectsState = {
	projects: [],
	currentProject: null,
	isLoading: false,
	error: null,
	pendingSave: false,
	lastSavedAt: null,
}

export const useProjectsStore = create<ProjectsState & ProjectsActions>((set, get) => ({
	...initialState,

	// === Initialization ===

	loadProjects: async () => {
		set({ isLoading: true, error: null })
		try {
			const projects = await storageListProjects()
			set({ projects, isLoading: false })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load projects",
				isLoading: false,
			})
		}
	},

	// === Project CRUD ===

	openProject: async (id: ProjectId) => {
		set({ isLoading: true, error: null })
		try {
			const project = await storageGetProject(id)
			if (!project) {
				throw new Error(`Project not found: ${id}`)
			}
			set({ currentProject: project, isLoading: false })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to open project",
				isLoading: false,
			})
		}
	},

	createProject: async (
		name: string,
		contentType: ContentType = "social-image",
		dimensions: CanvasDimensions = SOCIAL_DIMENSIONS["instagram-post"],
	) => {
		set({ isLoading: true, error: null })
		try {
			const initialSlide: SlideCreateInput = {
				name: "Slide 1",
				contentType,
				dimensions,
				fabricJSON: JSON.stringify({ version: "6.0.0", objects: [] }),
			}

			const project = await storageCreateProject({ name, initialSlide })

			// Refresh projects list
			const projects = await storageListProjects()
			set({ projects, currentProject: project, isLoading: false })

			return project.id
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to create project",
				isLoading: false,
			})
			throw error
		}
	},

	renameProject: async (id: ProjectId, name: string) => {
		try {
			await storageUpdateProject(id, { name })

			// Update current project if it's the one being renamed
			const { currentProject } = get()
			if (currentProject?.id === id) {
				set({ currentProject: { ...currentProject, name } })
			}

			// Refresh projects list
			const projects = await storageListProjects()
			set({ projects })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to rename project",
			})
		}
	},

	deleteProject: async (id: ProjectId) => {
		try {
			await storageDeleteProject(id)

			// Clear current project if it's the one being deleted
			const { currentProject } = get()
			if (currentProject?.id === id) {
				set({ currentProject: null })
			}

			// Refresh projects list
			const projects = await storageListProjects()
			set({ projects })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to delete project",
			})
		}
	},

	closeProject: () => {
		set({ currentProject: null, pendingSave: false, lastSavedAt: null })
	},

	// === Slide CRUD ===

	addSlide: async (contentType: ContentType, dimensions: CanvasDimensions, name?: string) => {
		const { currentProject } = get()
		if (!currentProject) {
			throw new Error("No project open")
		}

		try {
			const slideCount = currentProject.slides.length
			const slideName = name ?? `Slide ${slideCount + 1}`

			const slide = await storageAddSlide(currentProject.id, {
				name: slideName,
				contentType,
				dimensions,
				fabricJSON: JSON.stringify({ version: "6.0.0", objects: [] }),
			})

			// Update current project
			set({
				currentProject: {
					...currentProject,
					slides: [...currentProject.slides, slide],
					activeSlideId: slide.id,
				},
			})

			return slide.id
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to add slide",
			})
			throw error
		}
	},

	renameSlide: async (slideId: SlideId, name: string) => {
		const { currentProject } = get()
		if (!currentProject) return

		try {
			await storageUpdateSlide(currentProject.id, slideId, { name })

			// Update current project
			set({
				currentProject: {
					...currentProject,
					slides: currentProject.slides.map((s) => (s.id === slideId ? { ...s, name } : s)),
				},
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to rename slide",
			})
		}
	},

	duplicateSlide: async (slideId: SlideId) => {
		const { currentProject } = get()
		if (!currentProject) {
			throw new Error("No project open")
		}

		try {
			const newSlide = await storageDuplicateSlide(currentProject.id, slideId)

			// Find source index and insert after
			const sourceIndex = currentProject.slides.findIndex((s) => s.id === slideId)
			const newSlides = [...currentProject.slides]
			newSlides.splice(sourceIndex + 1, 0, newSlide)

			set({
				currentProject: {
					...currentProject,
					slides: newSlides,
					activeSlideId: newSlide.id,
				},
			})

			return newSlide.id
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to duplicate slide",
			})
			throw error
		}
	},

	deleteSlide: async (slideId: SlideId) => {
		const { currentProject } = get()
		if (!currentProject) return

		try {
			await storageDeleteSlide(currentProject.id, slideId)

			const newSlides = currentProject.slides.filter((s) => s.id !== slideId)
			const newActiveSlideId =
				currentProject.activeSlideId === slideId
					? (newSlides[0]?.id ?? null)
					: currentProject.activeSlideId

			set({
				currentProject: {
					...currentProject,
					slides: newSlides,
					activeSlideId: newActiveSlideId,
				},
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to delete slide",
			})
		}
	},

	reorderSlides: async (slideIds: SlideId[]) => {
		const { currentProject } = get()
		if (!currentProject) return

		try {
			await storageReorderSlides(currentProject.id, slideIds)

			// Reorder in memory
			const slideMap = new Map(currentProject.slides.map((s) => [s.id, s]))
			const reordered = slideIds
				.map((id) => slideMap.get(id))
				.filter((s): s is Slide => s !== undefined)

			set({
				currentProject: {
					...currentProject,
					slides: reordered,
				},
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to reorder slides",
			})
		}
	},

	setActiveSlide: async (slideId: SlideId) => {
		const { currentProject } = get()
		if (!currentProject) return

		try {
			await storageSetActiveSlide(currentProject.id, slideId)

			set({
				currentProject: {
					...currentProject,
					activeSlideId: slideId,
				},
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to set active slide",
			})
		}
	},

	updateSlide: async (slideId: SlideId, input: SlideUpdateInput) => {
		const { currentProject } = get()
		if (!currentProject) return

		const updatedAt = new Date().toISOString()
		const updatedSlides = currentProject.slides.map((slide) =>
			slide.id === slideId ? { ...slide, ...input, updatedAt } : slide,
		)
		const updatedProject: Project = {
			...currentProject,
			slides: updatedSlides,
			updatedAt,
		}

		const projects = get().projects
		const updatedProjects = projects.length
			? projects.map((project) => {
					if (project.id !== currentProject.id) return project
					const firstSlideThumbnail = updatedProject.slides[0]?.thumbnailDataUrl ?? null
					return {
						...project,
						name: updatedProject.name,
						slideCount: updatedProject.slides.length,
						thumbnailDataUrl: firstSlideThumbnail,
						updatedAt,
					}
				})
			: projects

		set({
			currentProject: updatedProject,
			projects: updatedProjects,
		})

		try {
			await storageUpdateSlide(currentProject.id, slideId, input)
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to update slide",
			})
			await get().refreshProject()
		}
	},

	// === State Management ===

	markSaved: () => {
		set({
			pendingSave: false,
			lastSavedAt: new Date().toISOString(),
		})
	},

	markDirty: () => {
		set({ pendingSave: true })
	},

	clearError: () => {
		set({ error: null })
	},

	refreshProject: async () => {
		const { currentProject } = get()
		if (!currentProject) return

		try {
			const project = await storageGetProject(currentProject.id)
			if (project) {
				set({ currentProject: project })
			}
		} catch (error) {
			console.error("[ProjectsStore] Failed to refresh project:", error)
		}
	},
}))

// === Selectors ===

export const selectCurrentSlide = (state: ProjectsState): Slide | null => {
	if (!state.currentProject?.activeSlideId) return null
	return (
		state.currentProject.slides.find((s) => s.id === state.currentProject?.activeSlideId) ?? null
	)
}

export const selectSlideById = (state: ProjectsState, slideId: SlideId): Slide | null => {
	if (!state.currentProject) return null
	return state.currentProject.slides.find((s) => s.id === slideId) ?? null
}
