import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { closeDb, getDb, isIndexedDBAvailable } from "@/lib/storage/indexeddb"
import { CURRENT_SCHEMA_VERSION } from "@/types/project"
import { resetIndexedDb } from "../../../../tests/utils/indexeddb"

describe("indexeddb", () => {
	const expectedStores = [
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

	beforeEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	afterEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	it("creates schema stores at current version", async () => {
		const db = await getDb()
		expect(db.version).toBe(CURRENT_SCHEMA_VERSION)
		const storeNames = Array.from(db.objectStoreNames)
		for (const store of expectedStores) {
			expect(storeNames).toContain(store)
		}
	})

	it("reports availability based on indexedDB presence", () => {
		const original = globalThis.indexedDB
		Object.defineProperty(globalThis, "indexedDB", {
			value: undefined,
			configurable: true,
		})

		expect(isIndexedDBAvailable()).toBe(false)

		Object.defineProperty(globalThis, "indexedDB", {
			value: original,
			configurable: true,
		})
		expect(isIndexedDBAvailable()).toBe(true)
	})
})
