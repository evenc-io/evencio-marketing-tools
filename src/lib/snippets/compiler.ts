/**
 * TSX Compiler using esbuild-wasm
 *
 * Provides client-side compilation of custom snippet TSX source code
 * into browser-executable JavaScript with React JSX transform.
 */

import type * as esbuild from "esbuild-wasm"
import { withTimeout } from "./async-timeout"
import { expandSnippetSource } from "./source-files"

// Types
export interface CompileError {
	message: string
	line: number // 1-based
	column: number // 0-based
	endLine?: number
	endColumn?: number
	severity: "error" | "warning"
}

export interface CompileResult {
	success: boolean
	code?: string
	errors: CompileError[]
	warnings: CompileError[]
}

type EsbuildGlobalState = {
	instance: typeof esbuild | null
	initPromise: Promise<typeof esbuild> | null
	initError: Error | null
	initErrorAt: number
}

const getEsbuildGlobalState = (): EsbuildGlobalState => {
	const globalScope = globalThis as typeof globalThis & {
		__evencio_esbuild_wasm__?: EsbuildGlobalState
	}
	if (!globalScope.__evencio_esbuild_wasm__) {
		globalScope.__evencio_esbuild_wasm__ = {
			instance: null,
			initPromise: null,
			initError: null,
			initErrorAt: 0,
		}
	}
	return globalScope.__evencio_esbuild_wasm__
}

const INIT_TIMEOUT_MS = 6000
const INIT_RETRY_MS = 1500

/**
 * Lazily initialize esbuild-wasm.
 * Only loads the WASM binary on first compile, avoiding bundle bloat.
 */
const hasWorkerGlobalScope = typeof self !== "undefined" && "WorkerGlobalScope" in self
const isServerRuntime =
	typeof Bun !== "undefined" || (typeof process !== "undefined" && Boolean(process.versions?.node))
const isBrowserRuntime = !isServerRuntime && (typeof window !== "undefined" || hasWorkerGlobalScope)

async function resolveBrowserWasmUrl(): Promise<string | undefined> {
	if (!isBrowserRuntime) return undefined
	try {
		const wasmModule = await import("esbuild-wasm/esbuild.wasm?url")
		return wasmModule.default
	} catch {
		try {
			return new URL("esbuild-wasm/esbuild.wasm", import.meta.url).toString()
		} catch {
			return undefined
		}
	}
}

async function getEsbuild(): Promise<typeof esbuild> {
	const state = getEsbuildGlobalState()
	// Return cached instance if already initialized
	if (state.instance) {
		return state.instance
	}

	// Return cached error if initialization previously failed
	if (state.initError) {
		if (Date.now() - state.initErrorAt < INIT_RETRY_MS) {
			throw state.initError
		}
		state.initError = null
	}

	// Return existing promise if initialization is in progress
	if (!state.initPromise) {
		// Start initialization
		state.initPromise = (async () => {
			const esbuildModule = await import("esbuild-wasm")

			const initOptions: esbuild.InitializeOptions = {
				worker: false,
			}
			if (isBrowserRuntime) {
				const wasmURL = await resolveBrowserWasmUrl()
				if (!wasmURL) {
					throw new Error("Failed to resolve esbuild WASM binary")
				}
				initOptions.wasmURL = wasmURL
			}
			try {
				await esbuildModule.initialize(initOptions)
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes("Cannot call initialize more than once")) {
					state.instance = esbuildModule
					return esbuildModule
				}
				throw err
			}

			state.instance = esbuildModule
			return esbuildModule
		})().catch((err) => {
			state.initError = err instanceof Error ? err : new Error(String(err))
			state.initErrorAt = Date.now()
			state.initPromise = null
			throw state.initError
		})
	}

	try {
		return await withTimeout(state.initPromise, INIT_TIMEOUT_MS, "esbuild initialization timed out")
	} catch (err) {
		if (err instanceof Error && err.name === "TimeoutError") {
			throw err
		}
		throw err
	}
}

/**
 * Convert esbuild message to our CompileError format
 */
function toCompileError(msg: esbuild.Message, severity: "error" | "warning"): CompileError {
	const loc = msg.location
	return {
		message: msg.text,
		line: loc?.line ?? 1,
		column: loc?.column ?? 0,
		endLine: loc?.line,
		endColumn: loc?.column !== undefined ? loc.column + (loc.length ?? 1) : undefined,
		severity,
	}
}

/**
 * Wrap compiled code to work in the preview iframe context.
 *
 * The preview iframe provides React and ReactDOM as globals (via UMD),
 * so we need to transform the ES module output to use those globals.
 */
function wrapForPreview(code: string, entryExport?: string): string {
	const resolvedEntryExport = entryExport ? JSON.stringify(entryExport) : "null"
	return `
(function() {
  const React = window.React;

  const attachDevSource = (props, source) => {
    if (!source) return props || null;
    if (props && typeof props === "object") {
      return { ...props, __source: source };
    }
    return { __source: source };
  };

  // jsx-runtime shim for automatic JSX transform
  const jsxRuntime = {
    jsx: function(type, props, key) {
      const { children, ...rest } = props || {};
      return React.createElement(type, key !== undefined ? { ...rest, key } : rest, children);
    },
    jsxs: function(type, props, key) {
      const { children, ...rest } = props || {};
      return React.createElement(type, key !== undefined ? { ...rest, key } : rest, ...(Array.isArray(children) ? children : [children]));
    },
    jsxDEV: function(type, props, key, _isStaticChildren, source, _self) {
      const nextProps = attachDevSource(props, source);
      const { children, ...rest } = nextProps || {};
      return React.createElement(type, key !== undefined ? { ...rest, key } : rest, ...(Array.isArray(children) ? children : [children]));
    },
    Fragment: React.Fragment
  };

  const jsxDevRuntime = {
    jsxDEV: jsxRuntime.jsxDEV,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: React.Fragment
  };

  // Minimal require shim for React imports
  const require = (name) => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react/jsx-dev-runtime") return jsxDevRuntime;
    throw new Error("Only React imports are supported in snippets. Found: " + name);
  };

  // Module scope
  const module = { exports: {} };
  const exports = module.exports;

  // Compiled code
  ${code}

  const requestedExport = ${resolvedEntryExport};
  const resolvedComponent = requestedExport && requestedExport !== "default"
    ? module.exports?.[requestedExport] ?? exports?.[requestedExport]
    : (module.exports?.default ?? exports?.default ?? module.exports);

  if (!resolvedComponent) {
    window.__SNIPPET_COMPONENT_ERROR__ = requestedExport && requestedExport !== "default"
      ? "No export named \\"" + requestedExport + "\\" found. Export a component with that name."
      : "No default export found. Snippet must export a React component.";
  }

  window.__SNIPPET_COMPONENT__ = resolvedComponent;
})();
`
}

/**
 * Compile TSX source code to browser-executable JavaScript.
 *
 * @param source - Raw TSX source code
 * @param entryExport - Named export to render (defaults to "default")
 * @returns Compilation result with code or errors
 */
export async function compileSnippet(source: string, entryExport?: string): Promise<CompileResult> {
	try {
		const esbuild = await getEsbuild()
		const normalizedSource = expandSnippetSource(source)

		const result = await esbuild.transform(normalizedSource, {
			loader: "tsx",
			jsx: "automatic",
			jsxDev: true,
			target: "es2020",
			format: "cjs",
			minify: false,
			sourcemap: false,
			sourcefile: "Snippet.tsx",
		})

		// Check for errors
		if (result.warnings.length > 0) {
			const warnings = result.warnings.map((w) => toCompileError(w, "warning"))
			return {
				success: true,
				code: wrapForPreview(result.code, entryExport),
				errors: [],
				warnings,
			}
		}

		return {
			success: true,
			code: wrapForPreview(result.code, entryExport),
			errors: [],
			warnings: [],
		}
	} catch (err) {
		// Handle esbuild transform errors
		if (err && typeof err === "object" && "errors" in err) {
			const buildError = err as { errors: esbuild.Message[]; warnings: esbuild.Message[] }
			return {
				success: false,
				errors: buildError.errors.map((e) => toCompileError(e, "error")),
				warnings: buildError.warnings?.map((w) => toCompileError(w, "warning")) ?? [],
			}
		}

		// Handle other errors (e.g., initialization failure)
		return {
			success: false,
			errors: [
				{
					message: err instanceof Error ? err.message : String(err),
					line: 1,
					column: 0,
					severity: "error",
				},
			],
			warnings: [],
		}
	}
}

/**
 * Check if esbuild is already initialized.
 * Useful for showing loading states.
 */
export function isCompilerReady(): boolean {
	return getEsbuildGlobalState().instance !== null
}

/**
 * Pre-warm the compiler by loading esbuild-wasm.
 * Call this early to reduce first-compile latency.
 */
export async function warmupCompiler(): Promise<void> {
	await getEsbuild()
}
