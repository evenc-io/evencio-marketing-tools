import { createFileRoute, Link } from "@tanstack/react-router"
import { FileCode2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { AddSnippetButton } from "@/components/asset-library/add-snippet-button"
import { Footer } from "@/components/layout/footer"
import { Navbar } from "@/components/layout/navbar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { useAssetLibraryStore } from "@/stores/asset-library-store"
import type { SnippetAsset } from "@/types/asset-library"

export const Route = createFileRoute("/")({ component: DashboardPage })

function DashboardPage() {
	const assets = useAssetLibraryStore((state) => state.assets)
	const isLoading = useAssetLibraryStore((state) => state.isLoading)
	const error = useAssetLibraryStore((state) => state.error)
	const loadLibrary = useAssetLibraryStore((state) => state.loadLibrary)

	useEffect(() => {
		loadLibrary(false)
	}, [loadLibrary])

	const recentSnippets = useMemo(() => {
		const personalSnippets = assets.filter(
			(asset): asset is SnippetAsset =>
				asset.type === "snippet" && asset.scope.scope === "personal" && !asset.hidden,
		)

		return personalSnippets
			.sort(
				(left, right) =>
					new Date(right.metadata.updatedAt).getTime() -
					new Date(left.metadata.updatedAt).getTime(),
			)
			.slice(0, 8)
	}, [assets])

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Navbar variant="dashboard" />

			<main className="mx-auto w-full max-w-7xl flex-1 px-6 pt-24 pb-12">
				{/* Header */}
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">
							Your Snippets
						</h1>
						<p className="mt-2 text-neutral-500">Your latest saved personal snippets</p>
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link to="/library">Open Asset Library</Link>
					</Button>
				</div>

				{/* Content */}
				{isLoading ? (
					<div className="flex h-64 items-center justify-center">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
					</div>
				) : error ? (
					<EmptyState
						icon={<FileCode2 className="h-6 w-6" />}
						title="Could not load snippets"
						description={error}
						action={
							<Button variant="outline" onClick={() => loadLibrary(false)}>
								Try again
							</Button>
						}
						className="min-h-64"
					/>
				) : recentSnippets.length > 0 ? (
					<div className="grid gap-px border-l border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{recentSnippets.map((snippet) => {
							const formattedDate = new Date(snippet.metadata.updatedAt).toLocaleDateString(
								"en-US",
								{
									month: "short",
									day: "numeric",
									year: "numeric",
								},
							)

							return (
								<div
									key={snippet.id}
									className="group relative flex flex-col bg-white transition-colors hover:bg-neutral-50"
								>
									<Link to="/snippets/editor" search={{ edit: snippet.id }} className="block">
										<div className="relative aspect-[4/3] w-full overflow-hidden border-b border-neutral-200 bg-neutral-50">
											<div className="flex h-full w-full items-center justify-center">
												<FileCode2 className="h-8 w-8 text-neutral-300 group-hover:text-neutral-400" />
											</div>
										</div>
									</Link>

									<div className="flex flex-1 flex-col p-4">
										<Link to="/snippets/editor" search={{ edit: snippet.id }} className="min-w-0">
											<h3 className="truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
												{snippet.metadata.title}
											</h3>
										</Link>

										<div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
											<span
												className={cn(
													"rounded-full border border-neutral-200 px-1.5 py-0.5 text-[9px] font-medium",
													snippet.snippet.source
														? "bg-neutral-50 text-neutral-700"
														: "bg-neutral-50 text-neutral-500",
												)}
											>
												{snippet.snippet.source ? "Custom" : "Registry"}
											</span>
											<span className="h-1 w-1 rounded-full bg-neutral-300" />
											<span>{formattedDate}</span>
										</div>

										{snippet.metadata.description && (
											<p className="mt-2 line-clamp-2 text-xs text-neutral-500">
												{snippet.metadata.description}
											</p>
										)}
									</div>
								</div>
							)
						})}
					</div>
				) : (
					<EmptyState
						icon={<FileCode2 className="h-6 w-6" />}
						title="No personal snippets yet"
						description="Create your first snippet to get started"
						action={<AddSnippetButton />}
						className="min-h-64"
					/>
				)}
			</main>

			<Footer />
		</div>
	)
}
