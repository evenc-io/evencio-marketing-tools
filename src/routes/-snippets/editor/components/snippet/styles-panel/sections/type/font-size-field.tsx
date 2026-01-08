import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FONT_SIZE_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelExpandedState } from "../../types"
import { ensureOption, parseOptionalNumber } from "../../utils"

type FontSizeFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	fontSizeMode: "scale" | "custom"
	setFontSizeMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontSizeScale: string
	setFontSizeScale: Dispatch<SetStateAction<string>>
	fontSizeCustom: string
	setFontSizeCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FontSizeField({
	show,
	canApply,
	baseSelectClassName,
	fontSizeMode,
	setFontSizeMode,
	fontSizeScale,
	setFontSizeScale,
	fontSizeCustom,
	setFontSizeCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: FontSizeFieldProps) {
	if (!show) {
		return (
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
		)
	}

	return (
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
							}
						}}
						placeholder="16"
						disabled={!canApply}
						aria-invalid={
							fontSizeCustom.trim().length > 0 && parseOptionalNumber(fontSizeCustom) === "invalid"
								? true
								: undefined
						}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
