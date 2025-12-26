// Database

// Autosave
export {
	cancelAutosave,
	flushAutosave,
	resetAutosaveState,
	scheduleAutosave,
} from "./autosave"
export { closeDb, getDb, isIndexedDBAvailable } from "./indexeddb"
// Settings
export {
	clearAllData,
	formatBytes,
	getStorageEstimate,
	isPrivateBrowsing,
	type StorageEstimate,
} from "./settings"
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
