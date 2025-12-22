import type { Canvas, Object as FabricObject } from "fabric"

// Augment fabric.Object with custom data property
declare module "fabric" {
	interface FabricObject {
		data?: Record<string, unknown>
	}
}

export type ContentType = "social-image" | "poster"

export type SocialPlatform =
	| "instagram-post"
	| "instagram-story"
	| "facebook-cover"
	| "twitter-header"
	| "linkedin-banner"

export type PosterSize = "a4" | "a3" | "letter" | "custom"

export interface CanvasDimensions {
	width: number
	height: number
	label: string
}

export const SOCIAL_DIMENSIONS: Record<SocialPlatform, CanvasDimensions> = {
	"instagram-post": { width: 1080, height: 1080, label: "Instagram Post" },
	"instagram-story": { width: 1080, height: 1920, label: "Instagram Story" },
	"facebook-cover": { width: 820, height: 312, label: "Facebook Cover" },
	"twitter-header": { width: 1500, height: 500, label: "Twitter/X Header" },
	"linkedin-banner": { width: 1584, height: 396, label: "LinkedIn Banner" },
}

export const POSTER_DIMENSIONS: Record<PosterSize, CanvasDimensions> = {
	a4: { width: 2480, height: 3508, label: "A4 (210 × 297 mm)" },
	a3: { width: 3508, height: 4961, label: "A3 (297 × 420 mm)" },
	letter: { width: 2550, height: 3300, label: "Letter (8.5 × 11 in)" },
	custom: { width: 1920, height: 1080, label: "Custom" },
}

export interface EditorState {
	canvas: Canvas | null
	canvasProjectId: string | null
	selectedObjects: FabricObject[]
	hoveredLayerId: string | null
	hoveredObject: FabricObject | null
	contentType: ContentType
	dimensions: CanvasDimensions
	isDirty: boolean
	isExporting: boolean
	projectId: string | null
	slideId: string | null
	layerVersion: number
	inspectMode: boolean
	previewMode: boolean
}

export interface EditorActions {
	setCanvas: (canvas: Canvas | null, projectId?: string | null) => void
	setSelectedObjects: (objects: FabricObject[]) => void
	addToSelection: (object: FabricObject) => void
	removeFromSelection: (object: FabricObject) => void
	clearSelection: () => void
	setHoveredLayerId: (layerId: string | null) => void
	setHoveredObject: (object: FabricObject | null) => void
	setContentType: (contentType: ContentType) => void
	setDimensions: (dimensions: CanvasDimensions) => void
	setIsDirty: (isDirty: boolean) => void
	setIsExporting: (isExporting: boolean) => void
	setProjectContext: (projectId: string | null, slideId: string | null) => void
	loadSlideToCanvas: (fabricJSON: string, targetDimensions?: CanvasDimensions) => Promise<void>
	getCanvasJSON: () => string | null
	incrementLayerVersion: () => void
	toggleInspectMode: () => void
	togglePreviewMode: () => void
	reset: () => void
}

export interface EditorStore extends EditorState, EditorActions {
	updateActiveObjects: (updates: Partial<FabricObject>) => void
}

export type ExportFormat = "png" | "jpeg" | "pdf"

export interface ExportOptions {
	format: ExportFormat
	quality?: number // 0-1 for jpeg
	scale?: number // multiplier for resolution
	includeBleed?: boolean
}

export interface Template {
	id: string
	name: string
	description: string
	thumbnail: string
	contentType: ContentType
	dimensions: CanvasDimensions
	data: string // JSON serialized Fabric.js canvas
}
