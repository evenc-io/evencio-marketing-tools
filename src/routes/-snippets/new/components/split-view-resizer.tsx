import type { PointerEvent } from "react"
import { cn } from "@/lib/utils"

interface SnippetSplitViewResizerProps {
	isHidden?: boolean
	onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
}

export function SnippetSplitViewResizer({
	isHidden = false,
	onPointerDown,
}: SnippetSplitViewResizerProps) {
	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize editor and preview"
			aria-hidden={isHidden}
			onPointerDown={onPointerDown}
			className={cn(
				"group relative flex w-2 shrink-0 items-stretch justify-center bg-transparent touch-none select-none cursor-col-resize",
				isHidden && "w-0 pointer-events-none opacity-0",
			)}
		>
			<div className="h-full w-px bg-neutral-200 transition-colors group-hover:bg-neutral-400" />
			<div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 cursor-col-resize" />
		</div>
	)
}
