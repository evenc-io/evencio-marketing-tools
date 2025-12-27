import type { Canvas, Object as FabricObject, Group } from "fabric"
import { Rect } from "fabric"
import { create } from "zustand"
import { serializeCanvas } from "@/lib/canvas/serialize"
import { CANVAS_PADDING } from "@/lib/constants/canvas"
import {
	generateLayerId,
	generateLayerName,
	getLayerId,
	getLayerName,
	getObjectType,
	setLayerId,
	setLayerName,
} from "@/lib/layers"
import type { CanvasDimensions, ContentType, EditorActions, EditorState } from "@/types/editor"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "@/types/editor"

const KNOWN_DIMENSIONS = [...Object.values(SOCIAL_DIMENSIONS), ...Object.values(POSTER_DIMENSIONS)]

const initialState: EditorState = {
	canvas: null,
	canvasProjectId: null,
	selectedObjects: [],
	hoveredLayerId: null,
	hoveredObject: null,
	contentType: "social-image",
	dimensions: SOCIAL_DIMENSIONS["instagram-post"],
	isDirty: false,
	isExporting: false,
	projectId: null,
	slideId: null,
	layerVersion: 0,
	inspectMode: false,
	previewMode: false,
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
	...initialState,

	setCanvas: (canvas: Canvas | null, projectId?: string | null) =>
		set((state) => {
			const nextProjectId = projectId ?? null
			const shouldClear =
				!canvas || state.canvas !== canvas || state.canvasProjectId !== nextProjectId

			return {
				canvas,
				canvasProjectId: nextProjectId,
				...(shouldClear
					? {
							selectedObjects: [],
							hoveredObject: null,
							hoveredLayerId: null,
						}
					: {}),
			}
		}),

	setSelectedObjects: (objects: FabricObject[]) => set({ selectedObjects: objects }),

	addToSelection: (object: FabricObject) =>
		set((state) => {
			if (state.selectedObjects.some((obj) => obj === object)) {
				return state
			}
			return { selectedObjects: [...state.selectedObjects, object] }
		}),

	removeFromSelection: (object: FabricObject) =>
		set((state) => ({
			selectedObjects: state.selectedObjects.filter((obj) => obj !== object),
		})),

	clearSelection: () => set({ selectedObjects: [] }),

	setHoveredLayerId: (layerId: string | null) => set({ hoveredLayerId: layerId }),

	setHoveredObject: (object: FabricObject | null) => set({ hoveredObject: object }),

	setContentType: (contentType: ContentType) => set({ contentType }),

	setDimensions: (dimensions: CanvasDimensions) => set({ dimensions }),

	setIsDirty: (isDirty: boolean) => set({ isDirty }),

	setIsExporting: (isExporting: boolean) => set({ isExporting }),

	setProjectContext: (projectId: string | null, slideId: string | null) => {
		set({ projectId, slideId })
	},

	loadSlideToCanvas: async (fabricJSON: string, targetDimensions?: CanvasDimensions) => {
		const {
			canvas,
			canvasProjectId,
			projectId: activeProjectId,
			dimensions: currentDimensions,
		} = get()
		// Use provided dimensions or fall back to current store dimensions
		const dimensions = targetDimensions ?? currentDimensions
		if (!canvas || !activeProjectId || canvasProjectId !== activeProjectId) {
			console.warn("[EditorStore] No canvas available to load slide")
			return
		}
		const canvasStatus = canvas as unknown as { disposed?: boolean; destroyed?: boolean }
		if (canvasStatus.disposed || canvasStatus.destroyed) {
			console.warn("[EditorStore] Canvas is disposed, skipping slide load")
			return
		}
		const canvasRef = canvas

		try {
			const parsed = JSON.parse(fabricJSON)

			// Check if the saved JSON uses old coordinate system (without padding)
			// by looking at canvas dimensions in the JSON
			const savedWidth = typeof parsed.width === "number" ? parsed.width : 0
			const savedHeight = typeof parsed.height === "number" ? parsed.height : 0
			const needsMigration = KNOWN_DIMENSIONS.some(
				(dim) => Math.abs(savedWidth - dim.width) < 2 && Math.abs(savedHeight - dim.height) < 2,
			)

			await canvas.loadFromJSON(parsed)
			if (get().canvas !== canvasRef) {
				return
			}

			// loadFromJSON resets canvas dimensions - restore correct size
			canvas.setDimensions({
				width: dimensions.width + CANVAS_PADDING * 2,
				height: dimensions.height + CANVAS_PADDING * 2,
			})

			// Remove old background rects that were saved before artboard pattern
			// These include: rects marked as artboard, rects at origin (0,0), or rects at padding position
			const objectsToRemove: FabricObject[] = []
			canvas.getObjects().forEach((obj) => {
				// Remove if marked as artboard (we'll add fresh one)
				const objData = obj.data as { isArtboard?: boolean } | undefined
				if (objData?.isArtboard) {
					objectsToRemove.push(obj)
					return
				}

				// Check if this looks like an old/corrupted background rect
				if (obj.type === "rect") {
					const isWhiteFill = obj.fill === "#ffffff" || obj.fill === "white" || obj.fill === "#fff"
					const matchesDocSize =
						Math.abs((obj.width || 0) - dimensions.width) < 5 &&
						Math.abs((obj.height || 0) - dimensions.height) < 5

					// Old pattern: rect at origin (0,0)
					const isAtOrigin = obj.left === 0 && obj.top === 0
					const isNotSelectable = obj.selectable === false
					if (isAtOrigin && matchesDocSize && isWhiteFill && isNotSelectable) {
						objectsToRemove.push(obj)
						return
					}

					// Corrupted artboard: rect at padding position (saved without isArtboard marker)
					const isAtPaddingPosition =
						Math.abs((obj.left || 0) - CANVAS_PADDING) < 5 &&
						Math.abs((obj.top || 0) - CANVAS_PADDING) < 5
					if (isAtPaddingPosition && matchesDocSize && isWhiteFill) {
						objectsToRemove.push(obj)
						return
					}
				}
			})

			// Remove identified old background rects
			for (const obj of objectsToRemove) {
				canvas.remove(obj)
			}

			// Remove any objects that are both top-level and inside a group (prevents duplicate children).
			const removeDuplicateGroupChildren = () => {
				const allObjects = canvas.getObjects()
				const seenChildLayerIds = new Set<string>()
				const descendantLayerIds = new Set<string>()
				const duplicateChildren: Array<{ group: Group; child: FabricObject }> = []

				const collectGroupChildren = (obj: FabricObject) => {
					if (obj.type?.toLowerCase() !== "group") return
					const group = obj as Group & { getObjects?: () => FabricObject[] }
					const children = group.getObjects?.() ?? []
					for (const child of children) {
						const layerId = (child as FabricObject & { layerId?: string }).layerId
						if (layerId) {
							if (seenChildLayerIds.has(layerId)) {
								duplicateChildren.push({ group, child })
								continue
							}
							seenChildLayerIds.add(layerId)
							descendantLayerIds.add(layerId)
						}
						collectGroupChildren(child)
					}
				}

				for (const obj of allObjects) {
					collectGroupChildren(obj)
				}

				for (const { group, child } of duplicateChildren) {
					group.remove(child)
				}

				if (descendantLayerIds.size > 0) {
					const topLevelDuplicates = allObjects.filter((obj) => {
						const layerId = (obj as FabricObject & { layerId?: string }).layerId
						return typeof layerId === "string" && descendantLayerIds.has(layerId)
					})
					if (topLevelDuplicates.length > 0) {
						canvas.remove(...topLevelDuplicates)
					}
				}
			}

			removeDuplicateGroupChildren()

			const ensureLayerMetadata = () => {
				const existingNames = new Set<string>()

				const collectNames = (obj: FabricObject) => {
					const name = getLayerName(obj)
					if (name) {
						existingNames.add(name)
					}
					if (obj.type?.toLowerCase() === "group") {
						const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
						const children = group.getObjects?.() ?? []
						for (const child of children) {
							collectNames(child)
						}
					}
				}

				const ensureMetadata = (obj: FabricObject) => {
					if (!getLayerId(obj)) {
						setLayerId(obj, generateLayerId())
					}

					if (!getLayerName(obj)) {
						const name = generateLayerName(getObjectType(obj), Array.from(existingNames))
						setLayerName(obj, name)
						existingNames.add(name)
					}
				}

				const ensureAll = (obj: FabricObject) => {
					ensureMetadata(obj)
					if (obj.type?.toLowerCase() === "group") {
						const group = obj as FabricObject & { getObjects?: () => FabricObject[] }
						const children = group.getObjects?.() ?? []
						for (const child of children) {
							ensureAll(child)
						}
					}
				}

				for (const obj of canvas.getObjects()) {
					const objData = obj.data as { isArtboard?: boolean } | undefined
					if (!objData?.isArtboard) {
						collectNames(obj)
					}
				}

				for (const obj of canvas.getObjects()) {
					const objData = obj.data as { isArtboard?: boolean } | undefined
					if (!objData?.isArtboard) {
						ensureAll(obj)
					}
				}
			}

			ensureLayerMetadata()

			// Migrate old object positions if needed (add CANVAS_PADDING offset)
			if (needsMigration) {
				canvas.getObjects().forEach((obj) => {
					// Skip artboards (shouldn't exist at this point, but be safe)
					const objData = obj.data as { isArtboard?: boolean } | undefined
					if (objData?.isArtboard) return

					// Migrate position by adding padding offset
					obj.set({
						left: (obj.left || 0) + CANVAS_PADDING,
						top: (obj.top || 0) + CANVAS_PADDING,
					})
					obj.setCoords()
				})
			}

			// Add fresh artboard
			// Fabric 7 defaults to center origin; we need left/top for consistent positioning
			const artboard = new Rect({
				left: CANVAS_PADDING,
				top: CANVAS_PADDING,
				width: dimensions.width,
				height: dimensions.height,
				fill: "#ffffff",
				selectable: false,
				evented: false,
				excludeFromExport: false,
				originX: "left",
				originY: "top",
				data: { isArtboard: true },
			})
			canvas.add(artboard)
			canvas.sendObjectToBack(artboard)

			canvas.renderAll()
			if (typeof requestAnimationFrame !== "undefined") {
				requestAnimationFrame(() => {
					if (get().canvas === canvasRef) {
						canvas.renderAll()
					}
				})
			}
			// Increment layer version to update layers panel after loading
			set((state) => ({ isDirty: false, layerVersion: state.layerVersion + 1 }))
		} catch (error) {
			const canvasStatus = canvas as unknown as { disposed?: boolean; destroyed?: boolean }
			if (canvasStatus.disposed || canvasStatus.destroyed) {
				return
			}
			console.error("[EditorStore] Failed to load slide:", error)
		}
	},

	getCanvasJSON: () => {
		const { canvas } = get()
		if (!canvas) return null

		try {
			return serializeCanvas(canvas)
		} catch (error) {
			console.error("[EditorStore] Failed to serialize canvas:", error)
			return null
		}
	},

	incrementLayerVersion: () => {
		set((state) => ({ layerVersion: state.layerVersion + 1 }))
	},

	toggleInspectMode: () => {
		set((state) => {
			const nextInspect = !state.inspectMode
			return {
				inspectMode: nextInspect,
				previewMode: nextInspect ? false : state.previewMode,
			}
		})
	},

	togglePreviewMode: () => {
		set((state) => {
			const nextPreview = !state.previewMode
			return {
				previewMode: nextPreview,
				inspectMode: nextPreview ? false : state.inspectMode,
			}
		})
	},

	reset: () => set(initialState),
}))

export const updateActiveObjects = (updates: Partial<FabricObject>) =>
	useEditorStore.setState((state) => {
		if (state.selectedObjects.length === 0) return state
		for (const obj of state.selectedObjects) {
			obj.set(updates)
		}
		return state
	})
