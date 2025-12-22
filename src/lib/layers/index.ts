import type { Object as FabricObject } from "fabric"
import {
	Circle,
	Image,
	type LucideIcon,
	Pencil,
	Shapes,
	Square,
	Triangle,
	Type,
} from "lucide-react"
import { nanoid } from "nanoid"
import type { ObjectType } from "@/types/layers"

/**
 * Generate a unique layer ID
 */
export function generateLayerId(): string {
	return nanoid(10)
}

/**
 * Determine the object type from a Fabric.js object
 */
export function getObjectType(obj: FabricObject): ObjectType {
	const type = obj.type?.toLowerCase()

	switch (type) {
		case "i-text":
		case "itext":
		case "text":
		case "textbox":
			return "text"
		case "rect":
		case "rectangle":
			return "rect"
		case "circle":
		case "ellipse":
			return "circle"
		case "triangle":
			return "triangle"
		case "image":
			return "image"
		case "group":
		case "activeselection":
			return "group"
		case "path":
		case "line":
		case "polygon":
		case "polyline":
			return "path"
		default:
			return "unknown"
	}
}

/**
 * Get human-readable label for an object type
 */
export function getObjectTypeLabel(type: ObjectType): string {
	switch (type) {
		case "text":
			return "Text"
		case "rect":
			return "Rectangle"
		case "circle":
			return "Circle"
		case "triangle":
			return "Triangle"
		case "image":
			return "Image"
		case "group":
			return "Group"
		case "path":
			return "Path"
		default:
			return "Object"
	}
}

/**
 * Generate a unique layer name based on object type and existing names
 */
export function generateLayerName(type: ObjectType, existingNames: string[]): string {
	const baseLabel = getObjectTypeLabel(type)

	// Find the next available number
	let counter = 1
	let name = `${baseLabel} ${counter}`

	while (existingNames.includes(name)) {
		counter++
		name = `${baseLabel} ${counter}`
	}

	return name
}

/**
 * Get the appropriate icon for an object type
 */
export function getLayerIcon(type: ObjectType): LucideIcon {
	switch (type) {
		case "text":
			return Type
		case "rect":
			return Square
		case "circle":
			return Circle
		case "triangle":
			return Triangle
		case "image":
			return Image
		case "group":
			return Shapes
		case "path":
			return Pencil
		default:
			return Shapes
	}
}

/**
 * Get layer ID from a Fabric object (with type assertion for custom property)
 */
export function getLayerId(obj: FabricObject): string | undefined {
	return (obj as FabricObject & { layerId?: string }).layerId
}

/**
 * Get layer name from a Fabric object (with type assertion for custom property)
 */
export function getLayerName(obj: FabricObject): string | undefined {
	return (obj as FabricObject & { layerName?: string }).layerName
}

/**
 * Set layer ID on a Fabric object
 */
export function setLayerId(obj: FabricObject, id: string): void {
	obj.set("layerId" as keyof FabricObject, id as never)
}

/**
 * Set layer name on a Fabric object
 */
export function setLayerName(obj: FabricObject, name: string): void {
	obj.set("layerName" as keyof FabricObject, name as never)
}
