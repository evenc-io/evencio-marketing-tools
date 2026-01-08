import type {
	Asset,
	AssetScope,
	AssetScopeRef,
	AssetTag,
	AssetTagId,
	AssetType,
} from "@/types/asset-library"

export interface AssetSearchEntry {
	asset: Asset
	searchText: string
	tagIds: Set<AssetTagId>
}

export interface AssetSearchFilters {
	search?: string
	types?: AssetType[]
	scopes?: AssetScope[]
	tagIds?: AssetTagId[]
}

const normalizeText = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()

const buildScopeTokens = (scope: AssetScopeRef) => {
	if (scope.scope === "org") {
		return [scope.scope, scope.orgId]
	}
	if (scope.scope === "event") {
		return [scope.scope, scope.orgId, scope.eventId]
	}
	if (scope.scope === "personal") {
		return [scope.scope, scope.orgId, scope.ownerUserId, scope.eventId ?? ""]
	}
	return [scope.scope]
}

/**
 * Build a lightweight search index for assets (normalized text + tag set) for fast filtering.
 */
export function buildAssetSearchIndex(assets: Asset[], tags: AssetTag[]): AssetSearchEntry[] {
	const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

	return assets.map((asset) => {
		const tagTokens = asset.metadata.tags.flatMap((tagId) => {
			const tag = tagMap.get(tagId)
			if (!tag) return [tagId]
			return [tag.name, tag.slug, tagId]
		})

		const searchText = normalizeText(
			[
				asset.metadata.title,
				asset.metadata.description ?? "",
				asset.type,
				...buildScopeTokens(asset.scope),
				asset.scope.scope === "personal" ? asset.scope.ownerUserId : "",
				...tagTokens,
			]
				.filter(Boolean)
				.join(" "),
		)

		return {
			asset,
			searchText,
			tagIds: new Set(asset.metadata.tags),
		}
	})
}

/**
 * Filter a pre-built asset search index by type/scope/tags/search text.
 */
export function filterAssetSearchIndex(entries: AssetSearchEntry[], filters: AssetSearchFilters) {
	let results = entries

	if (filters.types?.length) {
		const allowed = new Set(filters.types)
		results = results.filter((entry) => allowed.has(entry.asset.type))
	}

	if (filters.scopes?.length) {
		const allowed = new Set(filters.scopes)
		results = results.filter((entry) => allowed.has(entry.asset.scope.scope))
	}

	if (filters.tagIds?.length) {
		const required = new Set(filters.tagIds)
		results = results.filter((entry) => {
			for (const tagId of entry.tagIds) {
				if (required.has(tagId)) return true
			}
			return false
		})
	}

	if (filters.search?.trim()) {
		const tokens = normalizeText(filters.search).split(" ").filter(Boolean)
		results = results.filter((entry) => tokens.every((token) => entry.searchText.includes(token)))
	}

	return results
}
