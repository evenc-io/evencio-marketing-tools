import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import {
	BORDER_WIDTH_SCALE,
	PALETTE_OPTIONS,
	SPECIAL_COLOR_OPTIONS,
	THEME_COLOR_OPTIONS,
} from "../constants"
import type { ColorDraft, ScheduleApplyFn, StylesPanelExpandedState } from "../types"
import { ensureOption, normalizeHexColor, parseOptionalNumber } from "../utils"

type BorderSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	canApply: boolean
	baseSelectClassName: string
	showBorderWidth: boolean
	showBorderColor: boolean
	hasBorderWidth: boolean
	hasBorderColor: boolean
	borderWidthMode: "scale" | "custom"
	setBorderWidthMode: Dispatch<SetStateAction<"scale" | "custom">>
	borderWidthScale: string
	setBorderWidthScale: Dispatch<SetStateAction<string>>
	borderWidthCustom: string
	setBorderWidthCustom: Dispatch<SetStateAction<string>>
	borderColorDraft: ColorDraft
	setBorderColorDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function BorderSection({
	open,
	onOpenChange,
	canApply,
	baseSelectClassName,
	showBorderWidth,
	showBorderColor,
	hasBorderWidth,
	hasBorderColor,
	borderWidthMode,
	setBorderWidthMode,
	borderWidthScale,
	setBorderWidthScale,
	borderWidthCustom,
	setBorderWidthCustom,
	borderColorDraft,
	setBorderColorDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: BorderSectionProps) {
	return (
		<div data-testid="snippet-styles-section-border">
			<CollapsibleSection title="Border" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-3">
					{showBorderWidth ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Width</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderWidth: false }))
										if (!hasBorderColor) {
											onOpenChange(false)
										}
										scheduleApply({ borderWidth: null }, "Remove border width", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove border width"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={borderWidthMode}
								onValueChange={(next) => setBorderWidthMode(next === "custom" ? "custom" : "scale")}
							>
								<TabsList className="w-full">
									<TabsTrigger value="scale">Scale</TabsTrigger>
									<TabsTrigger value="custom">Custom</TabsTrigger>
								</TabsList>
								<TabsContent value="scale">
									<select
										value={borderWidthScale}
										onChange={(event) => {
											const next = event.target.value
											setBorderWidthScale(next)
											setBorderWidthMode("scale")
											const numeric = Number(next)
											if (Number.isFinite(numeric)) {
												scheduleApply({ borderWidth: numeric }, "Update border")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderWidth-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderWidth-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{BORDER_WIDTH_SCALE.map((option) => (
											<option key={option.value} value={String(option.value)}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={borderWidthCustom}
										onChange={(event) => {
											const next = event.target.value
											setBorderWidthCustom(next)
											setBorderWidthMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ borderWidth: null }, "Remove border width", {
													immediate: true,
												})
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ borderWidth: parsed }, "Update border")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderWidth-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderWidth-custom") {
												focusedFieldRef.current = null
											}
											if (!borderWidthCustom.trim()) {
												setExpanded((prev) => ({ ...prev, borderWidth: false }))
												if (!hasBorderColor) {
													onOpenChange(false)
												}
											}
										}}
										placeholder="1"
										disabled={!canApply}
										aria-invalid={
											borderWidthCustom.trim().length > 0 &&
											parseOptionalNumber(borderWidthCustom) === "invalid"
												? true
												: undefined
										}
									/>
								</TabsContent>
							</Tabs>
						</div>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="justify-start px-0 text-neutral-500 hover:text-neutral-900"
							onClick={() => setExpanded((prev) => ({ ...prev, borderWidth: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add border width
						</Button>
					)}

					{showBorderColor ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Color</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderColor: false }))
										if (!hasBorderWidth) {
											onOpenChange(false)
										}
										scheduleApply({ borderColor: null }, "Remove border color", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove border color"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={borderColorDraft.mode}
								onValueChange={(next) =>
									setBorderColorDraft((prev) => ({
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
										value={borderColorDraft.token}
										onChange={(event) => {
											const next = event.target.value
											setBorderColorDraft((prev) => ({ ...prev, token: next, mode: "token" }))
											scheduleApply({ borderColor: next || null }, "Update border")
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderColor-token"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderColor-token") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										<option value="">Select…</option>
										<optgroup label="Theme">
											{ensureOption(THEME_COLOR_OPTIONS, borderColorDraft.token, "Custom").map(
												(option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												),
											)}
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
											value={normalizeHexColor(borderColorDraft.hex) ?? "#000000"}
											onChange={(event) => {
												const next = event.target.value
												setBorderColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ borderColor: normalized }, "Update border")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "borderColor-hex"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "borderColor-hex") {
													focusedFieldRef.current = null
												}
											}}
											className="h-9 w-9 rounded-md border border-neutral-200 bg-white p-1"
											disabled={!canApply}
											aria-label="Pick border color"
										/>
										<Input
											value={borderColorDraft.hex}
											onChange={(event) => {
												const next = event.target.value
												setBorderColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												if (!next.trim()) {
													scheduleApply({ borderColor: null }, "Remove border color", {
														immediate: true,
													})
													return
												}
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ borderColor: normalized }, "Update border")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "borderColor-hex-input"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "borderColor-hex-input") {
													focusedFieldRef.current = null
												}
												if (!borderColorDraft.hex.trim()) {
													setExpanded((prev) => ({ ...prev, borderColor: false }))
													if (!hasBorderWidth) {
														onOpenChange(false)
													}
												}
											}}
											placeholder="#000000"
											disabled={!canApply}
											aria-invalid={
												borderColorDraft.hex.trim().length > 0 &&
												normalizeHexColor(borderColorDraft.hex) === null
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
							onClick={() => setExpanded((prev) => ({ ...prev, borderColor: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add border color
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
