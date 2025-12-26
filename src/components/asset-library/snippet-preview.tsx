/**
 * Sandboxed iframe preview for custom snippets.
 *
 * Renders compiled snippet code in an isolated iframe with strict
 * CSP and sandbox attributes to prevent untrusted code from
 * accessing the parent DOM or storage.
 */

import { AlertCircle, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	generatePreviewSrcdoc,
	type PreviewDimensions,
	type PreviewMessage,
} from "@/lib/snippets/preview-runtime"

export interface SnippetPreviewProps {
	/** Compiled JavaScript code from the snippet compiler */
	compiledCode: string | null
	/** Props to pass to the snippet component */
	props: Record<string, unknown>
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
}

export type PreviewStatus = "idle" | "loading" | "success" | "error"

export function SnippetPreview({
	compiledCode,
	props,
	dimensions = DEFAULT_PREVIEW_DIMENSIONS,
	onRenderSuccess,
	onRenderError,
	className,
	headerActions,
}: SnippetPreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const [status, setStatus] = useState<PreviewStatus>("idle")
	const [error, setError] = useState<string | null>(null)

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
					break
				case "render-success":
					setStatus("success")
					setError(null)
					onRenderSuccess?.()
					break
				case "render-error":
					setStatus("error")
					setError(data.error ?? "Unknown render error")
					onRenderError?.(data.error ?? "Unknown error", data.stack)
					break
			}
		},
		[onRenderSuccess, onRenderError],
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
			return
		}

		setStatus("loading")
		setError(null)

		// Generate new srcdoc
		const srcdoc = generatePreviewSrcdoc(compiledCode, props, dimensions)

		// Update iframe
		if (iframeRef.current) {
			iframeRef.current.srcdoc = srcdoc
		}
	}, [compiledCode, props, dimensions])

	const containerStyle = {
		aspectRatio: `${dimensions.width} / ${dimensions.height}`,
	}

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
				<div className="mx-auto h-full w-full max-w-full" style={containerStyle}>
					{/* Status overlays */}
					{status === "idle" && !compiledCode && (
						<div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-white">
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
							className="h-full w-full rounded-md border border-neutral-200 bg-white"
							style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
