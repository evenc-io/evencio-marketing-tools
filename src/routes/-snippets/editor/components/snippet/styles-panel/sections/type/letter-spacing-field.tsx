import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LETTER_SPACING_SCALE } from "../../constants"
import type { ScheduleApplyFn } from "../../types"
import { ensureOption } from "../../utils"

type LetterSpacingFieldProps = {
	canApply: boolean
	baseSelectClassName: string
	letterSpacingMode: "scale" | "custom"
	setLetterSpacingMode: Dispatch<SetStateAction<"scale" | "custom">>
	letterSpacingScale: string
	setLetterSpacingScale: Dispatch<SetStateAction<string>>
	letterSpacingCustom: string
	setLetterSpacingCustom: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function LetterSpacingField({
	canApply,
	baseSelectClassName,
	letterSpacingMode,
	setLetterSpacingMode,
	letterSpacingScale,
	setLetterSpacingScale,
	letterSpacingCustom,
	setLetterSpacingCustom,
	focusedFieldRef,
	scheduleApply,
}: LetterSpacingFieldProps) {
	return (
		<div className="space-y-2">
			<Label className="text-xs text-neutral-600">Letter spacing</Label>
			<Tabs
				value={letterSpacingMode}
				onValueChange={(next) => setLetterSpacingMode(next === "custom" ? "custom" : "scale")}
			>
				<TabsList className="w-full">
					<TabsTrigger value="scale">Scale</TabsTrigger>
					<TabsTrigger value="custom">Custom</TabsTrigger>
				</TabsList>
				<TabsContent value="scale">
					<select
						value={letterSpacingScale}
						onChange={(event) => {
							const next = event.target.value
							setLetterSpacingScale(next)
							setLetterSpacingMode("scale")
							scheduleApply({ letterSpacing: next || null }, "Update typography", {
								immediate: !next,
							})
						}}
						onFocus={() => {
							focusedFieldRef.current = "letterSpacing-scale"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "letterSpacing-scale") {
								focusedFieldRef.current = null
							}
						}}
						className={baseSelectClassName}
						disabled={!canApply}
					>
						{ensureOption(LETTER_SPACING_SCALE, letterSpacingScale, "Custom").map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</TabsContent>
				<TabsContent value="custom">
					<Input
						value={letterSpacingCustom}
						onChange={(event) => {
							const next = event.target.value
							setLetterSpacingCustom(next)
							setLetterSpacingMode("custom")
							const trimmed = next.trim()
							if (!trimmed) {
								scheduleApply({ letterSpacing: null }, "Remove letter spacing", { immediate: true })
								return
							}

							if (
								/^(tighter|tight|normal|wide|wider|widest)$/.test(trimmed) ||
								(trimmed.startsWith("[") && trimmed.endsWith("]"))
							) {
								scheduleApply({ letterSpacing: trimmed }, "Update typography")
								return
							}

							scheduleApply({ letterSpacing: `[${trimmed}]` }, "Update typography")
						}}
						onFocus={() => {
							focusedFieldRef.current = "letterSpacing-custom"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "letterSpacing-custom") {
								focusedFieldRef.current = null
							}
						}}
						placeholder="-0.02em"
						disabled={!canApply}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
