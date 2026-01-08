import { hashSourceWasm } from "@/lib/wasm/snippet-wasm"
import { expandSnippetSource } from "./files"

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null

const hashBytes = (bytes: Uint8Array) => {
	let hash = 0x811c9dc5
	for (let i = 0; i < bytes.length; i += 1) {
		hash ^= bytes[i]
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

const hashSourceJs = (value: string) => {
	if (!value) return 0
	if (encoder) {
		return hashBytes(encoder.encode(value))
	}
	let hash = 0x811c9dc5
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

const isBrowserRuntime = typeof window !== "undefined" || typeof self !== "undefined"

/**
 * Hash snippet source synchronously, optionally treating the input as already-expanded source.
 */
export const hashSnippetSourceSync = (source: string, options?: { expanded?: boolean }): number => {
	const normalized = options?.expanded ? source : expandSnippetSource(source)
	if (!normalized || normalized.length === 0) return 0
	return hashSourceJs(normalized)
}

/**
 * Hash snippet source, preferring WASM hashing in the browser (falls back to JS hashing).
 */
export const hashSnippetSource = async (
	source: string,
	options?: { expanded?: boolean },
): Promise<number> => {
	const normalized = options?.expanded ? source : expandSnippetSource(source)
	if (!normalized || normalized.length === 0) return 0
	if (isBrowserRuntime) {
		const wasmHash = await hashSourceWasm(normalized)
		if (typeof wasmHash === "number") return wasmHash
	}
	return hashSourceJs(normalized)
}
