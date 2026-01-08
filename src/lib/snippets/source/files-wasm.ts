import { scanSnippetFilesWasm } from "@/lib/wasm/snippet-wasm"
import { type SnippetFileScanResult, scanSnippetFilesSync } from "./files"

const MAX_CACHE = 3
const isBrowserRuntime = typeof window !== "undefined" || typeof self !== "undefined"

const scanCache = new Map<string, SnippetFileScanResult>()
const scanPromises = new Map<string, Promise<SnippetFileScanResult>>()

const trimCache = () => {
	while (scanCache.size > MAX_CACHE) {
		const oldest = scanCache.keys().next().value
		if (oldest === undefined) return
		scanCache.delete(oldest)
	}
}

/**
 * Scan a snippet source for virtual `@snippet-file` blocks, using WASM in the browser with a small cache.
 */
export const scanSnippetFilesInWasm = async (source: string): Promise<SnippetFileScanResult> => {
	if (!source) {
		return scanSnippetFilesSync(source)
	}

	const cached = scanCache.get(source)
	if (cached) return cached

	const inflight = scanPromises.get(source)
	if (inflight) return inflight

	const promise = (async () => {
		try {
			if (!isBrowserRuntime) {
				const result = scanSnippetFilesSync(source)
				scanCache.set(source, result)
				trimCache()
				return result
			}
			const result = await scanSnippetFilesWasm(source)
			const resolved = result ?? scanSnippetFilesSync(source)
			scanCache.set(source, resolved)
			trimCache()
			return resolved
		} finally {
			scanPromises.delete(source)
		}
	})()

	scanPromises.set(source, promise)
	return promise
}
