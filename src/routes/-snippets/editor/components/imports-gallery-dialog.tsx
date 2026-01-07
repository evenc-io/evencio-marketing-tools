import { useVirtualizer } from "@tanstack/react-virtual"
import {
	FileCode2,
	Globe,
	Image as ImageIcon,
	Link as LinkIcon,
	Shapes,
	Sparkles,
	Trash2,
	Type,
} from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AVAILABLE_FONTS, TRUSTED_FONT_PROVIDERS } from "@/lib/snippets/imports"
import { cn } from "@/lib/utils"
import { createSnippetImporters } from "@/routes/-snippets/editor/hooks/snippet/importers"
import type { SnippetImportsIndex } from "@/routes/-snippets/editor/hooks/snippet/imports-index"
import { getImportAsset, type ImportAssetId } from "@/routes/-snippets/editor/import-assets"
import type { Asset } from "@/types/asset-library"

type ImportsGalleryFilterId =
	| "all"
	| "imported"
	| "svgs"
	| "images"
	| "icons"
	| "fonts"
	| "providers"
	| "snippets"

type ImportsGalleryItem =
	| {
			kind: "import-asset"
			key: string
			assetId: ImportAssetId
	  }
	| {
			kind: "library-asset"
			key: string
			asset: Asset
			tagLabels: string[]
			searchText: string
	  }
	| {
			kind: "font"
			key: string
			fontId: string
	  }
	| {
			kind: "provider"
			key: string
			providerId: string
	  }
	| {
			kind: "placeholder"
			key: string
			placeholderType: "icons"
	  }

interface SnippetImportsGalleryDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	importsIndex: SnippetImportsIndex
	libraryAssets: Asset[]
	tagNameById: Map<string, string>
	isLibraryLoading: boolean
	isImportingImportAsset: boolean
	isRemovingImportAsset: boolean
	onRequestImportImportAsset: (assetId: ImportAssetId) => void
	onRequestRemoveImportAsset: (assetId: ImportAssetId) => void
}

const FILTERS: Array<{ id: ImportsGalleryFilterId; label: string; icon: typeof Sparkles }> = [
	{ id: "all", label: "All", icon: Sparkles },
	{ id: "imported", label: "Imported", icon: LinkIcon },
	{ id: "svgs", label: "SVGs", icon: Shapes },
	{ id: "images", label: "Images", icon: ImageIcon },
	{ id: "icons", label: "Icons", icon: Sparkles },
	{ id: "fonts", label: "Fonts", icon: Type },
	{ id: "providers", label: "Providers", icon: Globe },
	{ id: "snippets", label: "Snippet assets", icon: FileCode2 },
] as const

const TILE_MIN_WIDTH = 260
const TILE_HEIGHT = 332
const TILE_PREVIEW_HEIGHT = 200
const GRID_GAP_PX = 16
const GRID_ROW_HEIGHT = TILE_HEIGHT + GRID_GAP_PX

type AssetPreviewState =
	| { status: "idle"; url: null }
	| { status: "loading"; url: null }
	| { status: "ready"; url: string }
	| { status: "missing"; url: null }
	| { status: "error"; url: null }

type PreviewCacheEntry = {
	url: string
	refCount: number
	lastUsedAt: number
}

const MAX_PREVIEW_CACHE = 80
const assetPreviewCache = new Map<string, PreviewCacheEntry>()
const assetPreviewPromiseCache = new Map<string, Promise<string | null>>()

let assetRegistryPromise: Promise<{
	storage: {
		get: (storageKey: string) => Promise<{ bytes: Uint8Array; contentType: string } | null>
	}
} | null> | null = null

const getAssetRegistry = async () => {
	if (typeof window === "undefined") return null
	if (typeof indexedDB === "undefined") return null
	if (!assetRegistryPromise) {
		assetRegistryPromise = import("@/lib/asset-library/registry-indexeddb")
			.then((module) => module.createIndexedDbAssetRegistry())
			.catch(() => null)
	}
	return assetRegistryPromise
}

const evictAssetPreviewsIfNeeded = () => {
	if (assetPreviewCache.size <= MAX_PREVIEW_CACHE) return
	const candidates = Array.from(assetPreviewCache.entries())
		.filter(([, entry]) => entry.refCount === 0)
		.sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)

	for (const [storageKey, entry] of candidates) {
		if (assetPreviewCache.size <= MAX_PREVIEW_CACHE) break
		URL.revokeObjectURL(entry.url)
		assetPreviewCache.delete(storageKey)
	}
}

const buildAssetPreviewUrl = async (storageKey: string) => {
	const registry = await getAssetRegistry()
	if (!registry) return null
	const object = await registry.storage.get(storageKey)
	if (!object) return null
	const bytes = object.bytes as unknown as Uint8Array<ArrayBuffer>
	const blob = new Blob([bytes], {
		type: object.contentType || "application/octet-stream",
	})
	return URL.createObjectURL(blob)
}

const useAssetPreviewUrl = (storageKey: string | null): AssetPreviewState => {
	const [state, setState] = useState<AssetPreviewState>({ status: "idle", url: null })

	useEffect(() => {
		if (!storageKey) {
			setState({ status: "idle", url: null })
			return
		}

		let disposed = false
		const cached = assetPreviewCache.get(storageKey)
		if (cached) {
			cached.refCount += 1
			cached.lastUsedAt = Date.now()
			setState({ status: "ready", url: cached.url })
			return () => {
				const entry = assetPreviewCache.get(storageKey)
				if (!entry) return
				entry.refCount = Math.max(0, entry.refCount - 1)
				entry.lastUsedAt = Date.now()
				evictAssetPreviewsIfNeeded()
			}
		}

		setState({ status: "loading", url: null })

		const promise =
			assetPreviewPromiseCache.get(storageKey) ??
			buildAssetPreviewUrl(storageKey).finally(() => {
				assetPreviewPromiseCache.delete(storageKey)
			})
		if (!assetPreviewPromiseCache.has(storageKey)) {
			assetPreviewPromiseCache.set(storageKey, promise)
		}

		void promise
			.then((url) => {
				if (!url) {
					if (!disposed) setState({ status: "missing", url: null })
					return
				}

				const existing = assetPreviewCache.get(storageKey)
				if (existing) {
					if (!disposed) {
						existing.refCount += 1
						existing.lastUsedAt = Date.now()
						setState({ status: "ready", url: existing.url })
					}
					return
				}

				assetPreviewCache.set(storageKey, {
					url,
					refCount: disposed ? 0 : 1,
					lastUsedAt: Date.now(),
				})
				evictAssetPreviewsIfNeeded()

				if (!disposed) setState({ status: "ready", url })
			})
			.catch(() => {
				if (!disposed) setState({ status: "error", url: null })
			})

		return () => {
			disposed = true
			const entry = assetPreviewCache.get(storageKey)
			if (!entry) return
			entry.refCount = Math.max(0, entry.refCount - 1)
			entry.lastUsedAt = Date.now()
			evictAssetPreviewsIfNeeded()
		}
	}, [storageKey])

	return state
}

const getItemLabel = (item: ImportsGalleryItem) => {
	if (item.kind === "import-asset") {
		const asset = getImportAsset(item.assetId)
		return asset?.label ?? item.assetId
	}
	if (item.kind === "library-asset") {
		return item.asset.metadata.title
	}
	if (item.kind === "font") {
		return AVAILABLE_FONTS.find((font) => font.id === item.fontId)?.name ?? item.fontId
	}
	if (item.kind === "provider") {
		return (
			TRUSTED_FONT_PROVIDERS.find((provider) => provider.id === item.providerId)?.label ??
			item.providerId
		)
	}
	if (item.kind === "placeholder") {
		return item.placeholderType === "icons" ? "Icons" : "Coming soon"
	}
	return ""
}

const isMatch = (value: string, query: string) => {
	if (!query) return true
	return value.toLowerCase().includes(query.toLowerCase())
}

const getAssetTypeLabel = (asset: Asset) => {
	if (asset.type === "svg") return "SVG"
	if (asset.type === "image") return "Image"
	return "Snippet"
}

const getAssetScopeLabel = (asset: Asset) => {
	if (asset.scope.scope === "global") return "Global"
	if (asset.scope.scope === "org") return "Org"
	if (asset.scope.scope === "event") return "Event"
	return "Personal"
}

export function SnippetImportsGalleryDialog({
	open,
	onOpenChange,
	importsIndex,
	libraryAssets,
	tagNameById,
	isLibraryLoading,
	isImportingImportAsset,
	isRemovingImportAsset,
	onRequestImportImportAsset,
	onRequestRemoveImportAsset,
}: SnippetImportsGalleryDialogProps) {
	const importers = useMemo(
		() =>
			createSnippetImporters({
				importsIndex,
				importImportAsset: onRequestImportImportAsset,
				requestRemoveImportAsset: onRequestRemoveImportAsset,
			}),
		[importsIndex, onRequestImportImportAsset, onRequestRemoveImportAsset],
	)
	const isImportAssetMutating = isImportingImportAsset || isRemovingImportAsset
	const [filterId, setFilterId] = useState<ImportsGalleryFilterId>("all")
	const [query, setQuery] = useState("")
	const deferredQuery = useDeferredValue(query)

	const libraryItems = useMemo<ImportsGalleryItem[]>(() => {
		return libraryAssets.map((asset) => {
			const tagLabels = asset.metadata.tags
				.map((tagId) => tagNameById.get(tagId))
				.filter((label): label is string => Boolean(label))
			const searchText =
				`${asset.metadata.title} ${asset.metadata.description ?? ""} ${tagLabels.join(
					" ",
				)}`.toLowerCase()
			return {
				kind: "library-asset" as const,
				key: `library:${asset.id}`,
				asset,
				tagLabels,
				searchText,
			}
		})
	}, [libraryAssets, tagNameById])

	const builtInItems = useMemo<ImportsGalleryItem[]>(
		() =>
			importsIndex.importAssets.map((entry) => ({
				kind: "import-asset" as const,
				key: `import-asset:${entry.id}`,
				assetId: entry.id,
			})),
		[importsIndex.importAssets],
	)

	const fontItems = useMemo<ImportsGalleryItem[]>(
		() =>
			AVAILABLE_FONTS.map((font) => ({
				kind: "font" as const,
				key: `font:${font.id}`,
				fontId: font.id,
			})),
		[],
	)

	const providerItems = useMemo<ImportsGalleryItem[]>(
		() =>
			TRUSTED_FONT_PROVIDERS.map((provider) => ({
				kind: "provider" as const,
				key: `provider:${provider.id}`,
				providerId: provider.id,
			})),
		[],
	)

	const placeholderItems = useMemo<ImportsGalleryItem[]>(
		() => [{ kind: "placeholder" as const, key: "placeholder:icons", placeholderType: "icons" }],
		[],
	)

	const allItems = useMemo<ImportsGalleryItem[]>(() => {
		const importedFirst = [...builtInItems].sort((a, b) => {
			const aUsage =
				a.kind === "import-asset" ? importsIndex.importAssetsById.get(a.assetId)?.imported : false
			const bUsage =
				b.kind === "import-asset" ? importsIndex.importAssetsById.get(b.assetId)?.imported : false
			return Number(bUsage) - Number(aUsage)
		})

		return [...importedFirst, ...libraryItems, ...fontItems, ...providerItems, ...placeholderItems]
	}, [
		builtInItems,
		fontItems,
		importsIndex.importAssetsById,
		libraryItems,
		placeholderItems,
		providerItems,
	])

	const counts = useMemo(() => {
		const librarySvg = libraryAssets.filter((asset) => asset.type === "svg").length
		const libraryImages = libraryAssets.filter((asset) => asset.type === "image").length
		const librarySnippets = libraryAssets.filter((asset) => asset.type === "snippet").length
		const imported = importsIndex.importAssets.filter((entry) => entry.imported).length
		return {
			all: allItems.length,
			imported,
			svgs: importsIndex.importAssets.length + librarySvg,
			images: libraryImages,
			icons: 0,
			fonts: AVAILABLE_FONTS.length,
			providers: TRUSTED_FONT_PROVIDERS.length,
			snippets: librarySnippets,
		} satisfies Record<ImportsGalleryFilterId, number>
	}, [allItems.length, importsIndex.importAssets, libraryAssets])

	const filteredItems = useMemo(() => {
		const filterMatches = (item: ImportsGalleryItem) => {
			if (filterId === "all") return true
			if (filterId === "imported") {
				if (item.kind !== "import-asset") return false
				return importsIndex.importAssetsById.get(item.assetId)?.imported ?? false
			}
			if (filterId === "svgs") {
				if (item.kind === "import-asset") return true
				if (item.kind === "library-asset") return item.asset.type === "svg"
				return false
			}
			if (filterId === "images") {
				return item.kind === "library-asset" && item.asset.type === "image"
			}
			if (filterId === "fonts") return item.kind === "font"
			if (filterId === "providers") return item.kind === "provider"
			if (filterId === "icons")
				return item.kind === "placeholder" && item.placeholderType === "icons"
			if (filterId === "snippets")
				return item.kind === "library-asset" && item.asset.type === "snippet"
			return true
		}

		const queryText = deferredQuery.trim()
		const queryLower = queryText.toLowerCase()
		const items = allItems.filter((item) => {
			if (!filterMatches(item)) return false
			if (!queryText) return true

			if (item.kind === "import-asset") {
				const asset = getImportAsset(item.assetId)
				const label = asset?.label ?? item.assetId
				const componentName = asset?.componentName ?? ""
				return isMatch(`${label} ${componentName}`, queryText)
			}
			if (item.kind === "library-asset") {
				return item.searchText.includes(queryLower)
			}
			if (item.kind === "font") {
				const font = AVAILABLE_FONTS.find((entry) => entry.id === item.fontId)
				return isMatch(`${font?.name ?? ""} ${font?.usage ?? ""}`, queryText)
			}
			if (item.kind === "provider") {
				const provider = TRUSTED_FONT_PROVIDERS.find((entry) => entry.id === item.providerId)
				return isMatch(`${provider?.label ?? ""} ${provider?.status ?? ""}`, queryText)
			}
			if (item.kind === "placeholder") {
				return isMatch(getItemLabel(item), queryText)
			}
			return true
		})

		return items
	}, [allItems, deferredQuery, filterId, importsIndex.importAssetsById])

	const libraryLoadingRow = isLibraryLoading ? (
		<div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
			<span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
			Loading asset library…
		</div>
	) : null

	const scrollParentRef = useRef<HTMLDivElement | null>(null)
	const gridMeasureRef = useRef<HTMLDivElement | null>(null)
	const [columnCount, setColumnCount] = useState(3)

	useEffect(() => {
		if (!open) return
		const element = gridMeasureRef.current
		if (!element) return

		const getNextColumnCount = () => {
			const width = element.clientWidth
			if (!Number.isFinite(width) || width <= 0) return 1
			return Math.max(1, Math.floor((width + GRID_GAP_PX) / (TILE_MIN_WIDTH + GRID_GAP_PX)))
		}

		const apply = () => {
			const nextColumns = getNextColumnCount()
			setColumnCount((prev) => (prev === nextColumns ? prev : nextColumns))
		}

		apply()

		if (typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(() => apply())
		observer.observe(element)
		return () => observer.disconnect()
	}, [open])

	const rowCount = Math.ceil(filteredItems.length / Math.max(1, columnCount))
	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => scrollParentRef.current,
		estimateSize: () => GRID_ROW_HEIGHT,
		overscan: 6,
	})
	const virtualRows = virtualizer.getVirtualItems()

	useEffect(() => {
		if (!open) return
		const raf = requestAnimationFrame(() => {
			virtualizer.measure()
		})
		return () => cancelAnimationFrame(raf)
	}, [open, virtualizer])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"fixed inset-0 left-0 top-0 z-50 w-screen max-w-none translate-x-0 translate-y-0 rounded-none border border-neutral-200 bg-white p-0 shadow-none sm:max-w-none",
				)}
			>
				<div className="flex h-[100dvh] flex-col">
					<div className="border-b border-neutral-200 px-6 py-5">
						<div className="flex items-start gap-6">
							<div className="min-w-0 pr-12">
								<div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
									Imports
								</div>
								<DialogTitle className="mt-1 text-lg font-semibold text-neutral-900">
									Imports gallery
								</DialogTitle>
								<DialogDescription className="mt-1 max-w-[52rem] text-sm text-neutral-500">
									Browse importable assets and the ones already imported into your snippet. Built-in
									SVGs can be imported today; asset library imports are coming soon.
								</DialogDescription>
							</div>
						</div>

						<div className="mt-4 flex items-center gap-3">
							<div className="w-full max-w-[34rem]">
								<Input
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search imports…"
									aria-label="Search imports"
									className="h-10"
								/>
							</div>
							<div className="ml-auto text-xs text-neutral-500">
								{filteredItems.length} of {counts.all}
							</div>
						</div>
					</div>

					<div className="flex min-h-0 flex-1">
						<nav className="w-[16rem] shrink-0 border-r border-neutral-200 bg-neutral-50 px-4 py-4">
							<div className="space-y-1">
								{FILTERS.map((filter) => {
									const Icon = filter.icon
									const isActive = filter.id === filterId
									const count = counts[filter.id]
									return (
										<button
											key={filter.id}
											type="button"
											onClick={() => setFilterId(filter.id)}
											className={cn(
												"flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
												isActive
													? "border-neutral-200 bg-white text-neutral-900"
													: "border-transparent bg-transparent text-neutral-600 hover:bg-white",
											)}
											aria-current={isActive}
										>
											<span className="flex min-w-0 items-center gap-2">
												<Icon className="h-4 w-4 text-neutral-400" />
												<span className="truncate">{filter.label}</span>
											</span>
											<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600">
												{count}
											</span>
										</button>
									)
								})}
							</div>

							<div className="mt-4 rounded-md border border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-600">
								<div className="font-medium text-neutral-900">Note</div>
								<p className="mt-1">
									The sidebar Imports panel reflects assets imported into the current snippet.
									Asset-library imports are shown here but importing them is coming soon.
								</p>
							</div>
						</nav>

						<div className="flex min-h-0 flex-1 flex-col">
							<div className="border-b border-neutral-200 bg-white px-6 py-3">
								<div className="flex items-center justify-between gap-3">
									<div className="text-sm font-medium text-neutral-900">
										{FILTERS.find((entry) => entry.id === filterId)?.label ?? "All"}
									</div>
									{filterId === "imported" && (
										<div className="text-xs text-neutral-500">
											Only imported built-in assets are removable today.
										</div>
									)}
								</div>
							</div>

							<div ref={scrollParentRef} className="min-h-0 flex-1 overflow-y-auto">
								<div className="space-y-4 px-6 py-5">
									{libraryLoadingRow}

									{filteredItems.length === 0 ? (
										<div className="rounded-md border border-dashed border-neutral-200 bg-white px-6 py-10 text-center">
											<div className="text-sm font-semibold text-neutral-900">No matches</div>
											<div className="mt-1 text-xs text-neutral-500">
												Try a different search or switch categories.
											</div>
										</div>
									) : (
										<div
											ref={gridMeasureRef}
											className="relative w-full"
											style={{
												height: `${virtualizer.getTotalSize()}px`,
											}}
										>
											{virtualRows.map((virtualRow) => {
												const startIndex = virtualRow.index * columnCount
												const rowItems = filteredItems.slice(startIndex, startIndex + columnCount)
												return (
													<div
														key={virtualRow.key}
														className="absolute left-0 top-0 w-full"
														style={{
															transform: `translateY(${virtualRow.start}px)`,
															height: `${virtualRow.size}px`,
														}}
													>
														<div
															className="grid gap-4"
															style={{
																gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
															}}
														>
															{rowItems.map((item) => (
																<ImportsGalleryTile
																	key={item.key}
																	item={item}
																	importsIndex={importsIndex}
																	importers={importers}
																	isImportAssetMutating={isImportAssetMutating}
																/>
															))}
															{rowItems.length < columnCount
																? Array.from({ length: columnCount - rowItems.length }).map(
																		(_, index) => <div key={`empty-${virtualRow.key}-${index}`} />,
																	)
																: null}
														</div>
													</div>
												)
											})}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function ImportsGalleryTile({
	item,
	importsIndex,
	importers,
	isImportAssetMutating,
}: {
	item: ImportsGalleryItem
	importsIndex: SnippetImportsIndex
	importers: ReturnType<typeof createSnippetImporters>
	isImportAssetMutating: boolean
}) {
	const label = getItemLabel(item)
	const storageKey =
		item.kind === "library-asset" && (item.asset.type === "image" || item.asset.type === "svg")
			? item.asset.file.storageKey
			: null
	const preview = useAssetPreviewUrl(storageKey)

	if (item.kind === "import-asset") {
		const asset = getImportAsset(item.assetId)
		const usage = importsIndex.importAssetsById.get(item.assetId)
		const imported = Boolean(usage?.imported)
		const used = Boolean(usage?.used)
		const usageCount = usage?.usageCount ?? 0
		const target = { kind: "import-asset" as const, assetId: item.assetId }
		const canImport = importers.canImport(target)
		const previewContent =
			item.assetId === "evencio-lockup" ? (
				<Logo size="sm" showWordmark />
			) : item.assetId === "evencio-mark" ? (
				<Logo size="lg" showWordmark={false} />
			) : (
				<div className="flex items-center justify-center text-neutral-400">
					<Shapes className="h-6 w-6" />
				</div>
			)

		return (
			<div
				data-testid={`imports-gallery-import-asset-${item.assetId}`}
				className="flex h-[332px] flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4"
			>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-neutral-900">{label}</div>
						<div className="mt-1 truncate text-xs text-neutral-500">
							<span className="font-mono">&lt;{asset?.componentName ?? "Component"} /&gt;</span>
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1">
						<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
							SVG
						</span>
						{imported ? (
							<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
								Imported
							</span>
						) : null}
						{used ? (
							<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
								In use{usageCount > 0 ? ` · ${usageCount}` : ""}
							</span>
						) : null}
					</div>
				</div>

				<div
					className="flex h-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
					style={{ height: `${TILE_PREVIEW_HEIGHT}px` }}
				>
					<div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
						{previewContent}
					</div>
				</div>

				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="truncate text-xs text-neutral-500">Built-in starter import</div>
					{imported ? (
						<Button
							type="button"
							size="sm"
							variant="destructive"
							data-testid={`imports-gallery-remove-${item.assetId}`}
							onClick={() => importers.remove(target)}
							disabled={isImportAssetMutating}
						>
							<Trash2 className="h-4 w-4" />
							Remove
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							data-testid={`imports-gallery-import-${item.assetId}`}
							onClick={() => {
								void importers.import(target)
							}}
							disabled={isImportAssetMutating || !canImport}
						>
							Import
						</Button>
					)}
				</div>
			</div>
		)
	}

	if (item.kind === "library-asset") {
		const typeLabel = getAssetTypeLabel(item.asset)
		const scopeLabel = getAssetScopeLabel(item.asset)
		const Icon =
			item.asset.type === "image" ? ImageIcon : item.asset.type === "svg" ? Shapes : FileCode2
		const tagLabels = item.tagLabels.slice(0, 2)
		return (
			<div className="flex h-[332px] flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-neutral-900">{label}</div>
						<div className="mt-1 truncate text-xs text-neutral-500">
							{item.asset.metadata.description?.trim() || "Asset library item"}
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1">
						<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
							{typeLabel}
						</span>
						<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
							{scopeLabel}
						</span>
						{tagLabels.map((tag) => (
							<span
								key={tag}
								className="hidden rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-600 md:inline-flex"
							>
								{tag}
							</span>
						))}
					</div>
				</div>

				<div
					className="flex h-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
					style={{ height: `${TILE_PREVIEW_HEIGHT}px` }}
				>
					{preview.status === "ready" ? (
						<img
							src={preview.url}
							alt={item.asset.metadata.title}
							className="max-h-full max-w-full object-contain"
							loading="lazy"
						/>
					) : preview.status === "loading" ? (
						<div className="flex items-center gap-2 text-xs text-neutral-500">
							<span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
							Loading preview…
						</div>
					) : (
						<div className="flex flex-col items-center gap-2 text-neutral-400">
							<Icon className="h-6 w-6" />
							<div className="text-xs">
								{preview.status === "missing" ? "No file preview" : "Preview unavailable"}
							</div>
						</div>
					)}
				</div>

				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="truncate text-xs text-neutral-500">Library asset</div>
					<Button type="button" size="sm" variant="outline" disabled>
						Import (soon)
					</Button>
				</div>
			</div>
		)
	}

	if (item.kind === "font") {
		const font = AVAILABLE_FONTS.find((entry) => entry.id === item.fontId)
		return (
			<div className="flex h-[332px] flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-neutral-900">
							{font?.name ?? label}
						</div>
						<div className="mt-1 truncate text-xs text-neutral-500">
							{font?.usage ?? "Typography"}
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1">
						<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
							Font
						</span>
						{font?.classNameLabel ? (
							<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
								{font.classNameLabel}
							</span>
						) : null}
					</div>
				</div>

				<div
					className="flex h-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
					style={{ height: `${TILE_PREVIEW_HEIGHT}px` }}
				>
					<div
						className={cn("text-center text-3xl text-neutral-900", font?.previewClassName ?? "")}
					>
						Aa Bb 012
					</div>
				</div>

				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="truncate text-xs text-neutral-500">Available in preview</div>
					<Button type="button" size="sm" variant="outline" disabled>
						Manage (soon)
					</Button>
				</div>
			</div>
		)
	}

	if (item.kind === "provider") {
		const provider = TRUSTED_FONT_PROVIDERS.find((entry) => entry.id === item.providerId)
		const isActive = provider?.status === "active"
		return (
			<div className="flex h-[332px] flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-neutral-900">
							{provider?.label ?? label}
						</div>
						<div className="mt-1 truncate text-xs text-neutral-500">
							Trusted provider used inside the snippet preview sandbox.
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-1">
						<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
							Provider
						</span>
						{isActive ? (
							<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
								Active
							</span>
						) : (
							<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
								Available
							</span>
						)}
					</div>
				</div>

				<div
					className="flex h-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
					style={{ height: `${TILE_PREVIEW_HEIGHT}px` }}
				>
					<div className="flex flex-col items-center gap-2 text-center">
						<Globe className="h-8 w-8 text-neutral-400" />
						<div className="text-xs text-neutral-500">
							{provider?.cssUrl ? (
								<span className="break-all font-mono text-neutral-600">{provider.cssUrl}</span>
							) : (
								"Provider details unavailable"
							)}
						</div>
					</div>
				</div>

				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="truncate text-xs text-neutral-500">Preview sandbox</div>
					<Button type="button" size="sm" variant="outline" disabled>
						Manage (soon)
					</Button>
				</div>
			</div>
		)
	}

	if (item.kind === "placeholder" && item.placeholderType === "icons") {
		return (
			<div className="flex h-[332px] flex-col gap-3 rounded-md border border-dashed border-neutral-200 bg-white p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-neutral-900">Icons</div>
						<div className="mt-1 truncate text-xs text-neutral-500">
							Icon imports will appear here once the snippet sandbox supports them.
						</div>
					</div>
					<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
						Coming soon
					</span>
				</div>

				<div
					className="flex h-[200px] items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4"
					style={{ height: `${TILE_PREVIEW_HEIGHT}px` }}
				>
					<div className="flex flex-col items-center gap-2 text-neutral-400">
						<Sparkles className="h-8 w-8" />
						<div className="text-xs text-neutral-500">Icon sets (Lucide, custom, etc.)</div>
					</div>
				</div>

				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="truncate text-xs text-neutral-500">Not available yet</div>
					<Button type="button" size="sm" variant="outline" disabled>
						Import (soon)
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-[332px] flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4">
			<div className="text-sm font-semibold text-neutral-900">{label}</div>
		</div>
	)
}
