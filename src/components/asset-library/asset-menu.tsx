import { Eye, EyeOff, Star, Trash2 } from "lucide-react"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AssetMenuProps {
	isFavorite: boolean
	isHidden: boolean
	onToggleFavorite: () => void
	onToggleHide: () => void
	onDelete: () => void
}

export function AssetMenu({
	isFavorite,
	isHidden,
	onToggleFavorite,
	onToggleHide,
	onDelete,
}: AssetMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Asset actions"
					className="flex h-6 w-6 items-center justify-center rounded border border-transparent text-neutral-400 hover:border-neutral-200 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
				>
					<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<title>Asset actions</title>
						<circle cx="6" cy="12" r="1.5" />
						<circle cx="12" cy="12" r="1.5" />
						<circle cx="18" cy="12" r="1.5" />
					</svg>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={4}>
				<DropdownMenuItem onClick={onToggleFavorite}>
					<Star
						className={`h-4 w-4 ${isFavorite ? "fill-neutral-900 text-neutral-900" : "text-neutral-500"}`}
					/>
					{isFavorite ? "Remove from favorites" : "Add to favorites"}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onToggleHide}>
					{isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
					{isHidden ? "Show asset" : "Hide asset"}
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={onDelete}>
					<Trash2 className="h-4 w-4" />
					Delete asset
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default AssetMenu
