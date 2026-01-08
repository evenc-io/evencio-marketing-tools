import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { RADIUS_SCALE } from "../constants"
import type { ScheduleApplyFn, StylesPanelExpandedState } from "../types"
import { ensureOption, parseOptionalNumber } from "../utils"

type RadiusSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	radiusMode: "scale" | "custom"
	setRadiusMode: Dispatch<SetStateAction<"scale" | "custom">>
	radiusScale: string
	setRadiusScale: Dispatch<SetStateAction<string>>
	radiusCustom: string
	setRadiusCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function RadiusSection({
	open,
	onOpenChange,
	show,
	canApply,
	baseSelectClassName,
	radiusMode,
	setRadiusMode,
	radiusScale,
	setRadiusScale,
	radiusCustom,
	setRadiusCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: RadiusSectionProps) {
	return (
		<div data-testid="snippet-styles-section-radius">
			<CollapsibleSection title="Radius" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-3">
					{show ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label className="text-xs text-neutral-600">Radius</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-neutral-400 hover:text-neutral-700"
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderRadius: false }))
										onOpenChange(false)
										scheduleApply({ borderRadius: null }, "Remove radius", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove radius"
									title="Remove"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
							<Tabs
								value={radiusMode}
								onValueChange={(next) => setRadiusMode(next === "custom" ? "custom" : "scale")}
							>
								<TabsList className="w-full">
									<TabsTrigger value="scale">Scale</TabsTrigger>
									<TabsTrigger value="custom">Custom</TabsTrigger>
								</TabsList>
								<TabsContent value="scale">
									<select
										value={radiusScale}
										onChange={(event) => {
											const next = event.target.value
											setRadiusScale(next)
											setRadiusMode("scale")
											scheduleApply({ borderRadius: next || null }, "Update radius")
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderRadius-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderRadius-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{ensureOption(RADIUS_SCALE, radiusScale, "Custom").map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={radiusCustom}
										onChange={(event) => {
											const next = event.target.value
											setRadiusCustom(next)
											setRadiusMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ borderRadius: null }, "Remove radius", { immediate: true })
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ borderRadius: parsed }, "Update radius")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderRadius-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderRadius-custom") {
												focusedFieldRef.current = null
											}
											if (!radiusCustom.trim()) {
												setExpanded((prev) => ({ ...prev, borderRadius: false }))
												onOpenChange(false)
											}
										}}
										placeholder="12"
										disabled={!canApply}
										aria-invalid={
											radiusCustom.trim().length > 0 &&
											parseOptionalNumber(radiusCustom) === "invalid"
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
							onClick={() => setExpanded((prev) => ({ ...prev, borderRadius: true }))}
							disabled={!canApply}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add radius
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
