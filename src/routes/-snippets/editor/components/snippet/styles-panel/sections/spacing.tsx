import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { SPACING_SCALE } from "../constants"
import { SegmentedControl } from "../segmented-control"
import type { ScheduleApplyFn } from "../types"
import { ensureOption } from "../utils"

type SpacingSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	panelMode: "basic" | "advanced"
	canApply: boolean
	baseSelectClassName: string
	padding: string
	setPadding: Dispatch<SetStateAction<string>>
	paddingX: string
	setPaddingX: Dispatch<SetStateAction<string>>
	paddingY: string
	setPaddingY: Dispatch<SetStateAction<string>>
	paddingTop: string
	setPaddingTop: Dispatch<SetStateAction<string>>
	paddingRight: string
	setPaddingRight: Dispatch<SetStateAction<string>>
	paddingBottom: string
	setPaddingBottom: Dispatch<SetStateAction<string>>
	paddingLeft: string
	setPaddingLeft: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

type PaddingMode = "all" | "axis" | "sides"

const formatSpacingOptionLabel = (prefix: string, value: string) => {
	if (!value) return "Default"
	return `${value} (${prefix}-${value})`
}

const toPayloadValue = (value: string) => (value ? value : null)

export function SpacingSection({
	open,
	onOpenChange,
	panelMode,
	canApply,
	baseSelectClassName,
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
	focusedFieldRef,
	scheduleApply,
}: SpacingSectionProps) {
	const compactSelectClassName = cn(baseSelectClassName, "h-8 px-2 text-xs")

	const buildOptions = (prefix: string, currentValue: string) =>
		ensureOption(SPACING_SCALE, currentValue, "Custom").map((option) => ({
			...option,
			label:
				option.value === "" ? option.label : formatSpacingOptionLabel(prefix, String(option.value)),
		}))

	const isEmpty = useMemo(
		() =>
			[padding, paddingX, paddingY, paddingTop, paddingRight, paddingBottom, paddingLeft].every(
				(value) => !value,
			),
		[padding, paddingBottom, paddingLeft, paddingRight, paddingTop, paddingX, paddingY],
	)

	const derivedMode = useMemo<PaddingMode>(() => {
		if (paddingTop || paddingRight || paddingBottom || paddingLeft) return "sides"
		if (paddingX || paddingY) return "axis"
		return "all"
	}, [paddingBottom, paddingLeft, paddingRight, paddingTop, paddingX, paddingY])

	const [paddingMode, setPaddingMode] = useState<PaddingMode>(() =>
		panelMode === "advanced" ? derivedMode : "all",
	)
	const modeOverrideRef = useRef(false)

	useEffect(() => {
		if (panelMode === "basic") {
			setPaddingMode("all")
			modeOverrideRef.current = false
			return
		}
		if (isEmpty) {
			modeOverrideRef.current = false
		}
		if (!modeOverrideRef.current) {
			setPaddingMode(derivedMode)
		}
	}, [derivedMode, isEmpty, panelMode])

	const displayPaddingAll = useMemo(() => {
		if (padding) return padding
		if (paddingX && paddingY && paddingX === paddingY) return paddingX
		if (
			paddingTop &&
			paddingRight &&
			paddingBottom &&
			paddingLeft &&
			paddingTop === paddingRight &&
			paddingTop === paddingBottom &&
			paddingTop === paddingLeft
		) {
			return paddingTop
		}
		return ""
	}, [padding, paddingBottom, paddingLeft, paddingRight, paddingTop, paddingX, paddingY])

	const displayPaddingX = useMemo(() => {
		if (paddingX) return paddingX
		if (paddingLeft && paddingRight && paddingLeft === paddingRight) return paddingLeft
		return padding || ""
	}, [padding, paddingLeft, paddingRight, paddingX])

	const displayPaddingY = useMemo(() => {
		if (paddingY) return paddingY
		if (paddingTop && paddingBottom && paddingTop === paddingBottom) return paddingTop
		return padding || ""
	}, [padding, paddingBottom, paddingTop, paddingY])

	const displayPaddingTop = useMemo(
		() => paddingTop || paddingY || padding || "",
		[padding, paddingTop, paddingY],
	)
	const displayPaddingRight = useMemo(
		() => paddingRight || paddingX || padding || "",
		[padding, paddingRight, paddingX],
	)
	const displayPaddingBottom = useMemo(
		() => paddingBottom || paddingY || padding || "",
		[padding, paddingBottom, paddingY],
	)
	const displayPaddingLeft = useMemo(
		() => paddingLeft || paddingX || padding || "",
		[padding, paddingLeft, paddingX],
	)

	const clearPaddingFocus = (key: string) => {
		if (focusedFieldRef.current === key) {
			focusedFieldRef.current = null
		}
	}

	const applyAllPadding = (next: string) => {
		setPadding(next)
		setPaddingX("")
		setPaddingY("")
		setPaddingTop("")
		setPaddingRight("")
		setPaddingBottom("")
		setPaddingLeft("")
		scheduleApply(
			{
				padding: toPayloadValue(next),
				paddingX: null,
				paddingY: null,
				paddingTop: null,
				paddingRight: null,
				paddingBottom: null,
				paddingLeft: null,
			},
			"Update spacing",
			{ immediate: !next },
		)
	}

	const applyAxisPadding = (nextX: string, nextY: string) => {
		setPadding("")
		setPaddingX(nextX)
		setPaddingY(nextY)
		setPaddingTop("")
		setPaddingRight("")
		setPaddingBottom("")
		setPaddingLeft("")
		scheduleApply(
			{
				padding: null,
				paddingX: toPayloadValue(nextX),
				paddingY: toPayloadValue(nextY),
				paddingTop: null,
				paddingRight: null,
				paddingBottom: null,
				paddingLeft: null,
			},
			"Update spacing",
			{ immediate: !nextX && !nextY },
		)
	}

	const applySidePadding = (next: { top: string; right: string; bottom: string; left: string }) => {
		setPadding("")
		setPaddingX("")
		setPaddingY("")
		setPaddingTop(next.top)
		setPaddingRight(next.right)
		setPaddingBottom(next.bottom)
		setPaddingLeft(next.left)
		scheduleApply(
			{
				padding: null,
				paddingX: null,
				paddingY: null,
				paddingTop: toPayloadValue(next.top),
				paddingRight: toPayloadValue(next.right),
				paddingBottom: toPayloadValue(next.bottom),
				paddingLeft: toPayloadValue(next.left),
			},
			"Update spacing",
			{ immediate: !next.top && !next.right && !next.bottom && !next.left },
		)
	}

	const handleModeChange = (next: PaddingMode) => {
		modeOverrideRef.current = true
		setPaddingMode(next)
	}

	return (
		<div data-testid="snippet-styles-section-spacing">
			<CollapsibleSection title="Spacing" open={open} onOpenChange={onOpenChange}>
				<div className="space-y-3">
					{panelMode === "advanced" ? (
						<div className="flex items-center justify-between gap-3">
							<Label className="text-xs text-neutral-600">Padding</Label>
							<SegmentedControl
								aria-label="Padding mode"
								value={paddingMode}
								onValueChange={handleModeChange}
								disabled={!canApply}
								options={[
									{ value: "all", label: "All" },
									{ value: "axis", label: "X / Y" },
									{ value: "sides", label: "Sides" },
								]}
							/>
						</div>
					) : (
						<div className="space-y-1">
							<Label className="text-xs text-neutral-600">Padding</Label>
							<p className="text-[11px] text-neutral-400">
								Switch to Advanced for axis/per-side padding.
							</p>
						</div>
					)}

					{paddingMode === "axis" && panelMode === "advanced" ? (
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<div className="text-[11px] font-medium text-neutral-500">Horizontal</div>
								<select
									aria-label="Padding horizontal"
									value={displayPaddingX}
									onChange={(event) => {
										const nextX = event.target.value
										applyAxisPadding(nextX, displayPaddingY)
									}}
									onFocus={() => {
										focusedFieldRef.current = "padding-x"
									}}
									onBlur={() => clearPaddingFocus("padding-x")}
									className={baseSelectClassName}
									disabled={!canApply}
								>
									{buildOptions("px", displayPaddingX).map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1.5">
								<div className="text-[11px] font-medium text-neutral-500">Vertical</div>
								<select
									aria-label="Padding vertical"
									value={displayPaddingY}
									onChange={(event) => {
										const nextY = event.target.value
										applyAxisPadding(displayPaddingX, nextY)
									}}
									onFocus={() => {
										focusedFieldRef.current = "padding-y"
									}}
									onBlur={() => clearPaddingFocus("padding-y")}
									className={baseSelectClassName}
									disabled={!canApply}
								>
									{buildOptions("py", displayPaddingY).map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
						</div>
					) : paddingMode === "sides" && panelMode === "advanced" ? (
						<div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
							<div className="grid grid-cols-3 gap-2">
								<div />
								<div className="space-y-1">
									<div className="text-[11px] font-medium text-neutral-500">Top</div>
									<select
										aria-label="Padding top"
										value={displayPaddingTop}
										onChange={(event) => {
											const next = event.target.value
											applySidePadding({
												top: next,
												right: displayPaddingRight,
												bottom: displayPaddingBottom,
												left: displayPaddingLeft,
											})
										}}
										onFocus={() => {
											focusedFieldRef.current = "padding-top"
										}}
										onBlur={() => clearPaddingFocus("padding-top")}
										className={compactSelectClassName}
										disabled={!canApply}
									>
										{buildOptions("pt", displayPaddingTop).map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								<div />
								<div className="space-y-1">
									<div className="text-[11px] font-medium text-neutral-500">Left</div>
									<select
										aria-label="Padding left"
										value={displayPaddingLeft}
										onChange={(event) => {
											const next = event.target.value
											applySidePadding({
												top: displayPaddingTop,
												right: displayPaddingRight,
												bottom: displayPaddingBottom,
												left: next,
											})
										}}
										onFocus={() => {
											focusedFieldRef.current = "padding-left"
										}}
										onBlur={() => clearPaddingFocus("padding-left")}
										className={compactSelectClassName}
										disabled={!canApply}
									>
										{buildOptions("pl", displayPaddingLeft).map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								<div className="flex items-center justify-center rounded-md border border-dashed border-neutral-200 bg-white px-2 text-[11px] text-neutral-400">
									Padding
								</div>
								<div className="space-y-1">
									<div className="text-[11px] font-medium text-neutral-500">Right</div>
									<select
										aria-label="Padding right"
										value={displayPaddingRight}
										onChange={(event) => {
											const next = event.target.value
											applySidePadding({
												top: displayPaddingTop,
												right: next,
												bottom: displayPaddingBottom,
												left: displayPaddingLeft,
											})
										}}
										onFocus={() => {
											focusedFieldRef.current = "padding-right"
										}}
										onBlur={() => clearPaddingFocus("padding-right")}
										className={compactSelectClassName}
										disabled={!canApply}
									>
										{buildOptions("pr", displayPaddingRight).map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								<div />
								<div className="space-y-1">
									<div className="text-[11px] font-medium text-neutral-500">Bottom</div>
									<select
										aria-label="Padding bottom"
										value={displayPaddingBottom}
										onChange={(event) => {
											const next = event.target.value
											applySidePadding({
												top: displayPaddingTop,
												right: displayPaddingRight,
												bottom: next,
												left: displayPaddingLeft,
											})
										}}
										onFocus={() => {
											focusedFieldRef.current = "padding-bottom"
										}}
										onBlur={() => clearPaddingFocus("padding-bottom")}
										className={compactSelectClassName}
										disabled={!canApply}
									>
										{buildOptions("pb", displayPaddingBottom).map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								<div />
							</div>
						</div>
					) : (
						<select
							aria-label="Padding"
							value={displayPaddingAll}
							onChange={(event) => {
								applyAllPadding(event.target.value)
							}}
							onFocus={() => {
								focusedFieldRef.current = "padding-all"
							}}
							onBlur={() => clearPaddingFocus("padding-all")}
							className={baseSelectClassName}
							disabled={!canApply}
						>
							{buildOptions("p", displayPaddingAll).map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
