import { useCallback, useEffect, useRef, useState } from "react"
import { analyzeSnippetInEngine } from "@/lib/engine/client"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import type { SnippetInspectIndex } from "@/lib/snippets/inspect-index"
import { parseSnippetFiles } from "@/lib/snippets/source/files"
import { toComponentFileId } from "@/routes/-snippets/editor/snippet-file-utils"

interface UseSnippetAnalysisOptions {
	source: string
	includeTailwind?: boolean
	includeInspect?: boolean
	debounceMs?: number
	key?: string
}

interface UseSnippetAnalysisResult {
	analysis: AnalyzeTsxResponse | null
	resetAnalysis: () => void
	status: "idle" | "loading" | "ready" | "error"
	error: string | null
}

const mapInspectIndexes = (source: string, analysis: AnalyzeTsxResponse): AnalyzeTsxResponse => {
	if (!analysis.inspectIndexByFile) return analysis
	const parsed = parseSnippetFiles(source)
	const indexByFileId: Record<string, SnippetInspectIndex | null> = {
		source: analysis.inspectIndexByFile.source ?? null,
	}

	for (const fileName of Object.keys(parsed.files)) {
		const fileId = toComponentFileId(fileName)
		indexByFileId[fileId] = analysis.inspectIndexByFile[fileName] ?? null
	}

	return {
		...analysis,
		inspectIndexByFileId: indexByFileId,
	}
}

export const useSnippetAnalysis = ({
	source,
	includeTailwind = true,
	includeInspect = true,
	debounceMs = 500,
	key = "snippet-analyze",
}: UseSnippetAnalysisOptions): UseSnippetAnalysisResult => {
	const [analysis, setAnalysis] = useState<AnalyzeTsxResponse | null>(null)
	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
	const [error, setError] = useState<string | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const versionRef = useRef(0)
	const isMountedRef = useRef(true)
	const runImmediatelyRef = useRef(false)
	const [resetToken, setResetToken] = useState(0)

	const resetAnalysis = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = null
		}
		versionRef.current += 1
		runImmediatelyRef.current = true
		setAnalysis(null)
		setStatus("idle")
		setError(null)
		setResetToken((prev) => prev + 1)
	}, [])

	// React StrictMode mounts, unmounts, then remounts; re-arm to avoid stale false.
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	useEffect(() => {
		void resetToken
		if (timerRef.current) {
			clearTimeout(timerRef.current)
		}

		const nextSource = source ?? ""
		if (!nextSource.trim()) {
			setAnalysis(null)
			setStatus("idle")
			setError(null)
			return
		}

		setStatus("loading")
		setError(null)
		const currentVersion = ++versionRef.current

		const delayMs =
			runImmediatelyRef.current || debounceMs <= 0 ? 0 : Math.max(0, Math.floor(debounceMs))
		runImmediatelyRef.current = false

		timerRef.current = setTimeout(() => {
			void (async () => {
				try {
					const { data, stale } = await analyzeSnippetInEngine(nextSource, {
						includeTailwind,
						includeInspect,
						key,
					})
					if (currentVersion !== versionRef.current || !isMountedRef.current) return
					if (stale) return
					const mapped = mapInspectIndexes(nextSource, data)
					if (!isMountedRef.current) return
					setAnalysis(mapped)
					setStatus("ready")
					setError(null)
				} catch (err) {
					if (currentVersion !== versionRef.current || !isMountedRef.current) return
					setStatus("error")
					setAnalysis(null)
					setError(err instanceof Error ? err.message : "Snippet analysis failed")
				}
			})()
		}, delayMs)

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
			}
		}
	}, [debounceMs, includeInspect, includeTailwind, key, resetToken, source])

	return { analysis, resetAnalysis, status, error }
}
