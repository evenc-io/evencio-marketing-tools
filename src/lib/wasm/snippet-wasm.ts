import { withTimeout } from "@/lib/snippets/async-timeout"
import type { SnippetInspectIndex } from "@/lib/snippets/inspect-index"
import {
	expandSnippetSource,
	type SnippetFileScanResult,
	type SnippetLineMapSegment,
} from "@/lib/snippets/source-files"
import type { SourceSecurityIssue } from "@/lib/snippets/source-security"

type SnippetWasmExports = {
	memory: WebAssembly.Memory
	alloc: (size: number) => number
	free: (ptr: number, size: number) => void
	scan_tailwind_candidates: (ptr: number, len: number, outLenPtr: number) => number
	scan_security_issues: (ptr: number, len: number, outLenPtr: number) => number
	scan_inspect_index: (ptr: number, len: number, outLenPtr: number) => number
	scan_snippet_files: (ptr: number, len: number, outLenPtr: number) => number
	hash_bytes: (ptr: number, len: number) => number
}

let wasmPromise: Promise<SnippetWasmExports | null> | null = null
let wasmFailure: string | null = null
let wasmFailureAt = 0

const WASM_TIMEOUT_MS = 5000
const WASM_RETRY_MS = 1500

const hasWasmSupport = () => typeof WebAssembly !== "undefined" && typeof fetch !== "undefined"

const loadSnippetWasm = async (): Promise<SnippetWasmExports | null> => {
	if (!hasWasmSupport()) {
		wasmFailure = "WebAssembly runtime not available."
		wasmFailureAt = Date.now()
		return null
	}
	if (wasmPromise) return wasmPromise
	if (wasmFailure) {
		if (Date.now() - wasmFailureAt < WASM_RETRY_MS) {
			return null
		}
		wasmFailure = null
		wasmPromise = null
	}

	wasmPromise = withTimeout(
		(async () => {
			try {
				const wasmUrl = new URL("./snippet_wasm.wasm", import.meta.url)
				let bytes: ArrayBuffer

				if (wasmUrl.protocol === "file:") {
					if (typeof Bun !== "undefined") {
						bytes = await Bun.file(wasmUrl).arrayBuffer()
					} else {
						wasmFailure = "WASM file URL unavailable in this runtime."
						wasmFailureAt = Date.now()
						return null
					}
				} else {
					const response = await fetch(wasmUrl)
					if (!response.ok) {
						wasmFailure = "WASM file could not be fetched."
						wasmFailureAt = Date.now()
						return null
					}
					bytes = await response.arrayBuffer()
				}
				const { instance } = await WebAssembly.instantiate(bytes, {})
				const exports = instance.exports as Partial<SnippetWasmExports>
				if (
					!exports.memory ||
					!exports.alloc ||
					!exports.free ||
					!exports.scan_tailwind_candidates ||
					!exports.scan_security_issues ||
					!exports.scan_inspect_index ||
					!exports.scan_snippet_files ||
					!exports.hash_bytes
				) {
					wasmFailure = "Snippet WASM exports missing."
					wasmFailureAt = Date.now()
					return null
				}
				wasmFailure = null
				return exports as SnippetWasmExports
			} catch (err) {
				wasmFailure = err instanceof Error ? err.message : "Failed to load snippet WASM."
				wasmFailureAt = Date.now()
				return null
			}
		})(),
		WASM_TIMEOUT_MS,
		"Snippet WASM load timed out",
	)
		.then((exports) => {
			if (!exports) {
				wasmPromise = null
			}
			return exports
		})
		.catch((err) => {
			wasmFailure = err instanceof Error ? err.message : "Failed to load snippet WASM."
			wasmFailureAt = Date.now()
			wasmPromise = null
			return null
		})

	return wasmPromise
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const FILE_SCAN_MAGIC = 0x534e4950
const FILE_SCAN_VERSION = 1
const FILE_SCAN_FLAG_HAS_FILE_BLOCKS = 1
const FILE_SCAN_HEADER_SIZE = 8 * 4

const decodeSnippetFileScanPayload = (bytes: Uint8Array): SnippetFileScanResult => {
	if (bytes.byteLength < FILE_SCAN_HEADER_SIZE) {
		throw new Error("Snippet file scan payload is incomplete.")
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	let offset = 0
	const readU32 = () => {
		if (offset + 4 > view.byteLength) {
			throw new Error("Snippet file scan payload is truncated.")
		}
		const value = view.getUint32(offset, true)
		offset += 4
		return value
	}
	const readBytes = (length: number) => {
		if (offset + length > bytes.byteLength) {
			throw new Error("Snippet file scan payload is truncated.")
		}
		const slice = bytes.subarray(offset, offset + length)
		offset += length
		return slice
	}

	const magic = readU32()
	const version = readU32()
	if (magic !== FILE_SCAN_MAGIC || version !== FILE_SCAN_VERSION) {
		throw new Error("Snippet file scan payload is not supported.")
	}

	const flags = readU32()
	const mainLen = readU32()
	const fileCount = readU32()
	const expandedLen = readU32()
	const segmentCount = readU32()
	readU32()

	const mainSource = decoder.decode(readBytes(mainLen))

	const files: Record<string, string> = {}
	const fileOrder: string[] = []
	for (let index = 0; index < fileCount; index += 1) {
		const nameLen = readU32()
		const contentLen = readU32()
		const name = decoder.decode(readBytes(nameLen))
		const content = decoder.decode(readBytes(contentLen))
		fileOrder.push(name)
		files[name] = content
	}

	const expandedSource = decoder.decode(readBytes(expandedLen))

	const lineMapSegments: SnippetLineMapSegment[] = []
	for (let index = 0; index < segmentCount; index += 1) {
		const fileIndex = readU32()
		const expandedStartLine = readU32()
		const originalStartLine = readU32()
		const lineCount = readU32()
		const fileName = fileIndex === 0 ? null : (fileOrder[fileIndex - 1] ?? null)
		lineMapSegments.push({
			fileName,
			expandedStartLine,
			originalStartLine,
			lineCount,
		})
	}

	return {
		mainSource,
		files,
		hasFileBlocks: (flags & FILE_SCAN_FLAG_HAS_FILE_BLOCKS) === FILE_SCAN_FLAG_HAS_FILE_BLOCKS,
		expandedSource,
		lineMapSegments,
		fileOrder,
	}
}

export const scanSnippetFilesWasm = async (
	source: string,
): Promise<SnippetFileScanResult | null> => {
	const wasm = await loadSnippetWasm()
	if (!wasm) return null

	const input = encoder.encode(source)
	if (input.length === 0) return null

	const inputPtr = wasm.alloc(input.length)
	const outLenPtr = wasm.alloc(4)
	if (!inputPtr || !outLenPtr) {
		if (inputPtr) wasm.free(inputPtr, input.length)
		if (outLenPtr) wasm.free(outLenPtr, 4)
		return null
	}

	let outPtr = 0
	let outLen = 0
	try {
		const memoryU8 = new Uint8Array(wasm.memory.buffer)
		memoryU8.set(input, inputPtr)

		outPtr = wasm.scan_snippet_files(inputPtr, input.length, outLenPtr)
		const memoryAfter = new Uint8Array(wasm.memory.buffer)
		const outLenView = new DataView(memoryAfter.buffer)
		outLen = outLenView.getUint32(outLenPtr, true)

		if (!outPtr || outLen === 0) {
			return null
		}

		const output = memoryAfter.subarray(outPtr, outPtr + outLen)
		try {
			return decodeSnippetFileScanPayload(output)
		} catch {
			return null
		}
	} finally {
		wasm.free(inputPtr, input.length)
		wasm.free(outLenPtr, 4)
		if (outPtr && outLen) {
			wasm.free(outPtr, outLen)
		}
	}
}

export const warmSnippetWasm = async () => {
	await loadSnippetWasm()
}

export const getSnippetWasmStatus = async () => {
	const supported = hasWasmSupport()
	if (!supported) {
		return { supported: false, loaded: false, error: wasmFailure ?? "WASM not supported." }
	}
	const wasm = await loadSnippetWasm()
	return {
		supported: true,
		loaded: Boolean(wasm),
		error: wasm ? null : (wasmFailure ?? "Snippet WASM unavailable."),
	}
}

const unescapeMessage = (value: string) =>
	value.replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")

export const scanTailwindCandidatesWasm = async (
	source: string,
	options?: { expanded?: boolean },
): Promise<string[] | null> => {
	const wasm = await loadSnippetWasm()
	if (!wasm) return null

	const normalizedSource = options?.expanded ? source : expandSnippetSource(source)
	const input = encoder.encode(normalizedSource)
	if (input.length === 0) return []

	const inputPtr = wasm.alloc(input.length)
	const outLenPtr = wasm.alloc(4)
	if (!inputPtr || !outLenPtr) {
		if (inputPtr) wasm.free(inputPtr, input.length)
		if (outLenPtr) wasm.free(outLenPtr, 4)
		return null
	}

	let outPtr = 0
	let outLen = 0
	try {
		const memoryU8 = new Uint8Array(wasm.memory.buffer)
		memoryU8.set(input, inputPtr)

		outPtr = wasm.scan_tailwind_candidates(inputPtr, input.length, outLenPtr)
		const memoryAfter = new Uint8Array(wasm.memory.buffer)
		const outLenView = new DataView(memoryAfter.buffer)
		outLen = outLenView.getUint32(outLenPtr, true)

		if (!outPtr || outLen === 0) {
			return []
		}

		const output = memoryAfter.subarray(outPtr, outPtr + outLen)
		const decoded = decoder.decode(output)
		return decoded
			.split("\n")
			.map((entry) => entry.trim())
			.filter(Boolean)
	} finally {
		wasm.free(inputPtr, input.length)
		wasm.free(outLenPtr, 4)
		if (outPtr && outLen) {
			wasm.free(outPtr, outLen)
		}
	}
}

export const hashSourceWasm = async (source: string): Promise<number | null> => {
	const wasm = await loadSnippetWasm()
	if (!wasm) return null

	const input = encoder.encode(source)
	if (input.length === 0) return 0

	const inputPtr = wasm.alloc(input.length)
	if (!inputPtr) return null

	try {
		const memoryU8 = new Uint8Array(wasm.memory.buffer)
		memoryU8.set(input, inputPtr)
		return wasm.hash_bytes(inputPtr, input.length)
	} finally {
		wasm.free(inputPtr, input.length)
	}
}

export const scanSnippetSecurityIssuesWasm = async (
	source: string,
	options?: { expanded?: boolean },
): Promise<SourceSecurityIssue[] | null> => {
	const wasm = await loadSnippetWasm()
	if (!wasm) return null

	const normalizedSource = options?.expanded ? source : expandSnippetSource(source)
	const input = encoder.encode(normalizedSource)
	if (input.length === 0) return []

	const inputPtr = wasm.alloc(input.length)
	const outLenPtr = wasm.alloc(4)
	if (!inputPtr || !outLenPtr) {
		if (inputPtr) wasm.free(inputPtr, input.length)
		if (outLenPtr) wasm.free(outLenPtr, 4)
		return null
	}

	let outPtr = 0
	let outLen = 0
	try {
		const memoryU8 = new Uint8Array(wasm.memory.buffer)
		memoryU8.set(input, inputPtr)

		outPtr = wasm.scan_security_issues(inputPtr, input.length, outLenPtr)
		const memoryAfter = new Uint8Array(wasm.memory.buffer)
		const outLenView = new DataView(memoryAfter.buffer)
		outLen = outLenView.getUint32(outLenPtr, true)

		if (!outPtr || outLen === 0) {
			return []
		}

		const output = memoryAfter.subarray(outPtr, outPtr + outLen)
		const decoded = decoder.decode(output)
		const lines = decoded.split("\n").filter(Boolean)
		const issues: SourceSecurityIssue[] = []
		for (const line of lines) {
			if (!line.startsWith("S\t")) continue
			const parts = line.split("\t")
			if (parts.length < 6) continue
			const lineNumber = Number(parts[1])
			const column = Number(parts[2])
			const endLine = Number(parts[3])
			const endColumn = Number(parts[4])
			const message = unescapeMessage(parts.slice(5).join("\t"))
			if (!Number.isFinite(lineNumber) || !Number.isFinite(column)) continue
			issues.push({
				message,
				line: lineNumber,
				column,
				endLine: Number.isFinite(endLine) ? endLine : undefined,
				endColumn: Number.isFinite(endColumn) ? endColumn : undefined,
			})
		}
		return issues
	} finally {
		wasm.free(inputPtr, input.length)
		wasm.free(outLenPtr, 4)
		if (outPtr && outLen) {
			wasm.free(outPtr, outLen)
		}
	}
}

export const buildSnippetInspectIndexWasm = async (
	source: string,
	options?: { expanded?: boolean },
): Promise<SnippetInspectIndex | null> => {
	const wasm = await loadSnippetWasm()
	if (!wasm) return null

	const normalizedSource = options?.expanded ? source : expandSnippetSource(source)
	const input = encoder.encode(normalizedSource)
	if (input.length === 0) {
		return { version: 1, elements: [] }
	}

	const inputPtr = wasm.alloc(input.length)
	const outLenPtr = wasm.alloc(4)
	if (!inputPtr || !outLenPtr) {
		if (inputPtr) wasm.free(inputPtr, input.length)
		if (outLenPtr) wasm.free(outLenPtr, 4)
		return null
	}

	let outPtr = 0
	let outLen = 0
	try {
		const memoryU8 = new Uint8Array(wasm.memory.buffer)
		memoryU8.set(input, inputPtr)

		outPtr = wasm.scan_inspect_index(inputPtr, input.length, outLenPtr)
		const memoryAfter = new Uint8Array(wasm.memory.buffer)
		const outLenView = new DataView(memoryAfter.buffer)
		outLen = outLenView.getUint32(outLenPtr, true)

		if (!outPtr || outLen === 0) {
			return { version: 1, elements: [] }
		}

		const output = memoryAfter.subarray(outPtr, outPtr + outLen)
		const decoded = decoder.decode(output)
		const lines = decoded.split("\n").filter(Boolean)
		const elements: SnippetInspectIndex["elements"] = []
		const normalizeEndColumn = (value: number) => (Number.isFinite(value) ? value + 1 : value)
		let idx = 0
		while (idx < lines.length) {
			const line = lines[idx]
			if (!line.startsWith("E\t")) {
				idx += 1
				continue
			}
			const parts = line.split("\t")
			if (parts.length < 8) {
				idx += 1
				continue
			}
			const startLine = Number(parts[1])
			const startColumn = Number(parts[2])
			const endLine = Number(parts[3])
			const endColumn = Number(parts[4])
			const normalizedEndColumn = normalizeEndColumn(endColumn)
			const elementType = parts[5] === "fragment" ? "fragment" : "element"
			const elementName = elementType === "fragment" || !parts[6] ? null : (parts[6] as string)
			const rangeCount = Number(parts[7] ?? 0)
			const textRanges: SnippetInspectIndex["elements"][number]["textRanges"] = []
			for (let j = 0; j < rangeCount; j += 1) {
				const rangeLine = lines[idx + 1 + j]
				if (!rangeLine || !rangeLine.startsWith("T\t")) continue
				const rangeParts = rangeLine.split("\t")
				if (rangeParts.length < 5) continue
				const rStartLine = Number(rangeParts[1])
				const rStartColumn = Number(rangeParts[2])
				const rEndLine = Number(rangeParts[3])
				const rEndColumn = Number(rangeParts[4])
				const normalizedRangeEndColumn = normalizeEndColumn(rEndColumn)
				if (
					Number.isFinite(rStartLine) &&
					Number.isFinite(rStartColumn) &&
					Number.isFinite(rEndLine) &&
					Number.isFinite(normalizedRangeEndColumn)
				) {
					textRanges.push({
						startLine: rStartLine,
						startColumn: rStartColumn,
						endLine: rEndLine,
						endColumn: normalizedRangeEndColumn,
					})
				}
			}
			if (
				Number.isFinite(startLine) &&
				Number.isFinite(startColumn) &&
				Number.isFinite(endLine) &&
				Number.isFinite(normalizedEndColumn)
			) {
				elements.push({
					elementRange: { startLine, startColumn, endLine, endColumn: normalizedEndColumn },
					textRanges,
					elementType,
					elementName,
				})
			}
			const safeCount = Number.isFinite(rangeCount) ? Math.max(0, rangeCount) : 0
			idx += 1 + safeCount
		}

		return { version: 1, elements }
	} finally {
		wasm.free(inputPtr, input.length)
		wasm.free(outLenPtr, 4)
		if (outPtr && outLen) {
			wasm.free(outPtr, outLen)
		}
	}
}
