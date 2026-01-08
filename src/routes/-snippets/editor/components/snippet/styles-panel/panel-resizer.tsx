import type { PointerEvent } from "react"
import { cn } from "@/lib/utils"

type StylesPanelResizerProps = {
	isHidden?: boolean
	onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
	onDoubleClick?: () => void
}

export function StylesPanelResizer({
	isHidden = false,
	onPointerDown,
	onDoubleClick,
}: StylesPanelResizerProps) {
	return (
		<button
			type="button"
			aria-label="Resize styles panel"
			aria-hidden={isHidden}
			onPointerDown={onPointerDown}
			onDoubleClick={onDoubleClick}
			className={cn(
				"group absolute inset-y-0 left-0 z-10 flex w-2 -translate-x-1/2 items-stretch justify-center border-0 bg-transparent p-0 touch-none select-none cursor-col-resize",
				isHidden && "w-0 pointer-events-none opacity-0",
			)}
		>
			<div className="h-full w-px bg-neutral-200 transition-colors group-hover:bg-neutral-400" />
			<div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 cursor-col-resize" />
		</button>
	)
}
