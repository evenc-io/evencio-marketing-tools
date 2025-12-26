import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { createIndexedDbAssetRegistry } from "@/lib/asset-library/registry-indexeddb"
import { SAMPLE_ASSETS, SAMPLE_TAG } from "@/lib/asset-library/sample-data"
import { closeDb } from "@/lib/storage/indexeddb"
import type { Asset, AssetVersion } from "@/types/asset-library"
import { resetIndexedDb } from "../../../../tests/utils/indexeddb"

describe("registry-indexeddb", () => {
	beforeEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	afterEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	it("stores and retrieves binary asset data", async () => {
		const registry = createIndexedDbAssetRegistry()
		const bytes = new Uint8Array([1, 2, 3])
		const fileRef = await registry.storage.put({ bytes, contentType: "image/png" })

		const record = await registry.storage.get(fileRef.storageKey)
		expect(record?.contentType).toBe("image/png")
		expect(Array.from(record?.bytes ?? [])).toEqual([1, 2, 3])

		await registry.storage.delete(fileRef.storageKey)
		const removed = await registry.storage.get(fileRef.storageKey)
		expect(removed).toBeNull()
	})

	it("filters assets by scope, tags, and search", async () => {
		const registry = createIndexedDbAssetRegistry()
		const orgAsset = structuredClone(SAMPLE_ASSETS[0]) as Asset
		const personalAsset = {
			...structuredClone(SAMPLE_ASSETS[1]),
			id: "asset_personal",
			scope: {
				scope: "personal" as const,
				orgId: "org_demo",
				ownerUserId: "user_demo",
			},
			metadata: {
				...SAMPLE_ASSETS[1].metadata,
				title: "Personal asset",
				tags: [],
			},
		} as Asset

		await registry.metadata.upsertTag(SAMPLE_TAG)
		await registry.metadata.upsertAsset(orgAsset)
		await registry.metadata.upsertAsset(personalAsset)

		const scoped = await registry.metadata.listAssets({ scope: "org" })
		expect(scoped.map((asset) => asset.id)).toEqual([orgAsset.id])

		const tagged = await registry.metadata.listAssets({ tagIds: [SAMPLE_TAG.id] })
		expect(tagged.map((asset) => asset.id)).toEqual([orgAsset.id])

		const search = await registry.metadata.listAssets({ search: "personal" })
		expect(search.map((asset) => asset.id)).toEqual([personalAsset.id])
	})

	it("returns versions sorted by version number", async () => {
		const registry = createIndexedDbAssetRegistry()
		const asset = structuredClone(SAMPLE_ASSETS[0]) as Asset
		await registry.metadata.upsertAsset(asset)

		const versions: AssetVersion[] = [
			{
				id: "v2",
				assetId: asset.id,
				version: 2,
				createdAt: "2024-01-02T00:00:00.000Z",
				createdBy: "user_demo",
			},
			{
				id: "v1",
				assetId: asset.id,
				version: 1,
				createdAt: "2024-01-01T00:00:00.000Z",
				createdBy: "user_demo",
			},
		]

		await registry.metadata.upsertVersion(versions[0])
		await registry.metadata.upsertVersion(versions[1])

		const ordered = await registry.metadata.listVersions(asset.id)
		expect(ordered.map((version) => version.version)).toEqual([1, 2])
	})
})
