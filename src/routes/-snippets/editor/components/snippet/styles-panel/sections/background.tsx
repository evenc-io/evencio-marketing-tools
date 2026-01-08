import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { PALETTE_OPTIONS, SPECIAL_COLOR_OPTIONS, THEME_COLOR_OPTIONS } from "../constants"
import type { ColorDraft, ScheduleApplyFn, StylesPanelExpandedState } from "../types"
import { ensureOption, normalizeHexColor } from "../utils"

type BackgroundSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	draft: ColorDraft
	setDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function BackgroundSection({
	open,
	onOpenChange,
	show,
	canApply,
	baseSelectClassName,
	draft,
	setDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: BackgroundSectionProps) {
	return (
		<div data-testid="snippet-styles-section-background">
			<CollapsibleSection title="Background" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-3">
					{show ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Color</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, backgroundColor: false }))
										onOpenChange(false)
										scheduleApply({ backgroundColor: null }, "Remove background", {
											immediate: true,
										})
									}}
									disabled={!canApply}
									aria-label="Remove background"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={draft.mode}
								onValueChange={(next) =>
									setDraft((prev) => ({
										...prev,
										mode: next === "custom" ? "custom" : "token",
									}))
								}
							>
								<TabsList className="w-full">
									<TabsTrigger value="token">Token</TabsTrigger>
									<TabsTrigger value="custom">Custom</TabsTrigger>
								</TabsList>
								<TabsContent value="token">
									<select
										value={draft.token}
										onChange={(event) => {
											const next = event.target.value
											setDraft((prev) => ({ ...prev, token: next, mode: "token" }))
											scheduleApply({ backgroundColor: next || null }, "Update background")
										}}
										onFocus={() => {
											focusedFieldRef.current = "backgroundColor-token"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "backgroundColor-token") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										<option value="">Select…</option>
										<optgroup label="Theme">
											{ensureOption(THEME_COLOR_OPTIONS, draft.token, "Custom").map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</optgroup>
										<optgroup label="Palette">
											{PALETTE_OPTIONS.flatMap((group) =>
												group.options.map((option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												)),
											)}
										</optgroup>
										<optgroup label="Special">
											{SPECIAL_COLOR_OPTIONS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</optgroup>
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<div className="flex items-center gap-2">
										<input
											type="color"
											value={normalizeHexColor(draft.hex) ?? "#000000"}
											onChange={(event) => {
												const next = event.target.value
												setDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ backgroundColor: normalized }, "Update background")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "backgroundColor-hex"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "backgroundColor-hex") {
													focusedFieldRef.current = null
												}
											}}
											className="h-9 w-9 rounded-md border border-neutral-200 bg-white p-1"
											disabled={!canApply}
											aria-label="Pick background color"
										/>
										<Input
											value={draft.hex}
											onChange={(event) => {
												const next = event.target.value
												setDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												if (!next.trim()) {
													scheduleApply({ backgroundColor: null }, "Remove background", {
														immediate: true,
													})
													return
												}
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ backgroundColor: normalized }, "Update background")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "backgroundColor-hex-input"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "backgroundColor-hex-input") {
													focusedFieldRef.current = null
												}
												if (!draft.hex.trim()) {
													setExpanded((prev) => ({ ...prev, backgroundColor: false }))
													onOpenChange(false)
												}
											}}
											placeholder="#000000"
											disabled={!canApply}
											aria-invalid={
												draft.hex.trim().length > 0 && normalizeHexColor(draft.hex) === null
													? true
													: undefined
											}
										/>
									</div>
								</TabsContent>
							</Tabs>
						</div>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start px-0 text-neutral-500 hover:text-neutral-900"
							onClick={() => setExpanded((prev) => ({ ...prev, backgroundColor: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add background
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
