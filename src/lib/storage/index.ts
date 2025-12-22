// Database

// Autosave
export {
	cancelAutosave,
	flushAutosave,
	resetAutosaveState,
	scheduleAutosave,
} from "./autosave"
export { closeDb, getDb, isIndexedDBAvailable } from "./indexeddb"
// Storage operations
export {
	addSlide,
	createProject,
	deleteProject,
	deleteSlide,
	duplicateSlide,
	getProject,
	listProjects,
	reorderSlides,
	saveCanvasState,
	setActiveSlide,
	updateProject,
	updateSlide,
} from "./storage-adapter"

// Thumbnail
export { generateThumbnail, generateThumbnailFromJSON } from "./thumbnail"
