import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb"
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
import type { SnippetDraftRecord } from "@/types/snippet-drafts"
import { runMigrations } from "./migrations"

export const DATABASE_NAME = "evencio-studio"
export const LEGACY_DATABASE_NAME = "evencio-marketing-tools"
const STORE_NAMES = [
	"projects",
	"metadata",
	"assets",
	"assetTags",
	"assetCollections",
	"assetFavorites",
	"assetVersions",
	"assetStorage",
	"snippetDrafts",
] as const
type StoreName = (typeof STORE_NAMES)[number]

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
	snippetDrafts: {
		key: string
		value: SnippetDraftRecord
		indexes: {
			updatedAt: string
		}
	}
	metadata: {
		key: string
		value: StorageMetadata & { key: string }
	}
}

let dbPromise: Promise<IDBPDatabase<EvencioDBSchema>> | null = null

const openDb = () =>
	openDB<EvencioDBSchema>(DATABASE_NAME, CURRENT_SCHEMA_VERSION, {
		upgrade(database, oldVersion, _newVersion, _transaction) {
			runMigrations(database as unknown as IDBPDatabase, oldVersion)
		},
		blocked() {
			console.warn("[Storage] Database upgrade blocked by another tab")
		},
		blocking() {
			// Close connection to allow other tabs to upgrade
			console.warn("[Storage] Closing connection for upgrade in another tab")
			dbPromise?.then((database) => database.close())
			dbPromise = null
		},
		terminated() {
			console.error("[Storage] Database connection terminated unexpectedly")
			dbPromise = null
		},
	})

/**
 * Verify all required object stores exist in the database.
 * Returns true if all stores exist, false if any are missing.
 */
const verifyStoresExist = (db: IDBPDatabase<EvencioDBSchema>): boolean => {
	for (const storeName of STORE_NAMES) {
		if (!db.objectStoreNames.contains(storeName)) {
			return false
		}
	}
	return true
}

const migrateLegacyDbIfNeeded = async () => {
	if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
		return
	}

	let databases: IDBDatabaseInfo[]
	try {
		databases = await indexedDB.databases()
	} catch {
		return
	}

	const hasLegacy = databases.some((db) => db.name === LEGACY_DATABASE_NAME)
	const hasNew = databases.some((db) => db.name === DATABASE_NAME)
	if (!hasLegacy || hasNew) {
		return
	}

	let legacyDb: IDBPDatabase<EvencioDBSchema> | null = null
	let newDb: IDBPDatabase<EvencioDBSchema> | null = null
	try {
		legacyDb = await openDB<EvencioDBSchema>(LEGACY_DATABASE_NAME, CURRENT_SCHEMA_VERSION, {
			upgrade(db, oldVersion) {
				runMigrations(db as unknown as IDBPDatabase, oldVersion)
			},
		})
		newDb = await openDb()

		for (const storeName of STORE_NAMES) {
			// Skip stores that don't exist in legacy database (e.g., if migration failed)
			if (!legacyDb.objectStoreNames.contains(storeName)) continue
			if (!newDb.objectStoreNames.contains(storeName)) continue

			const records = await legacyDb.getAll(storeName as StoreName)
			if (records.length === 0) continue
			const tx = newDb.transaction(storeName as StoreName, "readwrite")
			for (const record of records) {
				await tx.store.put(record)
			}
			await tx.done
		}
	} catch (error) {
		console.warn("[Storage] Legacy database migration failed", error)
	} finally {
		legacyDb?.close()
		newDb?.close()
	}
}

/**
 * Export data from all existing stores in the database.
 * Used during repair to preserve user data.
 */
const exportAllData = async (
	db: IDBPDatabase<EvencioDBSchema>,
): Promise<Partial<Record<StoreName, unknown[]>>> => {
	const exported: Partial<Record<StoreName, unknown[]>> = {}
	for (const storeName of STORE_NAMES) {
		if (db.objectStoreNames.contains(storeName)) {
			try {
				exported[storeName] = await db.getAll(storeName)
			} catch {
				// Store might exist but be inaccessible, skip it
			}
		}
	}
	return exported
}

/**
 * Restore exported data into the database.
 * Used during repair to preserve user data.
 */
const restoreAllData = async (
	db: IDBPDatabase<EvencioDBSchema>,
	exported: Partial<Record<StoreName, unknown[]>>,
): Promise<void> => {
	for (const storeName of STORE_NAMES) {
		const records = exported[storeName]
		if (!records || records.length === 0) continue
		if (!db.objectStoreNames.contains(storeName)) continue

		const tx = db.transaction(storeName, "readwrite")
		for (const record of records) {
			await tx.store.put(record as EvencioDBSchema[typeof storeName]["value"])
		}
		await tx.done
		delete exported[storeName]
	}
}

/**
 * Open the database, handling version conflicts from previous repairs.
 * If the existing version is higher than expected, exports data, deletes, and recreates.
 */
const openDbWithVersionRecovery = async (): Promise<IDBPDatabase<EvencioDBSchema>> => {
	try {
		return await openDb()
	} catch (error) {
		// Handle "requested version is less than existing version" error
		// This can happen if a previous repair bumped the version above CURRENT_SCHEMA_VERSION
		if (error instanceof Error && error.message.includes("less than the existing version")) {
			console.warn("[Storage] Database version conflict detected, performing recovery")

			let existingDb: IDBPDatabase<EvencioDBSchema> | null = null
			let newDb: IDBPDatabase<EvencioDBSchema> | null = null
			try {
				// Open without version to get current state and export data
				existingDb = await openDB<EvencioDBSchema>(DATABASE_NAME)
				const exported = await exportAllData(existingDb)
				existingDb.close()
				existingDb = null

				// Delete and recreate at correct version
				await deleteDB(DATABASE_NAME, {
					blocked() {
						console.warn("[Storage] Database deletion blocked by another tab")
					},
				})

				newDb = await openDb()

				// Restore data
				await restoreAllData(newDb, exported)
				console.log("[Storage] Database version recovery complete, data restored")
				return newDb
			} catch (recoveryError) {
				newDb?.close()
				throw recoveryError
			} finally {
				existingDb?.close()
			}
		}
		throw error
	}
}

/**
 * Get the IndexedDB database instance.
 * Creates and migrates the database on first call.
 * Detects and repairs corrupted databases with missing object stores.
 */
export async function getDb(): Promise<IDBPDatabase<EvencioDBSchema>> {
	if (!dbPromise) {
		dbPromise = (async () => {
			let db: IDBPDatabase<EvencioDBSchema> | null = null
			try {
				await migrateLegacyDbIfNeeded()

				db = await openDbWithVersionRecovery()

				// Check if all required object stores exist (handles corrupted migrations)
				if (!verifyStoresExist(db)) {
					console.warn("[Storage] Missing object stores detected, performing full repair")

					// Export all existing data to preserve it
					const exported = await exportAllData(db)
					db.close()

					// Delete and recreate database at correct schema version
					await deleteDB(DATABASE_NAME, {
						blocked() {
							console.warn("[Storage] Database deletion blocked by another tab")
						},
					})

					db = await openDb()

					// Restore preserved data
					await restoreAllData(db, exported)
					console.log("[Storage] Database repair complete, data restored")
				}

				return db
			} catch (error) {
				db?.close()
				dbPromise = null
				throw error
			}
		})()
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
