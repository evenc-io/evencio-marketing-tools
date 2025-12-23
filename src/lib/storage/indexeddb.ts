import { type DBSchema, type IDBPDatabase, openDB } from "idb"
import type {
	Asset,
	AssetCollection,
	AssetFavorite,
	AssetStorageRecord,
	AssetTag,
	AssetVersion,
} from "@/types/asset-library"
import type { Project, StorageMetadata } from "@/types/project"
import { CURRENT_SCHEMA_VERSION } from "@/types/project"
import { runMigrations } from "./migrations"

const DB_NAME = "evencio-marketing-tools"

/**
 * IndexedDB schema type for type-safe database operations.
 */
interface EvencioDBSchema extends DBSchema {
	projects: {
		key: string
		value: Project
		indexes: {
			updatedAt: string
			name: string
		}
	}
	assets: {
		key: string
		value: Asset
		indexes: {
			type: string
			scope: string
		}
	}
	assetTags: {
		key: string
		value: AssetTag
		indexes: {
			scope: string
		}
	}
	assetCollections: {
		key: string
		value: AssetCollection
		indexes: {
			scope: string
		}
	}
	assetFavorites: {
		key: string
		value: AssetFavorite
		indexes: {
			userId: string
			assetId: string
		}
	}
	assetVersions: {
		key: string
		value: AssetVersion
		indexes: {
			assetId: string
			version: number
		}
	}
	assetStorage: {
		key: string
		value: AssetStorageRecord
	}
	metadata: {
		key: string
		value: StorageMetadata & { key: string }
	}
}

let dbPromise: Promise<IDBPDatabase<EvencioDBSchema>> | null = null

/**
 * Get the IndexedDB database instance.
 * Creates and migrates the database on first call.
 */
export async function getDb(): Promise<IDBPDatabase<EvencioDBSchema>> {
	if (!dbPromise) {
		dbPromise = openDB<EvencioDBSchema>(DB_NAME, CURRENT_SCHEMA_VERSION, {
			upgrade(db, oldVersion, _newVersion, _transaction) {
				runMigrations(db as unknown as IDBPDatabase, oldVersion)
			},
			blocked() {
				console.warn("[Storage] Database upgrade blocked by another tab")
			},
			blocking() {
				// Close connection to allow other tabs to upgrade
				console.warn("[Storage] Closing connection for upgrade in another tab")
				dbPromise?.then((db) => db.close())
				dbPromise = null
			},
			terminated() {
				console.error("[Storage] Database connection terminated unexpectedly")
				dbPromise = null
			},
		})
	}
	return dbPromise
}

/**
 * Close the database connection.
 * Useful for testing or when the app is being closed.
 */
export async function closeDb(): Promise<void> {
	if (dbPromise) {
		const db = await dbPromise
		db.close()
		dbPromise = null
	}
}

/**
 * Check if IndexedDB is available in the current environment.
 */
export function isIndexedDBAvailable(): boolean {
	try {
		return typeof indexedDB !== "undefined" && indexedDB !== null
	} catch {
		return false
	}
}
