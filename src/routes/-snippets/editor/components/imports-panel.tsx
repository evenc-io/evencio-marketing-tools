import { Grid2X2, Trash2 } from "lucide-react"
import {
	Fragment,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useMemo,
	useState,
} from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AVAILABLE_FONTS, TRUSTED_FONT_PROVIDERS } from "@/lib/snippets/imports"
import { cn } from "@/lib/utils"
import type { ImportFilterId } from "@/routes/-snippets/editor/constants"
import type { SnippetImportsIndex } from "@/routes/-snippets/editor/hooks/snippet/imports-index"
import type { ImportAssetId } from "@/routes/-snippets/editor/import-assets"
import { getImportAsset } from "@/routes/-snippets/editor/import-assets"

interface ImportSection {
	id: string
	group: string
	node: ReactNode
}

interface SnippetImportsPanelProps {
	open: boolean
	filters: ImportFilterId[]
	importsIndex: SnippetImportsIndex
	onAssetPointerDown?: (assetId: ImportAssetId, event: ReactPointerEvent<HTMLButtonElement>) => void
	isRemovingImportAsset?: boolean
	onRequestRemoveImportAsset?: (assetId: ImportAssetId) => void
	onOpenGallery?: () => void
}

export function SnippetImportsPanel({
	open,
	filters,
	importsIndex,
	onAssetPointerDown,
	isRemovingImportAsset = false,
	onRequestRemoveImportAsset,
	onOpenGallery,
}: SnippetImportsPanelProps) {
	const [assetContextMenu, setAssetContextMenu] = useState<{
		open: boolean
		x: number
		y: number
		assetId: ImportAssetId | null
	}>(() => ({ open: false, x: 0, y: 0, assetId: null }))

	const handleAssetContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>, assetId: ImportAssetId) => {
			event.preventDefault()
			event.stopPropagation()
			setAssetContextMenu({ open: true, x: event.clientX, y: event.clientY, assetId })
		},
		[],
	)

	const sections = useMemo<ImportSection[]>(() => {
		if (!open) return []
		const importedSvgAssets = importsIndex.importAssets.filter((asset) => asset.imported)
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
						{importedSvgAssets.length > 0 ? (
							importedSvgAssets.map((asset) => {
								const descriptor = getImportAsset(asset.id)
								const label = descriptor?.label ?? asset.id
								const typeLabel = asset.id === "evencio-lockup" ? "SVG + type" : "SVG"
								const preview =
									asset.id === "evencio-lockup" ? (
										<Logo size="xs" showWordmark />
									) : asset.id === "evencio-mark" ? (
										<Logo size="xs" showWordmark={false} />
									) : null

								return (
									<button
										key={asset.id}
										type="button"
										data-testid={`imports-sidebar-import-asset-${asset.id}`}
										onPointerDown={(event) => {
											if (event.button !== 0) return
											onAssetPointerDown?.(asset.id, event)
										}}
										onContextMenu={(event) => handleAssetContextMenu(event, asset.id)}
										className="w-full rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50 cursor-grab active:cursor-grabbing"
									>
										<div className="flex items-center justify-between gap-3">
											<span className="text-sm font-medium text-neutral-900">{label}</span>
											<span className="text-[10px] uppercase tracking-widest text-neutral-400">
												{typeLabel}
											</span>
										</div>
										<div className="mt-3 flex items-center gap-3">
											{preview ? (
												<div className="shrink-0">{preview}</div>
											) : (
												<div className="h-5 w-5 rounded-sm bg-neutral-200" />
											)}
											<span className="text-[11px] text-neutral-500">Drag into preview</span>
										</div>
									</button>
								)
							})
						) : (
							<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
								<p className="text-sm text-neutral-500">No SVG imports yet</p>
								<p className="mt-1 text-xs text-neutral-400">Open Gallery to import (soon).</p>
							</div>
						)}
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
	}, [filters, handleAssetContextMenu, importsIndex.importAssets, onAssetPointerDown, open])

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
						<DropdownMenu
							open={assetContextMenu.open}
							onOpenChange={(nextOpen) => {
								setAssetContextMenu((prev) => ({
									...prev,
									open: nextOpen,
									assetId: nextOpen ? prev.assetId : null,
								}))
							}}
						>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									aria-hidden="true"
									tabIndex={-1}
									className="pointer-events-none fixed h-px w-px opacity-0"
									style={{ left: assetContextMenu.x, top: assetContextMenu.y }}
								/>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" sideOffset={4} className="w-56">
								{assetContextMenu.assetId ? (
									<>
										<DropdownMenuItem disabled className="text-xs">
											{getImportAsset(assetContextMenu.assetId)?.label ?? assetContextMenu.assetId}
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											disabled={!onRequestRemoveImportAsset || isRemovingImportAsset}
											onSelect={() => {
												if (!assetContextMenu.assetId) return
												onRequestRemoveImportAsset?.(assetContextMenu.assetId)
											}}
										>
											<Trash2 className="h-4 w-4" />
											Remove import
										</DropdownMenuItem>
									</>
								) : (
									<DropdownMenuItem disabled>No asset actions</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>

						<div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
							<div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
								Imports
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 gap-1 px-2 text-[11px] font-semibold uppercase tracking-widest shadow-none"
								onClick={onOpenGallery}
								title="Imports gallery"
							>
								<Grid2X2 className="h-4 w-4" />
								Gallery
							</Button>
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
