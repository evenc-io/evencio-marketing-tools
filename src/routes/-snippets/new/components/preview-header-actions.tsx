import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SnippetPreviewHeaderActionsProps {
	isExamplePreviewing: boolean
	activeExampleTitle?: string
	activeComponentLabel: string
	useComponentDefaults: boolean
	onExitExamplePreview: () => void
	onToggleDefaults: () => void
}

export function SnippetPreviewHeaderActions({
	isExamplePreviewing,
	activeExampleTitle,
	activeComponentLabel,
	useComponentDefaults,
	onExitExamplePreview,
	onToggleDefaults,
}: SnippetPreviewHeaderActionsProps) {
	if (isExamplePreviewing) {
		return (
			<>
				<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
					Example
				</span>
				<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
					{activeExampleTitle}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-6 px-2 text-[11px]"
					onClick={onExitExamplePreview}
				>
					Back to snippet
				</Button>
			</>
		)
	}

	return (
		<>
			<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
				Component: {activeComponentLabel}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"h-6 px-2 text-[11px]",
					useComponentDefaults
						? "bg-neutral-900 text-white hover:bg-neutral-800"
						: "text-neutral-500 hover:text-neutral-700",
				)}
				aria-pressed={useComponentDefaults}
				onClick={onToggleDefaults}
			>
				Preview: {useComponentDefaults ? "Component defaults" : "Default props"}
			</Button>
		</>
	)
}
