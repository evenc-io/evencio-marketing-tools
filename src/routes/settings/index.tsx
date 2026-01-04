import { createFileRoute, Link } from "@tanstack/react-router"
import { Database, ExternalLink, Puzzle } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
	formatBytes,
	getDb,
	getStorageEstimate,
	isIndexedDBAvailable,
	type StorageEstimate,
} from "@/lib/storage"

export const Route = createFileRoute("/settings/")({
	component: SettingsOverviewPage,
})

function SettingsOverviewPage() {
	const [storage, setStorage] = useState<StorageEstimate | null>(null)
	const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "unavailable">("loading")
	const [isStorageAvailable, setIsStorageAvailable] = useState(true)

	useEffect(() => {
		let isActive = true
		const available = isIndexedDBAvailable()
		setIsStorageAvailable(available)

		async function loadStorage() {
			try {
				if (!available) {
					if (!isActive) return
					setStorageStatus("unavailable")
					return
				}

				const db = await getDb()
				const [estimate, projectsCount, assetsCount, draftCount] = await Promise.all([
					getStorageEstimate(),
					db.count("projects"),
					db.count("assets"),
					db.count("snippetDrafts"),
				])
				let resolvedEstimate = estimate
				let status: "ready" | "unavailable" = estimate ? "ready" : "unavailable"

				if (
					estimate &&
					estimate.used === 0 &&
					(projectsCount > 0 || assetsCount > 0 || draftCount > 0)
				) {
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
			} catch {
				if (!isActive) return
				setStorageStatus("unavailable")
			}
		}
		loadStorage()
		return () => {
			isActive = false
		}
	}, [])

	const usagePercent =
		storage && storage.quota > 0 ? Math.round((storage.used / storage.quota) * 100) : 0

	return (
		<div className="p-4 md:p-8">
			{/* Header */}
			<div className="mb-6 md:mb-8">
				<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">Settings</h1>
				<p className="mt-2 text-neutral-500">Manage your preferences and local data</p>
			</div>

			{/* Content */}
			<div className="space-y-6">
				{/* Storage Summary Card */}
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Database className="h-5 w-5" />
							Storage
						</CardTitle>
						<CardDescription>
							{isStorageAvailable
								? "Local storage usage for your snippets, assets, and drafts"
								: "IndexedDB is not available in this browser"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{!isStorageAvailable ? (
							<p className="text-sm text-red-600">
								Storage is unavailable in this browser session. Check privacy settings or storage
								permissions.
							</p>
						) : storageStatus === "loading" ? (
							<p className="text-sm text-neutral-500">Loading storage information...</p>
						) : (
							<div className="space-y-4">
								{storageStatus === "ready" && storage ? (
									<div>
										<div className="mb-2 flex justify-between text-sm">
											<span className="text-neutral-600">
												{formatBytes(storage.used)} of {formatBytes(storage.quota)} used
											</span>
											<span className="text-neutral-500">{usagePercent}%</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-neutral-100">
											<div
												className="h-full rounded-full bg-neutral-900 transition-all duration-300"
												style={{ width: `${Math.min(usagePercent, 100)}%` }}
											/>
										</div>
									</div>
								) : (
									<p className="text-sm text-neutral-500">
										Storage estimate is unavailable in this browser.
									</p>
								)}

								<Button variant="outline" size="sm" asChild>
									<Link to="/settings/storage">
										Manage Storage
										<ExternalLink className="ml-2 h-3 w-3" />
									</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Quick Links */}
				<div className="grid gap-4 md:grid-cols-2">
					{/* Integrations Card */}
					<Card className="shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Puzzle className="h-5 w-5" />
								Integrations
							</CardTitle>
							<CardDescription>Connect external services and APIs</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" size="sm" asChild>
								<Link to="/settings/integrations">
									View Integrations
									<ExternalLink className="ml-2 h-3 w-3" />
								</Link>
							</Button>
						</CardContent>
					</Card>

					{/* Storage Card */}
					<Card className="shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Local Data
							</CardTitle>
							<CardDescription>Manage your locally stored snippets and assets</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" size="sm" asChild>
								<Link to="/settings/storage">
									Manage Data
									<ExternalLink className="ml-2 h-3 w-3" />
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>

				{/* Version Info */}
				<div className="text-center text-sm text-neutral-400">Evencio Studio &middot; v0.1.0</div>
			</div>
		</div>
	)
}
