/**
 * Sandboxed iframe preview for custom snippets.
 *
 * Renders compiled snippet code in an isolated iframe with strict
 * CSP and sandbox attributes to prevent untrusted code from
 * accessing the parent DOM or storage.
 */

import { AlertCircle, Loader2 } from "lucide-react"
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	generatePreviewSrcdoc,
	type PreviewDimensions,
	type PreviewLayerSnapshot,
	type PreviewLayoutCommit,
	type PreviewLayoutDebugEvent,
	type PreviewMessage,
	type PreviewSourceLocation,
} from "@/lib/snippets/preview/runtime"
import { cn } from "@/lib/utils"

export interface SnippetPreviewProps {
	/** Compiled JavaScript code from the snippet compiler */
	compiledCode: string | null
	/** Props to pass to the snippet component */
	props: Record<string, unknown>
	/** Tailwind CSS (optional) for styling the preview */
	tailwindCss?: string | null
	/** Dimensions for the snippet viewport */
	dimensions?: PreviewDimensions
	/** How the preview should scale within the container */
	fitMode?: "contain" | "width"
	/** Called when the preview successfully renders */
	onRenderSuccess?: () => void
	/** Called when the preview encounters an error */
	onRenderError?: (error: string, stack?: string) => void
	/** Additional CSS class for the container */
	className?: string
	/** Optional actions rendered in the preview header */
	headerActions?: ReactNode
	/** Whether camera transforms should apply for this preview mode */
	cameraAvailable?: boolean
	/** Enable camera mode (pan/zoom) for the preview viewport */
	cameraEnabled?: boolean
	/** Triggers resetting the camera pan/zoom back to the default view */
	cameraResetToken?: number
	/** Notifies when the pointer enters/leaves the preview viewport (useful for scoped hotkeys) */
	onCameraHoverChange?: (hovered: boolean) => void
	/** Enable inspect mode in the preview iframe */
	inspectEnabled?: boolean
	/** Called when the preview reports a hovered element source location */
	onInspectHover?: (source: PreviewSourceLocation | null) => void
	/** Called when the preview reports a selected element source location */
	onInspectSelect?: (source: PreviewSourceLocation | null, meta?: { reason?: "reset" }) => void
	/** Called when the preview reports a context action (right click) */
	onInspectContext?: (payload: {
		source: PreviewSourceLocation | null
		clientX: number
		clientY: number
	}) => void
	/** Called when the preview reports escape while inspecting */
	onInspectEscape?: () => void
	/** Request selecting a source location in the preview */
	inspectSelectionRequest?: PreviewSourceLocation | null
	/** Triggers sending a new inspect selection request */
	inspectSelectionRequestToken?: number
	/** Enable layers snapshot reporting */
	layersEnabled?: boolean
	/** Triggers a fresh layers snapshot request */
	layersRequestToken?: number
	/** Called when the preview reports a layers snapshot */
	onLayersSnapshot?: (snapshot: PreviewLayerSnapshot) => void
	/** Called when the preview reports a layers error */
	onLayersError?: (error: string) => void
	/** Enable layout manipulation in the preview iframe */
	layoutEnabled?: boolean
	/** Enable layout debug logging in the preview iframe */
	layoutDebugEnabled?: boolean
	/** Enable grid snapping during layout drag (8px grid + sibling edges/centers) */
	layoutSnapEnabled?: boolean
	/** Grid step size (in pixels) for layout snapping */
	layoutSnapGrid?: number
	/** Called when the preview commits a layout change */
	onLayoutCommit?: (commit: PreviewLayoutCommit) => void
	/** Trigger skipping the next render after a layout commit */
	suppressNextRenderToken?: number
	/** Called when the imports preview requests removing an asset */
	onImportAssetRemove?: (assetId: string) => void
}

export type PreviewStatus = "idle" | "loading" | "success" | "error"

const MAX_LAYOUT_DEBUG_ENTRIES = 200
const MAX_MESSAGE_TRACE_ENTRIES = 250

type PreviewMessageTraceEntry = {
	timestamp: number
	direction: "in" | "out"
	type: string
	detail?: string
}

type PreviewCameraState = {
	scale: number
	translateX: number
	translateY: number
}

const CAMERA_DEFAULT_STATE: PreviewCameraState = {
	scale: 1,
	translateX: 0,
	translateY: 0,
}

const CAMERA_MIN_SCALE = 0.1
const CAMERA_MAX_SCALE = 8
const CAMERA_TRACKPAD_DELTA_THRESHOLD = 50
const CAMERA_WHEEL_ZOOM_BASE = 1.0015

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (!value || typeof value !== "object") return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

const stableStringify = (value: unknown) => {
	const stack = new WeakSet<object>()

	const normalize = (input: unknown): unknown => {
		if (!input || typeof input !== "object") return input
		if (stack.has(input)) return null

		stack.add(input)
		try {
			if (Array.isArray(input)) {
				return input.map((entry) => normalize(entry))
			}

			if (isPlainObject(input)) {
				const sortedKeys = Object.keys(input).sort()
				const next: Record<string, unknown> = {}
				for (const key of sortedKeys) {
					next[key] = normalize(input[key])
				}
				return next
			}

			return input
		} finally {
			stack.delete(input)
		}
	}

	try {
		return JSON.stringify(normalize(value) ?? {})
	} catch {
		return "{}"
	}
}

type PreviewSuppressRenderState = {
	token: number
	codeRendersRemaining: number
	deadline: number
}

export function SnippetPreview({
	compiledCode,
	props,
	tailwindCss,
	dimensions = DEFAULT_PREVIEW_DIMENSIONS,
	fitMode = "contain",
	onRenderSuccess,
	onRenderError,
	className,
	headerActions,
	cameraAvailable = true,
	cameraEnabled = false,
	cameraResetToken = 0,
	onCameraHoverChange,
	inspectEnabled = false,
	onInspectHover,
	onInspectSelect,
	onInspectContext,
	onInspectEscape,
	inspectSelectionRequest = null,
	inspectSelectionRequestToken = 0,
	layersEnabled = false,
	layersRequestToken = 0,
	onLayersSnapshot,
	onLayersError,
	layoutEnabled = false,
	layoutDebugEnabled = false,
	layoutSnapEnabled = true,
	layoutSnapGrid = 8,
	onLayoutCommit,
	suppressNextRenderToken = 0,
	onImportAssetRemove,
}: SnippetPreviewProps) {
	const cameraModeEnabled = cameraAvailable && cameraEnabled
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const viewportRef = useRef<HTMLDivElement>(null)
	const iframeReadyRef = useRef(false)
	const [status, setStatus] = useState<PreviewStatus>("idle")
	const [error, setError] = useState<string | null>(null)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const traceStartRef = useRef(Date.now())
	const lastCompiledCodeRef = useRef<string | null>(null)
	const lastDimensionsRef = useRef<PreviewDimensions>(dimensions)
	const lastTailwindCssRef = useRef<string | null>(null)
	const lastPropsJsonRef = useRef<string | null>(null)
	const layoutDebugEnabledRef = useRef(Boolean(layoutDebugEnabled))
	const layoutSnapEnabledRef = useRef(Boolean(layoutSnapEnabled))
	const layoutSnapGridRef = useRef(layoutSnapGrid)
	const onInspectHoverRef = useRef(onInspectHover)
	const onInspectSelectRef = useRef(onInspectSelect)
	const onInspectContextRef = useRef(onInspectContext)
	const onInspectEscapeRef = useRef(onInspectEscape)
	const pendingInspectSelectionRef = useRef<PreviewSourceLocation | null>(null)
	const onRenderSuccessRef = useRef(onRenderSuccess)
	const onRenderErrorRef = useRef(onRenderError)
	const onLayersSnapshotRef = useRef(onLayersSnapshot)
	const onLayersErrorRef = useRef(onLayersError)
	const layersEnabledRef = useRef(Boolean(layersEnabled))
	const onLayoutCommitRef = useRef(onLayoutCommit)
	const onImportAssetRemoveRef = useRef(onImportAssetRemove)
	const layoutEnabledRef = useRef(Boolean(layoutEnabled))
	const cameraModeEnabledRef = useRef(cameraModeEnabled)
	const onCameraHoverChangeRef = useRef(onCameraHoverChange)
	const lastCameraResetTokenRef = useRef(cameraResetToken)
	const [camera, setCamera] = useState<PreviewCameraState>(() => ({ ...CAMERA_DEFAULT_STATE }))
	const cameraRef = useRef(camera)
	const pendingCameraRef = useRef<PreviewCameraState | null>(null)
	const cameraAnimationFrameRef = useRef<number | null>(null)
	const cameraHoverRef = useRef(false)
	const [isCameraPanning, setIsCameraPanning] = useState(false)
	const cameraPanRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null)
	const baseTranslateRef = useRef({ x: 0, y: 0 })
	const scaleRef = useRef(1)
	const suppressRenderStateRef = useRef<PreviewSuppressRenderState>({
		token: suppressNextRenderToken,
		codeRendersRemaining: 0,
		deadline: 0,
	})
	const suppressRenderResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [layoutDebugEntries, setLayoutDebugEntries] = useState<PreviewLayoutDebugEvent[]>([])
	const [messageTraceEntries, setMessageTraceEntries] = useState<PreviewMessageTraceEntry[]>([])
	const [debugView, setDebugView] = useState<"trace" | "layout">("trace")

	const traceEnabledRef = useRef(Boolean(layoutDebugEnabled))
	const canAppendTrace = useCallback(() => {
		return traceEnabledRef.current
	}, [])

	const appendTrace = useCallback(
		(entry: Omit<PreviewMessageTraceEntry, "timestamp">) => {
			if (!canAppendTrace()) return
			setMessageTraceEntries((prev) => {
				const next = [...prev, { ...entry, timestamp: Date.now() }]
				if (next.length > MAX_MESSAGE_TRACE_ENTRIES) {
					next.splice(0, next.length - MAX_MESSAGE_TRACE_ENTRIES)
				}
				return next
			})
		},
		[canAppendTrace],
	)

	useEffect(() => {
		const state = suppressRenderStateRef.current
		if (suppressNextRenderToken === state.token) return
		state.token = suppressNextRenderToken
		state.codeRendersRemaining = 1
		state.deadline = Date.now() + 4_000

		if (suppressRenderResetTimerRef.current) {
			clearTimeout(suppressRenderResetTimerRef.current)
		}
		suppressRenderResetTimerRef.current = setTimeout(() => {
			const current = suppressRenderStateRef.current
			if (current.token !== suppressNextRenderToken) return
			current.codeRendersRemaining = 0
			current.deadline = 0
		}, 4_250)
	}, [suppressNextRenderToken])

	const setCameraHovered = useCallback((hovered: boolean) => {
		if (cameraHoverRef.current === hovered) return
		cameraHoverRef.current = hovered
		onCameraHoverChangeRef.current?.(hovered)
	}, [])

	const scheduleCameraUpdate = useCallback(
		(updater: (prev: PreviewCameraState) => PreviewCameraState) => {
			const prev = pendingCameraRef.current ?? cameraRef.current
			const next = updater(prev)
			if (next === prev) return

			pendingCameraRef.current = next
			cameraRef.current = next

			if (cameraAnimationFrameRef.current !== null) return
			cameraAnimationFrameRef.current = requestAnimationFrame(() => {
				cameraAnimationFrameRef.current = null
				const value = pendingCameraRef.current
				pendingCameraRef.current = null
				if (!value) return
				setCamera(value)
			})
		},
		[],
	)

	useEffect(() => {
		if (cameraResetToken === lastCameraResetTokenRef.current) return
		lastCameraResetTokenRef.current = cameraResetToken
		if (cameraAnimationFrameRef.current !== null) {
			cancelAnimationFrame(cameraAnimationFrameRef.current)
			cameraAnimationFrameRef.current = null
		}
		pendingCameraRef.current = null
		const next = { ...CAMERA_DEFAULT_STATE }
		cameraRef.current = next
		setCamera(next)
	}, [cameraResetToken])

	useEffect(() => {
		if (cameraModeEnabled) return
		cameraPanRef.current = null
		setIsCameraPanning(false)
		if (cameraAnimationFrameRef.current !== null) {
			cancelAnimationFrame(cameraAnimationFrameRef.current)
			cameraAnimationFrameRef.current = null
		}
		pendingCameraRef.current = null
	}, [cameraModeEnabled])

	useEffect(() => {
		return () => {
			if (cameraAnimationFrameRef.current !== null) {
				cancelAnimationFrame(cameraAnimationFrameRef.current)
				cameraAnimationFrameRef.current = null
			}
			pendingCameraRef.current = null
			cameraHoverRef.current = false
			if (suppressRenderResetTimerRef.current) {
				clearTimeout(suppressRenderResetTimerRef.current)
				suppressRenderResetTimerRef.current = null
			}
		}
	}, [])

	useEffect(() => {
		onInspectHoverRef.current = onInspectHover
		onInspectSelectRef.current = onInspectSelect
		onInspectContextRef.current = onInspectContext
		onInspectEscapeRef.current = onInspectEscape
		onRenderSuccessRef.current = onRenderSuccess
		onRenderErrorRef.current = onRenderError
		onLayersSnapshotRef.current = onLayersSnapshot
		onLayersErrorRef.current = onLayersError
		layersEnabledRef.current = Boolean(layersEnabled)
		onLayoutCommitRef.current = onLayoutCommit
		onImportAssetRemoveRef.current = onImportAssetRemove
		layoutEnabledRef.current = Boolean(layoutEnabled)
		layoutDebugEnabledRef.current = Boolean(layoutDebugEnabled)
		traceEnabledRef.current = Boolean(layoutDebugEnabled)
		layoutSnapEnabledRef.current = Boolean(layoutSnapEnabled)
		layoutSnapGridRef.current = layoutSnapGrid
		cameraModeEnabledRef.current = Boolean(cameraAvailable) && Boolean(cameraEnabled)
		onCameraHoverChangeRef.current = onCameraHoverChange
	}, [
		cameraAvailable,
		cameraEnabled,
		onCameraHoverChange,
		onInspectHover,
		onInspectSelect,
		onInspectContext,
		onInspectEscape,
		onRenderSuccess,
		onRenderError,
		onLayersSnapshot,
		onLayersError,
		layersEnabled,
		onLayoutCommit,
		onImportAssetRemove,
		layoutEnabled,
		layoutDebugEnabled,
		layoutSnapEnabled,
		layoutSnapGrid,
	])

	useEffect(() => {
		if (!layoutDebugEnabled) {
			setLayoutDebugEntries([])
			setMessageTraceEntries([])
			setDebugView("trace")
		}
	}, [layoutDebugEnabled])

	// Handle messages from the iframe
	const handleMessage = useCallback(
		(event: MessageEvent<PreviewMessage>) => {
			const iframeWindow = iframeRef.current?.contentWindow
			if (!iframeWindow || event.source !== iframeWindow) return

			const data = event.data
			if (!data || typeof data.type !== "string") {
				return
			}

			switch (data.type) {
				case "ready":
					appendTrace({ direction: "in", type: "ready" })
					iframeReadyRef.current = true
					// Send scale immediately so inspect overlay sizing is correct,
					// especially for high-res templates with small scale factors.
					iframeRef.current?.contentWindow?.postMessage(
						{ type: "inspect-scale", scale: scaleRef.current },
						"*",
					)
					if (pendingInspectSelectionRef.current) {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "inspect-select-source",
								source: pendingInspectSelectionRef.current ?? null,
							},
							"*",
						)
						pendingInspectSelectionRef.current = null
					}
					if (layersEnabledRef.current) {
						iframeRef.current?.contentWindow?.postMessage(
							{ type: "layers-toggle", enabled: true },
							"*",
						)
						iframeRef.current?.contentWindow?.postMessage({ type: "layers-request" }, "*")
					}
					if (layoutEnabledRef.current) {
						iframeRef.current?.contentWindow?.postMessage(
							{ type: "layout-toggle", enabled: true },
							"*",
						)
					}
					iframeRef.current?.contentWindow?.postMessage(
						{ type: "layout-debug-toggle", enabled: layoutDebugEnabledRef.current },
						"*",
					)
					iframeRef.current?.contentWindow?.postMessage(
						{ type: "layout-snap-toggle", enabled: layoutSnapEnabledRef.current },
						"*",
					)
					iframeRef.current?.contentWindow?.postMessage(
						{ type: "layout-snap-grid", grid: layoutSnapGridRef.current },
						"*",
					)
					break
				case "render-success":
					appendTrace({ direction: "in", type: "render-success" })
					setStatus("success")
					setError(null)
					onRenderSuccessRef.current?.()
					break
				case "render-error":
					appendTrace({
						direction: "in",
						type: "render-error",
						detail: data.error ? String(data.error).slice(0, 120) : undefined,
					})
					setStatus("error")
					setError(data.error ?? "Unknown render error")
					onRenderErrorRef.current?.(data.error ?? "Unknown error", data.stack)
					break
				case "inspect-hover":
					onInspectHoverRef.current?.(data.source ?? null)
					break
				case "inspect-select":
					onInspectSelectRef.current?.(data.source ?? null)
					break
				case "inspect-context": {
					if (!onInspectContextRef.current) break
					const rect = iframeRef.current?.getBoundingClientRect()
					const x = typeof data.x === "number" ? data.x : 0
					const y = typeof data.y === "number" ? data.y : 0
					const scaleX = rect && dimensions.width > 0 ? rect.width / dimensions.width : 1
					const scaleY = rect && dimensions.height > 0 ? rect.height / dimensions.height : 1
					const clientX = rect ? rect.left + x * scaleX : x
					const clientY = rect ? rect.top + y * scaleY : y
					onInspectContextRef.current?.({ source: data.source ?? null, clientX, clientY })
					break
				}
				case "inspect-escape":
					onInspectEscapeRef.current?.()
					break
				case "layers-snapshot":
					if (data.snapshot) {
						onLayersSnapshotRef.current?.(data.snapshot)
					}
					break
				case "layers-error":
					if (data.error) {
						onLayersErrorRef.current?.(data.error)
					}
					break
				case "layout-commit":
					if (data.commit) {
						appendTrace({
							direction: "in",
							type: "layout-commit",
							detail:
								data.commit.width || data.commit.height
									? `resize w=${data.commit.width ?? "?"} h=${data.commit.height ?? "?"}`
									: `move x=${Math.round(data.commit.translate.x)} y=${Math.round(
											data.commit.translate.y,
										)}`,
						})
						onLayoutCommitRef.current?.(data.commit)
					}
					break
				case "layout-debug":
					if (!layoutDebugEnabledRef.current || !data.entry) break
					setLayoutDebugEntries((prev) => {
						const next = [...prev, data.entry]
						if (next.length > MAX_LAYOUT_DEBUG_ENTRIES) {
							next.splice(0, next.length - MAX_LAYOUT_DEBUG_ENTRIES)
						}
						return next
					})
					break
				case "import-assets-remove":
					onImportAssetRemoveRef.current?.(data.assetId)
					break
			}
		},
		[appendTrace, dimensions],
	)

	// Set up message listener
	useEffect(() => {
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [handleMessage])

	const propsJson = useMemo(() => stableStringify(props), [props])

	// Update iframe srcdoc when code or dimensions change
	useEffect(() => {
		if (!compiledCode) {
			setStatus("idle")
			setError(null)
			lastCompiledCodeRef.current = null
			lastTailwindCssRef.current = null
			lastPropsJsonRef.current = null
			if (suppressRenderResetTimerRef.current) {
				clearTimeout(suppressRenderResetTimerRef.current)
				suppressRenderResetTimerRef.current = null
			}
			suppressRenderStateRef.current = {
				token: suppressNextRenderToken,
				codeRendersRemaining: 0,
				deadline: 0,
			}
			iframeReadyRef.current = false
			onInspectHoverRef.current?.(null)
			onInspectSelectRef.current?.(null, { reason: "reset" })
			return
		}

		const lastDimensions = lastDimensionsRef.current
		const dimensionsChanged =
			dimensions.width !== lastDimensions.width || dimensions.height !== lastDimensions.height
		const codeChanged = compiledCode !== lastCompiledCodeRef.current

		if (!codeChanged && !dimensionsChanged) {
			return
		}

		const iframe = iframeRef.current
		onInspectHoverRef.current?.(null)
		onInspectSelectRef.current?.(null, { reason: "reset" })

		const canHotSwap =
			Boolean(iframe?.contentWindow) && iframeReadyRef.current && !dimensionsChanged

		if (canHotSwap) {
			const suppressState = suppressRenderStateRef.current
			const shouldSkipRender =
				suppressState.codeRendersRemaining > 0 && Date.now() <= suppressState.deadline

			lastCompiledCodeRef.current = compiledCode
			lastDimensionsRef.current = dimensions
			if (!shouldSkipRender) {
				lastPropsJsonRef.current = propsJson
			}
			if (shouldSkipRender) {
				suppressState.codeRendersRemaining = Math.max(0, suppressState.codeRendersRemaining - 1)
			}
			appendTrace({
				direction: "out",
				type: "code-update",
				detail: `skipRender=${shouldSkipRender} codeLen=${compiledCode.length} propsLen=${propsJson.length}`,
			})
			iframe?.contentWindow?.postMessage(
				{ type: "code-update", code: compiledCode, propsJson, skipRender: shouldSkipRender },
				"*",
			)
			return
		}

		lastCompiledCodeRef.current = compiledCode
		lastDimensionsRef.current = dimensions
		lastTailwindCssRef.current = tailwindCss ?? null
		lastPropsJsonRef.current = propsJson
		iframeReadyRef.current = false
		setStatus("loading")
		setError(null)
		appendTrace({
			direction: "out",
			type: "srcdoc-reload",
			detail: `codeChanged=${codeChanged} dimensionsChanged=${dimensionsChanged} codeLen=${compiledCode.length}`,
		})

		// Generate new srcdoc
		const srcdoc = generatePreviewSrcdoc(
			compiledCode,
			props,
			dimensions,
			tailwindCss ?? undefined,
			propsJson,
		)

		// Update iframe
		if (iframe) {
			iframe.srcdoc = srcdoc
		}
	}, [
		appendTrace,
		compiledCode,
		dimensions,
		props,
		propsJson,
		suppressNextRenderToken,
		tailwindCss,
	])

	useEffect(() => {
		if (!compiledCode || status !== "success") return
		const iframeWindow = iframeRef.current?.contentWindow
		if (!iframeWindow) return
		const nextCss = tailwindCss ?? null
		if (lastTailwindCssRef.current === nextCss) return
		lastTailwindCssRef.current = nextCss
		appendTrace({
			direction: "out",
			type: "tailwind-update",
			detail: `cssLen=${nextCss ? nextCss.length : 0}`,
		})
		iframeWindow.postMessage({ type: "tailwind-update", css: nextCss }, "*")
	}, [appendTrace, compiledCode, status, tailwindCss])

	useEffect(() => {
		if (!compiledCode || status !== "success") return
		const iframeWindow = iframeRef.current?.contentWindow
		if (!iframeWindow) return
		if (propsJson === lastPropsJsonRef.current) return
		lastPropsJsonRef.current = propsJson
		appendTrace({
			direction: "out",
			type: "props-update",
			detail: `propsLen=${propsJson.length}`,
		})
		iframeWindow.postMessage({ type: "props-update", propsJson }, "*")
	}, [appendTrace, compiledCode, propsJson, status])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe || status !== "success") return
		iframe.contentWindow?.postMessage(
			{ type: "inspect-toggle", enabled: Boolean(inspectEnabled) },
			"*",
		)
	}, [inspectEnabled, status])

	useEffect(() => {
		if (!inspectSelectionRequestToken) return
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) {
			pendingInspectSelectionRef.current = inspectSelectionRequest ?? null
			return
		}
		iframe.contentWindow.postMessage(
			{ type: "inspect-select-source", source: inspectSelectionRequest ?? null },
			"*",
		)
	}, [inspectSelectionRequest, inspectSelectionRequestToken])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		const enabled = Boolean(layersEnabled)
		iframe.contentWindow.postMessage({ type: "layers-toggle", enabled }, "*")
		if (enabled) {
			iframe.contentWindow.postMessage({ type: "layers-request" }, "*")
		}
	}, [layersEnabled])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage(
			{ type: "layout-toggle", enabled: Boolean(layoutEnabled) },
			"*",
		)
		iframe.contentWindow.postMessage({ type: "inspect-scale", scale: scaleRef.current }, "*")
	}, [layoutEnabled])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage(
			{ type: "layout-debug-toggle", enabled: Boolean(layoutDebugEnabled) },
			"*",
		)
	}, [layoutDebugEnabled])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage(
			{ type: "layout-snap-toggle", enabled: Boolean(layoutSnapEnabled) },
			"*",
		)
	}, [layoutSnapEnabled])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage({ type: "layout-snap-grid", grid: layoutSnapGrid }, "*")
	}, [layoutSnapGrid])

	useEffect(() => {
		if (!layersEnabledRef.current) return
		if (!layersRequestToken) return
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage({ type: "layers-request" }, "*")
	}, [layersRequestToken])

	useEffect(() => {
		const element = containerRef.current
		if (!element) return

		const updateSize = () => {
			const rect = element.getBoundingClientRect()
			setContainerSize((prev) =>
				prev.width === rect.width && prev.height === rect.height
					? prev
					: { width: rect.width, height: rect.height },
			)
		}

		updateSize()
		if (typeof ResizeObserver === "undefined") {
			return
		}
		const observer = new ResizeObserver(updateSize)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const viewport = viewportRef.current
		if (!viewport) return

		const handleWheel = (event: WheelEvent) => {
			if (!cameraModeEnabledRef.current) return
			event.preventDefault()

			const rect = viewport.getBoundingClientRect()
			const pointerX = event.clientX - rect.left
			const pointerY = event.clientY - rect.top

			const isPinch = event.ctrlKey
			const isTrackpad =
				event.deltaMode === 0 &&
				(Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < CAMERA_TRACKPAD_DELTA_THRESHOLD)

			if (!isPinch && isTrackpad) {
				const dx = event.deltaX
				const dy = event.deltaY
				if (!dx && !dy) return
				scheduleCameraUpdate((prev) => ({
					...prev,
					translateX: prev.translateX - dx,
					translateY: prev.translateY - dy,
				}))
				return
			}

			const zoomFactor = CAMERA_WHEEL_ZOOM_BASE ** -event.deltaY
			if (!Number.isFinite(zoomFactor) || zoomFactor === 1) return

			scheduleCameraUpdate((prev) => {
				const base = baseTranslateRef.current
				const nextScale = clamp(prev.scale * zoomFactor, CAMERA_MIN_SCALE, CAMERA_MAX_SCALE)
				if (nextScale === prev.scale) return prev
				const ratio = nextScale / prev.scale
				const prevOriginX = base.x + prev.translateX
				const prevOriginY = base.y + prev.translateY
				const nextOriginX = pointerX - (pointerX - prevOriginX) * ratio
				const nextOriginY = pointerY - (pointerY - prevOriginY) * ratio
				return {
					scale: nextScale,
					translateX: nextOriginX - base.x,
					translateY: nextOriginY - base.y,
				}
			})
		}

		viewport.addEventListener("wheel", handleWheel, { passive: false })
		return () => viewport.removeEventListener("wheel", handleWheel)
	}, [scheduleCameraUpdate])

	const scale = useMemo(() => {
		const availableWidth = containerSize.width
		const availableHeight = containerSize.height
		if (!availableWidth) return 1
		if (fitMode !== "width" && !availableHeight) return 1
		const widthRatio = availableWidth / dimensions.width
		const heightRatio = availableHeight / dimensions.height
		const nextScale = fitMode === "width" ? widthRatio : Math.min(widthRatio, heightRatio)
		return Math.min(1, Math.max(0.01, nextScale))
	}, [containerSize.height, containerSize.width, dimensions.height, dimensions.width, fitMode])

	const appliedCamera = cameraAvailable ? camera : CAMERA_DEFAULT_STATE
	const previewScale = scale * appliedCamera.scale
	const baseTranslate = useMemo(() => {
		if (fitMode !== "contain") return { x: 0, y: 0 }
		const availableWidth = containerSize.width
		const availableHeight = containerSize.height
		if (!availableWidth || !availableHeight) return { x: 0, y: 0 }
		const contentWidth = dimensions.width * scale
		const contentHeight = dimensions.height * scale
		const x = (availableWidth - contentWidth) / 2
		const y = (availableHeight - contentHeight) / 2
		return {
			x: Number.isFinite(x) ? x : 0,
			y: Number.isFinite(y) ? y : 0,
		}
	}, [
		containerSize.height,
		containerSize.width,
		dimensions.height,
		dimensions.width,
		fitMode,
		scale,
	])

	useEffect(() => {
		baseTranslateRef.current = baseTranslate
	}, [baseTranslate])

	// Keep scaleRef in sync for use in message handler
	useEffect(() => {
		scaleRef.current = previewScale
	}, [previewScale])

	useEffect(() => {
		cameraRef.current = camera
	}, [camera])

	const scaledWidth = Math.max(0, Math.round(dimensions.width * scale))
	const scaledHeight = Math.max(0, Math.round(dimensions.height * scale))
	const scalePercent = Math.round(previewScale * 100)
	const dimensionsLabel = `${dimensions.width} x ${dimensions.height}`
	const scaleLabel = `${scalePercent}%`
	const showScaleLabel = scalePercent !== 100
	const [metaOverride, setMetaOverride] = useState<"dimensions" | "scale" | null>(null)
	const previewMetaMode = showScaleLabel ? (metaOverride ?? "scale") : "dimensions"
	const previewMetaLabel = previewMetaMode === "scale" ? scaleLabel : dimensionsLabel
	const previewMetaTitle = `${dimensionsLabel} / ${scaleLabel}`

	useEffect(() => {
		if (!showScaleLabel && metaOverride !== null) {
			setMetaOverride(null)
		}
	}, [metaOverride, showScaleLabel])

	const handleMetaToggle = useCallback(() => {
		if (!showScaleLabel) return
		setMetaOverride((prev) => (prev === "dimensions" ? "scale" : "dimensions"))
	}, [showScaleLabel])

	const handleViewportPointerEnter = useCallback(() => {
		setCameraHovered(true)
	}, [setCameraHovered])

	const handleViewportPointerLeave = useCallback(() => {
		setCameraHovered(false)
	}, [setCameraHovered])

	const handleCameraPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!cameraModeEnabled) return
			if (event.pointerType === "mouse" && event.button !== 0) return
			const target = event.currentTarget
			target.setPointerCapture(event.pointerId)
			cameraPanRef.current = {
				pointerId: event.pointerId,
				clientX: event.clientX,
				clientY: event.clientY,
			}
			setCameraHovered(true)
			setIsCameraPanning(true)
			event.preventDefault()
		},
		[cameraModeEnabled, setCameraHovered],
	)

	const handleCameraPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!cameraModeEnabled) return
			const pan = cameraPanRef.current
			if (!pan || pan.pointerId !== event.pointerId) return

			const dx = event.clientX - pan.clientX
			const dy = event.clientY - pan.clientY
			if (!dx && !dy) return
			pan.clientX = event.clientX
			pan.clientY = event.clientY

			scheduleCameraUpdate((prev) => ({
				...prev,
				translateX: prev.translateX + dx,
				translateY: prev.translateY + dy,
			}))
		},
		[cameraModeEnabled, scheduleCameraUpdate],
	)

	const handleCameraPointerEnd = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!cameraModeEnabled) return
			const pan = cameraPanRef.current
			if (!pan || pan.pointerId !== event.pointerId) return

			cameraPanRef.current = null
			setIsCameraPanning(false)
			const target = event.currentTarget
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId)
			}
			const viewport = viewportRef.current
			setCameraHovered(viewport ? viewport.matches(":hover") : false)
			event.preventDefault()
		},
		[cameraModeEnabled, setCameraHovered],
	)

	const previewHint = useMemo(() => {
		if (cameraModeEnabled) return "Drag to pan · Scroll/pinch to zoom"
		if (layoutEnabled && inspectEnabled) {
			return "Drag to reposition or resize · Right-click to edit"
		}
		if (layoutEnabled) return "Drag to reposition or resize"
		if (inspectEnabled) return "Right-click to edit"
		return null
	}, [cameraModeEnabled, inspectEnabled, layoutEnabled])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe?.contentWindow || !iframeReadyRef.current) return
		iframe.contentWindow.postMessage({ type: "inspect-scale", scale: previewScale }, "*")
	}, [previewScale])

	const layoutDebugText = useMemo(
		() => layoutDebugEntries.map((entry) => JSON.stringify(entry)).join("\n"),
		[layoutDebugEntries],
	)

	const messageTraceText = useMemo(() => {
		const base = traceStartRef.current
		return messageTraceEntries
			.map((entry) => {
				const deltaMs = Math.max(0, entry.timestamp - base)
				const prefix = entry.direction === "in" ? "←" : "→"
				const detail = entry.detail ? ` ${entry.detail}` : ""
				return `${String(deltaMs).padStart(5, " ")}ms ${prefix} ${entry.type}${detail}`
			})
			.join("\n")
	}, [messageTraceEntries])

	const debugText = debugView === "layout" ? layoutDebugText : messageTraceText
	const handleCopyDebug = useCallback(async () => {
		if (!debugText) return
		try {
			await navigator.clipboard.writeText(debugText)
		} catch {
			// Ignore clipboard errors; user can still select manually.
		}
	}, [debugText])

	return (
		<div className={`relative flex flex-col ${className ?? ""}`}>
			{/* Preview header */}
			<div className="flex h-9 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3">
				<span className="text-xs font-medium text-neutral-500">Preview</span>
				<div className="flex items-center gap-2">
					{headerActions}
					<button
						type="button"
						className={cn(
							"text-xs text-neutral-400 transition-colors",
							showScaleLabel ? "cursor-pointer hover:text-neutral-600" : "cursor-default",
						)}
						onClick={handleMetaToggle}
						title={previewMetaTitle}
						aria-label="Preview scale and dimensions"
					>
						{previewMetaLabel}
					</button>
				</div>
			</div>

			{/* Preview container */}
			<div className="relative flex-1 overflow-auto bg-neutral-100 p-4">
				{previewHint && (
					<div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex justify-center">
						<div className="rounded-full border border-neutral-200 bg-white/95 px-2 py-1 text-[10px] font-medium text-neutral-500">
							{previewHint}
						</div>
					</div>
				)}
				<div
					ref={containerRef}
					className={cn(
						"relative w-full",
						fitMode === "contain"
							? "flex h-full items-center justify-center"
							: "flex justify-center",
					)}
				>
					<div
						ref={viewportRef}
						onPointerEnter={handleViewportPointerEnter}
						onPointerLeave={handleViewportPointerLeave}
						className={cn(
							"relative overflow-hidden rounded-md border border-neutral-200",
							layoutEnabled ? "bg-neutral-100" : "bg-white",
						)}
						style={{
							width: fitMode === "contain" ? "100%" : scaledWidth || "100%",
							height: fitMode === "contain" ? "100%" : scaledHeight || "100%",
						}}
					>
						<div
							className="absolute left-0 top-0"
							style={{
								transform: `translate3d(${baseTranslate.x + appliedCamera.translateX}px, ${baseTranslate.y + appliedCamera.translateY}px, 0)`,
							}}
						>
							<div
								className={cn(
									"relative",
									fitMode === "contain"
										? "overflow-hidden rounded-md border border-neutral-200 bg-white"
										: null,
								)}
								style={{
									width: dimensions.width,
									height: dimensions.height,
									transform: `scale(${previewScale})`,
									transformOrigin: "top left",
								}}
							>
								{/* Status overlays */}
								{status === "idle" && !compiledCode && (
									<div className="flex h-full w-full items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-white">
										<p className="text-sm text-neutral-400">Write code to see preview</p>
									</div>
								)}

								{status === "loading" && (
									<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
										<Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
									</div>
								)}

								{status === "error" && error && (
									<div className="absolute bottom-2 left-2 right-2 z-20 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg">
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
										<span className="line-clamp-2">{error}</span>
									</div>
								)}

								{/* Sandboxed iframe */}
								{compiledCode && (
									<iframe
										ref={iframeRef}
										title="Snippet Preview"
										sandbox="allow-scripts"
										data-snippet-preview="iframe"
										className="block"
										style={{
											width: dimensions.width,
											height: dimensions.height,
											border: "none",
											pointerEvents: cameraModeEnabled ? "none" : "auto",
										}}
									/>
								)}
							</div>
						</div>

						{cameraModeEnabled && (
							<div
								aria-hidden="true"
								className={cn(
									"absolute inset-0 z-[5] bg-transparent",
									isCameraPanning ? "cursor-grabbing" : "cursor-grab",
								)}
								style={{ touchAction: "none" }}
								onContextMenu={(event) => event.preventDefault()}
								onPointerDown={handleCameraPointerDown}
								onPointerMove={handleCameraPointerMove}
								onPointerUp={handleCameraPointerEnd}
								onPointerCancel={handleCameraPointerEnd}
							/>
						)}

						{layoutDebugEnabled && (
							<div className="absolute bottom-3 right-3 z-30 w-[360px] rounded-md border border-neutral-200 bg-white/95 text-[10px] text-neutral-700 shadow-sm">
								<div className="flex items-center justify-between border-b border-neutral-200 px-2 py-1">
									<span className="font-semibold uppercase tracking-widest text-neutral-500">
										Debug · Layout {layoutDebugEntries.length} · Trace {messageTraceEntries.length}
									</span>
									<div className="flex items-center gap-1">
										<button
											type="button"
											className={cn(
												"rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50",
												debugView === "trace" ? "bg-neutral-100" : null,
											)}
											onClick={() => setDebugView("trace")}
										>
											Trace
										</button>
										<button
											type="button"
											className={cn(
												"rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50",
												debugView === "layout" ? "bg-neutral-100" : null,
											)}
											onClick={() => setDebugView("layout")}
										>
											Layout
										</button>
										<button
											type="button"
											className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50"
											onClick={handleCopyDebug}
										>
											Copy
										</button>
										<button
											type="button"
											className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50"
											onClick={() => {
												if (debugView === "layout") {
													setLayoutDebugEntries([])
													return
												}
												setMessageTraceEntries([])
												traceStartRef.current = Date.now()
											}}
										>
											Clear
										</button>
									</div>
								</div>
								<textarea
									readOnly
									value={debugText}
									className="h-40 w-full resize-none border-0 bg-transparent p-2 font-mono text-[10px] text-neutral-700 focus:outline-none"
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
