/**
 * TSX Compiler using esbuild-wasm
 *
 * Provides client-side compilation of custom snippet TSX source code
 * into browser-executable JavaScript with React JSX transform.
 */

import type * as esbuild from "esbuild-wasm"

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

// Singleton state for lazy initialization
let esbuildInstance: typeof esbuild | null = null
let initPromise: Promise<typeof esbuild> | null = null
let initError: Error | null = null

/**
 * Lazily initialize esbuild-wasm.
 * Only loads the WASM binary on first compile, avoiding bundle bloat.
 */
const isBrowserRuntime =
	typeof window !== "undefined" && typeof document !== "undefined" && typeof Bun === "undefined"

async function resolveBrowserWasmUrl(): Promise<string | undefined> {
	if (!isBrowserRuntime) return undefined
	const wasmModule = await import("esbuild-wasm/esbuild.wasm?url")
	return wasmModule.default
}

async function getEsbuild(): Promise<typeof esbuild> {
	// Return cached instance if already initialized
	if (esbuildInstance) {
		return esbuildInstance
	}

	// Return cached error if initialization previously failed
	if (initError) {
		throw initError
	}

	// Return existing promise if initialization is in progress
	if (initPromise) {
		return initPromise
	}

	// Start initialization
	initPromise = (async () => {
		try {
			const esbuildModule = await import("esbuild-wasm")

			const wasmURL = await resolveBrowserWasmUrl()
			const initOptions: esbuild.InitializeOptions = {
				worker: false,
			}
			if (wasmURL) {
				initOptions.wasmURL = wasmURL
			}
			await esbuildModule.initialize(initOptions)

			esbuildInstance = esbuildModule
			return esbuildModule
		} catch (err) {
			initError = err instanceof Error ? err : new Error(String(err))
			initPromise = null
			throw initError
		}
	})()

	return initPromise
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
function wrapForPreview(code: string): string {
	return `
(function() {
  const React = window.React;

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
    Fragment: React.Fragment
  };

  // Minimal require shim for React imports
  const require = (name) => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsxRuntime;
    throw new Error("Only React imports are supported in snippets. Found: " + name);
  };

  // Module scope
  const module = { exports: {} };
  const exports = module.exports;

  // Compiled code
  ${code}

  // Return the default export
  window.__SNIPPET_COMPONENT__ = module.exports.default || exports.default || module.exports;
})();
`
}

/**
 * Compile TSX source code to browser-executable JavaScript.
 *
 * @param source - Raw TSX source code
 * @returns Compilation result with code or errors
 */
export async function compileSnippet(source: string): Promise<CompileResult> {
	try {
		const esbuild = await getEsbuild()

		const result = await esbuild.transform(source, {
			loader: "tsx",
			jsx: "automatic",
			target: "es2020",
			format: "cjs",
			minify: false,
			sourcemap: false,
		})

		// Check for errors
		if (result.warnings.length > 0) {
			const warnings = result.warnings.map((w) => toCompileError(w, "warning"))
			return {
				success: true,
				code: wrapForPreview(result.code),
				errors: [],
				warnings,
			}
		}

		return {
			success: true,
			code: wrapForPreview(result.code),
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
	return esbuildInstance !== null
}

/**
 * Pre-warm the compiler by loading esbuild-wasm.
 * Call this early to reduce first-compile latency.
 */
export async function warmupCompiler(): Promise<void> {
	await getEsbuild()
}
