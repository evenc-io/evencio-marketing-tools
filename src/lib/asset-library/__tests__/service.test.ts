import { describe, expect, it } from "bun:test"
import { createStubAssetRegistry } from "@/lib/asset-library/registry"
import { createAssetLibraryService } from "@/lib/asset-library/service"
import type { AssetCreateInput, AssetMetadataInput, AssetScopeRef } from "@/types/asset-library"

type AccessContext = {
	orgId: string
	eventId: string
	userId: string
	allowGlobalRead?: boolean
	allowGlobalWrite?: boolean
}

const baseMetadata = (overrides?: Partial<AssetMetadataInput>): AssetMetadataInput => ({
	title: "Asset",
	description: null,
	tags: [],
	license: {
		id: "license",
		name: "License",
		attributionRequired: false,
	},
	attribution: null,
	createdBy: "user_1",
	updatedBy: "user_1",
	...overrides,
})

const createService = (context?: Partial<AccessContext>) => {
	const registry = createStubAssetRegistry()
	const accessContext = {
		orgId: "org_1",
		eventId: "event_1",
		userId: "user_1",
		allowGlobalRead: true,
		allowGlobalWrite: false,
		...context,
	}
	const service = createAssetLibraryService(registry, { accessContext, scopedAccessEnabled: true })
	return { registry, service }
}

describe("asset library service", () => {
	it("blocks global writes when disallowed", async () => {
		const { service } = createService({ allowGlobalWrite: false })
		const input: AssetCreateInput = {
			type: "image",
			scope: { scope: "global" },
			metadata: baseMetadata(),
			file: { bytes: new Uint8Array([1]), contentType: "image/png" },
		}

		await expect(service.createAsset(input)).rejects.toThrow(
			"Access denied for write on scope global",
		)
	})

	it("bumps version and records history on updates", async () => {
		const { service } = createService()
		const scope: AssetScopeRef = { scope: "org", orgId: "org_1" }
		const asset = await service.createAsset({
			type: "image",
			scope,
			metadata: baseMetadata({ title: "Original" }),
			file: { bytes: new Uint8Array([1]), contentType: "image/png" },
		})

		const updated = await service.updateAsset(asset.id, {
			metadata: { title: "Updated" },
			changelog: "Rename",
		})

		expect(updated.version).toBe(asset.version + 1)
		const versions = await service.listAssetVersions(asset.id)
		expect(versions.map((version) => version.version)).toEqual([1, 2])
	})

	it("hides assets by default unless includeHidden is set", async () => {
		const { service } = createService()
		const scope: AssetScopeRef = { scope: "org", orgId: "org_1" }
		const asset = await service.createAsset({
			type: "image",
			scope,
			metadata: baseMetadata(),
			file: { bytes: new Uint8Array([1]), contentType: "image/png" },
		})

		await service.hideAsset(asset.id)

		const visible = await service.listAssets()
		expect(visible).toHaveLength(0)

		const all = await service.listAssets({ includeHidden: true })
		expect(all.map((item) => item.id)).toEqual([asset.id])
	})

	it("enforces collection scope matching asset scope", async () => {
		const { service } = createService()
		const scope: AssetScopeRef = { scope: "org", orgId: "org_1" }
		const asset = await service.createAsset({
			type: "image",
			scope,
			metadata: baseMetadata(),
			file: { bytes: new Uint8Array([1]), contentType: "image/png" },
		})

		await expect(
			service.createCollection({
				name: "Mismatch",
				scope: { scope: "event", orgId: "org_1", eventId: "event_1" },
				assetIds: [asset.id],
			}),
		).rejects.toThrow("Collection scope must match asset scope")
	})
})
