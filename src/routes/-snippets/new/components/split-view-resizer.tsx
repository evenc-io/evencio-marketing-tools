import type { PointerEvent } from "react"
import { cn } from "@/lib/utils"

interface SnippetSplitViewResizerProps {
	isHidden?: boolean
	onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
}

export function SnippetSplitViewResizer({
	isHidden = false,
	onPointerDown,
}: SnippetSplitViewResizerProps) {
	return (
		<button
			type="button"
			aria-label="Resize editor and preview"
			aria-hidden={isHidden}
			onPointerDown={onPointerDown}
			className={cn(
				"group relative flex w-2 shrink-0 items-stretch justify-center border-0 bg-transparent p-0 touch-none select-none cursor-col-resize",
				isHidden && "w-0 pointer-events-none opacity-0",
			)}
		>
			<div className="h-full w-px bg-neutral-200 transition-colors group-hover:bg-neutral-400" />
			<div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 cursor-col-resize" />
		</button>
	)
}
