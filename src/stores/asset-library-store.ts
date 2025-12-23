import { nanoid } from "nanoid"
import { create } from "zustand"
import {
	createAssetLibraryService,
	createIndexedDbAssetRegistry,
	SAMPLE_ASSETS,
	SAMPLE_COLLECTION,
	SAMPLE_TAG,
} from "@/lib/asset-library"
import type {
	Asset,
	AssetCollection,
	AssetFavorite,
	AssetTag,
	AssetVersion,
} from "@/types/asset-library"

const DEMO_ACCESS_CONTEXT = {
	orgId: "org_demo",
	eventId: "event_demo",
	userId: "user_demo",
}

const registry = createIndexedDbAssetRegistry()
const service = createAssetLibraryService(registry, {
	accessContext: DEMO_ACCESS_CONTEXT,
	scopedAccessEnabled: true,
})

async function seedAssetLibraryIfEmpty() {
	const existingAssets = await registry.metadata.listAssets()
	if (existingAssets.length > 0) return

	await registry.metadata.upsertTag(SAMPLE_TAG)
	await registry.metadata.upsertCollection(SAMPLE_COLLECTION)

	for (const asset of SAMPLE_ASSETS) {
		await registry.metadata.upsertAsset(asset)
		const version: AssetVersion = {
			id: nanoid(),
			assetId: asset.id,
			version: asset.version,
			changelog: "Initial import",
			createdAt: asset.metadata.createdAt,
			createdBy: asset.metadata.createdBy ?? null,
		}
		await registry.metadata.upsertVersion(version)
	}
}

interface AssetLibraryState {
	assets: Asset[]
	tags: AssetTag[]
	collections: AssetCollection[]
	favorites: AssetFavorite[]
	isLoading: boolean
	error: string | null
}

interface AssetLibraryActions {
	loadLibrary: () => Promise<void>
	toggleFavorite: (assetId: string) => Promise<void>
	clearError: () => void
}

const initialState: AssetLibraryState = {
	assets: [],
	tags: [],
	collections: [],
	favorites: [],
	isLoading: false,
	error: null,
}

export const useAssetLibraryStore = create<AssetLibraryState & AssetLibraryActions>((set, get) => ({
	...initialState,

	loadLibrary: async () => {
		set({ isLoading: true, error: null })
		try {
			await seedAssetLibraryIfEmpty()
			const [assets, tags, collections, favorites] = await Promise.all([
				service.listAssets(),
				service.listTags(),
				service.listCollections(),
				service.listFavorites(),
			])
			set({ assets, tags, collections, favorites, isLoading: false })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load asset library",
				isLoading: false,
			})
		}
	},

	toggleFavorite: async (assetId) => {
		try {
			const { favorites } = get()
			const existing = favorites.find((favorite) => favorite.assetId === assetId)
			if (existing) {
				await service.removeFavorite(existing.id)
			} else {
				await service.addFavorite(assetId)
			}
			const nextFavorites = await service.listFavorites()
			set({ favorites: nextFavorites })
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to update favorites",
			})
		}
	},

	clearError: () => set({ error: null }),
}))
