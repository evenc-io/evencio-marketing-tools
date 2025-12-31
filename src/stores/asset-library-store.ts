import { nanoid } from "nanoid"
import { create } from "zustand"
import type { AssetRegistry } from "@/lib/asset-library/registry"
import {
	getSnippetViewportError,
	SNIPPET_COMPONENT_LIMITS,
	SNIPPET_SOURCE_MAX_CHARS,
} from "@/lib/snippets/constraints"
import type { SnippetComponentExport } from "@/lib/snippets/source-derived"
import type {
	Asset,
	AssetAttribution,
	AssetCollection,
	AssetFavorite,
	AssetLicense,
	AssetScope,
	AssetScopeRef,
	AssetTag,
	AssetType,
	AssetVersion,
	SnippetAssetDefinition,
	SnippetProps,
	SnippetPropsSchemaDefinition,
	SnippetRuntime,
	SnippetViewport,
} from "@/types/asset-library"

const DEFAULT_SNIPPET_EXPORT = "default"

const DEMO_ACCESS_CONTEXT = {
	orgId: "org_demo",
	eventId: "event_demo",
	userId: "user_demo",
}

type AssetLibraryService = ReturnType<
	typeof import("@/lib/asset-library/service").createAssetLibraryService
>

let registryPromise: Promise<AssetRegistry> | null = null
let servicePromise: Promise<AssetLibraryService> | null = null

const getRegistry = async () => {
	if (!registryPromise) {
		registryPromise = (async () => {
			const { createIndexedDbAssetRegistry } = await import(
				"@/lib/asset-library/registry-indexeddb"
			)
			return createIndexedDbAssetRegistry()
		})()
	}
	return registryPromise
}

const getAssetLibraryService = async () => {
	if (!servicePromise) {
		servicePromise = (async () => {
			const registry = await getRegistry()
			const { createAssetLibraryService } = await import("@/lib/asset-library/service")
			return createAssetLibraryService(registry, {
				accessContext: DEMO_ACCESS_CONTEXT,
				scopedAccessEnabled: true,
			})
		})()
	}
	return servicePromise
}

const normalizeUrl = (value?: string | null) => {
	if (!value) return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

const normalizeAttribution = (input?: AssetAttribution | null): AssetAttribution | null => {
	if (!input) return null
	const text = input.text.trim()
	if (!text) return null
	return {
		text,
		url: normalizeUrl(input.url),
	}
}

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")

const resolveScopeRef = (scope: AssetScope): AssetScopeRef => {
	if (scope === "org") {
		if (!DEMO_ACCESS_CONTEXT.orgId) {
			throw new Error("Organization context is required for org assets")
		}
		return { scope: "org", orgId: DEMO_ACCESS_CONTEXT.orgId }
	}
	if (scope === "event") {
		if (!DEMO_ACCESS_CONTEXT.orgId || !DEMO_ACCESS_CONTEXT.eventId) {
			throw new Error("Event context is required for event assets")
		}
		return {
			scope: "event",
			orgId: DEMO_ACCESS_CONTEXT.orgId,
			eventId: DEMO_ACCESS_CONTEXT.eventId,
		}
	}
	if (!DEMO_ACCESS_CONTEXT.orgId || !DEMO_ACCESS_CONTEXT.userId) {
		throw new Error("User context is required for personal assets")
	}
	return {
		scope: "personal",
		orgId: DEMO_ACCESS_CONTEXT.orgId,
		ownerUserId: DEMO_ACCESS_CONTEXT.userId,
		eventId: DEMO_ACCESS_CONTEXT.eventId ?? null,
	}
}

const resolvePromotionScope = (current: AssetScopeRef, target: AssetScope): AssetScopeRef => {
	if (current.scope === target) return current

	if (current.scope === "personal") {
		if (target === "event") {
			const eventId = current.eventId ?? DEMO_ACCESS_CONTEXT.eventId
			if (!eventId) {
				throw new Error("Event context is required to promote to event scope")
			}
			return { scope: "event", orgId: current.orgId, eventId }
		}
		if (target === "org") {
			return { scope: "org", orgId: current.orgId }
		}
	}

	if (current.scope === "event" && target === "org") {
		return { scope: "org", orgId: current.orgId }
	}

	throw new Error("Scope promotion is only supported from personal -> event/org or event -> org")
}

const toAssetStorageObject = async (file: File) => {
	const buffer = await file.arrayBuffer()
	const bytes = new Uint8Array(buffer)
	const inferredType =
		file.type ||
		(file.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "application/octet-stream")
	return { bytes, contentType: inferredType }
}

const ensureTagIds = async (
	service: AssetLibraryService,
	tagNames: string[],
	scope: AssetScopeRef,
) => {
	const cleaned = Array.from(new Set(tagNames.map((tag) => tag.trim()).filter(Boolean)))
	if (cleaned.length === 0) {
		return []
	}

	const existingTags = await service.listTags(scope)
	const tagIds: string[] = []

	for (const name of cleaned) {
		const slug = slugify(name)
		const existing = existingTags.find((tag) => tag.slug === slug)
		if (existing) {
			tagIds.push(existing.id)
			continue
		}
		const created = await service.createTag({ name, slug, scope })
		existingTags.push(created)
		tagIds.push(created.id)
	}

	return tagIds
}

const resolvePromotedTagIds = async (
	service: AssetLibraryService,
	tagIds: string[],
	targetScope: AssetScopeRef,
) => {
	if (tagIds.length === 0) return []

	const tags = await service.listTags()
	const nameById = new Map(tags.map((tag) => [tag.id, tag.name]))
	const missing = tagIds.filter((id) => !nameById.has(id))
	if (missing.length > 0) {
		throw new Error(`Missing tag metadata for promotion: ${missing.join(", ")}`)
	}

	const names = tagIds.map((id) => nameById.get(id)).filter((name): name is string => Boolean(name))

	return ensureTagIds(service, names, targetScope)
}

async function seedAssetLibraryIfEmpty() {
	const registry = await getRegistry()
	const existingAssets = await registry.metadata.listAssets()
	if (existingAssets.length > 0) return

	const { SAMPLE_ASSETS, SAMPLE_COLLECTION, SAMPLE_TAG } = await import(
		"@/lib/asset-library/sample-data"
	)

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
	includeHidden: boolean
	isLoading: boolean
	error: string | null
}

interface AssetLibraryActions {
	syncLibrary: (includeHidden?: boolean) => Promise<void>
	loadLibrary: (includeHidden?: boolean) => Promise<void>
	toggleFavorite: (assetId: string) => Promise<void>
	createAssetFromUpload: (input: AssetUploadInput) => Promise<Asset>
	registerSnippetAsset: (input: SnippetRegistrationInput) => Promise<Asset>
	registerCustomSnippetAsset: (input: CustomSnippetRegistrationInput) => Promise<Asset>
	updateCustomSnippetAsset: (assetId: string, input: CustomSnippetUpdateInput) => Promise<Asset>
	updateSnippetSource: (assetId: string, source: string) => Promise<Asset>
	promoteAssetScope: (assetId: string, targetScope: AssetScope) => Promise<Asset>
	hideAsset: (assetId: string) => Promise<void>
	unhideAsset: (assetId: string) => Promise<void>
	deleteAsset: (assetId: string) => Promise<void>
	clearError: () => void
}

const initialState: AssetLibraryState = {
	assets: [],
	tags: [],
	collections: [],
	favorites: [],
	includeHidden: false,
	isLoading: false,
	error: null,
}

interface AssetUploadInput {
	type: Extract<AssetType, "image" | "svg">
	file: File
	scope: AssetScope
	title: string
	description?: string | null
	tagNames: string[]
	license: AssetLicense
	attribution?: AssetAttribution | null
}

interface SnippetRegistrationInput {
	entry: string
	runtime: SnippetRuntime
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	viewport?: SnippetViewport
	entryExport?: string
	scope: AssetScope
	title: string
	description?: string | null
	tagNames: string[]
	license: AssetLicense
	attribution?: AssetAttribution | null
}

interface CustomSnippetRegistrationInput extends SnippetRegistrationInput {
	source: string
}

interface CustomSnippetUpdateInput {
	source: string
	scope: AssetScope
	title: string
	description?: string | null
	tagNames: string[]
	license: AssetLicense
	attribution?: AssetAttribution | null
	viewport?: SnippetViewport
	entryExport?: string
}

export const useAssetLibraryStore = create<AssetLibraryState & AssetLibraryActions>((set, get) => ({
	...initialState,

	syncLibrary: async (includeHidden) => {
		const service = await getAssetLibraryService()
		const resolvedIncludeHidden = includeHidden ?? get().includeHidden
		const [assets, tags, collections, favorites] = await Promise.all([
			service.listAssets({ includeHidden: resolvedIncludeHidden }),
			service.listTags(),
			service.listCollections(),
			service.listFavorites(),
		])
		set({ assets, tags, collections, favorites, includeHidden: resolvedIncludeHidden })
	},

	loadLibrary: async (includeHidden) => {
		const service = await getAssetLibraryService()
		const resolvedIncludeHidden = includeHidden ?? get().includeHidden
		set({ isLoading: true, error: null, includeHidden: resolvedIncludeHidden })
		try {
			await seedAssetLibraryIfEmpty()
			const [assets, tags, collections, favorites] = await Promise.all([
				service.listAssets({ includeHidden: resolvedIncludeHidden }),
				service.listTags(),
				service.listCollections(),
				service.listFavorites(),
			])
			set({
				assets,
				tags,
				collections,
				favorites,
				isLoading: false,
				includeHidden: resolvedIncludeHidden,
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to load asset library",
				isLoading: false,
			})
		}
	},

	toggleFavorite: async (assetId) => {
		const service = await getAssetLibraryService()
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

	createAssetFromUpload: async (input) => {
		const service = await getAssetLibraryService()
		const scopeRef = resolveScopeRef(input.scope)
		const tagIds = await ensureTagIds(service, input.tagNames, scopeRef)
		const metadata = {
			title: input.title,
			description: input.description ?? null,
			tags: tagIds,
			license: {
				...input.license,
				url: normalizeUrl(input.license.url),
			},
			attribution: normalizeAttribution(input.attribution),
		}

		const file = await toAssetStorageObject(input.file)
		const asset = await service.createAsset(
			{
				type: input.type,
				scope: scopeRef,
				metadata,
				file,
			},
			"Imported asset",
		)

		const { syncLibrary } = get()
		if (syncLibrary) {
			await syncLibrary()
		}

		return asset
	},

	registerSnippetAsset: async (input) => {
		const service = await getAssetLibraryService()
		if (input.viewport) {
			const viewportError = getSnippetViewportError(input.viewport)
			if (viewportError) {
				throw new Error(`Snippet resolution invalid: ${viewportError}`)
			}
		}
		const scopeRef = resolveScopeRef(input.scope)
		const tagIds = await ensureTagIds(service, input.tagNames, scopeRef)
		const metadata = {
			title: input.title,
			description: input.description ?? null,
			tags: tagIds,
			license: {
				...input.license,
				url: normalizeUrl(input.license.url),
			},
			attribution: normalizeAttribution(input.attribution),
		}

		const snippet: SnippetAssetDefinition = {
			entry: input.entry,
			runtime: input.runtime,
			propsSchema: input.propsSchema,
			entryExport: input.entryExport,
			viewport: input.viewport,
		}

		const asset = await service.createAsset(
			{
				type: "snippet",
				scope: scopeRef,
				metadata,
				snippet,
				defaultProps: input.defaultProps,
			},
			"Registered snippet",
		)

		const { syncLibrary } = get()
		if (syncLibrary) {
			await syncLibrary()
		}

		return asset
	},

	registerCustomSnippetAsset: async (input) => {
		const service = await getAssetLibraryService()
		if (input.source.length > SNIPPET_SOURCE_MAX_CHARS) {
			throw new Error(`Snippet source is too large (limit ${SNIPPET_SOURCE_MAX_CHARS} characters).`)
		}
		if (input.viewport) {
			const viewportError = getSnippetViewportError(input.viewport)
			if (viewportError) {
				throw new Error(`Snippet resolution invalid: ${viewportError}`)
			}
		}
		const scopeRef = resolveScopeRef(input.scope)
		const tagIds = await ensureTagIds(service, input.tagNames, scopeRef)
		let derived: { propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }
		const entryExport = input.entryExport ?? DEFAULT_SNIPPET_EXPORT
		let componentExports: SnippetComponentExport[] = []
		try {
			const { deriveSnippetPropsFromSource, listSnippetComponentExports } = await import(
				"@/lib/snippets/source-derived"
			)
			componentExports = await listSnippetComponentExports(input.source)
			if (componentExports.length === 0) {
				throw new Error("Snippet must export at least one component.")
			}
			if (componentExports.length > SNIPPET_COMPONENT_LIMITS.hard) {
				throw new Error(
					`Snippet exports too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`,
				)
			}
			const hasEntry =
				entryExport === DEFAULT_SNIPPET_EXPORT
					? componentExports.some((component) => component.isDefault)
					: componentExports.some((component) => component.exportName === entryExport)
			if (!hasEntry) {
				throw new Error(
					entryExport === DEFAULT_SNIPPET_EXPORT
						? "Snippet must include a default export or select a named component."
						: `Snippet entry "${entryExport}" was not found.`,
				)
			}

			derived = await deriveSnippetPropsFromSource(input.source, entryExport)
		} catch (error) {
			if (error instanceof Error) {
				throw error
			}
			throw new Error("Snippet source must be valid TSX before saving")
		}
		const metadata = {
			title: input.title,
			description: input.description ?? null,
			tags: tagIds,
			license: {
				...input.license,
				url: normalizeUrl(input.license.url),
			},
			attribution: normalizeAttribution(input.attribution),
		}

		const snippet: SnippetAssetDefinition = {
			entry: input.entry,
			runtime: input.runtime,
			propsSchema: derived.propsSchema,
			source: input.source,
			viewport: input.viewport,
			entryExport: entryExport === DEFAULT_SNIPPET_EXPORT ? undefined : entryExport,
		}

		const asset = await service.createAsset(
			{
				type: "snippet",
				scope: scopeRef,
				metadata,
				snippet,
				defaultProps: derived.defaultProps,
			},
			"Created custom snippet",
		)

		const { syncLibrary } = get()
		if (syncLibrary) {
			await syncLibrary()
		}

		return asset
	},

	updateCustomSnippetAsset: async (assetId, input) => {
		const service = await getAssetLibraryService()
		const { assets, syncLibrary } = get()
		const existing = assets.find((asset) => asset.id === assetId)
		if (!existing) {
			throw new Error("Asset not found")
		}
		if (existing.type !== "snippet") {
			throw new Error("Asset is not a snippet")
		}
		if (!existing.snippet.source) {
			throw new Error("Snippet is not editable")
		}
		if (input.source.length > SNIPPET_SOURCE_MAX_CHARS) {
			throw new Error(`Snippet source is too large (limit ${SNIPPET_SOURCE_MAX_CHARS} characters).`)
		}
		if (input.viewport) {
			const viewportError = getSnippetViewportError(input.viewport)
			if (viewportError) {
				throw new Error(`Snippet resolution invalid: ${viewportError}`)
			}
		}
		const currentScope = existing.scope.scope
		const targetScope = input.scope
		if (currentScope !== targetScope) {
			const order: AssetScope[] = ["personal", "event", "org"]
			const currentIndex = order.indexOf(currentScope)
			const targetIndex = order.indexOf(targetScope)
			if (currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex) {
				throw new Error("Scope demotion is not supported for existing snippets.")
			}
		}

		const nextScopeRef =
			targetScope === currentScope
				? existing.scope
				: resolvePromotionScope(existing.scope, targetScope)
		const tagIds = await ensureTagIds(service, input.tagNames, nextScopeRef)

		const { deriveSnippetPropsFromSource, listSnippetComponentExports } = await import(
			"@/lib/snippets/source-derived"
		)
		const componentExports = await listSnippetComponentExports(input.source)
		if (componentExports.length === 0) {
			throw new Error("Snippet must export at least one component.")
		}
		if (componentExports.length > SNIPPET_COMPONENT_LIMITS.hard) {
			throw new Error(
				`Snippet exports too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`,
			)
		}

		const preferredEntry =
			input.entryExport ?? existing.snippet.entryExport ?? DEFAULT_SNIPPET_EXPORT
		const hasPreferred =
			preferredEntry === DEFAULT_SNIPPET_EXPORT
				? componentExports.some((component) => component.isDefault)
				: componentExports.some((component) => component.exportName === preferredEntry)
		const fallbackEntry =
			componentExports.find((component) => component.isDefault)?.exportName ??
			componentExports[0]?.exportName ??
			DEFAULT_SNIPPET_EXPORT
		const entryExport = hasPreferred ? preferredEntry : fallbackEntry

		let derived: { propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }
		try {
			derived = await deriveSnippetPropsFromSource(input.source, entryExport)
		} catch {
			throw new Error("Snippet source must be valid TSX before saving")
		}

		const metadata = {
			title: input.title,
			description: input.description ?? null,
			tags: tagIds,
			license: {
				...input.license,
				url: normalizeUrl(input.license.url),
			},
			attribution: normalizeAttribution(input.attribution),
		}

		const updated = await service.updateAsset(assetId, {
			scope: nextScopeRef,
			metadata,
			snippet: {
				...existing.snippet,
				source: input.source,
				propsSchema: derived.propsSchema,
				viewport: input.viewport ?? existing.snippet.viewport,
				entryExport: entryExport === DEFAULT_SNIPPET_EXPORT ? undefined : entryExport,
			},
			defaultProps: derived.defaultProps,
			changelog: "Updated snippet",
		})

		set({
			assets: assets.map((asset) => (asset.id === assetId ? updated : asset)),
		})

		if (syncLibrary) {
			await syncLibrary()
		}

		return updated
	},

	updateSnippetSource: async (assetId, source) => {
		const service = await getAssetLibraryService()
		const { assets, syncLibrary } = get()
		const existing = assets.find((asset) => asset.id === assetId)
		if (!existing) {
			throw new Error("Asset not found")
		}
		if (existing.type !== "snippet") {
			throw new Error("Asset is not a snippet")
		}
		if (source.length > SNIPPET_SOURCE_MAX_CHARS) {
			throw new Error(`Snippet source is too large (limit ${SNIPPET_SOURCE_MAX_CHARS} characters).`)
		}

		const { deriveSnippetPropsFromSource, listSnippetComponentExports } = await import(
			"@/lib/snippets/source-derived"
		)
		const componentExports = await listSnippetComponentExports(source)
		if (componentExports.length === 0) {
			throw new Error("Snippet must export at least one component.")
		}
		if (componentExports.length > SNIPPET_COMPONENT_LIMITS.hard) {
			throw new Error(
				`Snippet exports too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`,
			)
		}

		const preferredEntry = existing.snippet.entryExport ?? DEFAULT_SNIPPET_EXPORT
		const hasPreferred =
			preferredEntry === DEFAULT_SNIPPET_EXPORT
				? componentExports.some((component) => component.isDefault)
				: componentExports.some((component) => component.exportName === preferredEntry)
		const fallbackEntry =
			componentExports.find((component) => component.isDefault)?.exportName ??
			componentExports[0]?.exportName ??
			DEFAULT_SNIPPET_EXPORT
		const entryExport = hasPreferred ? preferredEntry : fallbackEntry

		let derived: { propsSchema: SnippetPropsSchemaDefinition; defaultProps: SnippetProps }
		try {
			derived = await deriveSnippetPropsFromSource(source, entryExport)
		} catch {
			throw new Error("Snippet source must be valid TSX before saving")
		}

		const updated = await service.updateAsset(assetId, {
			snippet: {
				...existing.snippet,
				source,
				propsSchema: derived.propsSchema,
				entryExport: entryExport === DEFAULT_SNIPPET_EXPORT ? undefined : entryExport,
			},
			defaultProps: derived.defaultProps,
			changelog: "Updated snippet source",
		})

		set({
			assets: assets.map((asset) => (asset.id === assetId ? updated : asset)),
		})

		if (syncLibrary) {
			await syncLibrary()
		}

		return updated
	},

	promoteAssetScope: async (assetId, targetScope) => {
		const service = await getAssetLibraryService()
		const { assets, syncLibrary } = get()
		const existing = assets.find((asset) => asset.id === assetId)
		if (!existing) {
			throw new Error("Asset not found")
		}

		const nextScope = resolvePromotionScope(existing.scope, targetScope)
		const promotedTagIds = await resolvePromotedTagIds(service, existing.metadata.tags, nextScope)
		const updated = await service.updateAsset(assetId, {
			scope: nextScope,
			metadata: {
				tags: promotedTagIds,
			},
			changelog: `Promoted to ${targetScope}`,
		})

		set({
			assets: assets.map((asset) => (asset.id === assetId ? updated : asset)),
		})

		if (syncLibrary) {
			await syncLibrary()
		}

		return updated
	},

	clearError: () => set({ error: null }),

	hideAsset: async (assetId) => {
		const service = await getAssetLibraryService()
		await service.hideAsset(assetId)
		const { syncLibrary } = get()
		if (syncLibrary) {
			await syncLibrary()
		}
	},

	unhideAsset: async (assetId) => {
		const service = await getAssetLibraryService()
		await service.unhideAsset(assetId)
		const { syncLibrary } = get()
		if (syncLibrary) {
			await syncLibrary()
		}
	},

	deleteAsset: async (assetId) => {
		const service = await getAssetLibraryService()
		await service.deleteAsset(assetId)
		const { syncLibrary, assets } = get()
		const nextAssets = assets.filter((asset) => asset.id !== assetId)
		set({ assets: nextAssets })
		if (syncLibrary) {
			await syncLibrary()
		}
	},
}))
