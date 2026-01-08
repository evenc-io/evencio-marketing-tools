import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FONT_WEIGHT_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelExpandedState } from "../../types"
import { ensureOption, parseOptionalNumber } from "../../utils"

type FontWeightFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
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

export function FontWeightField({
	show,
	canApply,
	baseSelectClassName,
	fontWeightMode,
	setFontWeightMode,
	fontWeightScale,
	setFontWeightScale,
	fontWeightCustom,
	setFontWeightCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: FontWeightFieldProps) {
	if (!show) {
		return (
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
		)
	}

	return (
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
								scheduleApply({ fontWeight: null }, "Remove font weight", { immediate: true })
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
	)
}
