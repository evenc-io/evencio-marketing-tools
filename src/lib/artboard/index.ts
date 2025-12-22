import type { Object as FabricObject } from "fabric"

/**
 * Check if a Fabric object is the artboard background.
 * The artboard is identified by data.isArtboard === true
 */
export function isArtboard(obj: FabricObject): boolean {
	return (obj.data as { isArtboard?: boolean } | undefined)?.isArtboard === true
}

/**
 * Get the artboard from a canvas, or null if not found.
 */
export function getArtboard(canvas: { getObjects(): FabricObject[] }): FabricObject | null {
	return canvas.getObjects().find(isArtboard) ?? null
}

/**
 * Get all user objects (everything except the artboard).
 */
export function getUserObjects(canvas: { getObjects(): FabricObject[] }): FabricObject[] {
	return canvas.getObjects().filter((obj) => !isArtboard(obj))
}
