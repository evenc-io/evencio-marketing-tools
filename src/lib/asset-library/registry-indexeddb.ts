import { nanoid } from "nanoid"
import { getDb } from "@/lib/storage"
import type {
	AssetFileRef,
	AssetScopeRef,
	AssetStorageRecord,
	EventScopeRef,
	OrgScopeRef,
	PersonalScopeRef,
} from "@/types/asset-library"
import type { AssetMetadataStore, AssetRegistry, AssetStorageAdapter } from "./registry"

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

export function createIndexedDbAssetRegistry(): AssetRegistry {
	const storage: AssetStorageAdapter = {
		async put(object) {
			const db = await getDb()
			const storageKey = nanoid()
			const record: AssetStorageRecord = { storageKey, ...object }
			await db.put("assetStorage", record)

			const fileRef: AssetFileRef = {
				storageKey,
				contentType: object.contentType,
				sizeBytes: object.bytes.byteLength,
				checksum: nanoid(),
			}

			return fileRef
		},
		async get(storageKey) {
			const db = await getDb()
			const record = await db.get("assetStorage", storageKey)
			if (!record) return null
			return { bytes: record.bytes, contentType: record.contentType }
		},
		async delete(storageKey) {
			const db = await getDb()
			await db.delete("assetStorage", storageKey)
		},
	}

	const metadata: AssetMetadataStore = {
		async upsertAsset(asset) {
			const db = await getDb()
			await db.put("assets", asset)
			return asset
		},
		async getAsset(id) {
			const db = await getDb()
			return (await db.get("assets", id)) ?? null
		},
		async listAssets(query) {
			const db = await getDb()
			let results = await db.getAll("assets")

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
			const db = await getDb()
			await db.delete("assets", id)
		},
		async upsertTag(tag) {
			const db = await getDb()
			await db.put("assetTags", tag)
			return tag
		},
		async listTags(scope) {
			const db = await getDb()
			const all = await db.getAll("assetTags")
			if (!scope) return all
			return all.filter((tag) => matchesScope(tag.scope, scope))
		},
		async deleteTag(id) {
			const db = await getDb()
			await db.delete("assetTags", id)
		},
		async upsertCollection(collection) {
			const db = await getDb()
			await db.put("assetCollections", collection)
			return collection
		},
		async listCollections(scope) {
			const db = await getDb()
			const all = await db.getAll("assetCollections")
			if (!scope) return all
			return all.filter((collection) => matchesScope(collection.scope, scope))
		},
		async deleteCollection(id) {
			const db = await getDb()
			await db.delete("assetCollections", id)
		},
		async upsertFavorite(favorite) {
			const db = await getDb()
			await db.put("assetFavorites", favorite)
			return favorite
		},
		async listFavorites(userId) {
			const db = await getDb()
			const all = await db.getAll("assetFavorites")
			return all.filter((favorite) => favorite.userId === userId)
		},
		async deleteFavorite(id) {
			const db = await getDb()
			await db.delete("assetFavorites", id)
		},
		async deleteFavoritesByAsset(assetId) {
			const db = await getDb()
			const all = await db.getAll("assetFavorites")
			const deletions = all
				.filter((favorite) => favorite.assetId === assetId)
				.map((favorite) => db.delete("assetFavorites", favorite.id))
			await Promise.all(deletions)
		},
		async upsertVersion(version) {
			const db = await getDb()
			await db.put("assetVersions", version)
			return version
		},
		async listVersions(assetId) {
			const db = await getDb()
			const all = await db.getAll("assetVersions")
			return all
				.filter((version) => version.assetId === assetId)
				.sort((left, right) => left.version - right.version)
		},
		async deleteVersions(assetId) {
			const db = await getDb()
			const all = await db.getAll("assetVersions")
			const deletions = all
				.filter((version) => version.assetId === assetId)
				.map((version) => db.delete("assetVersions", version.id))
			await Promise.all(deletions)
		},
	}

	return { storage, metadata }
}
