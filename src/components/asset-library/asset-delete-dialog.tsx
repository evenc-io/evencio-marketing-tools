import { Info } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import type { Asset } from "@/types/asset-library"

interface AssetDeleteDialogProps {
	asset: Asset | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onDelete: () => Promise<void>
}

const typeLabels = {
	image: "Image",
	svg: "SVG",
	snippet: "Snippet",
} as const

const scopeLabels: Record<string, string> = {
	global: "Global",
	org: "Organization",
	event: "Event",
	personal: "Personal",
}

export function AssetDeleteDialog({ asset, open, onOpenChange, onDelete }: AssetDeleteDialogProps) {
	const [step, setStep] = useState<"warning" | "confirm">("warning")
	const [isDeleting, setIsDeleting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleDelete = async () => {
		if (!asset) return

		if (step === "warning") {
			setStep("confirm")
			return
		}

		setIsDeleting(true)
		setError(null)
		try {
			await onDelete()
			setStep("warning")
			onOpenChange(false)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete asset")
		} finally {
			setIsDeleting(false)
		}
	}

	const handleClose = () => {
		setStep("warning")
		setError(null)
		onOpenChange(false)
	}

	if (!asset) return null

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{step === "warning" ? "Delete asset?" : "Confirm deletion"}</DialogTitle>
					<DialogDescription>
						{step === "warning" ? (
							<>
								This will permanently delete <strong>"{asset.metadata.title}"</strong>.
							</>
						) : (
							<span className="text-red-600">
								This cannot be undone. The asset, file, versions, and favorites will be permanently
								removed.
							</span>
						)}
					</DialogDescription>
				</DialogHeader>

				{step === "warning" && (
					<div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
						<div className="grid grid-cols-2 gap-2">
							<span className="text-neutral-600">Type:</span>
							<span className="font-medium text-neutral-900">{typeLabels[asset.type]}</span>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-neutral-600">Scope:</span>
							<span className="font-medium text-neutral-900">
								{scopeLabels[asset.scope.scope] ?? asset.scope.scope}
							</span>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-neutral-600">Version:</span>
							<span className="font-medium text-neutral-900">v{asset.version}</span>
						</div>
					</div>
				)}

				{error && (
					<div
						className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
						role="alert"
					>
						<Info className="h-4 w-4 flex-shrink-0" />
						<p>{error}</p>
					</div>
				)}

				<DialogFooter>
					<Button type="button" variant="outline" onClick={handleClose} disabled={isDeleting}>
						Cancel
					</Button>
					<Button
						type="button"
						variant={step === "confirm" ? "destructive" : "default"}
						onClick={handleDelete}
						disabled={isDeleting}
					>
						{isDeleting
							? "Deleting..."
							: step === "warning"
								? "Yes, proceed"
								: "Yes, permanently delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default AssetDeleteDialog
