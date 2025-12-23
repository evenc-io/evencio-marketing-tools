import { FileCode2, Image, Shapes, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Asset, AssetTag } from "@/types/asset-library"

type AssetCardView = "grid" | "list"

const typeConfig = {
	image: { label: "Image", icon: Image },
	svg: { label: "SVG", icon: Shapes },
	snippet: { label: "Snippet", icon: FileCode2 },
} as const

interface AssetCardProps {
	asset: Asset
	tags: Map<string, AssetTag>
	view: AssetCardView
	isSelected: boolean
	isFavorite: boolean
	onSelect: (assetId: string) => void
	onToggleFavorite: (assetId: string) => void
}

export function AssetCard({
	asset,
	tags,
	view,
	isSelected,
	isFavorite,
	onSelect,
	onToggleFavorite,
}: AssetCardProps) {
	const Icon = typeConfig[asset.type].icon
	const tagLabels = asset.metadata.tags
		.map((tagId) => tags.get(tagId)?.name)
		.filter((label): label is string => Boolean(label))
		.slice(0, 2)

	return (
		<button
			type="button"
			onClick={() => onSelect(asset.id)}
			data-selected={isSelected}
			className={cn(
				"group relative w-full rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors",
				"hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
				"data-[selected=true]:border-neutral-900 data-[selected=true]:ring-1 data-[selected=true]:ring-neutral-900/20",
				view === "list" ? "flex items-center gap-4" : "flex flex-col gap-3",
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400",
					view === "list" ? "h-12 w-12" : "aspect-[4/3] w-full",
				)}
			>
				<Icon className={cn("h-5 w-5", view === "list" ? "" : "h-6 w-6")} />
			</div>

			<div className={cn("flex-1 space-y-1", view === "list" ? "" : "")}>
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-sm font-medium text-neutral-900">{asset.metadata.title}</p>
						<p className="text-xs text-neutral-500">{typeConfig[asset.type].label}</p>
					</div>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation()
							onToggleFavorite(asset.id)
						}}
						aria-pressed={isFavorite}
						className={cn(
							"rounded-full border border-transparent p-1 transition-colors",
							"hover:border-neutral-200 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
						)}
					>
						<Star
							className={cn(
								"h-4 w-4",
								isFavorite ? "fill-neutral-900 text-neutral-900" : "text-neutral-400",
							)}
						/>
						<span className="sr-only">
							{isFavorite ? "Remove from favorites" : "Add to favorites"}
						</span>
					</button>
				</div>

				{asset.metadata.description && view === "grid" && (
					<p className="line-clamp-2 text-xs text-neutral-500">{asset.metadata.description}</p>
				)}

				{tagLabels.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{tagLabels.map((label) => (
							<span
								key={label}
								className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600"
							>
								{label}
							</span>
						))}
						{asset.metadata.tags.length > tagLabels.length && (
							<span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600">
								+{asset.metadata.tags.length - tagLabels.length}
							</span>
						)}
					</div>
				)}
			</div>
		</button>
	)
}

export default AssetCard
