import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TailwindColorPicker } from "../../tailwind-color-picker"
import type { ColorDraft, ScheduleApplyFn, StylesPanelExpandedState } from "../../types"
import { normalizeHexColor } from "../../utils"

type TextColorFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	textColorDraft: ColorDraft
	setTextColorDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function TextColorField({
	show,
	canApply,
	baseSelectClassName,
	textColorDraft,
	setTextColorDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: TextColorFieldProps) {
	if (!show) {
		return (
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
		)
	}

	return (
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
					<TailwindColorPicker
						value={textColorDraft.token}
						onValueChange={(next) => {
							setTextColorDraft((prev) => ({ ...prev, token: next, mode: "token" }))
							scheduleApply({ textColor: next || null }, "Update typography")
						}}
						disabled={!canApply}
						buttonClassName={baseSelectClassName}
						title="Text color"
						description="Select a Tailwind v4 text token like emerald-500."
						onOpenChange={(nextOpen) => {
							if (nextOpen) {
								focusedFieldRef.current = "textColor-token"
								return
							}
							if (focusedFieldRef.current === "textColor-token") {
								focusedFieldRef.current = null
							}
						}}
					/>
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
									scheduleApply({ textColor: null }, "Remove text color", { immediate: true })
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
	)
}
