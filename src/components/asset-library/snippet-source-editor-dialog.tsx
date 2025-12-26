import { AlertCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { MonacoEditor } from "@/components/ui/monaco-editor"
import type { SnippetAsset } from "@/types/asset-library"

interface SnippetSyntaxValidationResult {
	valid: boolean
	error?: string
}

function validateSnippetSyntax(source: string): SnippetSyntaxValidationResult {
	const trimmed = source.trim()
	if (!trimmed) {
		return { valid: false, error: "Source code is required" }
	}

	const hasDefaultExport =
		/export\s+default\s+function/.test(trimmed) || /export\s+default\s+/.test(trimmed)

	if (!hasDefaultExport) {
		return {
			valid: false,
			error: "Snippet must have a default export (e.g., 'export default function MySnippet')",
		}
	}

	// Basic bracket matching
	const brackets: Record<string, string> = { "(": ")", "[": "]", "{": "}" }
	const stack: string[] = []
	for (const char of trimmed) {
		if (char in brackets) {
			stack.push(brackets[char])
		} else if (Object.values(brackets).includes(char)) {
			if (stack.pop() !== char) {
				return { valid: false, error: "Unbalanced brackets in source code" }
			}
		}
	}
	if (stack.length > 0) {
		return { valid: false, error: "Unbalanced brackets in source code" }
	}

	return { valid: true }
}

interface SnippetSourceEditorDialogProps {
	asset: SnippetAsset | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (source: string) => Promise<void>
}

export function SnippetSourceEditorDialog({
	asset,
	open,
	onOpenChange,
	onSave,
}: SnippetSourceEditorDialogProps) {
	const [source, setSource] = useState(asset?.snippet.source ?? "")
	const [isSaving, setIsSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	// Reset source when dialog opens with new asset
	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen && asset) {
			setSource(asset.snippet.source ?? "")
			setSaveError(null)
		}
		onOpenChange(nextOpen)
	}

	const validation = validateSnippetSyntax(source)

	const handleSave = async () => {
		if (!validation.valid) return

		setIsSaving(true)
		setSaveError(null)
		try {
			await onSave(source)
			onOpenChange(false)
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to save changes")
		} finally {
			setIsSaving(false)
		}
	}

	if (!asset) return null

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
				<DialogHeader>
					<DialogTitle>Edit Snippet Source</DialogTitle>
					<DialogDescription>
						Modify the JSX/TSX source code for "{asset.metadata.title}"
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1">
					<MonacoEditor value={source} onChange={setSource} language="typescript" height={400} />
				</div>

				{!validation.valid && validation.error && (
					<div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{validation.error}</span>
					</div>
				)}

				{saveError && (
					<div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
						<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{saveError}</span>
					</div>
				)}

				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="button" onClick={handleSave} disabled={!validation.valid || isSaving}>
						{isSaving ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
