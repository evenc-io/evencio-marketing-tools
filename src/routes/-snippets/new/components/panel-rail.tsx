import {
	Clock,
	FileCode,
	FolderOpen,
	Info,
	LayoutTemplate,
	Settings,
	SlidersHorizontal,
} from "lucide-react"
import type { MouseEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
	EXAMPLE_FILTERS,
	type ExampleFilterId,
	IMPORT_FILTERS,
	type ImportFilterId,
} from "@/routes/-snippets/new/constants"

interface PanelRailProps {
	editorCollapsed: boolean
	detailsCollapsed: boolean
	explorerCollapsed: boolean
	examplesOpen: boolean
	importsOpen: boolean
	historyOpen: boolean
	isFocusPanelOpen: boolean
	onToggleEditor: () => void
	onToggleDetails: () => void
	onToggleExplorer: () => void
	onToggleExamples: () => void
	onToggleImports: () => void
	onToggleHistory: () => void
	exampleFilters: ExampleFilterId[]
	importsFilters: ImportFilterId[]
	onExampleFilterClick: (id: ExampleFilterId, event: MouseEvent<HTMLButtonElement>) => void
	onImportsFilterClick: (id: ImportFilterId, event: MouseEvent<HTMLButtonElement>) => void
}

export function PanelRail({
	editorCollapsed,
	detailsCollapsed,
	explorerCollapsed,
	examplesOpen,
	importsOpen,
	historyOpen,
	isFocusPanelOpen,
	onToggleEditor,
	onToggleDetails,
	onToggleExplorer,
	onToggleExamples,
	onToggleImports,
	onToggleHistory,
	exampleFilters,
	importsFilters,
	onExampleFilterClick,
	onImportsFilterClick,
}: PanelRailProps) {
	return (
		<div className="w-14 shrink-0 border-r border-neutral-200 bg-neutral-50">
			<div className="relative flex h-full flex-col items-center py-2">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						"mb-2 h-10 w-10",
						!editorCollapsed && "border border-neutral-200 bg-white text-neutral-900",
					)}
					onClick={onToggleEditor}
					aria-pressed={!editorCollapsed}
					aria-label={editorCollapsed ? "Show code editor" : "Hide code editor"}
					title="Editor"
				>
					<FileCode className="h-4 w-4" />
				</Button>
				<div
					className={cn(
						"flex flex-col items-center gap-1 transition-all duration-200 ease-out",
						isFocusPanelOpen
							? "pointer-events-none -translate-y-2 opacity-0"
							: "translate-y-0 opacity-100",
					)}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-10 w-10",
							!detailsCollapsed && "border border-neutral-200 bg-white text-neutral-900",
						)}
						onClick={onToggleDetails}
						aria-pressed={!detailsCollapsed}
						aria-label={
							detailsCollapsed ? "Show snippet details panel" : "Hide snippet details panel"
						}
						title="Snippet details"
					>
						<Info className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-10 w-10",
							!explorerCollapsed && "border border-neutral-200 bg-white text-neutral-900",
						)}
						onClick={onToggleExplorer}
						aria-pressed={!explorerCollapsed}
						aria-label={explorerCollapsed ? "Show explorer panel" : "Hide explorer panel"}
						title="Explorer"
					>
						<FolderOpen className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-10 w-10",
							examplesOpen && "border border-neutral-200 bg-white text-neutral-900",
						)}
						onClick={onToggleExamples}
						aria-pressed={examplesOpen}
						aria-label={examplesOpen ? "Hide examples panel" : "Show examples panel"}
						title="Examples"
					>
						<LayoutTemplate className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-10 w-10",
							importsOpen && "border border-neutral-200 bg-white text-neutral-900",
						)}
						onClick={onToggleImports}
						aria-pressed={importsOpen}
						aria-label={importsOpen ? "Hide imports panel" : "Show imports panel"}
						title="Imports"
					>
						<SlidersHorizontal className="h-4 w-4" />
					</Button>
				</div>

				<div className="mt-auto flex flex-col items-center gap-1 pb-2">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"h-10 w-10",
							historyOpen && "border border-neutral-200 bg-white text-neutral-900",
						)}
						onClick={onToggleHistory}
						aria-pressed={historyOpen}
						aria-label={historyOpen ? "Hide history panel" : "Show history panel"}
						title="History"
					>
						<Clock className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-10 w-10"
						disabled
						aria-label="Settings (coming soon)"
						title="Settings (coming soon)"
					>
						<Settings className="h-4 w-4" />
					</Button>
				</div>

				<div
					className={cn(
						"absolute top-2 left-0 right-0 flex flex-col items-center transition-all duration-200 ease-out",
						examplesOpen
							? "translate-y-0 opacity-100"
							: "pointer-events-none -translate-y-2 opacity-0",
					)}
				>
					<div className="flex w-full flex-col items-center">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-10 w-10 border border-neutral-200 bg-white text-neutral-900"
							onClick={onToggleExamples}
							aria-pressed={examplesOpen}
							aria-label="Hide examples panel"
							title="Examples"
						>
							<LayoutTemplate className="h-4 w-4" />
						</Button>
						<div className="mt-2 w-full border-t border-neutral-200 pt-2">
							<div className="flex flex-col items-center gap-1 px-1">
								<span className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
									Filter
								</span>
								<div className="flex w-full flex-col items-center gap-1 px-1 group">
									{EXAMPLE_FILTERS.map((filter) => {
										const isActive = exampleFilters.includes(filter.id)
										return (
											<button
												key={filter.id}
												type="button"
												onClick={(event) => onExampleFilterClick(filter.id, event)}
												className={cn(
													"w-full rounded-md border px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors",
													isActive
														? "border-neutral-200 bg-white text-neutral-900"
														: "border-transparent text-neutral-400 hover:bg-neutral-100",
												)}
												title={`Filter: ${filter.label}`}
												aria-label={`Filter: ${filter.label}`}
											>
												<filter.icon className="mx-auto h-4 w-4" />
											</button>
										)
									})}
									<p className="pt-1 text-[9px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
										Shift+click to multi-select
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div
					className={cn(
						"absolute top-2 left-0 right-0 flex flex-col items-center transition-all duration-200 ease-out",
						importsOpen
							? "translate-y-0 opacity-100"
							: "pointer-events-none -translate-y-2 opacity-0",
					)}
				>
					<div className="flex w-full flex-col items-center">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-10 w-10 border border-neutral-200 bg-white text-neutral-900"
							onClick={onToggleImports}
							aria-pressed={importsOpen}
							aria-label="Hide imports panel"
							title="Imports"
						>
							<SlidersHorizontal className="h-4 w-4" />
						</Button>
						<div className="mt-2 w-full border-t border-neutral-200 pt-2">
							<div className="flex flex-col items-center gap-1 px-1">
								<span className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">
									Filter
								</span>
								<div className="flex w-full flex-col items-center gap-1 px-1 group">
									{IMPORT_FILTERS.map((filter) => {
										const isActive = importsFilters.includes(filter.id)
										return (
											<button
												key={filter.id}
												type="button"
												onClick={(event) => onImportsFilterClick(filter.id, event)}
												className={cn(
													"w-full rounded-md border px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors",
													isActive
														? "border-neutral-200 bg-white text-neutral-900"
														: "border-transparent text-neutral-400 hover:bg-neutral-100",
												)}
												title={`Filter: ${filter.label}`}
												aria-label={`Filter: ${filter.label}`}
											>
												<filter.icon className="mx-auto h-4 w-4" />
											</button>
										)
									})}
									<p className="pt-1 text-[9px] text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100">
										Shift+click to multi-select
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
