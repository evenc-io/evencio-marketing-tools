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
