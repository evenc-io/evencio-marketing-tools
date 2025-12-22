import type { CanvasDimensions, ContentType } from "./editor"

/** UUID v4 string identifier for projects */
export type ProjectId = string

/** UUID v4 string identifier for slides */
export type SlideId = string

/** Current schema version for storage migrations */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * A single slide within a project.
 * Each slide has its own canvas with dimensions and Fabric.js state.
 */
export interface Slide {
	id: SlideId
	name: string
	contentType: ContentType
	dimensions: CanvasDimensions
	/** Serialized Fabric.js canvas state (JSON.stringify of canvas.toJSON()) */
	fabricJSON: string
	/** Base64 data URL for thumbnail preview (JPEG, low quality) */
	thumbnailDataUrl: string | null
	createdAt: string // ISO 8601
	updatedAt: string // ISO 8601
}

/** Input for creating a new slide (id and timestamps auto-generated) */
export type SlideCreateInput = Omit<Slide, "id" | "createdAt" | "updatedAt" | "thumbnailDataUrl">

/** Input for updating an existing slide */
export type SlideUpdateInput = Partial<Omit<Slide, "id" | "createdAt">>

/**
 * A project containing multiple slides.
 * Projects are the top-level organizational unit.
 */
export interface Project {
	id: ProjectId
	name: string
	slides: Slide[]
	/** ID of the currently active/open slide */
	activeSlideId: SlideId | null
	createdAt: string // ISO 8601
	updatedAt: string // ISO 8601
}

/** Input for creating a new project */
export interface ProjectCreateInput {
	name: string
	initialSlide?: SlideCreateInput
}

/** Input for updating an existing project */
export type ProjectUpdateInput = Partial<Omit<Project, "id" | "createdAt" | "slides">>

/**
 * Lightweight project summary for dashboard listing.
 * Avoids loading full slide data for performance.
 */
export interface ProjectListItem {
	id: ProjectId
	name: string
	slideCount: number
	/** Thumbnail from first slide, or null if no slides */
	thumbnailDataUrl: string | null
	updatedAt: string
}

/** Storage metadata for schema versioning */
export interface StorageMetadata {
	schemaVersion: number
	lastMigrationAt: string
}
