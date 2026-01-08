import type { RenderDeterminismConfig } from "./render-config"

export interface SnippetRenderCacheEntry {
	dataUrl: string
	createdAt: number
}

export interface SnippetRenderCacheOptions {
	maxEntries?: number
	maxAgeMs?: number
}

interface CacheKeyInput {
	assetId: string
	version: number
	props: unknown
	determinism?: RenderDeterminismConfig
}

const DEFAULT_MAX_ENTRIES = 50
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000

const cache = new Map<string, SnippetRenderCacheEntry>()

const hashString = (input: string): string => {
	let hash = 2166136261
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(16)
}

const stableStringify = (value: unknown): string => {
	if (value === null || value === undefined) {
		return String(value)
	}

	if (typeof value !== "object") {
		return JSON.stringify(value)
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`
	}

	const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
		a.localeCompare(b),
	)
	const serialized = entries
		.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
		.join(",")
	return `{${serialized}}`
}

/**
 * Build a stable cache key for a snippet render based on asset/version/props and determinism settings.
 */
export function getSnippetRenderCacheKey({ assetId, version, props, determinism }: CacheKeyInput) {
	const propsHash = hashString(stableStringify(props))
	const determinismHash = determinism ? hashString(stableStringify(determinism)) : "default"
	return `${assetId}:${version}:${propsHash}:${determinismHash}`
}

/**
 * Read a cached snippet render entry, evicting it if it is too old.
 */
export function getSnippetRenderCache(
	key: string,
	options: SnippetRenderCacheOptions = {},
): SnippetRenderCacheEntry | null {
	const entry = cache.get(key)
	if (!entry) return null

	const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS
	if (Date.now() - entry.createdAt > maxAgeMs) {
		cache.delete(key)
		return null
	}

	return entry
}

/**
 * Store a snippet render in cache and evict the oldest entry if over capacity.
 */
export function setSnippetRenderCache(
	key: string,
	dataUrl: string,
	options: SnippetRenderCacheOptions = {},
): void {
	const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
	if (cache.size >= maxEntries) {
		const oldestKey = cache.keys().next().value
		if (oldestKey) {
			cache.delete(oldestKey)
		}
	}

	cache.set(key, { dataUrl, createdAt: Date.now() })
}

/**
 * Clear all cached snippet renders.
 */
export function clearSnippetRenderCache(): void {
	cache.clear()
}
