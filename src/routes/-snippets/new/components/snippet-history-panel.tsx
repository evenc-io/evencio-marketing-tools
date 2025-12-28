import { RotateCcw, RotateCw } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SnippetHistoryEntry } from "@/routes/-snippets/new/hooks/use-snippet-history"

interface SnippetHistoryPanelProps {
	open: boolean
	entries: SnippetHistoryEntry[]
	activeIndex: number
	canUndo: boolean
	canRedo: boolean
	onUndo: () => void
	onRedo: () => void
	onJump: (index: number) => void
}

export function SnippetHistoryPanel({
	open,
	entries,
	activeIndex,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onJump,
}: SnippetHistoryPanelProps) {
	const relativeFormatter = useMemo(
		() => new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }),
		[],
	)
	const items = useMemo(
		() => entries.map((entry, index) => ({ entry, index })).reverse(),
		[entries],
	)

	const formatRelativeTime = (timestamp: number) => {
		const diffMs = timestamp - Date.now()
		const seconds = Math.round(diffMs / 1000)
		if (Math.abs(seconds) < 60) return relativeFormatter.format(seconds, "second")
		const minutes = Math.round(diffMs / 60000)
		if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute")
		const hours = Math.round(diffMs / 3600000)
		if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour")
		const days = Math.round(diffMs / 86400000)
		return relativeFormatter.format(days, "day")
	}

	return (
		<aside
			className={cn(
				"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
				open ? "w-[19rem] border-r border-neutral-200" : "w-0 border-r-0",
			)}
		>
			<div
				className={cn(
					"flex h-full w-[19rem] flex-col transition-opacity duration-200",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				aria-hidden={!open}
			>
				{open && (
					<>
						<div className="flex items-center justify-between px-4 pb-2 pt-3">
							<span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
								History
							</span>
							<div className="flex items-center gap-1">
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
						</div>
						<div className="flex-1 overflow-y-auto px-3 pb-3">
							{items.length === 0 ? (
								<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3">
									<p className="text-sm text-neutral-500">No history yet.</p>
								</div>
							) : (
								<div className="space-y-2">
									{items.map(({ entry, index }) => (
										<button
											key={entry.id}
											type="button"
											onClick={() => onJump(index)}
											className={cn(
												"w-full rounded-md border px-3 py-2 text-left text-xs transition-colors",
												index === activeIndex
													? "border-neutral-900 bg-white text-neutral-900"
													: "border-transparent text-neutral-600 hover:bg-neutral-100",
											)}
											aria-current={index === activeIndex}
											title={`Restore: ${entry.label}`}
										>
											<div className="flex items-center justify-between gap-2">
												<span className="text-[10px] uppercase tracking-widest text-neutral-400">
													{index === activeIndex ? "Current" : "Snapshot"}
												</span>
												<span className="text-[10px] text-neutral-400">
													{formatRelativeTime(entry.createdAt)}
												</span>
											</div>
											<p className="mt-1 text-sm font-medium text-neutral-900">{entry.label}</p>
										</button>
									))}
								</div>
							)}
						</div>
						<div className="border-t border-neutral-200 bg-white/70 px-3 py-3">
							<p className="text-[10px] uppercase tracking-widest text-neutral-400">Timeline</p>
							<p className="mt-1 text-[11px] text-neutral-500">
								History is stored locally and capped to keep memory light.
							</p>
						</div>
					</>
				)}
			</div>
		</aside>
	)
}
