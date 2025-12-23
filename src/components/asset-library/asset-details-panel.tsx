import { FileCode2, Image, Shapes, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Asset, AssetTag } from "@/types/asset-library"

const typeConfig = {
	image: { label: "Image", icon: Image },
	svg: { label: "SVG", icon: Shapes },
	snippet: { label: "Snippet", icon: FileCode2 },
} as const

const scopeLabels: Record<string, string> = {
	global: "Global",
	org: "Organization",
	event: "Event",
	personal: "Personal",
}

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

interface AssetDetailsPanelProps {
	asset: Asset | null
	tags: Map<string, AssetTag>
	isFavorite: boolean
	onToggleFavorite: (assetId: string) => void
}

export function AssetDetailsPanel({
	asset,
	tags,
	isFavorite,
	onToggleFavorite,
}: AssetDetailsPanelProps) {
	if (!asset) {
		return (
			<div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
				Select an asset to view metadata and licensing details.
			</div>
		)
	}

	const Icon = typeConfig[asset.type].icon
	const tagLabels = asset.metadata.tags
		.map((tagId) => tags.get(tagId)?.name)
		.filter((label): label is string => Boolean(label))

	return (
		<div className="rounded-lg border border-neutral-200 bg-white p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
						Asset Details
					</p>
					<h2 className="mt-2 text-lg font-semibold text-neutral-900">{asset.metadata.title}</h2>
					{asset.metadata.description && (
						<p className="mt-1 text-sm text-neutral-500">{asset.metadata.description}</p>
					)}
				</div>
				<button
					type="button"
					onClick={() => onToggleFavorite(asset.id)}
					aria-pressed={isFavorite}
					className={cn(
						"rounded-full border border-neutral-200 p-2 text-neutral-600 transition-colors",
						"hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
					)}
				>
					<Star
						className={cn(
							"h-4 w-4",
							isFavorite ? "fill-neutral-900 text-neutral-900" : "text-neutral-500",
						)}
					/>
					<span className="sr-only">
						{isFavorite ? "Remove from favorites" : "Add to favorites"}
					</span>
				</button>
			</div>

			<div className="mt-4 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
				<Icon className="h-4 w-4" />
				<span>{typeConfig[asset.type].label}</span>
				<span className="mx-1 text-neutral-300">•</span>
				<span>{scopeLabels[asset.scope.scope] ?? asset.scope.scope}</span>
			</div>

			<div className="mt-4 space-y-4 text-sm text-neutral-700">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Tags</p>
					{tagLabels.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-1">
							{tagLabels.map((label) => (
								<span
									key={label}
									className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600"
								>
									{label}
								</span>
							))}
						</div>
					) : (
						<p className="mt-2 text-xs text-neutral-400">No tags assigned.</p>
					)}
				</div>

				<div className="grid gap-3">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Version</p>
						<p className="mt-1 text-sm text-neutral-800">v{asset.version}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Updated</p>
						<p className="mt-1 text-sm text-neutral-800">{formatDate(asset.metadata.updatedAt)}</p>
					</div>
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">License</p>
						<p className="mt-1 text-sm text-neutral-800">{asset.metadata.license.name}</p>
						{asset.metadata.license.attributionRequired && (
							<p className="mt-1 text-xs text-neutral-500">Attribution required</p>
						)}
					</div>
					{asset.metadata.attribution && (
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Attribution</p>
							<p className="mt-1 text-sm text-neutral-800">{asset.metadata.attribution.text}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default AssetDetailsPanel
