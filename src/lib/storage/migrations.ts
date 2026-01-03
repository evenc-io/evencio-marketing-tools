import type { IDBPDatabase } from "idb"
import { CURRENT_SCHEMA_VERSION } from "@/types/project"

interface Migration {
	version: number
	description: string
	migrate: (db: IDBPDatabase) => void
}

/**
 * Database migrations run in order when schema version increases.
 * Each migration is run once and recorded in metadata.
 */
export const migrations: Migration[] = [
	{
		version: 1,
		description: "Initial schema with projects object store",
		migrate: (db) => {
			// Create projects object store
			if (!db.objectStoreNames.contains("projects")) {
				const projectsStore = db.createObjectStore("projects", { keyPath: "id" })
				projectsStore.createIndex("updatedAt", "updatedAt", { unique: false })
				projectsStore.createIndex("name", "name", { unique: false })
			}

			// Create metadata object store for schema versioning
			if (!db.objectStoreNames.contains("metadata")) {
				db.createObjectStore("metadata", { keyPath: "key" })
			}
		},
	},
	{
		version: 2,
		description: "Asset library stores for registry metadata and storage",
		migrate: (db) => {
			if (!db.objectStoreNames.contains("assets")) {
				const assetsStore = db.createObjectStore("assets", { keyPath: "id" })
				assetsStore.createIndex("type", "type", { unique: false })
				assetsStore.createIndex("scope", "scope.scope", { unique: false })
			}

			if (!db.objectStoreNames.contains("assetTags")) {
				const tagsStore = db.createObjectStore("assetTags", { keyPath: "id" })
				tagsStore.createIndex("scope", "scope.scope", { unique: false })
			}

			if (!db.objectStoreNames.contains("assetCollections")) {
				const collectionsStore = db.createObjectStore("assetCollections", { keyPath: "id" })
				collectionsStore.createIndex("scope", "scope.scope", { unique: false })
			}

			if (!db.objectStoreNames.contains("assetFavorites")) {
				const favoritesStore = db.createObjectStore("assetFavorites", { keyPath: "id" })
				favoritesStore.createIndex("userId", "userId", { unique: false })
				favoritesStore.createIndex("assetId", "assetId", { unique: false })
			}

			if (!db.objectStoreNames.contains("assetVersions")) {
				const versionsStore = db.createObjectStore("assetVersions", { keyPath: "id" })
				versionsStore.createIndex("assetId", "assetId", { unique: false })
				versionsStore.createIndex("version", "version", { unique: false })
			}

			if (!db.objectStoreNames.contains("assetStorage")) {
				db.createObjectStore("assetStorage", { keyPath: "storageKey" })
			}
		},
	},
	{
		version: 3,
		description: "Snippet editor draft storage",
		migrate: (db) => {
			if (!db.objectStoreNames.contains("snippetDrafts")) {
				const draftsStore = db.createObjectStore("snippetDrafts", { keyPath: "id" })
				draftsStore.createIndex("updatedAt", "updatedAt", { unique: false })
			}
		},
	},
]

/**
 * Run all pending migrations from currentVersion to CURRENT_SCHEMA_VERSION.
 * Called during database upgrade event.
 */
export function runMigrations(db: IDBPDatabase, oldVersion: number): void {
	const pendingMigrations = migrations.filter((m) => m.version > oldVersion)

	for (const migration of pendingMigrations) {
		console.log(`[Storage] Running migration v${migration.version}: ${migration.description}`)
		migration.migrate(db)
	}

	if (pendingMigrations.length > 0) {
		console.log(`[Storage] Migrations complete. Schema version: ${CURRENT_SCHEMA_VERSION}`)
	}
}
