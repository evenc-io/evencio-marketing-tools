import type { Object as FabricObject } from "fabric"

/**
 * Types of canvas objects that can be layers
 */
export type ObjectType =
	| "text"
	| "rect"
	| "circle"
	| "triangle"
	| "image"
	| "group"
	| "path"
	| "unknown"

/**
 * Layer information derived from a Fabric.js object
 */
export interface LayerInfo {
	/** Unique identifier for the layer */
	layerId: string
	/** Display name for the layer (e.g., "Text 1", "Rectangle 2") */
	layerName: string
	/** Type of the object */
	objectType: ObjectType
	/** Whether the layer is visible */
	visible: boolean
	/** Depth in the layers panel (0 = top level, 1+ = nested) */
	depth: number
	/** Parent layer ID when nested (null for top-level layers) */
	parentLayerId: string | null
	/** Reference to the actual Fabric.js object */
	object: FabricObject
}

/**
 * Props for layer-related components
 */
export interface LayerItemProps {
	layer: LayerInfo
	isSelected: boolean
	selectedLayerIds?: string[]
	onSelect: () => void
	onMouseEnter: () => void
	onMouseLeave: () => void
}
