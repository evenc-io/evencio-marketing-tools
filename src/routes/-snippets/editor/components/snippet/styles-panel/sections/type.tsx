import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import {
	FONT_SIZE_SCALE,
	FONT_WEIGHT_SCALE,
	PALETTE_OPTIONS,
	SPECIAL_COLOR_OPTIONS,
	THEME_COLOR_OPTIONS,
} from "../constants"
import type { ColorDraft, ScheduleApplyFn, StylesPanelExpandedState } from "../types"
import { ensureOption, normalizeHexColor, parseOptionalNumber } from "../utils"

type TypeSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	canApply: boolean
	baseSelectClassName: string
	showTextColor: boolean
	showFontSize: boolean
	showFontWeight: boolean
	hasTextColor: boolean
	hasFontSize: boolean
	hasFontWeight: boolean
	textColorDraft: ColorDraft
	setTextColorDraft: Dispatch<SetStateAction<ColorDraft>>
	fontSizeMode: "scale" | "custom"
	setFontSizeMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontSizeScale: string
	setFontSizeScale: Dispatch<SetStateAction<string>>
	fontSizeCustom: string
	setFontSizeCustom: Dispatch<SetStateAction<string>>
	fontWeightMode: "scale" | "custom"
	setFontWeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontWeightScale: string
	setFontWeightScale: Dispatch<SetStateAction<string>>
	fontWeightCustom: string
	setFontWeightCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function TypeSection({
	open,
	onOpenChange,
	canApply,
	baseSelectClassName,
	showTextColor,
	showFontSize,
	showFontWeight,
	hasTextColor,
	hasFontSize,
	hasFontWeight,
	textColorDraft,
	setTextColorDraft,
	fontSizeMode,
	setFontSizeMode,
	fontSizeScale,
	setFontSizeScale,
	fontSizeCustom,
	setFontSizeCustom,
	fontWeightMode,
	setFontWeightMode,
	fontWeightScale,
	setFontWeightScale,
	fontWeightCustom,
	setFontWeightCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: TypeSectionProps) {
	return (
		<div data-testid="snippet-styles-section-type">
			<CollapsibleSection title="Type" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-3">
					{showTextColor ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Text color</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, textColor: false }))
										if (!hasFontSize && !hasFontWeight) {
											onOpenChange(false)
										}
										scheduleApply({ textColor: null }, "Remove text color", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove text color"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={textColorDraft.mode}
								onValueChange={(next) =>
									setTextColorDraft((prev) => ({
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
										value={textColorDraft.token}
										onChange={(event) => {
											const next = event.target.value
											setTextColorDraft((prev) => ({ ...prev, token: next, mode: "token" }))
											scheduleApply({ textColor: next || null }, "Update typography")
										}}
										onFocus={() => {
											focusedFieldRef.current = "textColor-token"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "textColor-token") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										<option value="">Select…</option>
										<optgroup label="Theme">
											{ensureOption(THEME_COLOR_OPTIONS, textColorDraft.token, "Custom").map(
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
											value={normalizeHexColor(textColorDraft.hex) ?? "#000000"}
											onChange={(event) => {
												const next = event.target.value
												setTextColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ textColor: normalized }, "Update typography")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "textColor-hex"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "textColor-hex") {
													focusedFieldRef.current = null
												}
											}}
											className="h-9 w-9 rounded-md border border-neutral-200 bg-white p-1"
											disabled={!canApply}
											aria-label="Pick text color"
										/>
										<Input
											value={textColorDraft.hex}
											onChange={(event) => {
												const next = event.target.value
												setTextColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												if (!next.trim()) {
													scheduleApply({ textColor: null }, "Remove text color", {
														immediate: true,
													})
													return
												}
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ textColor: normalized }, "Update typography")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "textColor-hex-input"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "textColor-hex-input") {
													focusedFieldRef.current = null
												}
												if (!textColorDraft.hex.trim()) {
													setExpanded((prev) => ({ ...prev, textColor: false }))
													if (!hasFontSize && !hasFontWeight) {
														onOpenChange(false)
													}
												}
											}}
											placeholder="#111111"
											disabled={!canApply}
											aria-invalid={
												textColorDraft.hex.trim().length > 0 &&
												normalizeHexColor(textColorDraft.hex) === null
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
							onClick={() => setExpanded((prev) => ({ ...prev, textColor: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add text color
						</Button>
					)}

					{showFontSize ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Font size</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, fontSize: false }))
										if (!hasTextColor && !hasFontWeight) {
											onOpenChange(false)
										}
										scheduleApply({ fontSize: null }, "Remove font size", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove font size"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={fontSizeMode}
								onValueChange={(next) => setFontSizeMode(next === "custom" ? "custom" : "scale")}
							>
								<TabsList className="w-full">
									<TabsTrigger value="scale">Scale</TabsTrigger>
									<TabsTrigger value="custom">Custom</TabsTrigger>
								</TabsList>
								<TabsContent value="scale">
									<select
										value={fontSizeScale}
										onChange={(event) => {
											const next = event.target.value
											setFontSizeScale(next)
											setFontSizeMode("scale")
											scheduleApply({ fontSize: next || null }, "Update typography")
										}}
										onFocus={() => {
											focusedFieldRef.current = "fontSize-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "fontSize-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{ensureOption(FONT_SIZE_SCALE, fontSizeScale, "Custom").map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={fontSizeCustom}
										onChange={(event) => {
											const next = event.target.value
											setFontSizeCustom(next)
											setFontSizeMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ fontSize: null }, "Remove font size", { immediate: true })
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ fontSize: parsed }, "Update typography")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "fontSize-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "fontSize-custom") {
												focusedFieldRef.current = null
											}
											if (!fontSizeCustom.trim()) {
												setExpanded((prev) => ({ ...prev, fontSize: false }))
												if (!hasTextColor && !hasFontWeight) {
													onOpenChange(false)
												}
											}
										}}
										placeholder="16"
										disabled={!canApply}
										aria-invalid={
											fontSizeCustom.trim().length > 0 &&
											parseOptionalNumber(fontSizeCustom) === "invalid"
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
							onClick={() => setExpanded((prev) => ({ ...prev, fontSize: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add font size
						</Button>
					)}

					{showFontWeight ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Font weight</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, fontWeight: false }))
										if (!hasTextColor && !hasFontSize) {
											onOpenChange(false)
										}
										scheduleApply({ fontWeight: null }, "Remove font weight", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove font weight"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={fontWeightMode}
								onValueChange={(next) => setFontWeightMode(next === "custom" ? "custom" : "scale")}
							>
								<TabsList className="w-full">
									<TabsTrigger value="scale">Scale</TabsTrigger>
									<TabsTrigger value="custom">Custom</TabsTrigger>
								</TabsList>
								<TabsContent value="scale">
									<select
										value={fontWeightScale}
										onChange={(event) => {
											const next = event.target.value
											setFontWeightScale(next)
											setFontWeightMode("scale")
											scheduleApply({ fontWeight: next || null }, "Update typography")
										}}
										onFocus={() => {
											focusedFieldRef.current = "fontWeight-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "fontWeight-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{ensureOption(FONT_WEIGHT_SCALE, fontWeightScale, "Custom").map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={fontWeightCustom}
										onChange={(event) => {
											const next = event.target.value
											setFontWeightCustom(next)
											setFontWeightMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ fontWeight: null }, "Remove font weight", {
													immediate: true,
												})
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ fontWeight: parsed }, "Update typography")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "fontWeight-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "fontWeight-custom") {
												focusedFieldRef.current = null
											}
											if (!fontWeightCustom.trim()) {
												setExpanded((prev) => ({ ...prev, fontWeight: false }))
												if (!hasTextColor && !hasFontSize) {
													onOpenChange(false)
												}
											}
										}}
										placeholder="600"
										disabled={!canApply}
										aria-invalid={
											fontWeightCustom.trim().length > 0 &&
											parseOptionalNumber(fontWeightCustom) === "invalid"
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
							onClick={() => setExpanded((prev) => ({ ...prev, fontWeight: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add font weight
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
