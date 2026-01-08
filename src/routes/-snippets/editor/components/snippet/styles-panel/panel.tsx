import { X } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStylesPanelPreferences } from "./controller/use-panel-preferences"
import { useSnippetStylesPanelController } from "./panel-controller"
import { StylesPanelResizer } from "./panel-resizer"
import { BackgroundSection } from "./sections/background"
import { BorderSection } from "./sections/border"
import { RadiusSection } from "./sections/radius"
import { SpacingSection } from "./sections/spacing"
import { TypeSection } from "./sections/type"
import { SegmentedControl } from "./segmented-control"
import type { SnippetStylesPanelProps } from "./types"

export function SnippetStylesPanel({
	open,
	target,
	state,
	isReading = false,
	isApplying = false,
	onClose,
	onApply,
}: SnippetStylesPanelProps) {
	const panelRef = useRef<HTMLElement | null>(null)
	const { mode, setMode, width, resetWidth, onResizeStart } = useStylesPanelPreferences({
		panelRef,
		open,
	})
	const {
		focusedFieldRef,
		setExpanded,
		sectionOpen,
		setSectionOpen,
		backgroundDraft,
		setBackgroundDraft,
		borderColorDraft,
		setBorderColorDraft,
		textColorDraft,
		setTextColorDraft,
		borderWidthMode,
		setBorderWidthMode,
		borderWidthScale,
		setBorderWidthScale,
		borderWidthCustom,
		setBorderWidthCustom,
		radiusMode,
		setRadiusMode,
		radiusScale,
		setRadiusScale,
		radiusCustom,
		setRadiusCustom,
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
		fontFamily,
		setFontFamily,
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
		padding,
		setPadding,
		paddingX,
		setPaddingX,
		paddingY,
		setPaddingY,
		paddingTop,
		setPaddingTop,
		paddingRight,
		setPaddingRight,
		paddingBottom,
		setPaddingBottom,
		paddingLeft,
		setPaddingLeft,
		panelLabel,
		disabledReason,
		canApply,
		supportsBackground,
		supportsBorder,
		supportsRadius,
		supportsSpacing,
		supportsTypography,
		hasBorderWidth,
		hasBorderColor,
		showBackground,
		showBorderWidth,
		showBorderColor,
		showRadius,
		showTextColor,
		showFontSize,
		showFontWeight,
		baseSelectClassName,
		scheduleApply,
	} = useSnippetStylesPanelController({
		open,
		target,
		state,
		onApply,
	})

	return (
		<aside
			ref={panelRef}
			data-testid="snippet-styles-panel"
			className={cn(
				"relative shrink-0 overflow-hidden bg-neutral-50 transition-[width] duration-200",
				open ? "border-l border-neutral-200" : "border-l-0",
			)}
			style={{ width: open ? width : 0 }}
		>
			<StylesPanelResizer
				isHidden={!open}
				onPointerDown={onResizeStart}
				onDoubleClick={resetWidth}
			/>
			<div
				className={cn(
					"flex h-full w-full flex-col transition-opacity duration-200",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				aria-hidden={!open}
			>
				<div className="flex items-center justify-between px-4 pb-2 pt-3">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
							Styles
						</p>
						<p className="mt-0.5 truncate text-xs font-medium text-neutral-900" title={panelLabel}>
							{panelLabel}
						</p>
						{isApplying ? <p className="mt-1 text-[11px] text-neutral-400">Updating…</p> : null}
					</div>
					<div className="flex items-center gap-2">
						<SegmentedControl
							aria-label="Styles panel mode"
							value={mode}
							onValueChange={setMode}
							options={[
								{ value: "basic", label: "Basic" },
								{ value: "advanced", label: "Advanced" },
							]}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onClose}
							aria-label="Close styles panel"
							title="Close"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto border-t border-neutral-200 bg-white">
					{isReading && !state ? (
						<div className="px-4 py-4">
							<div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3">
								<p className="text-sm text-neutral-600">Loading styles...</p>
							</div>
						</div>
					) : null}

					{disabledReason ? (
						<div className="px-4 py-4">
							<div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3">
								<p className="text-sm text-neutral-600">{disabledReason}</p>
							</div>
						</div>
					) : null}

					{supportsBackground ? (
						<BackgroundSection
							open={sectionOpen.background}
							onOpenChange={(openValue) =>
								setSectionOpen((current) => ({ ...current, background: openValue }))
							}
							show={showBackground}
							canApply={canApply}
							baseSelectClassName={baseSelectClassName}
							draft={backgroundDraft}
							setDraft={setBackgroundDraft}
							setExpanded={setExpanded}
							focusedFieldRef={focusedFieldRef}
							scheduleApply={scheduleApply}
						/>
					) : null}

					{supportsBorder ? (
						<BorderSection
							open={sectionOpen.border}
							onOpenChange={(openValue) =>
								setSectionOpen((current) => ({ ...current, border: openValue }))
							}
							canApply={canApply}
							baseSelectClassName={baseSelectClassName}
							showBorderWidth={showBorderWidth}
							showBorderColor={showBorderColor}
							hasBorderWidth={hasBorderWidth}
							hasBorderColor={hasBorderColor}
							borderWidthMode={borderWidthMode}
							setBorderWidthMode={setBorderWidthMode}
							borderWidthScale={borderWidthScale}
							setBorderWidthScale={setBorderWidthScale}
							borderWidthCustom={borderWidthCustom}
							setBorderWidthCustom={setBorderWidthCustom}
							borderColorDraft={borderColorDraft}
							setBorderColorDraft={setBorderColorDraft}
							setExpanded={setExpanded}
							focusedFieldRef={focusedFieldRef}
							scheduleApply={scheduleApply}
						/>
					) : null}

					{supportsRadius ? (
						<RadiusSection
							open={sectionOpen.radius}
							onOpenChange={(openValue) =>
								setSectionOpen((current) => ({ ...current, radius: openValue }))
							}
							show={showRadius}
							canApply={canApply}
							baseSelectClassName={baseSelectClassName}
							radiusMode={radiusMode}
							setRadiusMode={setRadiusMode}
							radiusScale={radiusScale}
							setRadiusScale={setRadiusScale}
							radiusCustom={radiusCustom}
							setRadiusCustom={setRadiusCustom}
							setExpanded={setExpanded}
							focusedFieldRef={focusedFieldRef}
							scheduleApply={scheduleApply}
						/>
					) : null}

					{supportsSpacing ? (
						<SpacingSection
							open={sectionOpen.spacing}
							onOpenChange={(openValue) =>
								setSectionOpen((current) => ({ ...current, spacing: openValue }))
							}
							panelMode={mode}
							canApply={canApply}
							baseSelectClassName={baseSelectClassName}
							padding={padding}
							setPadding={setPadding}
							paddingX={paddingX}
							setPaddingX={setPaddingX}
							paddingY={paddingY}
							setPaddingY={setPaddingY}
							paddingTop={paddingTop}
							setPaddingTop={setPaddingTop}
							paddingRight={paddingRight}
							setPaddingRight={setPaddingRight}
							paddingBottom={paddingBottom}
							setPaddingBottom={setPaddingBottom}
							paddingLeft={paddingLeft}
							setPaddingLeft={setPaddingLeft}
							focusedFieldRef={focusedFieldRef}
							scheduleApply={scheduleApply}
						/>
					) : null}

					{supportsTypography ? (
						<TypeSection
							open={sectionOpen.type}
							onOpenChange={(openValue) =>
								setSectionOpen((current) => ({ ...current, type: openValue }))
							}
							panelMode={mode}
							canApply={canApply}
							baseSelectClassName={baseSelectClassName}
							fontFamily={fontFamily}
							setFontFamily={setFontFamily}
							showTextColor={showTextColor}
							showFontSize={showFontSize}
							showFontWeight={showFontWeight}
							textColorDraft={textColorDraft}
							setTextColorDraft={setTextColorDraft}
							fontSizeMode={fontSizeMode}
							setFontSizeMode={setFontSizeMode}
							fontSizeScale={fontSizeScale}
							setFontSizeScale={setFontSizeScale}
							fontSizeCustom={fontSizeCustom}
							setFontSizeCustom={setFontSizeCustom}
							fontWeightMode={fontWeightMode}
							setFontWeightMode={setFontWeightMode}
							fontWeightScale={fontWeightScale}
							setFontWeightScale={setFontWeightScale}
							fontWeightCustom={fontWeightCustom}
							setFontWeightCustom={setFontWeightCustom}
							lineHeightMode={lineHeightMode}
							setLineHeightMode={setLineHeightMode}
							lineHeightScale={lineHeightScale}
							setLineHeightScale={setLineHeightScale}
							lineHeightCustom={lineHeightCustom}
							setLineHeightCustom={setLineHeightCustom}
							letterSpacingMode={letterSpacingMode}
							setLetterSpacingMode={setLetterSpacingMode}
							letterSpacingScale={letterSpacingScale}
							setLetterSpacingScale={setLetterSpacingScale}
							letterSpacingCustom={letterSpacingCustom}
							setLetterSpacingCustom={setLetterSpacingCustom}
							textAlign={textAlign}
							setTextAlign={setTextAlign}
							textTransform={textTransform}
							setTextTransform={setTextTransform}
							fontStyle={fontStyle}
							setFontStyle={setFontStyle}
							textDecoration={textDecoration}
							setTextDecoration={setTextDecoration}
							setExpanded={setExpanded}
							focusedFieldRef={focusedFieldRef}
							scheduleApply={scheduleApply}
						/>
					) : null}
				</div>
			</div>
		</aside>
	)
}
