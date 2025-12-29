import { useEffect, useMemo, useState } from "react"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import { cn } from "@/lib/utils"
import { getSnippetWasmStatus } from "@/lib/wasm/snippet-wasm"
import { CollapsibleSection } from "@/routes/-snippets/new/components/collapsible-section"

type LogStatus = "ok" | "warn" | "blocked" | "skip" | "loading"

type LogEntry = {
	label: string
	status: LogStatus
	detail?: string
}

interface SnippetSettingsPanelProps {
	open: boolean
	analysis: AnalyzeTsxResponse | null
	analysisStatus: "idle" | "loading" | "ready" | "error"
	analysisError: string | null
	includeTailwind: boolean
	includeInspect: boolean
}

type WasmStatus = {
	supported: boolean
	loaded: boolean
	error: string | null
	loading: boolean
}

const statusLabel: Record<LogStatus, string> = {
	ok: "OK",
	warn: "WARN",
	blocked: "BLOCKED",
	skip: "SKIP",
	loading: "LOADING",
}

const statusClasses: Record<LogStatus, string> = {
	ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
	warn: "border-amber-200 bg-amber-50 text-amber-700",
	blocked: "border-red-200 bg-red-50 text-red-700",
	skip: "border-neutral-200 bg-neutral-100 text-neutral-500",
	loading: "border-neutral-200 bg-neutral-100 text-neutral-500",
}

export function SnippetSettingsPanel({
	open,
	analysis,
	analysisStatus,
	analysisError,
	includeTailwind,
	includeInspect,
}: SnippetSettingsPanelProps) {
	const [wasmStatus, setWasmStatus] = useState<WasmStatus>({
		supported: false,
		loaded: false,
		error: null,
		loading: false,
	})

	useEffect(() => {
		if (!open) return
		let cancelled = false
		setWasmStatus((prev) => ({ ...prev, loading: true }))
		void (async () => {
			const status = await getSnippetWasmStatus()
			if (cancelled) return
			setWasmStatus({
				supported: status.supported,
				loaded: status.loaded,
				error: status.error,
				loading: false,
			})
		})()
		return () => {
			cancelled = true
		}
	}, [open])

	const { capabilityLogs, activityLogs } = useMemo(() => {
		const capabilities: LogEntry[] = []
		const activity: LogEntry[] = []
		const wasmLoading = wasmStatus.loading && open
		const wasmLoaded = wasmStatus.loaded
		const wasmSupported = wasmStatus.supported
		const wasmLabel = wasmLoading ? "Loading WASM module…" : "WASM module"

		capabilities.push({
			label: "WASM runtime",
			status: wasmLoading ? "loading" : wasmSupported ? "ok" : "blocked",
			detail: wasmSupported ? undefined : "Missing runtime.",
		})

		capabilities.push({
			label: wasmLabel,
			status: wasmLoading ? "loading" : wasmLoaded ? "ok" : "blocked",
			detail: wasmLoaded ? undefined : (wasmStatus.error ?? "WASM unavailable."),
		})

		capabilities.push({
			label: "Header scans (WASM accel)",
			status: wasmLoading ? "loading" : wasmLoaded ? "ok" : "warn",
			detail: wasmLoading
				? "Checking WASM module."
				: wasmLoaded
					? "Fast path active."
					: "JS fallback active.",
		})

		capabilities.push({
			label: "Tailwind scan (WASM-only)",
			status: !includeTailwind ? "skip" : wasmLoading ? "loading" : wasmLoaded ? "ok" : "blocked",
			detail: !includeTailwind ? "Preview hidden." : wasmLoaded ? undefined : "WASM required.",
		})

		capabilities.push({
			label: "Security scan (WASM-only)",
			status: wasmLoading ? "loading" : wasmLoaded ? "ok" : "blocked",
			detail: wasmLoaded ? undefined : "WASM required.",
		})

		capabilities.push({
			label: "Inspect index (WASM-only)",
			status: !includeInspect ? "skip" : wasmLoading ? "loading" : wasmLoaded ? "ok" : "blocked",
			detail: !includeInspect ? "Inspect disabled." : wasmLoaded ? undefined : "WASM required.",
		})

		if (analysisStatus === "error") {
			activity.push({
				label: "Analysis pipeline",
				status: "blocked",
				detail: analysisError ?? "Analysis failed.",
			})
		} else {
			const isIdle = analysisStatus === "idle"
			activity.push({
				label: "Analysis pipeline",
				status: isIdle ? "skip" : analysisStatus === "loading" ? "loading" : "ok",
				detail: isIdle ? "Waiting for source." : undefined,
			})
		}

		const tailwindError = analysis?.tailwindError ?? null
		if (tailwindError) {
			activity.push({
				label: "Tailwind output",
				status: "warn",
				detail: tailwindError,
			})
		}

		return { capabilityLogs: capabilities, activityLogs: activity }
	}, [analysis, analysisError, analysisStatus, includeInspect, includeTailwind, open, wasmStatus])

	return (
		<aside
			className={cn(
				"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
				open ? "w-[19rem] border-r border-neutral-200" : "w-0 border-r-0",
			)}
		>
			<div
				className={cn(
					"flex h-full w-[19rem] flex-col transition-opacity duration-200",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				aria-hidden={!open}
			>
				{open && (
					<>
						<div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
							Settings
						</div>
						<div className="flex-1 overflow-y-auto">
							<CollapsibleSection title="Developer" defaultOpen={false}>
								<div className="flex items-center justify-between">
									<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
										Capabilities
									</p>
								</div>
								<div className="mt-3 space-y-2">
									{capabilityLogs.map((entry) => (
										<div
											key={entry.label}
											className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 px-2 py-2 text-xs"
										>
											<div>
												<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-700">
													{entry.label}
												</p>
												{entry.detail && (
													<p className="mt-1 text-[10px] text-neutral-500">{entry.detail}</p>
												)}
											</div>
											<span
												className={cn(
													"mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
													statusClasses[entry.status],
												)}
											>
												{statusLabel[entry.status]}
											</span>
										</div>
									))}
								</div>
								<div className="mt-4 flex items-center justify-between">
									<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
										Activity
									</p>
								</div>
								<div className="mt-3 space-y-2">
									{activityLogs.map((entry) => (
										<div
											key={entry.label}
											className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 px-2 py-2 text-xs"
										>
											<div>
												<p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-700">
													{entry.label}
												</p>
												{entry.detail && (
													<p className="mt-1 text-[10px] text-neutral-500">{entry.detail}</p>
												)}
											</div>
											<span
												className={cn(
													"mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
													statusClasses[entry.status],
												)}
											>
												{statusLabel[entry.status]}
											</span>
										</div>
									))}
								</div>
							</CollapsibleSection>
						</div>
					</>
				)}
			</div>
		</aside>
	)
}
