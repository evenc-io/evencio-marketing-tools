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

	try {
		const legacyDb = await openDB<EvencioDBSchema>(LEGACY_DATABASE_NAME, CURRENT_SCHEMA_VERSION, {
			upgrade(db, oldVersion) {
				runMigrations(db as unknown as IDBPDatabase, oldVersion)
			},
		})
		const newDb = await openDB<EvencioDBSchema>(DATABASE_NAME, CURRENT_SCHEMA_VERSION, {
			upgrade(db, oldVersion) {
				runMigrations(db as unknown as IDBPDatabase, oldVersion)
			},
		})

		for (const storeName of STORE_NAMES) {
			const records = await legacyDb.getAll(storeName as StoreName)
			if (records.length === 0) continue
			const tx = newDb.transaction(storeName as StoreName, "readwrite")
			for (const record of records) {
				await tx.store.put(record)
			}
			await tx.done
		}

		legacyDb.close()
		newDb.close()
	} catch (error) {
		console.warn("[Storage] Legacy database migration failed", error)
	}
}

/**
 * Get the IndexedDB database instance.
 * Creates and migrates the database on first call.
 */
export async function getDb(): Promise<IDBPDatabase<EvencioDBSchema>> {
	if (!dbPromise) {
		dbPromise = (async () => {
			await migrateLegacyDbIfNeeded()
			return openDB<EvencioDBSchema>(DATABASE_NAME, CURRENT_SCHEMA_VERSION, {
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
