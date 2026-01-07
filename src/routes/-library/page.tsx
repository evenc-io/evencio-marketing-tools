import { Link, useNavigate } from "@tanstack/react-router"
import { AlertCircle, BarChart3, Clock, Grid2x2, List, Search, Star, Tag } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AddSnippetButton } from "@/components/asset-library/add-snippet-button"
import { AssetCard } from "@/components/asset-library/asset-card"
import { AssetDeleteDialog } from "@/components/asset-library/asset-delete-dialog"
import { AssetDetailsPanel } from "@/components/asset-library/asset-details-panel"
import { AssetImportDialog } from "@/components/asset-library/asset-import-dialog"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildAssetSearchIndex, filterAssetSearchIndex } from "@/lib/asset-library/search-index"
import { cn } from "@/lib/utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type { Asset, AssetScope, AssetType } from "@/types/asset-library"

type ViewMode = "grid" | "list"
type SmartView = "all" | "recent" | "favorites" | "most-used"

const ASSET_TYPES: { value: AssetType; label: string }[] = [
	{ value: "image", label: "Image" },
	{ value: "svg", label: "SVG" },
	{ value: "snippet", label: "Snippet" },
]

const ASSET_SCOPES: { value: AssetScope; label: string }[] = [
	{ value: "global", label: "Global" },
	{ value: "org", label: "Organization" },
	{ value: "event", label: "Event" },
	{ value: "personal", label: "Personal" },
]

export function AssetLibraryPage() {
	const assets = useAssetLibraryStore((state) => state.assets)
	const tags = useAssetLibraryStore((state) => state.tags)
	const collections = useAssetLibraryStore((state) => state.collections)
	const favorites = useAssetLibraryStore((state) => state.favorites)
	const isLoading = useAssetLibraryStore((state) => state.isLoading)
	const error = useAssetLibraryStore((state) => state.error)
	const syncLibrary = useAssetLibraryStore((state) => state.syncLibrary)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)
	const toggleFavorite = useAssetLibraryStore((state) => state.toggleFavorite)
	const promoteAssetScope = useAssetLibraryStore((state) => state.promoteAssetScope)
	const hideAsset = useAssetLibraryStore((state) => state.hideAsset)
	const unhideAsset = useAssetLibraryStore((state) => state.unhideAsset)
	const deleteAsset = useAssetLibraryStore((state) => state.deleteAsset)
	const navigate = useNavigate()

	const [searchTerm, setSearchTerm] = useState("")
	const [typeFilters, setTypeFilters] = useState<AssetType[]>([])
	const [scopeFilters, setScopeFilters] = useState<AssetScope[]>([])
	const [tagFilters, setTagFilters] = useState<string[]>([])
	const [viewMode, setViewMode] = useState<ViewMode>("grid")
	const [smartView, setSmartView] = useState<SmartView>("all")
	const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
	const [showHidden, setShowHidden] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)

	useEffect(() => {
		loadLibrary(showHidden)
	}, [loadLibrary, showHidden])

	const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
	const searchEntries = useMemo(() => buildAssetSearchIndex(assets, tags), [assets, tags])
	const favoriteIds = useMemo(
		() => new Set(favorites.map((favorite) => favorite.assetId)),
		[favorites],
	)

	const usageScores = useMemo(() => {
		const scores = new Map<string, number>()
		for (const favorite of favorites) {
			scores.set(favorite.assetId, (scores.get(favorite.assetId) ?? 0) + 1)
		}
		for (const collection of collections) {
			for (const assetId of collection.assetIds) {
				scores.set(assetId, (scores.get(assetId) ?? 0) + 1)
			}
		}
		return scores
	}, [collections, favorites])

	const smartViewEntries = useMemo(() => {
		if (smartView === "favorites") {
			return searchEntries.filter((entry) => favoriteIds.has(entry.asset.id))
		}

		if (smartView === "most-used") {
			const entries = searchEntries.filter((entry) => (usageScores.get(entry.asset.id) ?? 0) > 0)
			return entries.sort((left, right) => {
				const scoreDelta =
					(usageScores.get(right.asset.id) ?? 0) - (usageScores.get(left.asset.id) ?? 0)
				if (scoreDelta !== 0) return scoreDelta
				return (
					new Date(right.asset.metadata.updatedAt).getTime() -
					new Date(left.asset.metadata.updatedAt).getTime()
				)
			})
		}

		if (smartView === "recent") {
			return [...searchEntries].sort(
				(left, right) =>
					new Date(right.asset.metadata.updatedAt).getTime() -
					new Date(left.asset.metadata.updatedAt).getTime(),
			)
		}

		return searchEntries
	}, [favoriteIds, searchEntries, smartView, usageScores])

	const filteredEntries = useMemo(
		() =>
			filterAssetSearchIndex(smartViewEntries, {
				search: searchTerm,
				types: typeFilters,
				scopes: scopeFilters,
				tagIds: tagFilters,
			}).filter((entry) => showHidden || !entry.asset.hidden),
		[smartViewEntries, searchTerm, typeFilters, scopeFilters, tagFilters, showHidden],
	)

	const filteredAssets = useMemo(
		() => filteredEntries.map((entry) => entry.asset),
		[filteredEntries],
	)
	const totalAssets = assets.length
	const filteredCount = filteredAssets.length

	const selectedAsset = useMemo(
		() => filteredAssets.find((asset) => asset.id === selectedAssetId) ?? null,
		[filteredAssets, selectedAssetId],
	)

	useEffect(() => {
		if (filteredAssets.length === 0) {
			setSelectedAssetId(null)
			return
		}
		if (!selectedAssetId || !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
			setSelectedAssetId(filteredAssets[0]?.id ?? null)
		}
	}, [filteredAssets, selectedAssetId])

	const hasUsageData = usageScores.size > 0
	const hasActiveFilters =
		searchTerm.trim().length > 0 ||
		typeFilters.length > 0 ||
		scopeFilters.length > 0 ||
		tagFilters.length > 0

	const showEmptyLibrary = !isLoading && !error && assets.length === 0
	const showNoResults =
		!isLoading && !error && assets.length > 0 && filteredAssets.length === 0 && !showEmptyLibrary
	const showNoUsage =
		!isLoading && !error && assets.length > 0 && smartView === "most-used" && !hasUsageData

	const toggleSelection = <T,>(value: T, setValues: (next: T[]) => void, values: T[]) => {
		if (values.includes(value)) {
			setValues(values.filter((item) => item !== value))
		} else {
			setValues([...values, value])
		}
	}

	const handleClearFilters = () => {
		setSearchTerm("")
		setTypeFilters([])
		setScopeFilters([])
		setTagFilters([])
	}

	const handleToggleHideAsset = async (assetId: string, isHidden: boolean) => {
		if (isHidden) {
			await unhideAsset(assetId)
			return
		}
		await hideAsset(assetId)
	}

	const handleUnhideAsset = async (assetId: string) => {
		await unhideAsset(assetId)
	}

	const handleDeleteAsset = async () => {
		if (!assetToDelete) return
		await deleteAsset(assetToDelete.id)
		setDeleteDialogOpen(false)
		setAssetToDelete(null)
	}

	const handleDeleteDialogOpen = (assetId: string) => {
		const asset = assets.find((a) => a.id === assetId)
		if (asset) {
			setAssetToDelete(asset)
			setDeleteDialogOpen(true)
		}
	}

	const handleDeleteDialogClose = () => {
		setDeleteDialogOpen(false)
		setAssetToDelete(null)
	}

	const handleEditSnippetSource = (assetId: string) => {
		navigate({ to: "/snippets/editor", search: { edit: assetId } })
	}

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<header className="h-12 shrink-0 border-b border-neutral-200 bg-white">
				<div className="flex h-full items-center justify-between px-4">
					<div className="flex items-center gap-3">
						<Logo size="sm" href="/" animateOnHover />
						<span className="text-neutral-300">/</span>
						<span className="text-sm text-neutral-600">Asset Library</span>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link to="/">Dashboard</Link>
						</Button>
						<AddSnippetButton />
						<AssetImportDialog />
					</div>
				</div>
			</header>

			<main className="flex min-h-0 flex-1 flex-col">
				<section className="border-b border-neutral-200 bg-white">
					<div className="mx-auto flex max-w-full flex-col gap-4 px-6 py-6">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							<div>
								<span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
									01 / Library
								</span>
								<h1 className="mt-2 font-lexend text-3xl font-bold tracking-tight text-neutral-900">
									Asset Library
								</h1>
								<p className="mt-2 text-sm text-neutral-500">
									Search reusable images, SVGs, and snippets across your scopes.
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
								<span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
									Library size
								</span>
								<span>{totalAssets} assets total</span>
							</div>
						</div>

						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div className="relative w-full lg:max-w-xl">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
								<Input
									value={searchTerm}
									onChange={(event) => setSearchTerm(event.target.value)}
									placeholder="Search by title, tags, type, or owner"
									className="pl-9 shadow-none focus-visible:ring-neutral-900"
								/>
							</div>
							<Tabs value={smartView} onValueChange={(value) => setSmartView(value as SmartView)}>
								<TabsList className="h-auto flex-wrap gap-1 rounded-full border border-neutral-200 bg-white p-1">
									<TabsTrigger
										value="all"
										className="gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-none"
									>
										<Tag className="h-4 w-4" />
										All
									</TabsTrigger>
									<TabsTrigger
										value="recent"
										className="gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-none"
									>
										<Clock className="h-4 w-4" />
										Recent
									</TabsTrigger>
									<TabsTrigger
										value="favorites"
										className="gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-none"
									>
										<Star className="h-4 w-4" />
										Favorites
									</TabsTrigger>
									<TabsTrigger
										value="most-used"
										className="gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-none"
									>
										<BarChart3 className="h-4 w-4" />
										Most used
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>
				</section>

				<div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-200">
					<div className="grid min-h-0 flex-1 gap-px lg:grid-cols-[240px_minmax(0,1fr)_320px]">
						<aside className="order-2 flex min-h-0 flex-col bg-neutral-50 lg:order-1">
							<div className="flex h-12 items-center justify-between border-b border-neutral-200 px-4">
								<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
									Filters
								</p>
								{hasActiveFilters && (
									<button
										type="button"
										onClick={handleClearFilters}
										className="text-xs font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
									>
										Clear
									</button>
								)}
							</div>

							<div className="flex-1 overflow-y-auto px-4 py-4">
								<div className="space-y-6">
									<div className="space-y-2">
										<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
											Type
										</p>
										{ASSET_TYPES.map((type) => (
											<label
												key={type.value}
												className="flex items-center gap-2 text-sm text-neutral-700"
											>
												<input
													type="checkbox"
													checked={typeFilters.includes(type.value)}
													onChange={() => toggleSelection(type.value, setTypeFilters, typeFilters)}
													className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900"
												/>
												<span>{type.label}</span>
											</label>
										))}
									</div>

									<div className="space-y-2">
										<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
											Scope
										</p>
										{ASSET_SCOPES.map((scope) => (
											<label
												key={scope.value}
												className="flex items-center gap-2 text-sm text-neutral-700"
											>
												<input
													type="checkbox"
													checked={scopeFilters.includes(scope.value)}
													onChange={() =>
														toggleSelection(scope.value, setScopeFilters, scopeFilters)
													}
													className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900"
												/>
												<span>{scope.label}</span>
											</label>
										))}
									</div>

									<div className="space-y-2">
										<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
											Tags
										</p>
										{tags.length === 0 ? (
											<p className="text-xs text-neutral-400">No tags available yet.</p>
										) : (
											tags.map((tag) => (
												<label
													key={tag.id}
													className="flex items-center gap-2 text-sm text-neutral-700"
												>
													<input
														type="checkbox"
														checked={tagFilters.includes(tag.id)}
														onChange={() => toggleSelection(tag.id, setTagFilters, tagFilters)}
														className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900"
													/>
													<span>{tag.name}</span>
												</label>
											))
										)}
									</div>

									<div className="space-y-2">
										<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
											Visibility
										</p>
										<label className="flex items-center gap-2 text-sm text-neutral-700">
											<input
												type="checkbox"
												checked={showHidden}
												onChange={(event) => {
													setShowHidden(event.target.checked)
													syncLibrary(event.target.checked)
												}}
												className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900"
											/>
											<span>Show hidden assets</span>
										</label>
									</div>
								</div>
							</div>
						</aside>

						<section className="order-1 flex min-h-0 flex-col bg-white lg:order-2">
							<div className="flex h-12 items-center justify-between gap-3 border-b border-neutral-200 px-4">
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
										Results
									</p>
									<p className="text-xs text-neutral-500">
										{filteredCount} of {totalAssets} assets
									</p>
								</div>
								<div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1">
									<button
										type="button"
										onClick={() => setViewMode("grid")}
										aria-pressed={viewMode === "grid"}
										className={cn(
											"flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-neutral-500 transition-colors",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1",
											viewMode === "grid"
												? "border-neutral-900 bg-neutral-900 text-white"
												: "hover:border-neutral-200 hover:bg-neutral-50",
										)}
									>
										<Grid2x2 className="h-4 w-4" />
										<span className="sr-only">Grid view</span>
									</button>
									<button
										type="button"
										onClick={() => setViewMode("list")}
										aria-pressed={viewMode === "list"}
										className={cn(
											"flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-neutral-500 transition-colors",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1",
											viewMode === "list"
												? "border-neutral-900 bg-neutral-900 text-white"
												: "hover:border-neutral-200 hover:bg-neutral-50",
										)}
									>
										<List className="h-4 w-4" />
										<span className="sr-only">List view</span>
									</button>
								</div>
							</div>

							<div className="flex-1 overflow-y-auto p-4">
								{error && (
									<div
										className="flex h-32 flex-col items-center justify-center rounded-md border border-neutral-200 bg-white text-center"
										role="alert"
									>
										<AlertCircle className="mb-2 h-6 w-6 text-red-500" />
										<p className="text-sm text-neutral-600">Failed to load assets.</p>
										<Button
											variant="outline"
											size="sm"
											className="mt-3"
											onClick={() => loadLibrary(showHidden)}
										>
											Try again
										</Button>
									</div>
								)}

								{isLoading && !error && (
									<div className="flex h-40 items-center justify-center rounded-md border border-neutral-200 bg-white">
										<div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
									</div>
								)}

								{showEmptyLibrary && !error && !isLoading && (
									<EmptyState
										icon={<Tag className="h-6 w-6" />}
										title="No assets yet"
										description="Upload or register assets to start building your library."
										action={
											<Button variant="outline" size="sm" onClick={() => loadLibrary(showHidden)}>
												Refresh library
											</Button>
										}
										className="h-40"
									/>
								)}

								{showNoUsage && (
									<EmptyState
										icon={<BarChart3 className="h-6 w-6" />}
										title="No usage data yet"
										description="Usage appears once assets are added to designs or collections."
										action={
											<Button variant="outline" size="sm" onClick={() => setSmartView("recent")}>
												View recent assets
											</Button>
										}
										className="h-40"
									/>
								)}

								{showNoResults && !showNoUsage && (
									<div className="flex h-24 flex-col items-center justify-center rounded-md border border-neutral-200 bg-white text-center">
										<Search className="mb-2 h-6 w-6 text-neutral-400" />
										<p className="text-sm text-neutral-600">No assets match your filters.</p>
										<Button variant="link" size="sm" className="mt-1" onClick={handleClearFilters}>
											Clear filters
										</Button>
									</div>
								)}

								{!isLoading &&
									!error &&
									!showEmptyLibrary &&
									!showNoUsage &&
									filteredAssets.length > 0 && (
										<div
											className={cn(
												viewMode === "grid"
													? "grid gap-px border-l border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2 xl:grid-cols-3"
													: "space-y-3",
											)}
										>
											{filteredAssets.map((asset) => (
												<AssetCard
													key={asset.id}
													asset={asset}
													tags={tagMap}
													view={viewMode}
													isSelected={asset.id === selectedAssetId}
													isFavorite={favoriteIds.has(asset.id)}
													isHidden={asset.hidden ?? false}
													onSelect={setSelectedAssetId}
													onToggleFavorite={toggleFavorite}
													onToggleHide={handleToggleHideAsset}
													onDelete={handleDeleteDialogOpen}
												/>
											))}
										</div>
									)}
							</div>
						</section>

						<aside className="order-3 flex min-h-0 flex-col bg-neutral-50 lg:order-3">
							<div className="flex h-12 items-center border-b border-neutral-200 px-4">
								<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
									Details
								</p>
							</div>
							<div className="flex-1 overflow-y-auto p-4">
								<AssetDetailsPanel
									asset={selectedAsset}
									tags={tagMap}
									isFavorite={selectedAsset ? favoriteIds.has(selectedAsset.id) : false}
									isHidden={selectedAsset?.hidden ?? false}
									onToggleFavorite={toggleFavorite}
									onPromoteScope={promoteAssetScope}
									onUnhide={handleUnhideAsset}
									onDelete={handleDeleteDialogOpen}
									onEditSource={handleEditSnippetSource}
								/>
							</div>
						</aside>
					</div>
				</div>
			</main>

			<AssetDeleteDialog
				asset={assetToDelete}
				open={deleteDialogOpen}
				onOpenChange={handleDeleteDialogClose}
				onDelete={handleDeleteAsset}
			/>
		</div>
	)
}
