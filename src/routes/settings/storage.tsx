import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Database, HardDrive, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	clearAllData,
	formatBytes,
	getStorageEstimate,
	isIndexedDBAvailable,
	isPrivateBrowsing,
	listProjects,
	type StorageEstimate,
} from "@/lib/storage"
import { useProjectsStore } from "@/stores/projects-store"

export const Route = createFileRoute("/settings/storage")({
	component: StoragePage,
})

const CONFIRM_TEXT = "DELETE"

function StoragePage() {
	const navigate = useNavigate()

	const [storage, setStorage] = useState<StorageEstimate | null>(null)
	const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "unavailable">("loading")
	const [projectCount, setProjectCount] = useState<number>(0)
	const [isStorageAvailable, setIsStorageAvailable] = useState(true)
	const [isPersistenceLimited, setIsPersistenceLimited] = useState(false)
	const [confirmInput, setConfirmInput] = useState("")
	const [isClearing, setIsClearing] = useState(false)
	const [clearError, setClearError] = useState<string | null>(null)

	const loadProjects = useProjectsStore((s) => s.loadProjects)

	useEffect(() => {
		let isActive = true
		const available = isIndexedDBAvailable()
		setIsStorageAvailable(available)

		async function loadData() {
			if (!available) return

			try {
				const [estimate, projects, privateBrowsing] = await Promise.all([
					getStorageEstimate(),
					listProjects(),
					isPrivateBrowsing(),
				])

				let resolvedEstimate = estimate
				let status: "ready" | "unavailable" = estimate ? "ready" : "unavailable"

				if (estimate && estimate.used === 0 && projects.length > 0) {
					await new Promise((resolve) => setTimeout(resolve, 150))
					const retryEstimate = await getStorageEstimate()
					if (retryEstimate && retryEstimate.used > 0) {
						resolvedEstimate = retryEstimate
						status = "ready"
					} else {
						resolvedEstimate = null
						status = "unavailable"
					}
				}

				if (!isActive) return
				setStorage(resolvedEstimate)
				setStorageStatus(status)
				setProjectCount(projects.length)
				setIsPersistenceLimited(privateBrowsing)
			} catch {
				if (!isActive) return
				setIsStorageAvailable(false)
				setStorageStatus("unavailable")
				setProjectCount(0)
				setIsPersistenceLimited(false)
			}
		}

		loadData()
		return () => {
			isActive = false
		}
	}, [])

	const usagePercent =
		storage && storage.quota > 0 ? Math.round((storage.used / storage.quota) * 100) : 0
	const canClear = confirmInput === CONFIRM_TEXT && !isClearing

	const handleClearData = async () => {
		if (!canClear) return

		setIsClearing(true)
		setClearError(null)

		try {
			await clearAllData()
			// Reload from the now-empty database to clear in-memory state
			await loadProjects()
			// Navigate to dashboard
			navigate({ to: "/" })
		} catch (err) {
			setClearError(err instanceof Error ? err.message : "Failed to clear data")
			setIsClearing(false)
		}
	}

	return (
		<div className="p-4 md:p-8">
			{/* Header */}
			<div className="mb-6 md:mb-8">
				<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">Storage</h1>
				<p className="mt-2 text-neutral-500">Manage your locally stored data</p>
			</div>

			{/* Content */}
			<div className="space-y-6">
				{/* Storage Unavailable Warning */}
				{!isStorageAvailable && (
					<div className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
						<AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
						<div>
							<p className="font-medium text-red-900">Storage Unavailable</p>
							<p className="mt-1 text-sm text-red-700">
								IndexedDB is not available in this browser session. This can happen if storage is
								blocked by browser settings or in private browsing. Your projects cannot be saved.
							</p>
						</div>
					</div>
				)}

				{/* Persistence Warning */}
				{isStorageAvailable && isPersistenceLimited && (
					<div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
						<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
						<div>
							<p className="font-medium text-amber-900">Storage Persistence Not Guaranteed</p>
							<p className="mt-1 text-sm text-amber-700">
								This browser hasn’t granted persistent storage for this site. Your data could be
								cleared if the browser needs space or after certain privacy actions.
							</p>
						</div>
					</div>
				)}

				{/* Storage Info Card */}
				{isStorageAvailable && (
					<Card className="shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HardDrive className="h-5 w-5" />
								Storage Usage
							</CardTitle>
							<CardDescription>How much local storage is being used</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{storageStatus === "loading" && (
								<p className="text-sm text-neutral-500">Loading storage information...</p>
							)}

							{storageStatus === "ready" && storage && (
								<div>
									{/* Usage bar */}
									<div>
										<div className="mb-2 flex justify-between text-sm">
											<span className="text-neutral-600">
												{formatBytes(storage.used)} of {formatBytes(storage.quota)} used
											</span>
											<span className="text-neutral-500">{usagePercent}%</span>
										</div>
										<div className="h-3 overflow-hidden rounded-full bg-neutral-100">
											<div
												className="h-full rounded-full bg-neutral-900 transition-all duration-300"
												style={{ width: `${Math.min(usagePercent, 100)}%` }}
											/>
										</div>
									</div>
								</div>
							)}

							{storageStatus === "unavailable" && (
								<p className="text-sm text-neutral-500">
									Storage estimate is unavailable in this browser.
								</p>
							)}

							{/* Stats */}
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg border border-neutral-200 p-4">
									<p className="text-2xl font-semibold text-neutral-900">{projectCount}</p>
									<p className="text-sm text-neutral-500">
										{projectCount === 1 ? "Project" : "Projects"}
									</p>
								</div>
								<div className="rounded-lg border border-neutral-200 p-4">
									<p className="text-2xl font-semibold text-neutral-900">
										{storage ? formatBytes(storage.used) : "—"}
									</p>
									<p className="text-sm text-neutral-500">
										{storage ? "Total Size" : "Total Size (estimate unavailable)"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Danger Zone */}
				{isStorageAvailable && (
					<Card className="border-red-200 shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-red-600">
								<Database className="h-5 w-5" />
								Danger Zone
							</CardTitle>
							<CardDescription>Irreversible actions that affect your data</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border border-red-200 bg-red-50 p-4">
								<div className="flex items-start gap-3">
									<Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
									<div className="flex-1 space-y-4">
										<div>
											<p className="font-medium text-red-900">Clear All Data</p>
											<p className="mt-1 text-sm text-red-700">
												This will permanently delete all your projects, assets, and settings. This
												action cannot be undone.
											</p>
										</div>

										{/* Confirmation Input */}
										<div className="space-y-2">
											<Label htmlFor="confirm-delete" className="text-red-900">
												Type <span className="font-mono font-semibold">{CONFIRM_TEXT}</span> to
												confirm
											</Label>
											<Input
												id="confirm-delete"
												type="text"
												value={confirmInput}
												onChange={(e) => setConfirmInput(e.target.value)}
												placeholder={CONFIRM_TEXT}
												className="max-w-xs border-red-200 bg-white focus-visible:border-red-400 focus-visible:ring-red-200"
												disabled={isClearing}
											/>
										</div>

										{/* Error Message */}
										{clearError && <p className="text-sm font-medium text-red-600">{clearError}</p>}

										{/* Clear Button */}
										<Button
											variant="destructive"
											onClick={handleClearData}
											disabled={!canClear}
											className="gap-2"
										>
											{isClearing ? (
												<span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
											{isClearing ? "Clearing..." : "Clear All Data"}
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	)
}
