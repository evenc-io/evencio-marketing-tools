import { nanoid } from "nanoid"
import type {
	Asset,
	AssetAccessContext,
	AssetCollection,
	AssetCreateInput,
	AssetFavorite,
	AssetFileInput,
	AssetId,
	AssetListQuery,
	AssetMetadata,
	AssetMetadataInput,
	AssetScopeRef,
	AssetTag,
	AssetUpdateInput,
	AssetVersion,
} from "@/types/asset-library"
import { ASSET_LIBRARY_FEATURE_FLAGS } from "./feature-flags"
import type { AssetRegistry } from "./registry"

interface AssetLibraryServiceOptions {
	accessContext: AssetAccessContext
	scopedAccessEnabled?: boolean
}

interface AssetLibraryService {
	createAsset: (input: AssetCreateInput, changelog?: string | null) => Promise<Asset>
	getAsset: (id: AssetId) => Promise<Asset | null>
	listAssets: (query?: AssetListQuery & { includeHidden?: boolean }) => Promise<Asset[]>
	updateAsset: (id: AssetId, input: AssetUpdateInput) => Promise<Asset>
	deleteAsset: (id: AssetId) => Promise<void>
	hideAsset: (id: AssetId) => Promise<Asset>
	unhideAsset: (id: AssetId) => Promise<Asset>

	createTag: (input: { name: string; slug: string; scope: AssetScopeRef }) => Promise<AssetTag>
	updateTag: (
		id: string,
		input: { name?: string; slug?: string; scope?: AssetScopeRef },
	) => Promise<AssetTag>
	listTags: (scope?: AssetScopeRef) => Promise<AssetTag[]>
	deleteTag: (id: string) => Promise<void>

	createCollection: (input: {
		name: string
		description?: string | null
		scope: AssetScopeRef
		assetIds: AssetId[]
	}) => Promise<AssetCollection>
	updateCollection: (
		id: string,
		input: {
			name?: string
			description?: string | null
			scope?: AssetScopeRef
			assetIds?: AssetId[]
		},
	) => Promise<AssetCollection>
	listCollections: (scope?: AssetScopeRef) => Promise<AssetCollection[]>
	deleteCollection: (id: string) => Promise<void>

	addFavorite: (assetId: AssetId) => Promise<AssetFavorite>
	removeFavorite: (favoriteId: string) => Promise<void>
	listFavorites: () => Promise<AssetFavorite[]>

	listAssetVersions: (assetId: AssetId) => Promise<AssetVersion[]>
}

export function createAssetLibraryService(
	registry: AssetRegistry,
	options: AssetLibraryServiceOptions,
): AssetLibraryService {
	const context = options.accessContext
	const scopedAccessEnabled =
		options.scopedAccessEnabled ?? ASSET_LIBRARY_FEATURE_FLAGS.scopedAccessEnabled
	const allowGlobalRead = context.allowGlobalRead ?? true
	const allowGlobalWrite = context.allowGlobalWrite ?? false

	const canAccessScope = (scope: AssetScopeRef, intent: "read" | "write"): boolean => {
		if (!scopedAccessEnabled) return true
		switch (scope.scope) {
			case "global":
				return intent === "write" ? allowGlobalWrite : allowGlobalRead
			case "org":
				return Boolean(context.orgId && scope.orgId === context.orgId)
			case "event":
				return Boolean(
					context.orgId &&
						context.eventId &&
						scope.orgId === context.orgId &&
						scope.eventId === context.eventId,
				)
			case "personal":
				return Boolean(
					context.orgId &&
						context.userId &&
						scope.orgId === context.orgId &&
						scope.ownerUserId === context.userId &&
						(scope.eventId ? scope.eventId === context.eventId : true),
				)
		}
	}

	const assertAccess = (scope: AssetScopeRef, intent: "read" | "write") => {
		if (!canAccessScope(scope, intent)) {
			throw new Error(`Access denied for ${intent} on scope ${scope.scope}`)
		}
	}

	const isSameScope = (left: AssetScopeRef, right: AssetScopeRef): boolean => {
		if (left.scope !== right.scope) return false
		switch (left.scope) {
			case "global":
				return true
			case "org":
				return left.orgId === (right as typeof left).orgId
			case "event":
				return (
					left.orgId === (right as typeof left).orgId &&
					left.eventId === (right as typeof left).eventId
				)
			case "personal":
				return (
					left.orgId === (right as typeof left).orgId &&
					left.ownerUserId === (right as typeof left).ownerUserId &&
					(left.eventId ?? null) === ((right as typeof left).eventId ?? null)
				)
		}
	}

	const resolveMetadata = (metadata: AssetMetadataInput, now: string): AssetMetadata => {
		const createdBy = metadata.createdBy ?? context.userId ?? null
		const updatedBy = metadata.updatedBy ?? createdBy ?? context.userId ?? null
		return {
			...metadata,
			createdAt: now,
			updatedAt: now,
			createdBy,
			updatedBy,
		}
	}

	const resolveAssetFile = async (file: AssetFileInput) => {
		if ("bytes" in file) {
			return registry.storage.put(file)
		}
		return file
	}

	const recordVersion = async (assetId: AssetId, version: number, changelog?: string | null) => {
		const now = new Date().toISOString()
		return registry.metadata.upsertVersion({
			id: nanoid(),
			assetId,
			version,
			changelog: changelog ?? null,
			createdAt: now,
			createdBy: context.userId ?? null,
		})
	}

	const validateCollectionAssets = async (assetIds: AssetId[], collectionScope: AssetScopeRef) => {
		if (!assetIds.length) return
		const assets = await Promise.all(assetIds.map((id) => registry.metadata.getAsset(id)))
		for (const asset of assets) {
			if (!asset) {
				throw new Error("Collection references a missing asset")
			}
			assertAccess(asset.scope, "read")
			if (!isSameScope(asset.scope, collectionScope)) {
				throw new Error("Collection scope must match asset scope")
			}
		}
	}

	return {
		async createAsset(input, changelog) {
			assertAccess(input.scope, "write")
			const now = new Date().toISOString()
			const metadata = resolveMetadata(input.metadata, now)
			const id = nanoid()

			let asset: Asset
			if (input.type === "snippet") {
				asset = {
					id,
					type: "snippet",
					scope: input.scope,
					metadata,
					version: 1,
					snippet: input.snippet,
					defaultProps: input.defaultProps,
					hidden: false,
				}
			} else {
				const file = await resolveAssetFile(input.file)
				asset = {
					id,
					type: input.type,
					scope: input.scope,
					metadata,
					version: 1,
					file,
					hidden: false,
				}
			}

			await registry.metadata.upsertAsset(asset)
			await recordVersion(asset.id, asset.version, changelog)
			return asset
		},

		async getAsset(id) {
			const asset = await registry.metadata.getAsset(id)
			if (!asset) return null
			return canAccessScope(asset.scope, "read") ? asset : null
		},

		async listAssets(query) {
			const results = await registry.metadata.listAssets(query)
			let filtered = scopedAccessEnabled
				? results.filter((asset) => canAccessScope(asset.scope, "read"))
				: results

			if (!query?.includeHidden) {
				filtered = filtered.filter((asset) => !asset.hidden)
			}

			return filtered
		},

		async updateAsset(id, input) {
			const existing = await registry.metadata.getAsset(id)
			if (!existing) {
				throw new Error(`Asset not found: ${id}`)
			}

			assertAccess(existing.scope, "write")
			if (input.scope && !isSameScope(existing.scope, input.scope)) {
				assertAccess(input.scope, "write")
			}

			const now = new Date().toISOString()
			let updatedMetadata = existing.metadata
			if (input.metadata) {
				const { createdBy: _createdBy, ...metadataUpdates } = input.metadata
				updatedMetadata = {
					...existing.metadata,
					...metadataUpdates,
					updatedAt: now,
					updatedBy: metadataUpdates.updatedBy ?? context.userId ?? existing.metadata.updatedBy,
				}
			}

			let updatedAsset: Asset = {
				...existing,
				metadata: updatedMetadata,
				scope: input.scope ?? existing.scope,
			}

			let oldStorageKey: string | null = null

			if (input.file) {
				if (existing.type === "snippet") {
					throw new Error("Snippet assets do not support file updates")
				}
				const file = await resolveAssetFile(input.file)
				oldStorageKey = existing.file.storageKey
				updatedAsset = { ...updatedAsset, file } as Asset
			}

			if (input.snippet || input.defaultProps) {
				if (existing.type !== "snippet") {
					throw new Error("Only snippet assets support snippet updates")
				}
				updatedAsset = {
					...updatedAsset,
					snippet: input.snippet ?? existing.snippet,
					defaultProps: input.defaultProps ?? existing.defaultProps,
				} as Asset
			}

			const versionBump =
				input.metadata ||
				input.file ||
				input.snippet ||
				input.defaultProps ||
				(input.scope && !isSameScope(existing.scope, input.scope))

			if (!versionBump) {
				return existing
			}

			if (!input.metadata) {
				updatedMetadata = {
					...updatedMetadata,
					updatedAt: now,
					updatedBy: context.userId ?? existing.metadata.updatedBy,
				}
				updatedAsset = { ...updatedAsset, metadata: updatedMetadata }
			}

			updatedAsset = { ...updatedAsset, version: existing.version + 1 }
			await registry.metadata.upsertAsset(updatedAsset)
			await recordVersion(updatedAsset.id, updatedAsset.version, input.changelog ?? null)

			if (oldStorageKey && updatedAsset.type !== "snippet") {
				if (oldStorageKey !== updatedAsset.file.storageKey) {
					await registry.storage.delete(oldStorageKey)
				}
			}

			return updatedAsset
		},

		async deleteAsset(id) {
			const asset = await registry.metadata.getAsset(id)
			if (!asset) return
			assertAccess(asset.scope, "write")

			await registry.metadata.deleteAsset(id)
			await registry.metadata.deleteVersions(id)
			await registry.metadata.deleteFavoritesByAsset(id)

			if (asset.type !== "snippet") {
				await registry.storage.delete(asset.file.storageKey)
			}
		},

		async hideAsset(id) {
			const asset = await registry.metadata.getAsset(id)
			if (!asset) throw new Error(`Asset not found: ${id}`)
			assertAccess(asset.scope, "write")
			if (asset.hidden) return asset

			const updated = { ...asset, hidden: true, version: asset.version + 1 }
			await registry.metadata.upsertAsset(updated)
			await recordVersion(asset.id, updated.version, "Asset hidden")

			return updated
		},

		async unhideAsset(id) {
			const asset = await registry.metadata.getAsset(id)
			if (!asset) throw new Error(`Asset not found: ${id}`)
			assertAccess(asset.scope, "write")
			if (!asset.hidden) return asset

			const updated = { ...asset, hidden: false, version: asset.version + 1 }
			await registry.metadata.upsertAsset(updated)
			await recordVersion(asset.id, updated.version, "Asset unhidden")

			return updated
		},

		async createTag(input) {
			assertAccess(input.scope, "write")
			const now = new Date().toISOString()
			const tag: AssetTag = {
				id: nanoid(),
				name: input.name,
				slug: input.slug,
				scope: input.scope,
				createdAt: now,
				updatedAt: now,
			}
			await registry.metadata.upsertTag(tag)
			return tag
		},

		async updateTag(id, input) {
			const tags = await registry.metadata.listTags()
			const existing = tags.find((tag) => tag.id === id)
			if (!existing) {
				throw new Error(`Tag not found: ${id}`)
			}

			assertAccess(existing.scope, "write")
			if (input.scope && !isSameScope(existing.scope, input.scope)) {
				assertAccess(input.scope, "write")
			}

			const now = new Date().toISOString()
			const updated: AssetTag = {
				...existing,
				name: input.name ?? existing.name,
				slug: input.slug ?? existing.slug,
				scope: input.scope ?? existing.scope,
				updatedAt: now,
			}
			await registry.metadata.upsertTag(updated)
			return updated
		},

		async listTags(scope) {
			const tags = await registry.metadata.listTags(scope)
			return scopedAccessEnabled ? tags.filter((tag) => canAccessScope(tag.scope, "read")) : tags
		},

		async deleteTag(id) {
			const tags = await registry.metadata.listTags()
			const existing = tags.find((tag) => tag.id === id)
			if (!existing) return
			assertAccess(existing.scope, "write")
			await registry.metadata.deleteTag(id)
		},

		async createCollection(input) {
			assertAccess(input.scope, "write")
			await validateCollectionAssets(input.assetIds, input.scope)
			const now = new Date().toISOString()
			const collection: AssetCollection = {
				id: nanoid(),
				name: input.name,
				description: input.description ?? null,
				scope: input.scope,
				assetIds: input.assetIds,
				createdAt: now,
				updatedAt: now,
			}
			await registry.metadata.upsertCollection(collection)
			return collection
		},

		async updateCollection(id, input) {
			const collections = await registry.metadata.listCollections()
			const existing = collections.find((collection) => collection.id === id)
			if (!existing) {
				throw new Error(`Collection not found: ${id}`)
			}

			assertAccess(existing.scope, "write")
			const nextScope = input.scope ?? existing.scope
			if (!isSameScope(existing.scope, nextScope)) {
				assertAccess(nextScope, "write")
			}

			const assetIds = input.assetIds ?? existing.assetIds
			await validateCollectionAssets(assetIds, nextScope)

			const now = new Date().toISOString()
			const updated: AssetCollection = {
				...existing,
				name: input.name ?? existing.name,
				description: input.description ?? existing.description ?? null,
				scope: nextScope,
				assetIds,
				updatedAt: now,
			}
			await registry.metadata.upsertCollection(updated)
			return updated
		},

		async listCollections(scope) {
			const collections = await registry.metadata.listCollections(scope)
			return scopedAccessEnabled
				? collections.filter((collection) => canAccessScope(collection.scope, "read"))
				: collections
		},

		async deleteCollection(id) {
			const collections = await registry.metadata.listCollections()
			const existing = collections.find((collection) => collection.id === id)
			if (!existing) return
			assertAccess(existing.scope, "write")
			await registry.metadata.deleteCollection(id)
		},

		async addFavorite(assetId) {
			if (!context.userId) {
				throw new Error("User context required to favorite assets")
			}
			const asset = await registry.metadata.getAsset(assetId)
			if (!asset || !canAccessScope(asset.scope, "read")) {
				throw new Error("Asset not found")
			}

			const existing = await registry.metadata.listFavorites(context.userId)
			const match = existing.find((favorite) => favorite.assetId === assetId)
			if (match) return match

			const favorite: AssetFavorite = {
				id: nanoid(),
				assetId,
				userId: context.userId,
				createdAt: new Date().toISOString(),
			}
			await registry.metadata.upsertFavorite(favorite)
			return favorite
		},

		async removeFavorite(favoriteId) {
			if (!context.userId) {
				throw new Error("User context required to remove favorites")
			}
			const favorites = await registry.metadata.listFavorites(context.userId)
			const existing = favorites.find((favorite) => favorite.id === favoriteId)
			if (!existing) return
			await registry.metadata.deleteFavorite(favoriteId)
		},

		async listFavorites() {
			if (!context.userId) return []
			const favorites = await registry.metadata.listFavorites(context.userId)
			if (!scopedAccessEnabled) return favorites

			const assets = await Promise.all(
				favorites.map((favorite) => registry.metadata.getAsset(favorite.assetId)),
			)
			const visible = new Set(
				assets
					.filter((asset): asset is Asset => asset != null && canAccessScope(asset.scope, "read"))
					.map((asset) => asset.id),
			)
			return favorites.filter((favorite) => visible.has(favorite.assetId))
		},

		async listAssetVersions(assetId) {
			const asset = await registry.metadata.getAsset(assetId)
			if (!asset || !canAccessScope(asset.scope, "read")) {
				throw new Error("Asset not found")
			}
			return registry.metadata.listVersions(assetId)
		},
	}
}
