import { Button } from "@/components/ui/button"
import type { SnippetExample } from "@/lib/snippets/examples"
import { SNIPPET_EXAMPLE_LABELS } from "@/lib/snippets/examples"
import { cn } from "@/lib/utils"

interface SnippetExamplesPanelProps {
	open: boolean
	examples: SnippetExample[]
	activeExample: SnippetExample | null
	activeExampleId: string
	isPreviewActive: boolean
	onSelectExample: (id: string) => void
	onTogglePreview: () => void
	onApplyExample: () => void
}

export function SnippetExamplesPanel({
	open,
	examples,
	activeExample,
	activeExampleId,
	isPreviewActive,
	onSelectExample,
	onTogglePreview,
	onApplyExample,
}: SnippetExamplesPanelProps) {
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
							Evencio examples
						</div>
						<div className="flex-1 overflow-y-auto px-3 pb-3">
							<div className="space-y-2">
								{examples.map((example) => {
									const isActive = activeExampleId === example.id
									const isPreviewing = isPreviewActive && isActive
									return (
										<button
											key={example.id}
											type="button"
											onClick={() => onSelectExample(example.id)}
											className={cn(
												"w-full rounded-md border px-3 py-2 text-left transition-colors",
												isActive
													? "border-neutral-900 bg-white"
													: "border-transparent text-neutral-600 hover:bg-neutral-100",
											)}
										>
											<div className="flex items-center justify-between">
												<span className="text-[10px] uppercase tracking-widest text-neutral-400">
													{SNIPPET_EXAMPLE_LABELS[example.category]}
												</span>
												<span className="text-[10px] text-neutral-400">
													{example.viewport.width}×{example.viewport.height}
												</span>
											</div>
											<p className="mt-1 text-sm font-medium text-neutral-900">{example.title}</p>
											<p className="mt-1 text-[11px] text-neutral-500">{example.description}</p>
											{isPreviewing && (
												<span className="mt-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
													Previewing
												</span>
											)}
										</button>
									)
								})}
							</div>
						</div>
						<div className="border-t border-neutral-200 bg-white/70 px-3 py-3">
							<div className="space-y-2">
								<div>
									<p className="text-[10px] uppercase tracking-widest text-neutral-400">Selected</p>
									<p className="text-sm font-medium text-neutral-900">
										{activeExample?.title ?? "Select an example"}
									</p>
									<p className="text-[11px] text-neutral-500">
										{activeExample?.description ?? "Browse curated Evencio templates."}
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={onTogglePreview}
										disabled={!activeExample}
									>
										{isPreviewActive ? "Exit preview" : "Preview example"}
									</Button>
									<Button
										type="button"
										size="sm"
										onClick={onApplyExample}
										disabled={!activeExample}
									>
										Use in editor
									</Button>
								</div>
								<p className="text-[10px] text-neutral-400">
									Preview examples without changing your current snippet.
								</p>
							</div>
						</div>
					</>
				)}
			</div>
		</aside>
	)
}
