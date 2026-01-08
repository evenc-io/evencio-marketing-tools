import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Label } from "@/components/ui/label"
import { FONT_FAMILY_OPTIONS } from "../../constants"
import type { ScheduleApplyFn } from "../../types"

type FontFamilyFieldProps = {
	canApply: boolean
	baseSelectClassName: string
	fontFamily: string
	setFontFamily: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FontFamilyField({
	canApply,
	baseSelectClassName,
	fontFamily,
	setFontFamily,
	focusedFieldRef,
	scheduleApply,
}: FontFamilyFieldProps) {
	return (
		<div className="space-y-2">
			<Label className="text-xs text-neutral-600">Font family</Label>
			<select
				aria-label="Font family"
				value={fontFamily}
				onChange={(event) => {
					const next = event.target.value
					setFontFamily(next)
					scheduleApply({ fontFamily: next || null }, "Update typography", {
						immediate: !next,
					})
				}}
				onFocus={() => {
					focusedFieldRef.current = "fontFamily"
				}}
				onBlur={() => {
					if (focusedFieldRef.current === "fontFamily") {
						focusedFieldRef.current = null
					}
				}}
				className={baseSelectClassName}
				disabled={!canApply}
			>
				{FONT_FAMILY_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	)
}
