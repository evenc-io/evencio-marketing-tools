import { EyeOff, FileCode2, Image, Shapes } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Asset, AssetTag } from "@/types/asset-library"
import AssetMenu from "./asset-menu"

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
	isHidden: boolean
	onSelect: (assetId: string) => void
	onToggleFavorite: (assetId: string) => void
	onToggleHide: (assetId: string, isHidden: boolean) => void
	onDelete: (assetId: string) => void
}

export function AssetCard({
	asset,
	tags,
	view,
	isSelected,
	isFavorite,
	isHidden,
	onSelect,
	onToggleFavorite,
	onToggleHide,
	onDelete,
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
				"group relative w-full rounded-lg border p-3 text-left transition-colors",
				isHidden
					? "border-amber-200 bg-amber-50/50"
					: "border-neutral-200 bg-white hover:border-neutral-300",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
				"data-[selected=true]:border-neutral-900 data-[selected=true]:ring-1 data-[selected=true]:ring-neutral-900/20",
				view === "list" ? "flex items-center gap-4" : "flex flex-col gap-3",
			)}
		>
			{/* Controls row */}
			{view === "grid" && (
				<div className="flex items-center justify-between">
					{isHidden ? (
						<div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
							<EyeOff className="h-3 w-3" />
							Hidden
						</div>
					) : (
						<div />
					)}
					<AssetMenu
						isFavorite={isFavorite}
						isHidden={isHidden}
						onToggleFavorite={() => onToggleFavorite(asset.id)}
						onToggleHide={() => onToggleHide(asset.id, isHidden)}
						onDelete={() => onDelete(asset.id)}
					/>
				</div>
			)}

			<div
				className={cn(
					"flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400",
					view === "list" ? "h-12 w-12" : "aspect-[4/3] w-full",
				)}
			>
				<Icon className={cn("h-5 w-5", view === "list" ? "" : "h-6 w-6")} />
			</div>

			<div className={cn("flex-1 space-y-1", view === "list" ? "" : "")}>
				<div>
					<p className="text-sm font-medium text-neutral-900">{asset.metadata.title}</p>
					<p className="text-xs text-neutral-500">{typeConfig[asset.type].label}</p>
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

			{/* List view controls */}
			{view === "list" && (
				<div className="flex items-center gap-2">
					{isHidden && (
						<div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
							<EyeOff className="h-3 w-3" />
							Hidden
						</div>
					)}
					<AssetMenu
						isFavorite={isFavorite}
						isHidden={isHidden}
						onToggleFavorite={() => onToggleFavorite(asset.id)}
						onToggleHide={() => onToggleHide(asset.id, isHidden)}
						onDelete={() => onDelete(asset.id)}
					/>
				</div>
			)}
		</button>
	)
}

export default AssetCard
