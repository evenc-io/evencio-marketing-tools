import { cn } from "@/lib/utils"
import type { ImportAssetDescriptor } from "@/routes/-snippets/editor/import-assets"

type ImportDndOverlayState = {
	asset: ImportAssetDescriptor
	clientX: number
	clientY: number
	overPreview: boolean
}

interface SnippetImportDndOverlayProps {
	drag: ImportDndOverlayState | null
}

export function SnippetImportDndOverlay({ drag }: SnippetImportDndOverlayProps) {
	if (!drag) return null

	return (
		<div
			className="pointer-events-none fixed left-0 top-0 z-[80]"
			style={{
				transform: `translate(${Math.round(drag.clientX + 14)}px, ${Math.round(
					drag.clientY + 14,
				)}px)`,
			}}
			aria-hidden
		>
			<div className="rounded-md border border-neutral-200 bg-white px-2 py-1">
				<div className="flex items-center gap-2">
					<span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
						SVG
					</span>
					<span className="text-xs font-medium text-neutral-900">{drag.asset.label}</span>
				</div>
				<div
					className={cn(
						"mt-1 text-[10px] uppercase tracking-[0.32em]",
						drag.overPreview ? "text-neutral-500" : "text-neutral-400",
					)}
				>
					{drag.overPreview ? "Drop to insert" : "Drag into preview"}
				</div>
			</div>
		</div>
	)
}
