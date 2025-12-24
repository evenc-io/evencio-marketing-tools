import { nanoid } from "nanoid"
import type {
	Asset,
	AssetCollection,
	AssetCollectionId,
	AssetFavorite,
	AssetFavoriteId,
	AssetFileRef,
	AssetId,
	AssetListQuery,
	AssetScopeRef,
	AssetStorageObject,
	AssetTag,
	AssetTagId,
	AssetVersion,
	AssetVersionId,
	EventScopeRef,
	OrgScopeRef,
	PersonalScopeRef,
} from "@/types/asset-library"

export interface AssetStorageAdapter {
	put(object: AssetStorageObject): Promise<AssetFileRef>
	get(storageKey: string): Promise<AssetStorageObject | null>
	delete(storageKey: string): Promise<void>
}

export interface AssetMetadataStore {
	upsertAsset(asset: Asset): Promise<Asset>
	getAsset(id: AssetId): Promise<Asset | null>
	listAssets(query?: AssetListQuery): Promise<Asset[]>
	deleteAsset(id: AssetId): Promise<void>

	upsertTag(tag: AssetTag): Promise<AssetTag>
	listTags(scope?: AssetScopeRef): Promise<AssetTag[]>
	deleteTag(id: AssetTagId): Promise<void>

	upsertCollection(collection: AssetCollection): Promise<AssetCollection>
	listCollections(scope?: AssetScopeRef): Promise<AssetCollection[]>
	deleteCollection(id: AssetCollectionId): Promise<void>

	upsertFavorite(favorite: AssetFavorite): Promise<AssetFavorite>
	listFavorites(userId: string): Promise<AssetFavorite[]>
	deleteFavorite(id: AssetFavoriteId): Promise<void>
	deleteFavoritesByAsset(assetId: AssetId): Promise<void>

	upsertVersion(version: AssetVersion): Promise<AssetVersion>
	listVersions(assetId: AssetId): Promise<AssetVersion[]>
	deleteVersions(assetId: AssetId): Promise<void>
}

export interface AssetRegistry {
	storage: AssetStorageAdapter
	metadata: AssetMetadataStore
}

export function createStubAssetRegistry(): AssetRegistry {
	const assets = new Map<AssetId, Asset>()
	const tags = new Map<AssetTagId, AssetTag>()
	const collections = new Map<AssetCollectionId, AssetCollection>()
	const favorites = new Map<AssetFavoriteId, AssetFavorite>()
	const versions = new Map<AssetVersionId, AssetVersion>()
	const storageObjects = new Map<string, AssetStorageObject>()

	const matchesScope = (left: AssetScopeRef, right: AssetScopeRef) => {
		if (left.scope !== right.scope) return false
		switch (left.scope) {
			case "global":
				return true
			case "org":
				return left.orgId === (right as OrgScopeRef).orgId
			case "event": {
				const r = right as EventScopeRef
				return left.orgId === r.orgId && left.eventId === r.eventId
			}
			case "personal": {
				const r = right as PersonalScopeRef
				return (
					left.orgId === r.orgId &&
					left.ownerUserId === r.ownerUserId &&
					(left.eventId ?? null) === (r.eventId ?? null)
				)
			}
		}
	}

	const storage: AssetStorageAdapter = {
		async put(object) {
			const storageKey = nanoid()
			const fileRef: AssetFileRef = {
				storageKey,
				contentType: object.contentType,
				sizeBytes: object.bytes.byteLength,
				checksum: nanoid(),
			}
			storageObjects.set(storageKey, object)
			return fileRef
		},
		async get(storageKey) {
			return storageObjects.get(storageKey) ?? null
		},
		async delete(storageKey) {
			storageObjects.delete(storageKey)
		},
	}

	const metadata: AssetMetadataStore = {
		async upsertAsset(asset) {
			assets.set(asset.id, asset)
			return asset
		},
		async getAsset(id) {
			return assets.get(id) ?? null
		},
		async listAssets(query) {
			let results = Array.from(assets.values())

			if (query?.types?.length) {
				const allowed = new Set(query.types)
				results = results.filter((asset) => allowed.has(asset.type))
			}

			if (query?.scope) {
				results = results.filter((asset) => asset.scope.scope === query.scope)
			}

			if (query?.scopeRef) {
				const scopeRef = query.scopeRef
				results = results.filter((asset) => matchesScope(asset.scope, scopeRef))
			}

			if (query?.tagIds?.length) {
				const required = new Set(query.tagIds)
				results = results.filter((asset) =>
					asset.metadata.tags.some((tagId) => required.has(tagId)),
				)
			}

			if (query?.search) {
				const term = query.search.toLowerCase()
				results = results.filter((asset) => {
					const haystack =
						`${asset.metadata.title} ${asset.metadata.description ?? ""}`.toLowerCase()
					return haystack.includes(term)
				})
			}

			return results
		},
		async deleteAsset(id) {
			assets.delete(id)
		},
		async upsertTag(tag) {
			tags.set(tag.id, tag)
			return tag
		},
		async listTags(scope) {
			const all = Array.from(tags.values())
			if (!scope) return all
			return all.filter((tag) => matchesScope(tag.scope, scope))
		},
		async deleteTag(id) {
			tags.delete(id)
		},
		async upsertCollection(collection) {
			collections.set(collection.id, collection)
			return collection
		},
		async listCollections(scope) {
			const all = Array.from(collections.values())
			if (!scope) return all
			return all.filter((collection) => matchesScope(collection.scope, scope))
		},
		async deleteCollection(id) {
			collections.delete(id)
		},
		async upsertFavorite(favorite) {
			favorites.set(favorite.id, favorite)
			return favorite
		},
		async listFavorites(userId) {
			return Array.from(favorites.values()).filter((favorite) => favorite.userId === userId)
		},
		async deleteFavorite(id) {
			favorites.delete(id)
		},
		async deleteFavoritesByAsset(assetId) {
			for (const [id, favorite] of favorites.entries()) {
				if (favorite.assetId === assetId) {
					favorites.delete(id)
				}
			}
		},
		async upsertVersion(version) {
			versions.set(version.id, version)
			return version
		},
		async listVersions(assetId) {
			return Array.from(versions.values())
				.filter((version) => version.assetId === assetId)
				.sort((left, right) => left.version - right.version)
		},
		async deleteVersions(assetId) {
			for (const [id, version] of versions.entries()) {
				if (version.assetId === assetId) {
					versions.delete(id)
				}
			}
		},
	}

	return { storage, metadata }
}
