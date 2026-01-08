import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import type { ColorDraft, ScheduleApplyFn, StylesPanelExpandedState } from "../types"
import { FontFamilyField } from "./type/font-family-field"
import { FontSizeField } from "./type/font-size-field"
import { FontWeightField } from "./type/font-weight-field"
import { FormattingGrid } from "./type/formatting-grid"
import { LetterSpacingField } from "./type/letter-spacing-field"
import { LineHeightField } from "./type/line-height-field"
import { TextColorField } from "./type/text-color-field"

type TypeSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	panelMode: "basic" | "advanced"
	canApply: boolean
	baseSelectClassName: string
	fontFamily: string
	setFontFamily: Dispatch<SetStateAction<string>>
	showTextColor: boolean
	showFontSize: boolean
	showFontWeight: boolean
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
	lineHeightMode: "scale" | "custom"
	setLineHeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	lineHeightScale: string
	setLineHeightScale: Dispatch<SetStateAction<string>>
	lineHeightCustom: string
	setLineHeightCustom: Dispatch<SetStateAction<string>>
	letterSpacingMode: "scale" | "custom"
	setLetterSpacingMode: Dispatch<SetStateAction<"scale" | "custom">>
	letterSpacingScale: string
	setLetterSpacingScale: Dispatch<SetStateAction<string>>
	letterSpacingCustom: string
	setLetterSpacingCustom: Dispatch<SetStateAction<string>>
	textAlign: string
	setTextAlign: Dispatch<SetStateAction<string>>
	textTransform: string
	setTextTransform: Dispatch<SetStateAction<string>>
	fontStyle: string
	setFontStyle: Dispatch<SetStateAction<string>>
	textDecoration: string
	setTextDecoration: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function TypeSection({
	open,
	onOpenChange,
	panelMode,
	canApply,
	baseSelectClassName,
	fontFamily,
	setFontFamily,
	showTextColor,
	showFontSize,
	showFontWeight,
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
	lineHeightMode,
	setLineHeightMode,
	lineHeightScale,
	setLineHeightScale,
	lineHeightCustom,
	setLineHeightCustom,
	letterSpacingMode,
	setLetterSpacingMode,
	letterSpacingScale,
	setLetterSpacingScale,
	letterSpacingCustom,
	setLetterSpacingCustom,
	textAlign,
	setTextAlign,
	textTransform,
	setTextTransform,
	fontStyle,
	setFontStyle,
	textDecoration,
	setTextDecoration,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: TypeSectionProps) {
	const showAdvanced = panelMode === "advanced"

	return (
		<div data-testid="snippet-styles-section-type">
			<CollapsibleSection title="Type" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-4">
					<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
							Font
						</p>
						<div className="mt-3 space-y-3">
							<FontFamilyField
								canApply={canApply}
								baseSelectClassName={baseSelectClassName}
								fontFamily={fontFamily}
								setFontFamily={setFontFamily}
								focusedFieldRef={focusedFieldRef}
								scheduleApply={scheduleApply}
							/>

							<FontSizeField
								show={showFontSize}
								canApply={canApply}
								baseSelectClassName={baseSelectClassName}
								fontSizeMode={fontSizeMode}
								setFontSizeMode={setFontSizeMode}
								fontSizeScale={fontSizeScale}
								setFontSizeScale={setFontSizeScale}
								fontSizeCustom={fontSizeCustom}
								setFontSizeCustom={setFontSizeCustom}
								setExpanded={setExpanded}
								focusedFieldRef={focusedFieldRef}
								scheduleApply={scheduleApply}
							/>

							<FontWeightField
								show={showFontWeight}
								canApply={canApply}
								baseSelectClassName={baseSelectClassName}
								fontWeightMode={fontWeightMode}
								setFontWeightMode={setFontWeightMode}
								fontWeightScale={fontWeightScale}
								setFontWeightScale={setFontWeightScale}
								fontWeightCustom={fontWeightCustom}
								setFontWeightCustom={setFontWeightCustom}
								setExpanded={setExpanded}
								focusedFieldRef={focusedFieldRef}
								scheduleApply={scheduleApply}
							/>
						</div>
					</div>

					<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
							Text
						</p>
						<div className="mt-3 space-y-3">
							<TextColorField
								show={showTextColor}
								canApply={canApply}
								baseSelectClassName={baseSelectClassName}
								textColorDraft={textColorDraft}
								setTextColorDraft={setTextColorDraft}
								setExpanded={setExpanded}
								focusedFieldRef={focusedFieldRef}
								scheduleApply={scheduleApply}
							/>

							<FormattingGrid
								panelMode={panelMode}
								canApply={canApply}
								baseSelectClassName={baseSelectClassName}
								textAlign={textAlign}
								setTextAlign={setTextAlign}
								textTransform={textTransform}
								setTextTransform={setTextTransform}
								fontStyle={fontStyle}
								setFontStyle={setFontStyle}
								textDecoration={textDecoration}
								setTextDecoration={setTextDecoration}
								focusedFieldRef={focusedFieldRef}
								scheduleApply={scheduleApply}
							/>
						</div>
					</div>

					{showAdvanced ? (
						<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3">
							<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
								Rhythm
							</p>
							<div className="mt-3 space-y-3">
								<LineHeightField
									canApply={canApply}
									baseSelectClassName={baseSelectClassName}
									lineHeightMode={lineHeightMode}
									setLineHeightMode={setLineHeightMode}
									lineHeightScale={lineHeightScale}
									setLineHeightScale={setLineHeightScale}
									lineHeightCustom={lineHeightCustom}
									setLineHeightCustom={setLineHeightCustom}
									focusedFieldRef={focusedFieldRef}
									scheduleApply={scheduleApply}
								/>

								<LetterSpacingField
									canApply={canApply}
									baseSelectClassName={baseSelectClassName}
									letterSpacingMode={letterSpacingMode}
									setLetterSpacingMode={setLetterSpacingMode}
									letterSpacingScale={letterSpacingScale}
									setLetterSpacingScale={setLetterSpacingScale}
									letterSpacingCustom={letterSpacingCustom}
									setLetterSpacingCustom={setLetterSpacingCustom}
									focusedFieldRef={focusedFieldRef}
									scheduleApply={scheduleApply}
								/>
							</div>
						</div>
					) : null}
				</div>
			</CollapsibleSection>
		</div>
	)
}
