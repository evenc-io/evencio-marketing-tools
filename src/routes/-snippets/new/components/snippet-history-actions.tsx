import { RotateCcw, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SnippetHistoryActionsProps {
	canUndo: boolean
	canRedo: boolean
	onUndo: () => void
	onRedo: () => void
}

export function SnippetHistoryActions({
	canUndo,
	canRedo,
	onUndo,
	onRedo,
}: SnippetHistoryActionsProps) {
	return (
		<div className="flex items-center gap-1.5">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-7 w-7"
				onClick={onUndo}
				disabled={!canUndo}
				aria-label="Undo"
				title="Undo"
			>
				<RotateCcw className="h-3.5 w-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-7 w-7"
				onClick={onRedo}
				disabled={!canRedo}
				aria-label="Redo"
				title="Redo"
			>
				<RotateCw className="h-3.5 w-3.5" />
			</Button>
		</div>
	)
}
