/**
 * React hook for compiling custom snippet TSX source code.
 *
 * Provides debounced compilation with error tracking and Monaco marker conversion.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MonacoMarker } from "@/components/ui/monaco-editor"
import { compileSnippetInEngine } from "@/lib/engine/client"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import type { CompileError } from "./compiler"
import { SNIPPET_COMPONENT_LIMITS, SNIPPET_SOURCE_MAX_CHARS } from "./constraints"
import { DEFAULT_SNIPPET_EXPORT } from "./source/derived"
import { hashSnippetSourceSync } from "./source/hash"
import { securityIssuesToCompileErrors } from "./source/security"

export type CompileStatus = "idle" | "compiling" | "success" | "error"

export interface UseSnippetCompilerOptions {
	/** Source code to compile */
	source: string
	/** Default props to pass to the snippet (as JSON string or object) */
	defaultProps?: string | Record<string, unknown>
	/** Named export to use as the entry component (defaults to "default") */
	entryExport?: string
	/** Debounce delay in milliseconds (default: 500) */
	debounceMs?: number
	/** Whether to auto-compile on source changes (default: true) */
	autoCompile?: boolean
	/** Whether to generate Tailwind CSS for previews (default: false) */
	enableTailwindCss?: boolean
	/** Unified analysis result (security, exports, tailwind) */
	analysis?: AnalyzeTsxResponse | null
	/** Unique key to isolate engine stale tracking (default: "snippet-compile") */
	engineKey?: string
	/** Reset compiler state when this key changes (e.g. on snippet switch). */
	resetKey?: string | number
}

export interface UseSnippetCompilerResult {
	/** Current compilation status */
	status: CompileStatus
	/** Compiled JavaScript code (if successful) */
	compiledCode: string | null
	/** Compilation errors */
	errors: CompileError[]
	/** Compilation warnings */
	warnings: CompileError[]
	/** Monaco-compatible markers for display in editor */
	monacoMarkers: MonacoMarker[]
	/** Parsed props object (from defaultProps) */
	parsedProps: Record<string, unknown>
	/** Props parsing error (if defaultProps is invalid JSON) */
	propsError: string | null
	/** Tailwind CSS output for the current source (if enabled) */
	tailwindCss: string | null
	/** Manually trigger compilation */
	compile: () => Promise<void>
}

/**
 * Convert CompileError to MonacoMarker format.
 */
function toMonacoMarker(error: CompileError): MonacoMarker {
	return {
		message: error.message,
		severity: error.severity === "error" ? "error" : "warning",
		startLine: error.line,
		startColumn: error.column + 1, // Monaco columns are 1-based
		endLine: error.endLine ?? error.line,
		endColumn: (error.endColumn ?? error.column + 1) + 1,
	}
}

const buildLimitError = (message: string): CompileError => ({
	message,
	line: 1,
	column: 0,
	severity: "error",
})

/**
 * Parse props from string or return object as-is.
 */
function parseProps(props: string | Record<string, unknown> | undefined): {
	parsed: Record<string, unknown>
	error: string | null
} {
	if (props === undefined || props === "") {
		return { parsed: {}, error: null }
	}

	if (typeof props === "object") {
		return { parsed: props, error: null }
	}

	try {
		const parsed = JSON.parse(props)
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return { parsed: {}, error: "Props must be a JSON object" }
		}
		return { parsed, error: null }
	} catch (err) {
		return {
			parsed: {},
			error: err instanceof Error ? err.message : "Invalid JSON",
		}
	}
}

/**
 * Hook for compiling custom snippet TSX source code.
 *
 * @example
 * ```tsx
 * const { status, compiledCode, monacoMarkers } = useSnippetCompiler({
 *   source: tsxCode,
 *   defaultProps: '{ "title": "Hello" }',
 * });
 *
 * return (
 *   <>
 *     <MonacoEditor value={tsxCode} markers={monacoMarkers} />
 *     <SnippetPreview compiledCode={compiledCode} props={parsedProps} />
 *   </>
 * );
 * ```
 */
export function useSnippetCompiler({
	source,
	defaultProps,
	entryExport,
	debounceMs = 500,
	autoCompile = true,
	enableTailwindCss = false,
	analysis = null,
	engineKey = "snippet-compile",
	resetKey,
}: UseSnippetCompilerOptions): UseSnippetCompilerResult {
	const [status, setStatus] = useState<CompileStatus>("idle")
	const [compiledCode, setCompiledCode] = useState<string | null>(null)
	const [errors, setErrors] = useState<CompileError[]>([])
	const [warnings, setWarnings] = useState<CompileError[]>([])
	const [tailwindCss, setTailwindCss] = useState<string | null>(null)
	const runImmediatelyRef = useRef(false)
	const wasAutoCompileRef = useRef(autoCompile)

	// Parse props
	const { parsed: parsedProps, error: propsError } = useMemo(
		() => parseProps(defaultProps),
		[defaultProps],
	)

	// Track source version to handle race conditions
	const sourceVersionRef = useRef(0)
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isMountedRef = useRef(true)
	const resetKeyRef = useRef(resetKey)

	useEffect(() => {
		const wasAutoCompile = wasAutoCompileRef.current
		wasAutoCompileRef.current = autoCompile
		if (!wasAutoCompile && autoCompile) {
			runImmediatelyRef.current = true
		}
	}, [autoCompile])

	useEffect(() => {
		if (resetKey === undefined) return
		if (resetKeyRef.current === resetKey) return
		resetKeyRef.current = resetKey
		runImmediatelyRef.current = true
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
			debounceTimerRef.current = null
		}
		sourceVersionRef.current += 1
		setStatus("idle")
		setCompiledCode(null)
		setErrors([])
		setWarnings([])
		setTailwindCss(null)
	}, [resetKey])

	// Core compile function
	const doCompile = useCallback(
		async (sourceToCompile: string, version: number) => {
			// Skip empty source
			if (!sourceToCompile.trim()) {
				if (!isMountedRef.current) return
				setStatus("idle")
				setCompiledCode(null)
				setErrors([])
				setWarnings([])
				setTailwindCss(null)
				return
			}

			if (sourceToCompile.length > SNIPPET_SOURCE_MAX_CHARS) {
				if (!isMountedRef.current) return
				setStatus("error")
				setErrors([
					buildLimitError(
						`Snippet source is too large (limit ${SNIPPET_SOURCE_MAX_CHARS} characters).`,
					),
				])
				setWarnings([])
				setTailwindCss(null)
				return
			}

			const analysisHash =
				analysis && typeof analysis.sourceHash === "number" ? analysis.sourceHash : null
			const sourceHash = analysisHash !== null ? hashSnippetSourceSync(sourceToCompile) : null

			if (!isMountedRef.current) return
			setStatus("compiling")

			try {
				const resolvedEntryExport =
					typeof entryExport === "string" && entryExport.trim().length > 0
						? entryExport
						: DEFAULT_SNIPPET_EXPORT
				const { data: result } = await compileSnippetInEngine(sourceToCompile, {
					entryExport: resolvedEntryExport,
					key: engineKey,
				})
				if (!isMountedRef.current) {
					return
				}

				const analysisMatches =
					analysis &&
					analysisHash !== null &&
					typeof sourceHash === "number" &&
					analysisHash === sourceHash
				const effectiveAnalysis = analysisMatches ? analysis : null

				if (
					effectiveAnalysis?.exports.length &&
					effectiveAnalysis.exports.length > SNIPPET_COMPONENT_LIMITS.hard
				) {
					if (!isMountedRef.current) return
					setStatus("error")
					setErrors([
						buildLimitError(
							`Snippet exports too many components (limit ${SNIPPET_COMPONENT_LIMITS.hard}).`,
						),
					])
					setWarnings([])
					setTailwindCss(null)
					return
				}

				const securityErrors = effectiveAnalysis
					? securityIssuesToCompileErrors(effectiveAnalysis.securityIssues)
					: []

				// Check if this is still the latest version
				if (version !== sourceVersionRef.current || !isMountedRef.current) {
					return // Stale result, ignore
				}

				if (securityErrors.length > 0) {
					if (!isMountedRef.current) return
					setStatus("error")
					setCompiledCode(null)
					setErrors([...securityErrors, ...result.errors])
					setWarnings(result.warnings)
					setTailwindCss(null)
					return
				}

				if (result.success && result.code) {
					const tailwindErrorMessage = enableTailwindCss ? effectiveAnalysis?.tailwindError : null
					if (tailwindErrorMessage) {
						if (version !== sourceVersionRef.current || !isMountedRef.current) {
							return
						}
						setStatus("error")
						// Keep the compiled code so the preview can still render (unstyled) while
						// surfacing the Tailwind generation error to the editor.
						setCompiledCode(result.code)
						setErrors([...result.errors, buildLimitError(tailwindErrorMessage)])
						setWarnings(result.warnings)
						setTailwindCss(null)
						return
					}

					if (version !== sourceVersionRef.current || !isMountedRef.current) {
						return
					}

					setStatus("success")
					setCompiledCode(result.code)
					setErrors([])
					setWarnings(result.warnings)
					if (enableTailwindCss) {
						// Avoid FOUC/flashing in the preview: compilation can finish before the debounced
						// analysis pipeline (tailwind CSS). If analysis is stale, keep the previous CSS
						// until the matching analysis arrives (effect below will reconcile).
						if (!analysis) {
							setTailwindCss(null)
						} else if (analysisMatches) {
							setTailwindCss(analysis.tailwindCss ?? null)
						}
					}
				} else {
					if (!isMountedRef.current) return
					setStatus("error")
					setCompiledCode(null)
					setErrors(result.errors)
					setWarnings(result.warnings)
					setTailwindCss(null)
				}
			} catch (err) {
				// Check if this is still the latest version
				if (version !== sourceVersionRef.current || !isMountedRef.current) {
					return
				}

				setStatus("error")
				setCompiledCode(null)
				setTailwindCss(null)
				setErrors([
					{
						message: err instanceof Error ? err.message : "Compilation failed",
						line: 1,
						column: 0,
						severity: "error",
					},
				])
			}
		},
		[analysis, enableTailwindCss, entryExport, engineKey],
	)

	// Manual compile function
	const compile = useCallback(async () => {
		const version = ++sourceVersionRef.current
		await doCompile(source, version)
	}, [source, doCompile])

	// Auto-compile with debounce
	useEffect(() => {
		if (!autoCompile) return
		void resetKey

		// Clear existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		const delayMs =
			runImmediatelyRef.current || debounceMs <= 0 ? 0 : Math.max(0, Math.floor(debounceMs))
		runImmediatelyRef.current = false

		// Set up debounced compile
		debounceTimerRef.current = setTimeout(() => {
			const version = ++sourceVersionRef.current
			doCompile(source, version)
		}, delayMs)

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [source, debounceMs, autoCompile, doCompile, resetKey])

	// React StrictMode mounts, unmounts, then remounts; re-arm to avoid stale false.
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	useEffect(() => {
		if (!analysis) return
		if (!compiledCode || status !== "success") return
		const analysisHash = typeof analysis.sourceHash === "number" ? analysis.sourceHash : null
		const analysisMatches = analysisHash !== null && analysisHash === hashSnippetSourceSync(source)

		if (analysisMatches) {
			const securityErrors = securityIssuesToCompileErrors(analysis.securityIssues)
			if (securityErrors.length > 0) {
				if (!isMountedRef.current) return
				setStatus("error")
				setCompiledCode(null)
				setErrors(securityErrors)
				setTailwindCss(null)
				return
			}

			if (analysis.tailwindError) {
				if (!isMountedRef.current) return
				setStatus("error")
				setErrors([buildLimitError(analysis.tailwindError)])
				setTailwindCss(null)
				return
			}
		}

		if (!enableTailwindCss) return

		if (analysis.tailwindCss !== null && analysis.tailwindCss !== tailwindCss) {
			setTailwindCss(analysis.tailwindCss)
		}
	}, [analysis, compiledCode, enableTailwindCss, source, status, tailwindCss])

	// Convert errors to Monaco markers
	const monacoMarkers = useMemo(() => {
		const allIssues = [...errors, ...warnings]
		return allIssues.map(toMonacoMarker)
	}, [errors, warnings])

	return {
		status,
		compiledCode,
		errors,
		warnings,
		monacoMarkers,
		parsedProps,
		propsError,
		tailwindCss,
		compile,
	}
}
