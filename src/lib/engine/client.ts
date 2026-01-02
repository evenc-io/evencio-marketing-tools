import type {
	AnalyzeTsxResponse,
	CompileSnippetResponse,
	EngineRequest,
	EngineResponse,
	LayoutTranslateRequest,
	LayoutTranslateResponse,
} from "@/lib/engine/protocol"
import { analyzeSnippetTsx } from "@/lib/snippets/analyze-tsx"
import { compileSnippet } from "@/lib/snippets/compiler"
import { applySnippetTranslate } from "@/lib/snippets/source-layout"

const isBrowser = typeof window !== "undefined" || typeof self !== "undefined"
const hasWorker = typeof Worker !== "undefined"
const allowWorker = !import.meta.env?.DEV

type PendingRequest = {
	resolve: (value: EngineResponse) => void
	reject: (reason?: unknown) => void
}

const isEngineError = (error: unknown): boolean =>
	Boolean(error && typeof error === "object" && "engineError" in error)

const toEngineError = (payload: { error: string; stack?: string }): Error => {
	const err = new Error(payload.error)
	err.name = "EngineError"
	if (payload.stack) {
		err.stack = payload.stack
	}
	;(err as Error & { engineError?: boolean }).engineError = true
	return err
}

let workerPromise: Promise<Worker> | null = null
let workerInstance: Worker | null = null
let workerUnhealthy = false
const pending = new Map<string, PendingRequest>()
let requestCounter = 0

const WORKER_TIMEOUT_MS = 2000

const keyVersions = new Map<string, number>()

const nextVersion = (key: string) => {
	const next = (keyVersions.get(key) ?? 0) + 1
	keyVersions.set(key, next)
	return next
}

const isStale = (key: string, version: number) => (keyVersions.get(key) ?? 0) !== version

const rejectPending = (reason: unknown) => {
	for (const handler of pending.values()) {
		handler.reject(reason)
	}
	pending.clear()
}

const resetWorker = () => {
	if (workerInstance) {
		workerInstance.terminate()
		workerInstance = null
	}
	workerPromise = null
}

const markWorkerUnhealthy = (reason?: unknown) => {
	workerUnhealthy = true
	rejectPending(reason ?? new Error("Engine worker is unavailable"))
	resetWorker()
}

const getWorker = async () => {
	if (!isBrowser || !hasWorker) {
		throw new Error("Worker is not available in this environment")
	}

	if (!workerPromise) {
		workerPromise = Promise.resolve()
			.then(() => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }))
			.then((worker) => {
				workerInstance = worker
				worker.onmessage = (event: MessageEvent<EngineResponse>) => {
					const data = event.data
					if (!data || typeof data.id !== "string") return
					const handler = pending.get(data.id)
					if (!handler) return
					pending.delete(data.id)
					if (data.type === "error") {
						handler.reject(toEngineError(data))
						return
					}
					handler.resolve(data)
				}
				worker.onmessageerror = (event) => {
					markWorkerUnhealthy(event)
				}
				worker.onerror = (event) => {
					markWorkerUnhealthy(event)
				}
				return worker
			})
			.catch((err) => {
				markWorkerUnhealthy(err)
				throw err
			})
	}

	return workerPromise
}

const requestWorker = async <T extends EngineResponse>(payload: EngineRequest): Promise<T> => {
	const worker = await getWorker()
	return new Promise<T>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			const timeoutError = new Error("Engine worker timed out")
			pending.delete(payload.id)
			reject(timeoutError)
			markWorkerUnhealthy(timeoutError)
		}, WORKER_TIMEOUT_MS)

		pending.set(payload.id, {
			resolve: ((value) => {
				clearTimeout(timeoutId)
				resolve(value as T)
			}) as PendingRequest["resolve"],
			reject: (reason) => {
				clearTimeout(timeoutId)
				reject(reason)
			},
		})
		try {
			worker.postMessage(payload)
		} catch (err) {
			pending.delete(payload.id)
			clearTimeout(timeoutId)
			markWorkerUnhealthy(err)
			reject(err)
		}
	})
}

const runInProcess = async <T extends EngineResponse>(payload: EngineRequest): Promise<T> => {
	if (payload.type === "analyze") {
		const result = await analyzeSnippetTsx(payload.payload)
		return { id: payload.id, type: "analyze", payload: result } as T
	}
	if (payload.type === "layout-translate") {
		const result = await applySnippetTranslate(payload.payload)
		return { id: payload.id, type: "layout-translate", payload: result } as T
	}
	const result = await compileSnippet(payload.payload.source, payload.payload.entryExport)
	return { id: payload.id, type: "compile", payload: result } as T
}

const requestEngine = async <T extends EngineResponse>(payload: EngineRequest): Promise<T> => {
	if (isBrowser && hasWorker && allowWorker && !workerUnhealthy) {
		try {
			return await requestWorker<T>(payload)
		} catch (err) {
			if (isEngineError(err)) {
				throw err
			}
			markWorkerUnhealthy(err)
			return runInProcess<T>(payload)
		}
	}
	return runInProcess<T>(payload)
}

export const analyzeSnippetInEngine = async (
	source: string,
	options?: { includeTailwind?: boolean; includeInspect?: boolean; key?: string },
): Promise<{ data: AnalyzeTsxResponse; stale: boolean }> => {
	const key = options?.key ?? "snippet-analyze"
	const version = nextVersion(key)
	const id = `analyze-${++requestCounter}`
	const payload: EngineRequest = {
		id,
		type: "analyze",
		payload: {
			source,
			includeTailwind: options?.includeTailwind ?? true,
			includeInspect: options?.includeInspect ?? true,
		},
	}

	const response = await requestEngine<EngineResponse>(payload)
	if (response.type !== "analyze") {
		throw new Error("Engine returned unexpected response")
	}

	return {
		data: response.payload,
		stale: isStale(key, version),
	}
}

export const compileSnippetInEngine = async (
	source: string,
	options?: { entryExport?: string; key?: string },
): Promise<{ data: CompileSnippetResponse; stale: boolean }> => {
	const key = options?.key ?? "snippet-compile"
	const version = nextVersion(key)
	const id = `compile-${++requestCounter}`
	const payload: EngineRequest = {
		id,
		type: "compile",
		payload: {
			source,
			entryExport: options?.entryExport,
		},
	}

	const response = await requestEngine<EngineResponse>(payload)
	if (response.type !== "compile") {
		throw new Error("Engine returned unexpected response")
	}

	return {
		data: response.payload,
		stale: isStale(key, version),
	}
}

export const applySnippetLayoutInEngine = async (
	payload: LayoutTranslateRequest,
): Promise<LayoutTranslateResponse> => {
	const id = `layout-translate-${++requestCounter}`
	const response = await requestEngine<EngineResponse>({
		id,
		type: "layout-translate",
		payload,
	})
	if (response.type !== "layout-translate") {
		throw new Error("Engine returned unexpected response")
	}
	return response.payload
}
