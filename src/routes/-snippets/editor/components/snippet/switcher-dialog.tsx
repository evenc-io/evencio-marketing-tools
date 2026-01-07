import { useState } from "react"
import { toast } from "sonner"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SnippetExplorerItem } from "@/routes/-snippets/editor/snippet-editor-types"

interface SnippetSwitcherDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	snippetItems: SnippetExplorerItem[]
	activeSnippetId: string | null
	hasNewSnippetDraft: boolean
	canResetNewSnippet: boolean
	snippetSearch: string
	onSnippetSearchChange: (value: string) => void
	onSelectSnippet: (snippetId: string | null) => void
	onResetNewSnippet?: () => Promise<void> | void
	isSnippetListLoading: boolean
}

const scopeLabels: Record<string, string> = {
	personal: "Personal",
	event: "Event",
	org: "Org",
	global: "Global",
}

export function SnippetSwitcherDialog({
	open,
	onOpenChange,
	snippetItems,
	activeSnippetId,
	hasNewSnippetDraft,
	canResetNewSnippet,
	snippetSearch,
	onSnippetSearchChange,
	onSelectSnippet,
	onResetNewSnippet,
	isSnippetListLoading,
}: SnippetSwitcherDialogProps) {
	const [isResettingNewSnippet, setIsResettingNewSnippet] = useState(false)
	const isDisabled = isSnippetListLoading || isResettingNewSnippet
	const showSnippetEmpty = !isSnippetListLoading && snippetItems.length === 0
	const snippetEmptyMessage =
		snippetSearch.trim().length > 0
			? "No matching snippets."
			: "No snippets yet. Create one to switch here."

	const handleSelect = (snippetId: string | null) => {
		onSelectSnippet(snippetId)
		onOpenChange(false)
	}

	const handleResetNewSnippet = async () => {
		if (!onResetNewSnippet) return
		if (isResettingNewSnippet) return
		setIsResettingNewSnippet(true)
		try {
			await onResetNewSnippet()
			setIsResettingNewSnippet(false)
			onOpenChange(false)
		} catch (err) {
			setIsResettingNewSnippet(false)
			toast.error(err instanceof Error ? err.message : "Failed to reset the new snippet draft.")
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[44rem] border border-neutral-200 bg-white p-0 shadow-none">
				<DialogHeader className="gap-3 border-b border-neutral-200 px-5 py-4 text-left">
					<DialogTitle className="text-base font-semibold text-neutral-900">
						Switch snippet
					</DialogTitle>
					<DialogDescription className="text-xs text-neutral-500">
						Search and jump between snippets without leaving the editor. Drafts are saved
						automatically.
					</DialogDescription>
					<div className="pt-2">
						<Input
							value={snippetSearch}
							onChange={(event) => onSnippetSearchChange(event.target.value)}
							placeholder="Search snippets"
							disabled={isDisabled}
							className="h-9 text-sm"
							aria-label="Search snippets"
						/>
					</div>
				</DialogHeader>
				<div className="max-h-[26rem] space-y-2 overflow-y-auto px-5 py-4">
					{isSnippetListLoading && (
						<div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
							<span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
							Loading snippets...
						</div>
					)}
					<div
						className={cn(
							"flex w-full items-stretch overflow-hidden rounded-md border text-sm transition-colors",
							activeSnippetId === null
								? "border-neutral-300 bg-neutral-50 text-neutral-900"
								: "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
						)}
					>
						<button
							type="button"
							onClick={() => handleSelect(null)}
							disabled={isDisabled}
							aria-current={activeSnippetId === null}
							className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2 text-left"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="truncate font-medium">New snippet</span>
								{hasNewSnippetDraft && (
									<span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
										Draft
									</span>
								)}
							</div>
							<span className="text-[11px] text-neutral-500">Start from scratch</span>
						</button>

						{canResetNewSnippet && onResetNewSnippet && (
							<button
								type="button"
								onClick={() => {
									void handleResetNewSnippet()
								}}
								disabled={isDisabled}
								className={cn(
									"shrink-0 border-l border-neutral-200 bg-white px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700",
									activeSnippetId === null && "border-neutral-300",
								)}
								aria-label="Reset new snippet draft"
							>
								{isResettingNewSnippet ? "Resetting..." : "Reset"}
							</button>
						)}
					</div>

					{snippetItems.map((snippet) => {
						const isActive = snippet.id === activeSnippetId
						return (
							<button
								key={snippet.id}
								type="button"
								onClick={() => handleSelect(snippet.id)}
								disabled={isDisabled}
								aria-current={isActive}
								className={cn(
									"flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors",
									isActive
										? "border-neutral-300 bg-neutral-50 text-neutral-900"
										: "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="truncate font-medium">{snippet.title}</div>
										{snippet.description ? (
											<div className="truncate text-[11px] text-neutral-500">
												{snippet.description}
											</div>
										) : null}
									</div>
									<div className="flex items-center gap-1">
										{snippet.hasDraft && (
											<span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
												Draft
											</span>
										)}
										<span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
											{scopeLabels[snippet.scope] ?? snippet.scope}
										</span>
									</div>
								</div>
								<span className="text-[11px] text-neutral-500">Updated {snippet.updatedLabel}</span>
							</button>
						)
					})}

					{showSnippetEmpty && (
						<div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-500">
							{snippetEmptyMessage}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
