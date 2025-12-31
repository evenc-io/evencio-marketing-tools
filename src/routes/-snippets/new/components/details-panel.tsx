import { Button } from "@/components/ui/button"
import { SNIPPET_TEMPLATE_OPTIONS, type SnippetTemplateId } from "@/lib/snippets/templates"
import { cn } from "@/lib/utils"
import { MetadataFields } from "@/routes/-snippets/new/components/metadata-fields"
import { ResolutionFields } from "@/routes/-snippets/new/components/resolution-fields"
import type { AssetScope } from "@/types/asset-library"

interface SnippetDetailsPanelProps {
	collapsed: boolean
	disabledScopes?: AssetScope[]
	selectedTemplateId: SnippetTemplateId
	onSelectTemplate: (id: SnippetTemplateId) => void
	onApplyTemplate: () => void
	error: string | null
}

export function SnippetDetailsPanel({
	collapsed,
	disabledScopes,
	selectedTemplateId,
	onSelectTemplate,
	onApplyTemplate,
	error,
}: SnippetDetailsPanelProps) {
	return (
		<aside
			className={cn(
				"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
				collapsed ? "w-0 border-r-0" : "w-[19rem] border-r border-neutral-200",
			)}
		>
			<div
				className={cn(
					"flex h-full w-[19rem] flex-col transition-opacity duration-200",
					collapsed ? "pointer-events-none opacity-0" : "opacity-100",
				)}
				aria-hidden={collapsed}
			>
				<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
					<span className="whitespace-nowrap">Snippet details</span>
				</div>

				<div className="overflow-y-auto">
					<MetadataFields disabledScopes={disabledScopes} />
					<ResolutionFields />
					<div className="px-4 pb-4">
						<div className="rounded-md border border-neutral-200 bg-white p-3">
							<div className="flex items-center justify-between">
								<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
									Starter template
								</p>
								<span className="text-[10px] uppercase tracking-widest text-neutral-300">
									Optional
								</span>
							</div>
							<div className="mt-2 space-y-2">
								{SNIPPET_TEMPLATE_OPTIONS.map((template) => {
									const isActive = selectedTemplateId === template.id
									return (
										<button
											key={template.id}
											type="button"
											onClick={() => onSelectTemplate(template.id)}
											className={cn(
												"flex w-full flex-col gap-1 rounded-md border px-2 py-2 text-left text-xs transition-colors",
												isActive
													? "border-neutral-900 bg-neutral-50 text-neutral-900"
													: "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
											)}
										>
											<span className="text-[11px] font-semibold uppercase tracking-widest">
												{template.label}
											</span>
											<span className="text-[10px] text-neutral-500">{template.description}</span>
										</button>
									)
								})}
							</div>
							<div className="mt-3 flex items-center justify-between">
								<Button type="button" variant="outline" size="sm" onClick={onApplyTemplate}>
									Apply template
								</Button>
								<span className="text-[10px] text-neutral-400">Replaces current source</span>
							</div>
						</div>
					</div>

					{error && (
						<div className="px-4 py-3">
							<p className="text-sm text-red-500" role="alert">
								{error}
							</p>
						</div>
					)}
				</div>
			</div>
		</aside>
	)
}
