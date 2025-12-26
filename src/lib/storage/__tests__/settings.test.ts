import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { closeDb, getDb } from "@/lib/storage/indexeddb"
import {
	clearAllData,
	formatBytes,
	getStorageEstimate,
	isPrivateBrowsing,
} from "@/lib/storage/settings"
import { resetIndexedDb } from "../../../../tests/utils/indexeddb"

describe("settings storage helpers", () => {
	beforeEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	afterEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	describe("formatBytes", () => {
		it("formats 0 bytes", () => {
			expect(formatBytes(0)).toBe("0 B")
		})

		it("formats bytes", () => {
			expect(formatBytes(500)).toBe("500 B")
		})

		it("formats kilobytes", () => {
			expect(formatBytes(1024)).toBe("1.0 KB")
			expect(formatBytes(1536)).toBe("1.5 KB")
		})

		it("formats megabytes", () => {
			expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
			expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB")
		})

		it("formats gigabytes", () => {
			expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB")
		})
	})

	describe("getStorageEstimate", () => {
		it("returns storage estimate or null", async () => {
			const estimate = await getStorageEstimate()

			// In test environment with fake-indexeddb, Storage API may not be available
			if (estimate !== null) {
				expect(typeof estimate.used).toBe("number")
				expect(typeof estimate.quota).toBe("number")
				expect(estimate.used).toBeGreaterThanOrEqual(0)
				expect(estimate.quota).toBeGreaterThanOrEqual(0)
			} else {
				// null is valid when Storage API is unavailable
				expect(estimate).toBeNull()
			}
		})
	})

	describe("clearAllData", () => {
		it("clears all data from IndexedDB", async () => {
			// First create a database with some data
			const db = await getDb()
			await db.put("projects", {
				id: "test-project",
				name: "Test Project",
				slides: [],
				activeSlideId: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Verify data exists
			const projectBefore = await db.get("projects", "test-project")
			expect(projectBefore).toBeDefined()

			// Clear all data
			await clearAllData()

			// After clearing, getting a new DB connection should show no data
			const dbAfter = await getDb()
			const projectAfter = await dbAfter.get("projects", "test-project")
			expect(projectAfter).toBeUndefined()
		})

		it("handles being called when database is already closed", async () => {
			await closeDb()

			// Should not throw
			await expect(clearAllData()).resolves.toBeUndefined()
		})
	})

	describe("isPrivateBrowsing", () => {
		it("returns boolean", async () => {
			const result = await isPrivateBrowsing()
			expect(typeof result).toBe("boolean")
		})
	})
})
