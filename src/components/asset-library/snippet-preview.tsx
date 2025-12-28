/**
 * Sandboxed iframe preview for custom snippets.
 *
 * Renders compiled snippet code in an isolated iframe with strict
 * CSP and sandbox attributes to prevent untrusted code from
 * accessing the parent DOM or storage.
 */

import { AlertCircle, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	generatePreviewSrcdoc,
	type PreviewDimensions,
	type PreviewMessage,
	type PreviewSourceLocation,
} from "@/lib/snippets/preview-runtime"

export interface SnippetPreviewProps {
	/** Compiled JavaScript code from the snippet compiler */
	compiledCode: string | null
	/** Props to pass to the snippet component */
	props: Record<string, unknown>
	/** Tailwind CSS (optional) for styling the preview */
	tailwindCss?: string | null
	/** Dimensions for the snippet viewport */
	dimensions?: PreviewDimensions
	/** Called when the preview successfully renders */
	onRenderSuccess?: () => void
	/** Called when the preview encounters an error */
	onRenderError?: (error: string, stack?: string) => void
	/** Additional CSS class for the container */
	className?: string
	/** Optional actions rendered in the preview header */
	headerActions?: ReactNode
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
}

export type PreviewStatus = "idle" | "loading" | "success" | "error"

export function SnippetPreview({
	compiledCode,
	props,
	tailwindCss,
	dimensions = DEFAULT_PREVIEW_DIMENSIONS,
	onRenderSuccess,
	onRenderError,
	className,
	headerActions,
	inspectEnabled = false,
	onInspectHover,
	onInspectSelect,
	onInspectContext,
	onInspectEscape,
}: SnippetPreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [status, setStatus] = useState<PreviewStatus>("idle")
	const [error, setError] = useState<string | null>(null)
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
	const [isReady, setIsReady] = useState(false)
	const onInspectHoverRef = useRef(onInspectHover)
	const onInspectSelectRef = useRef(onInspectSelect)
	const onInspectContextRef = useRef(onInspectContext)
	const onInspectEscapeRef = useRef(onInspectEscape)
	const onRenderSuccessRef = useRef(onRenderSuccess)
	const onRenderErrorRef = useRef(onRenderError)

	useEffect(() => {
		onInspectHoverRef.current = onInspectHover
		onInspectSelectRef.current = onInspectSelect
		onInspectContextRef.current = onInspectContext
		onInspectEscapeRef.current = onInspectEscape
		onRenderSuccessRef.current = onRenderSuccess
		onRenderErrorRef.current = onRenderError
	}, [
		onInspectHover,
		onInspectSelect,
		onInspectContext,
		onInspectEscape,
		onRenderSuccess,
		onRenderError,
	])

	// Handle messages from the iframe
	const handleMessage = useCallback(
		(event: MessageEvent<PreviewMessage>) => {
			// Only accept messages from our iframe
			if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
				return
			}

			const data = event.data
			if (!data || typeof data.type !== "string") {
				return
			}

			switch (data.type) {
				case "ready":
					// Iframe is loaded and executing
					setIsReady(true)
					break
				case "render-success":
					setStatus("success")
					setError(null)
					onRenderSuccessRef.current?.()
					break
				case "render-error":
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
			}
		},
		[dimensions],
	)

	// Set up message listener
	useEffect(() => {
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [handleMessage])

	// Update iframe srcdoc when code changes
	useEffect(() => {
		if (!compiledCode) {
			setStatus("idle")
			setError(null)
			setIsReady(false)
			onInspectHoverRef.current?.(null)
			onInspectSelectRef.current?.(null, { reason: "reset" })
			return
		}

		setStatus("loading")
		setError(null)
		setIsReady(false)
		onInspectHoverRef.current?.(null)
		onInspectSelectRef.current?.(null, { reason: "reset" })

		// Generate new srcdoc
		const srcdoc = generatePreviewSrcdoc(compiledCode, props, dimensions, tailwindCss ?? undefined)

		// Update iframe
		if (iframeRef.current) {
			iframeRef.current.srcdoc = srcdoc
		}
	}, [compiledCode, props, dimensions, tailwindCss])

	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe || !isReady) return
		iframe.contentWindow?.postMessage(
			{ type: "inspect-toggle", enabled: Boolean(inspectEnabled) },
			"*",
		)
	}, [inspectEnabled, isReady])

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

	const scale = useMemo(() => {
		const availableWidth = containerSize.width
		const availableHeight = containerSize.height
		if (!availableWidth || !availableHeight) return 1
		const widthRatio = availableWidth / dimensions.width
		const heightRatio = availableHeight / dimensions.height
		const nextScale = Math.min(widthRatio, heightRatio)
		return Math.min(1, Math.max(0.01, nextScale))
	}, [containerSize.height, containerSize.width, dimensions.height, dimensions.width])

	const scaledWidth = Math.max(0, Math.round(dimensions.width * scale))
	const scaledHeight = Math.max(0, Math.round(dimensions.height * scale))

	return (
		<div className={`relative flex flex-col ${className ?? ""}`}>
			{/* Preview header */}
			<div className="flex h-9 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3">
				<span className="text-xs font-medium text-neutral-500">Preview</span>
				<div className="flex items-center gap-2">
					{headerActions}
					<span className="text-xs text-neutral-400">
						{dimensions.width} x {dimensions.height}
					</span>
				</div>
			</div>

			{/* Preview container */}
			<div className="relative flex-1 overflow-auto bg-neutral-100 p-4">
				<div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
					<div
						className="relative overflow-hidden rounded-md border border-neutral-200 bg-white"
						style={{
							width: scaledWidth || "100%",
							height: scaledHeight || "100%",
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
							<div
								style={{
									width: dimensions.width,
									height: dimensions.height,
									transform: `scale(${scale})`,
									transformOrigin: "top left",
								}}
							>
								<iframe
									ref={iframeRef}
									title="Snippet Preview"
									sandbox="allow-scripts"
									className="block"
									style={{
										width: dimensions.width,
										height: dimensions.height,
										border: "none",
									}}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
