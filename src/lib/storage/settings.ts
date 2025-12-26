import { closeDb, isIndexedDBAvailable } from "./indexeddb"

const DB_NAME = "evencio-marketing-tools"

export interface StorageEstimate {
	used: number
	quota: number
}

/**
 * Get storage usage estimate from the Storage API.
 * Returns null if the Storage API is not available.
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
	if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
		return null
	}

	try {
		const estimate = await navigator.storage.estimate()
		return {
			used: estimate.usage ?? 0,
			quota: estimate.quota ?? 0,
		}
	} catch {
		return null
	}
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"

	const units = ["B", "KB", "MB", "GB"]
	const k = 1024
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	const value = bytes / k ** i

	return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Clear all data from IndexedDB.
 * Closes the current connection, deletes the database, and resets the singleton.
 */
export async function clearAllData(): Promise<void> {
	if (!isIndexedDBAvailable()) {
		throw new Error("IndexedDB is not available")
	}

	// Close existing connection first
	await closeDb()

	// Delete the database
	return new Promise((resolve, reject) => {
		let settled = false
		const finalize = (fn: () => void) => {
			if (settled) return
			settled = true
			fn()
		}
		const request = indexedDB.deleteDatabase(DB_NAME)

		request.onsuccess = () => {
			finalize(resolve)
		}

		request.onerror = () => {
			finalize(() => reject(new Error("Failed to delete database")))
		}

		request.onblocked = () => {
			console.warn("[Storage] Database deletion blocked by another connection")
			finalize(() =>
				reject(new Error("Database deletion blocked. Close other tabs and try again.")),
			)
		}
	})
}

/**
 * Check if browser is in private/incognito mode.
 * Detection is heuristic and may not work in all browsers.
 */
export async function isPrivateBrowsing(): Promise<boolean> {
	if (!isIndexedDBAvailable()) {
		return true // Treat unavailable as private
	}

	// Check persistence without requesting it (avoid side effects).
	if (navigator.storage?.persisted) {
		try {
			const persisted = await navigator.storage.persisted()
			return !persisted
		} catch {
			return true
		}
	}

	return false
}
