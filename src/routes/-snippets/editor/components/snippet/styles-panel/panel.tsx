import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { getSnippetIntrinsicTagRule, isSnippetIntrinsicTag } from "@/lib/snippets/editing"
import { cn } from "@/lib/utils"
import { BackgroundSection } from "./sections/background"
import { BorderSection } from "./sections/border"
import { RadiusSection } from "./sections/radius"
import { TypeSection } from "./sections/type"
import type {
	ColorDraft,
	SnippetStylesPanelProps,
	StylesPanelExpandedState,
	StylesPanelSectionState,
	StyleUpdatePayload,
} from "./types"
import { toColorDraft } from "./utils"

export function SnippetStylesPanel({
	open,
	target,
	state,
	isReading = false,
	isApplying = false,
	onClose,
	onApply,
}: SnippetStylesPanelProps) {
	const focusedFieldRef = useRef<string | null>(null)
	const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastLabelRef = useRef("Update styles")
	const wasOpenRef = useRef(open)
	const pendingPayloadRef = useRef<StyleUpdatePayload>({})
	const pendingTargetRef = useRef<typeof target>(null)
	const targetRef = useRef(target)
	const onApplyRef = useRef(onApply)

	targetRef.current = target
	onApplyRef.current = onApply

	const targetKey = useMemo(() => {
		if (!target) return null
		if (target.elementRange) {
			const range = target.elementRange
			return `${target.fileId}:${range.startLine}:${range.startColumn}:${range.endLine}:${range.endColumn}`
		}
		return `${target.fileId}:${target.line}:${target.column}`
	}, [target])

	const [expanded, setExpanded] = useState<StylesPanelExpandedState>(() => ({
		backgroundColor: false,
		borderWidth: false,
		borderColor: false,
		borderRadius: false,
		textColor: false,
		fontSize: false,
		fontWeight: false,
	}))
	const [sectionOpen, setSectionOpen] = useState<StylesPanelSectionState>(() => ({
		background: false,
		border: false,
		radius: false,
		type: false,
	}))
	const sectionPresenceRef = useRef({
		background: false,
		border: false,
		radius: false,
		type: false,
	})

	const [backgroundDraft, setBackgroundDraft] = useState<ColorDraft>(() => toColorDraft(null))
	const [borderColorDraft, setBorderColorDraft] = useState<ColorDraft>(() => toColorDraft(null))
	const [textColorDraft, setTextColorDraft] = useState<ColorDraft>(() => toColorDraft(null))

	const [borderWidthMode, setBorderWidthMode] = useState<"scale" | "custom">("scale")
	const [borderWidthScale, setBorderWidthScale] = useState("1")
	const [borderWidthCustom, setBorderWidthCustom] = useState("")

	const [radiusMode, setRadiusMode] = useState<"scale" | "custom">("scale")
	const [radiusScale, setRadiusScale] = useState("md")
	const [radiusCustom, setRadiusCustom] = useState("")

	const [fontSizeMode, setFontSizeMode] = useState<"scale" | "custom">("scale")
	const [fontSizeScale, setFontSizeScale] = useState("base")
	const [fontSizeCustom, setFontSizeCustom] = useState("")

	const [fontWeightMode, setFontWeightMode] = useState<"scale" | "custom">("scale")
	const [fontWeightScale, setFontWeightScale] = useState("semibold")
	const [fontWeightCustom, setFontWeightCustom] = useState("")

	const tagName = target?.elementName ?? null
	const isIntrinsic = isSnippetIntrinsicTag(tagName)
	const rule = useMemo(
		() => (isIntrinsic && tagName ? getSnippetIntrinsicTagRule(tagName) : null),
		[isIntrinsic, tagName],
	)
	const panelLabel = rule?.label ?? (tagName ? `<${tagName}>` : "Styles")

	const isCodeOnly = Boolean(state?.found && !state.editable)
	const canApply = Boolean(target) && isIntrinsic && !isCodeOnly

	const disabledReason = !target
		? "Right click an element in the preview to edit styles."
		: !isIntrinsic
			? "Only intrinsic HTML tags are editable in v1."
			: isCodeOnly
				? (state?.reason ?? "This element is editable only via code.")
				: state && !state.found
					? (state.reason ?? "Unable to read styles for the selected element.")
					: null

	const clearPending = useCallback(() => {
		if (applyTimerRef.current) {
			clearTimeout(applyTimerRef.current)
			applyTimerRef.current = null
		}
		pendingPayloadRef.current = {}
		pendingTargetRef.current = null
	}, [])

	useEffect(() => {
		return () => {
			clearPending()
		}
	}, [clearPending])

	const flushApply = useCallback((label: string) => {
		const payload = pendingPayloadRef.current
		const keys = Object.keys(payload)
		if (keys.length === 0) return
		const pendingTarget = pendingTargetRef.current ?? targetRef.current
		if (!pendingTarget) return
		pendingPayloadRef.current = {}
		pendingTargetRef.current = null
		onApplyRef.current(payload, label, pendingTarget)
	}, [])

	const scheduleApply = useCallback(
		(payload: StyleUpdatePayload, label: string, options?: { immediate?: boolean }) => {
			if (!canApply) return
			pendingTargetRef.current = targetRef.current
			lastLabelRef.current = label
			pendingPayloadRef.current = { ...pendingPayloadRef.current, ...payload }
			if (options?.immediate) {
				if (applyTimerRef.current) {
					clearTimeout(applyTimerRef.current)
					applyTimerRef.current = null
				}
				flushApply(label)
				return
			}
			if (applyTimerRef.current) {
				clearTimeout(applyTimerRef.current)
			}
			applyTimerRef.current = setTimeout(() => {
				applyTimerRef.current = null
				flushApply(label)
			}, 200)
		},
		[canApply, flushApply],
	)

	useEffect(() => {
		if (wasOpenRef.current && !open) {
			if (applyTimerRef.current) {
				clearTimeout(applyTimerRef.current)
				applyTimerRef.current = null
			}
			flushApply(lastLabelRef.current)
			clearPending()
			focusedFieldRef.current = null
		}
		wasOpenRef.current = open
	}, [clearPending, flushApply, open])

	useEffect(() => {
		void targetKey
		if (applyTimerRef.current) {
			clearTimeout(applyTimerRef.current)
			applyTimerRef.current = null
		}
		flushApply(lastLabelRef.current)
		clearPending()
		setExpanded({
			backgroundColor: false,
			borderWidth: false,
			borderColor: false,
			borderRadius: false,
			textColor: false,
			fontSize: false,
			fontWeight: false,
		})
		setSectionOpen({
			background: false,
			border: false,
			radius: false,
			type: false,
		})
		sectionPresenceRef.current = {
			background: false,
			border: false,
			radius: false,
			type: false,
		}
		focusedFieldRef.current = null
	}, [clearPending, flushApply, targetKey])

	useEffect(() => {
		if (!state?.found) return

		const shouldSync = (prefix: string) => !(focusedFieldRef.current?.startsWith(prefix) ?? false)

		if (shouldSync("backgroundColor")) {
			setBackgroundDraft(toColorDraft(state.properties.backgroundColor.value))
		}
		if (shouldSync("borderColor")) {
			setBorderColorDraft(toColorDraft(state.properties.borderColor.value))
		}
		if (shouldSync("textColor")) {
			setTextColorDraft(toColorDraft(state.properties.textColor.value))
		}

		if (shouldSync("borderWidth")) {
			const value = state.properties.borderWidth.value
			if (typeof value === "number" && [1, 2, 4, 8].includes(value)) {
				setBorderWidthMode("scale")
				setBorderWidthScale(String(value))
				setBorderWidthCustom("")
			} else if (typeof value === "number") {
				setBorderWidthMode("custom")
				setBorderWidthCustom(String(value))
			} else {
				setBorderWidthMode("scale")
				setBorderWidthScale("1")
				setBorderWidthCustom("")
			}
		}

		if (shouldSync("borderRadius")) {
			const value = state.properties.borderRadius.value
			if (typeof value === "number") {
				setRadiusMode("custom")
				setRadiusCustom(String(value))
			} else if (typeof value === "string") {
				setRadiusMode("scale")
				setRadiusScale(value)
				setRadiusCustom("")
			} else {
				setRadiusMode("scale")
				setRadiusScale("md")
				setRadiusCustom("")
			}
		}

		if (shouldSync("fontSize")) {
			const value = state.properties.fontSize.value
			if (typeof value === "number") {
				setFontSizeMode("custom")
				setFontSizeCustom(String(value))
			} else if (typeof value === "string") {
				setFontSizeMode("scale")
				setFontSizeScale(value)
				setFontSizeCustom("")
			} else {
				setFontSizeMode("scale")
				setFontSizeScale("base")
				setFontSizeCustom("")
			}
		}

		if (shouldSync("fontWeight")) {
			const value = state.properties.fontWeight.value
			if (typeof value === "string") {
				setFontWeightMode("scale")
				setFontWeightScale(value)
				setFontWeightCustom("")
			} else if (typeof value === "number") {
				const token = (() => {
					switch (Math.round(value)) {
						case 100:
							return "thin"
						case 200:
							return "extralight"
						case 300:
							return "light"
						case 400:
							return "normal"
						case 500:
							return "medium"
						case 600:
							return "semibold"
						case 700:
							return "bold"
						case 800:
							return "extrabold"
						case 900:
							return "black"
						default:
							return null
					}
				})()
				if (token) {
					setFontWeightMode("scale")
					setFontWeightScale(token)
					setFontWeightCustom("")
				} else {
					setFontWeightMode("custom")
					setFontWeightCustom(String(value))
				}
			} else {
				setFontWeightMode("scale")
				setFontWeightScale("semibold")
				setFontWeightCustom("")
			}
		}
	}, [state])

	const hasBackground = Boolean(state?.properties.backgroundColor.present)
	const hasBorderWidth = Boolean(state?.properties.borderWidth.present)
	const hasBorderColor = Boolean(state?.properties.borderColor.present)
	const hasRadius = Boolean(state?.properties.borderRadius.present)
	const hasTextColor = Boolean(state?.properties.textColor.present)
	const hasFontSize = Boolean(state?.properties.fontSize.present)
	const hasFontWeight = Boolean(state?.properties.fontWeight.present)

	const isEditingBackground = Boolean(focusedFieldRef.current?.startsWith("backgroundColor"))
	const isEditingBorderWidth = Boolean(focusedFieldRef.current?.startsWith("borderWidth"))
	const isEditingBorderColor = Boolean(focusedFieldRef.current?.startsWith("borderColor"))
	const isEditingRadius = Boolean(focusedFieldRef.current?.startsWith("borderRadius"))
	const isEditingTextColor = Boolean(focusedFieldRef.current?.startsWith("textColor"))
	const isEditingFontSize = Boolean(focusedFieldRef.current?.startsWith("fontSize"))
	const isEditingFontWeight = Boolean(focusedFieldRef.current?.startsWith("fontWeight"))

	const sectionPresence = useMemo(
		() => ({
			background: hasBackground,
			border: hasBorderWidth || hasBorderColor,
			radius: hasRadius,
			type: hasTextColor || hasFontSize || hasFontWeight,
		}),
		[
			hasBackground,
			hasBorderColor,
			hasBorderWidth,
			hasFontSize,
			hasFontWeight,
			hasRadius,
			hasTextColor,
		],
	)

	const keepBackgroundOpen = isEditingBackground || expanded.backgroundColor
	const keepBorderOpen =
		isEditingBorderWidth || isEditingBorderColor || expanded.borderWidth || expanded.borderColor
	const keepRadiusOpen = isEditingRadius || expanded.borderRadius
	const keepTypeOpen =
		isEditingTextColor ||
		isEditingFontSize ||
		isEditingFontWeight ||
		expanded.textColor ||
		expanded.fontSize ||
		expanded.fontWeight

	useEffect(() => {
		const prev = sectionPresenceRef.current
		const next = sectionPresence
		if (!prev.background && next.background) {
			setSectionOpen((current) => ({ ...current, background: true }))
		}
		if (prev.background && !next.background && !keepBackgroundOpen) {
			setSectionOpen((current) => ({ ...current, background: false }))
		}
		if (!prev.border && next.border) {
			setSectionOpen((current) => ({ ...current, border: true }))
		}
		if (prev.border && !next.border && !keepBorderOpen) {
			setSectionOpen((current) => ({ ...current, border: false }))
		}
		if (!prev.radius && next.radius) {
			setSectionOpen((current) => ({ ...current, radius: true }))
		}
		if (prev.radius && !next.radius && !keepRadiusOpen) {
			setSectionOpen((current) => ({ ...current, radius: false }))
		}
		if (!prev.type && next.type) {
			setSectionOpen((current) => ({ ...current, type: true }))
		}
		if (prev.type && !next.type && !keepTypeOpen) {
			setSectionOpen((current) => ({ ...current, type: false }))
		}
		sectionPresenceRef.current = next
	}, [keepBackgroundOpen, keepBorderOpen, keepRadiusOpen, keepTypeOpen, sectionPresence])

	const showBackground = hasBackground || expanded.backgroundColor || isEditingBackground
	const showBorderWidth = hasBorderWidth || expanded.borderWidth || isEditingBorderWidth
	const showBorderColor = hasBorderColor || expanded.borderColor || isEditingBorderColor
	const showRadius = hasRadius || expanded.borderRadius || isEditingRadius
	const showTextColor = hasTextColor || expanded.textColor || isEditingTextColor
	const showFontSize = hasFontSize || expanded.fontSize || isEditingFontSize
	const showFontWeight = hasFontWeight || expanded.fontWeight || isEditingFontWeight

	const baseSelectClassName = cn(
		"h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900",
		"focus:border-neutral-900 focus:outline-none",
		"disabled:cursor-not-allowed disabled:opacity-50",
	)

	return (
		<aside
			data-testid="snippet-styles-panel"
			className={cn(
				"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
				open ? "w-[19rem] border-l border-neutral-200" : "w-0 border-l-0",
			)}
		>
			<div
				className={cn(
					"flex h-full w-[19rem] flex-col transition-opacity duration-200",
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

					<TypeSection
						open={sectionOpen.type}
						onOpenChange={(openValue) =>
							setSectionOpen((current) => ({ ...current, type: openValue }))
						}
						canApply={canApply}
						baseSelectClassName={baseSelectClassName}
						showTextColor={showTextColor}
						showFontSize={showFontSize}
						showFontWeight={showFontWeight}
						hasTextColor={hasTextColor}
						hasFontSize={hasFontSize}
						hasFontWeight={hasFontWeight}
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
						setExpanded={setExpanded}
						focusedFieldRef={focusedFieldRef}
						scheduleApply={scheduleApply}
					/>
				</div>
			</div>
		</aside>
	)
}
