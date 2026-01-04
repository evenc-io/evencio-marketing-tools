import { Fragment, type ReactNode, type PointerEvent as ReactPointerEvent, useMemo } from "react"
import { Logo } from "@/components/brand/logo"
import { AVAILABLE_FONTS, TRUSTED_FONT_PROVIDERS } from "@/lib/snippets/imports"
import { cn } from "@/lib/utils"
import type { ImportFilterId } from "@/routes/-snippets/editor/constants"
import type { ImportAssetId } from "@/routes/-snippets/editor/import-assets"

interface ImportSection {
	id: string
	group: string
	node: ReactNode
}

interface SnippetImportsPanelProps {
	open: boolean
	filters: ImportFilterId[]
	onAssetPointerDown?: (assetId: ImportAssetId, event: ReactPointerEvent<HTMLButtonElement>) => void
}

export function SnippetImportsPanel({
	open,
	filters,
	onAssetPointerDown,
}: SnippetImportsPanelProps) {
	const sections = useMemo<ImportSection[]>(() => {
		const items: ImportSection[] = [
			{
				id: "fonts",
				group: "fonts",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Fonts</p>
						{AVAILABLE_FONTS.map((font) => (
							<div key={font.id} className="rounded-md border border-neutral-200 bg-white p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-neutral-900">{font.name}</p>
										<p className="text-[11px] text-neutral-500">{font.usage}</p>
									</div>
									<span className="text-[10px] uppercase tracking-widest text-neutral-400">
										{font.classNameLabel}
									</span>
								</div>
								<p className={cn("mt-2 text-sm text-neutral-900", font.previewClassName)}>
									Aa Bb 012
								</p>
							</div>
						))}
					</div>
				),
			},
			{
				id: "providers",
				group: "fonts",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">
							Trusted font providers
						</p>
						{TRUSTED_FONT_PROVIDERS.map((provider) => (
							<div
								key={provider.id}
								className="rounded-md border border-neutral-200 bg-white px-3 py-2"
							>
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm font-medium text-neutral-900">{provider.label}</span>
									<span className="text-[10px] uppercase tracking-widest text-neutral-400">
										{provider.status === "active" ? "Active" : "Available"}
									</span>
								</div>
							</div>
						))}
						<p className="text-[10px] text-neutral-400">
							Only trusted providers are injected into preview.
						</p>
					</div>
				),
			},
			{
				id: "svgs",
				group: "svgs",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">SVG assets</p>
						<button
							type="button"
							onPointerDown={(event) => onAssetPointerDown?.("evencio-mark", event)}
							className="w-full rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50 cursor-grab active:cursor-grabbing"
						>
							<div className="flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-neutral-900">Evencio mark</span>
								<span className="text-[10px] uppercase tracking-widest text-neutral-400">SVG</span>
							</div>
							<div className="mt-3 flex items-center gap-3">
								<Logo size="xs" showWordmark={false} />
								<span className="text-[11px] text-neutral-500">Drag into preview</span>
							</div>
						</button>
						<button
							type="button"
							onPointerDown={(event) => onAssetPointerDown?.("evencio-lockup", event)}
							className="w-full rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50 cursor-grab active:cursor-grabbing"
						>
							<div className="flex items-center justify-between gap-3">
								<span className="text-sm font-medium text-neutral-900">Evencio lockup</span>
								<span className="text-[10px] uppercase tracking-widest text-neutral-400">
									SVG + type
								</span>
							</div>
							<div className="mt-3">
								<Logo size="xs" showWordmark />
							</div>
							<div className="mt-2 text-[11px] text-neutral-500">Drag into preview</div>
						</button>
					</div>
				),
			},
			{
				id: "icons",
				group: "icons",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Icons</p>
						<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
							<p className="text-sm text-neutral-500">Lucide icons (coming soon)</p>
						</div>
					</div>
				),
			},
			{
				id: "images",
				group: "images",
				node: (
					<div className="space-y-2">
						<p className="text-[10px] uppercase tracking-widest text-neutral-400">Images</p>
						<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
							<p className="text-sm text-neutral-500">Image imports (coming soon)</p>
						</div>
					</div>
				),
			},
		]

		if (filters.includes("all") || filters.length === 0) return items
		return items.filter((section) => filters.includes(section.group as ImportFilterId))
	}, [filters, onAssetPointerDown])

	return (
		<aside
			className={cn(
				"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
				open ? "w-[21rem] border-r border-neutral-200" : "w-0 border-r-0",
			)}
		>
			<div
				className={cn(
					"flex h-full w-[21rem] flex-col transition-opacity duration-200",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				aria-hidden={!open}
			>
				{open && (
					<>
						<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
							Imports
						</div>
						<div className="flex-1 space-y-6 overflow-y-auto px-3 pb-3">
							{sections.map((section) => (
								<Fragment key={section.id}>{section.node}</Fragment>
							))}
						</div>
					</>
				)}
			</div>
		</aside>
	)
}
