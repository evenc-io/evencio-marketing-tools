import { ArrowLeft, Bug, Crosshair, Layers, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SnippetPreviewHeaderActionsProps {
	isExamplePreviewing: boolean
	activeExampleTitle?: string
	onExitExamplePreview: () => void
	inspectEnabled?: boolean
	onToggleInspect?: () => void
	layoutEnabled?: boolean
	onToggleLayout?: () => void
	layoutDebugEnabled?: boolean
	onToggleLayoutDebug?: () => void
	layers3dEnabled?: boolean
	onToggleLayers3d?: () => void
}

export function SnippetPreviewHeaderActions({
	isExamplePreviewing,
	activeExampleTitle,
	onExitExamplePreview,
	inspectEnabled = false,
	onToggleInspect,
	layoutEnabled = false,
	onToggleLayout,
	layoutDebugEnabled = false,
	onToggleLayoutDebug,
	layers3dEnabled = false,
	onToggleLayers3d,
}: SnippetPreviewHeaderActionsProps) {
	const toggleButtonClass = (enabled: boolean) =>
		cn(
			"h-7 w-7",
			enabled
				? "bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
				: "text-neutral-500 hover:text-neutral-700",
		)

	if (isExamplePreviewing) {
		return (
			<>
				<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
					Example
				</span>
				<span
					className="max-w-[140px] truncate text-[11px] text-neutral-500"
					title={activeExampleTitle}
				>
					{activeExampleTitle}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="h-7 w-7 text-neutral-500 hover:text-neutral-700"
					onClick={onExitExamplePreview}
					aria-label="Back to snippet"
					title="Back to snippet"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				{onToggleLayers3d && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className={toggleButtonClass(layers3dEnabled)}
						aria-pressed={layers3dEnabled}
						onClick={onToggleLayers3d}
						aria-label="Layers 3D"
						title="Layers 3D"
					>
						<Layers className="h-4 w-4" />
					</Button>
				)}
			</>
		)
	}

	return (
		<>
			{onToggleLayers3d && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={toggleButtonClass(layers3dEnabled)}
					aria-pressed={layers3dEnabled}
					onClick={onToggleLayers3d}
					aria-label="Layers 3D"
					title="Layers 3D"
				>
					<Layers className="h-4 w-4" />
				</Button>
			)}
			{onToggleInspect && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={toggleButtonClass(inspectEnabled)}
					aria-pressed={inspectEnabled}
					onClick={onToggleInspect}
					aria-label="Inspect"
					title="Inspect"
				>
					<Crosshair className="h-4 w-4" />
				</Button>
			)}
			{onToggleLayout && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={toggleButtonClass(layoutEnabled)}
					aria-pressed={layoutEnabled}
					onClick={onToggleLayout}
					aria-label="Layout"
					title="Layout"
				>
					<LayoutGrid className="h-4 w-4" />
				</Button>
			)}
			{onToggleLayoutDebug && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className={toggleButtonClass(layoutDebugEnabled)}
					aria-pressed={layoutDebugEnabled}
					disabled={!layoutEnabled}
					onClick={onToggleLayoutDebug}
					aria-label="Debug"
					title="Debug"
				>
					<Bug className="h-4 w-4" />
				</Button>
			)}
		</>
	)
}
