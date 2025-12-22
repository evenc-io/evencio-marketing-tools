import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	GripVertical,
	Trash2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { getLayerIcon } from "@/lib/layers"
import { cn } from "@/lib/utils"
import type { LayerInfo } from "@/types/layers"
import { Button } from "../ui/button"

interface LayerItemProps {
	layer: LayerInfo
	isSelected: boolean
	onSelect: (event: React.MouseEvent) => void
	onToggleVisibility: () => void
	onDelete: () => void
	onDuplicate: () => void
	canDuplicate?: boolean
	showGroupToggle?: boolean
	isGroupExpanded?: boolean
	onToggleGroup?: () => void
}

const DELETE_CONFIRM_TIMEOUT = 2000

export function LayerItem({
	layer,
	isSelected,
	onSelect,
	onToggleVisibility,
	onDelete,
	onDuplicate,
	canDuplicate = true,
	showGroupToggle = false,
	isGroupExpanded = true,
	onToggleGroup,
}: LayerItemProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: layer.layerId,
	})

	// Clear timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleDeleteClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()

			if (confirmingDelete) {
				// Second click - confirm deletion
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current)
				}
				setConfirmingDelete(false)
				onDelete()
			} else {
				// First click - show confirmation state
				setConfirmingDelete(true)
				timeoutRef.current = setTimeout(() => {
					setConfirmingDelete(false)
				}, DELETE_CONFIRM_TIMEOUT)
			}
		},
		[confirmingDelete, onDelete],
	)

	const depth = layer.depth ?? 0
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		paddingLeft: `${8 + depth * 12}px`,
	}

	const Icon = getLayerIcon(layer.objectType)

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"group flex items-center gap-2 border-b border-neutral-200 pr-2 py-1.5 transition-colors",
				isSelected && "bg-neutral-100",
				!isSelected && "hover:bg-neutral-50",
				isDragging && "opacity-50",
				!layer.visible && "opacity-50",
			)}
		>
			{/* Group expand/collapse */}
			{showGroupToggle ? (
				<button
					type="button"
					className="shrink-0 text-neutral-500 hover:text-neutral-700"
					onClick={(e) => {
						e.stopPropagation()
						onToggleGroup?.()
					}}
					title={isGroupExpanded ? "Collapse group" : "Expand group"}
				>
					{isGroupExpanded ? (
						<ChevronDown className="h-3.5 w-3.5" />
					) : (
						<ChevronRight className="h-3.5 w-3.5" />
					)}
				</button>
			) : (
				<span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			)}

			{/* Drag handle */}
			<button
				type="button"
				className="cursor-grab touch-none text-neutral-400 hover:text-neutral-600"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-3.5 w-3.5" />
			</button>

			{/* Layer content (clickable to select) */}
			<button
				type="button"
				className="flex flex-1 items-center gap-2 text-left"
				onClick={(e) => {
					e.stopPropagation()
					onSelect(e)
				}}
			>
				<Icon className="h-3.5 w-3.5 text-neutral-500" />
				<span className="flex-1 truncate text-xs text-neutral-700">{layer.layerName}</span>
			</button>

			{/* Actions */}
			<div
				className={cn(
					"flex items-center gap-0.5 transition-opacity",
					confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100",
				)}
			>
				{canDuplicate ? (
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-6 w-6"
						onClick={(e) => {
							e.stopPropagation()
							onDuplicate()
						}}
						title="Duplicate layer"
					>
						<Copy className="h-3 w-3" />
					</Button>
				) : null}
				<Button
					variant={confirmingDelete ? "destructive" : "ghost"}
					size="icon-sm"
					className={cn(
						"h-6 w-6 transition-all",
						!confirmingDelete && "text-destructive hover:text-destructive",
						confirmingDelete && "animate-pulse",
					)}
					onClick={handleDeleteClick}
					title={confirmingDelete ? "Click again to confirm" : "Delete layer"}
				>
					{confirmingDelete ? <Check className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
				</Button>
			</div>

			{/* Visibility toggle (always visible) */}
			<Button
				variant="ghost"
				size="icon-sm"
				className="h-6 w-6"
				onClick={(e) => {
					e.stopPropagation()
					onToggleVisibility()
				}}
				title={layer.visible ? "Hide layer" : "Show layer"}
			>
				{layer.visible ? (
					<Eye className="h-3 w-3 text-neutral-500" />
				) : (
					<EyeOff className="h-3 w-3 text-neutral-400" />
				)}
			</Button>
		</div>
	)
}
