import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Label } from "@/components/ui/label"
import {
	FONT_STYLE_OPTIONS,
	TEXT_ALIGN_OPTIONS,
	TEXT_DECORATION_OPTIONS,
	TEXT_TRANSFORM_OPTIONS,
} from "../../constants"
import type { ScheduleApplyFn } from "../../types"

type FormattingGridProps = {
	panelMode: "basic" | "advanced"
	canApply: boolean
	baseSelectClassName: string
	textAlign: string
	setTextAlign: Dispatch<SetStateAction<string>>
	textTransform: string
	setTextTransform: Dispatch<SetStateAction<string>>
	fontStyle: string
	setFontStyle: Dispatch<SetStateAction<string>>
	textDecoration: string
	setTextDecoration: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FormattingGrid({
	panelMode,
	canApply,
	baseSelectClassName,
	textAlign,
	setTextAlign,
	textTransform,
	setTextTransform,
	fontStyle,
	setFontStyle,
	textDecoration,
	setTextDecoration,
	focusedFieldRef,
	scheduleApply,
}: FormattingGridProps) {
	const showAdvanced = panelMode === "advanced"

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 items-center gap-3">
				<Label className="text-xs text-neutral-600">Align</Label>
				<select
					aria-label="Text align"
					value={textAlign}
					onChange={(event) => {
						const next = event.target.value
						setTextAlign(next)
						scheduleApply({ textAlign: next || null }, "Update typography", { immediate: !next })
					}}
					onFocus={() => {
						focusedFieldRef.current = "textAlign"
					}}
					onBlur={() => {
						if (focusedFieldRef.current === "textAlign") {
							focusedFieldRef.current = null
						}
					}}
					className={baseSelectClassName}
					disabled={!canApply}
				>
					{TEXT_ALIGN_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			{showAdvanced ? (
				<>
					<div className="grid grid-cols-2 items-center gap-3">
						<Label className="text-xs text-neutral-600">Transform</Label>
						<select
							aria-label="Text transform"
							value={textTransform}
							onChange={(event) => {
								const next = event.target.value
								setTextTransform(next)
								scheduleApply({ textTransform: next || null }, "Update typography", {
									immediate: !next,
								})
							}}
							onFocus={() => {
								focusedFieldRef.current = "textTransform"
							}}
							onBlur={() => {
								if (focusedFieldRef.current === "textTransform") {
									focusedFieldRef.current = null
								}
							}}
							className={baseSelectClassName}
							disabled={!canApply}
						>
							{TEXT_TRANSFORM_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-2 items-center gap-3">
						<Label className="text-xs text-neutral-600">Style</Label>
						<select
							aria-label="Font style"
							value={fontStyle}
							onChange={(event) => {
								const next = event.target.value
								setFontStyle(next)
								scheduleApply({ fontStyle: next || null }, "Update typography", {
									immediate: !next,
								})
							}}
							onFocus={() => {
								focusedFieldRef.current = "fontStyle"
							}}
							onBlur={() => {
								if (focusedFieldRef.current === "fontStyle") {
									focusedFieldRef.current = null
								}
							}}
							className={baseSelectClassName}
							disabled={!canApply}
						>
							{FONT_STYLE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-2 items-center gap-3">
						<Label className="text-xs text-neutral-600">Decoration</Label>
						<select
							aria-label="Text decoration"
							value={textDecoration}
							onChange={(event) => {
								const next = event.target.value
								setTextDecoration(next)
								scheduleApply({ textDecoration: next || null }, "Update typography", {
									immediate: !next,
								})
							}}
							onFocus={() => {
								focusedFieldRef.current = "textDecoration"
							}}
							onBlur={() => {
								if (focusedFieldRef.current === "textDecoration") {
									focusedFieldRef.current = null
								}
							}}
							className={baseSelectClassName}
							disabled={!canApply}
						>
							{TEXT_DECORATION_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
				</>
			) : null}
		</div>
	)
}
