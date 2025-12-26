/**
 * React hook for compiling custom snippet TSX source code.
 *
 * Provides debounced compilation with error tracking and Monaco marker conversion.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MonacoMarker } from "@/components/ui/monaco-editor"
import { type CompileError, compileSnippet } from "./compiler"
import { analyzeSnippetSource, securityIssuesToCompileErrors } from "./source-security"

export type CompileStatus = "idle" | "compiling" | "success" | "error"

export interface UseSnippetCompilerOptions {
	/** Source code to compile */
	source: string
	/** Default props to pass to the snippet (as JSON string or object) */
	defaultProps?: string | Record<string, unknown>
	/** Debounce delay in milliseconds (default: 500) */
	debounceMs?: number
	/** Whether to auto-compile on source changes (default: true) */
	autoCompile?: boolean
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
	debounceMs = 500,
	autoCompile = true,
}: UseSnippetCompilerOptions): UseSnippetCompilerResult {
	const [status, setStatus] = useState<CompileStatus>("idle")
	const [compiledCode, setCompiledCode] = useState<string | null>(null)
	const [errors, setErrors] = useState<CompileError[]>([])
	const [warnings, setWarnings] = useState<CompileError[]>([])

	// Parse props
	const { parsed: parsedProps, error: propsError } = useMemo(
		() => parseProps(defaultProps),
		[defaultProps],
	)

	// Track source version to handle race conditions
	const sourceVersionRef = useRef(0)
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Core compile function
	const doCompile = useCallback(async (sourceToCompile: string, version: number) => {
		// Skip empty source
		if (!sourceToCompile.trim()) {
			setStatus("idle")
			setCompiledCode(null)
			setErrors([])
			setWarnings([])
			return
		}

		setStatus("compiling")

		try {
			const [result, securityIssues] = await Promise.all([
				compileSnippet(sourceToCompile),
				analyzeSnippetSource(sourceToCompile),
			])

			const securityErrors = securityIssuesToCompileErrors(securityIssues)

			// Check if this is still the latest version
			if (version !== sourceVersionRef.current) {
				return // Stale result, ignore
			}

			if (securityErrors.length > 0) {
				setStatus("error")
				setCompiledCode(null)
				setErrors([...securityErrors, ...result.errors])
				setWarnings(result.warnings)
				return
			}

			if (result.success && result.code) {
				setStatus("success")
				setCompiledCode(result.code)
				setErrors([])
				setWarnings(result.warnings)
			} else {
				setStatus("error")
				// Keep last successful code for preview (shows last working version)
				setErrors(result.errors)
				setWarnings(result.warnings)
			}
		} catch (err) {
			// Check if this is still the latest version
			if (version !== sourceVersionRef.current) {
				return
			}

			setStatus("error")
			setErrors([
				{
					message: err instanceof Error ? err.message : "Compilation failed",
					line: 1,
					column: 0,
					severity: "error",
				},
			])
		}
	}, [])

	// Manual compile function
	const compile = useCallback(async () => {
		const version = ++sourceVersionRef.current
		await doCompile(source, version)
	}, [source, doCompile])

	// Auto-compile with debounce
	useEffect(() => {
		if (!autoCompile) return

		// Clear existing timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		// Increment version
		const version = ++sourceVersionRef.current

		// Set up debounced compile
		debounceTimerRef.current = setTimeout(() => {
			doCompile(source, version)
		}, debounceMs)

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [source, debounceMs, autoCompile, doCompile])

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
		compile,
	}
}
