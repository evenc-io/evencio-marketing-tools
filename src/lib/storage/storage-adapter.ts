import { nanoid } from "nanoid"
import type {
	Project,
	ProjectCreateInput,
	ProjectId,
	ProjectListItem,
	ProjectUpdateInput,
	Slide,
	SlideCreateInput,
	SlideId,
	SlideUpdateInput,
} from "@/types/project"
import { getDb } from "./indexeddb"

const slideWriteQueues = new Map<string, Promise<unknown>>()

const enqueueSlideWrite = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
	const previous = slideWriteQueues.get(key) ?? Promise.resolve()
	const next = previous.then(task, task)
	slideWriteQueues.set(key, next)
	try {
		return await next
	} finally {
		if (slideWriteQueues.get(key) === next) {
			slideWriteQueues.delete(key)
		}
	}
}

/**
 * Create a new project with optional initial slide.
 */
export async function createProject(input: ProjectCreateInput): Promise<Project> {
	const db = await getDb()
	const now = new Date().toISOString()

	const project: Project = {
		id: nanoid(),
		name: input.name,
		slides: [],
		activeSlideId: null,
		createdAt: now,
		updatedAt: now,
	}

	// Add initial slide if provided
	if (input.initialSlide) {
		const slide = createSlideObject(input.initialSlide)
		project.slides.push(slide)
		project.activeSlideId = slide.id
	}

	await db.put("projects", project)
	return project
}

/**
 * Get a project by ID.
 */
export async function getProject(id: ProjectId): Promise<Project | null> {
	const db = await getDb()
	const project = await db.get("projects", id)
	return project ?? null
}

/**
 * Get all projects as lightweight list items for dashboard.
 * Sorted by updatedAt descending (most recent first).
 */
export async function listProjects(): Promise<ProjectListItem[]> {
	const db = await getDb()
	const projects = await db.getAllFromIndex("projects", "updatedAt")

	// Map to lightweight items and reverse for descending order
	return projects
		.map((p) => ({
			id: p.id,
			name: p.name,
			slideCount: p.slides.length,
			thumbnailDataUrl: p.slides[0]?.thumbnailDataUrl ?? null,
			updatedAt: p.updatedAt,
		}))
		.reverse()
}

/**
 * Update a project's metadata (not slides).
 */
export async function updateProject(id: ProjectId, input: ProjectUpdateInput): Promise<Project> {
	const db = await getDb()
	const project = await db.get("projects", id)

	if (!project) {
		throw new Error(`Project not found: ${id}`)
	}

	const updated: Project = {
		...project,
		...input,
		updatedAt: new Date().toISOString(),
	}

	await db.put("projects", updated)
	return updated
}

/**
 * Delete a project and all its slides.
 */
export async function deleteProject(id: ProjectId): Promise<void> {
	const db = await getDb()
	await db.delete("projects", id)
}

/**
 * Add a new slide to a project.
 */
export async function addSlide(projectId: ProjectId, input: SlideCreateInput): Promise<Slide> {
	const db = await getDb()
	const project = await db.get("projects", projectId)

	if (!project) {
		throw new Error(`Project not found: ${projectId}`)
	}

	const slide = createSlideObject(input)
	project.slides.push(slide)
	project.activeSlideId = slide.id
	project.updatedAt = new Date().toISOString()

	await db.put("projects", project)
	return slide
}

/**
 * Update a slide within a project.
 */
export async function updateSlide(
	projectId: ProjectId,
	slideId: SlideId,
	input: SlideUpdateInput,
): Promise<Slide> {
	return enqueueSlideWrite(`${projectId}:${slideId}`, async () => {
		const db = await getDb()
		const project = await db.get("projects", projectId)

		if (!project) {
			throw new Error(`Project not found: ${projectId}`)
		}

		const slideIndex = project.slides.findIndex((s) => s.id === slideId)
		if (slideIndex === -1) {
			throw new Error(`Slide not found: ${slideId}`)
		}

		const updatedSlide: Slide = {
			...project.slides[slideIndex],
			...input,
			updatedAt: new Date().toISOString(),
		}

		project.slides[slideIndex] = updatedSlide
		project.updatedAt = new Date().toISOString()

		await db.put("projects", project)
		return updatedSlide
	})
}

/**
 * Delete a slide from a project.
 */
export async function deleteSlide(projectId: ProjectId, slideId: SlideId): Promise<void> {
	const db = await getDb()
	const project = await db.get("projects", projectId)

	if (!project) {
		throw new Error(`Project not found: ${projectId}`)
	}

	const slideIndex = project.slides.findIndex((s) => s.id === slideId)
	if (slideIndex === -1) {
		throw new Error(`Slide not found: ${slideId}`)
	}

	project.slides.splice(slideIndex, 1)

	// Update activeSlideId if deleted slide was active
	if (project.activeSlideId === slideId) {
		project.activeSlideId = project.slides[0]?.id ?? null
	}

	project.updatedAt = new Date().toISOString()
	await db.put("projects", project)
}

/**
 * Reorder slides within a project.
 */
export async function reorderSlides(projectId: ProjectId, slideIds: SlideId[]): Promise<void> {
	const db = await getDb()
	const project = await db.get("projects", projectId)

	if (!project) {
		throw new Error(`Project not found: ${projectId}`)
	}

	// Create a map for quick lookup
	const slideMap = new Map(project.slides.map((s) => [s.id, s]))

	// Reorder based on provided IDs
	const reordered = slideIds
		.map((id) => slideMap.get(id))
		.filter((s): s is Slide => s !== undefined)

	// Verify all slides are accounted for
	if (reordered.length !== project.slides.length) {
		throw new Error("Reorder failed: slide count mismatch")
	}

	project.slides = reordered
	project.updatedAt = new Date().toISOString()

	await db.put("projects", project)
}

/**
 * Save canvas state to a slide. Used for autosave.
 */
export async function saveCanvasState(
	projectId: ProjectId,
	slideId: SlideId,
	fabricJSON: string,
	thumbnailDataUrl?: string | null,
): Promise<void> {
	await enqueueSlideWrite(`${projectId}:${slideId}`, async () => {
		const db = await getDb()
		const project = await db.get("projects", projectId)

		if (!project) {
			throw new Error(`Project not found: ${projectId}`)
		}

		const slideIndex = project.slides.findIndex((s) => s.id === slideId)
		if (slideIndex === -1) {
			throw new Error(`Slide not found: ${slideId}`)
		}

		project.slides[slideIndex].fabricJSON = fabricJSON
		project.slides[slideIndex].updatedAt = new Date().toISOString()

		if (thumbnailDataUrl !== undefined) {
			project.slides[slideIndex].thumbnailDataUrl = thumbnailDataUrl
		}

		project.updatedAt = new Date().toISOString()
		await db.put("projects", project)
	})
}

/**
 * Duplicate a slide within a project.
 */
export async function duplicateSlide(projectId: ProjectId, slideId: SlideId): Promise<Slide> {
	const db = await getDb()
	const project = await db.get("projects", projectId)

	if (!project) {
		throw new Error(`Project not found: ${projectId}`)
	}

	const sourceSlide = project.slides.find((s) => s.id === slideId)
	if (!sourceSlide) {
		throw new Error(`Slide not found: ${slideId}`)
	}

	const now = new Date().toISOString()
	const newSlide: Slide = {
		...sourceSlide,
		id: nanoid(),
		name: `${sourceSlide.name} (Copy)`,
		createdAt: now,
		updatedAt: now,
	}

	// Insert after source slide
	const sourceIndex = project.slides.indexOf(sourceSlide)
	project.slides.splice(sourceIndex + 1, 0, newSlide)
	project.activeSlideId = newSlide.id
	project.updatedAt = now

	await db.put("projects", project)
	return newSlide
}

/**
 * Set the active slide for a project.
 */
export async function setActiveSlide(projectId: ProjectId, slideId: SlideId): Promise<void> {
	const db = await getDb()
	const project = await db.get("projects", projectId)

	if (!project) {
		throw new Error(`Project not found: ${projectId}`)
	}

	const slideExists = project.slides.some((s) => s.id === slideId)
	if (!slideExists) {
		throw new Error(`Slide not found: ${slideId}`)
	}

	project.activeSlideId = slideId
	project.updatedAt = new Date().toISOString()

	await db.put("projects", project)
}

// === Helper Functions ===

function createSlideObject(input: SlideCreateInput): Slide {
	const now = new Date().toISOString()
	return {
		id: nanoid(),
		name: input.name,
		contentType: input.contentType,
		dimensions: input.dimensions,
		fabricJSON: input.fabricJSON,
		thumbnailDataUrl: null,
		createdAt: now,
		updatedAt: now,
	}
}
