import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const HELPER_LINES = [
	"Accepts raw TSX or chat output with ``` fences.",
	"Supports multi-file snippets via // @snippet-file … blocks.",
	"Drop a .txt/.md file to load it into the editor.",
	"Optional: // @res 1920x1080 (last one wins).",
] as const

const isSupportedImportFile = (file: File) => {
	const name = file.name.toLowerCase()
	if (name.endsWith(".md") || name.endsWith(".txt")) return true
	const type = file.type.toLowerCase()
	return type === "text/plain" || type === "text/markdown"
}

interface SnippetImportDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onImport: (value: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function SnippetImportDialog({ open, onOpenChange, onImport }: SnippetImportDialogProps) {
	const [value, setValue] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [isImporting, setIsImporting] = useState(false)
	const [isDraggingFile, setIsDraggingFile] = useState(false)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const openRef = useRef(open)
	const latestOperationRef = useRef(0)
	openRef.current = open

	useEffect(() => {
		if (!open) {
			latestOperationRef.current += 1
			setValue("")
			setError(null)
			setIsImporting(false)
			setIsDraggingFile(false)
		}
	}, [open])

	const loadImportFile = async (file: File) => {
		latestOperationRef.current += 1
		const operationId = latestOperationRef.current
		setError(null)
		if (!isSupportedImportFile(file)) {
			setError("Unsupported file. Use a .txt or .md file.")
			return
		}

		try {
			const text = await file.text()
			if (!openRef.current || latestOperationRef.current !== operationId) return
			setValue(text)
		} catch (error) {
			if (!openRef.current || latestOperationRef.current !== operationId) return
			setError(error instanceof Error ? error.message : "Failed to read file.")
		}
	}

	const handleImport = async () => {
		latestOperationRef.current += 1
		const operationId = latestOperationRef.current
		setError(null)
		setIsImporting(true)
		try {
			const result = await onImport(value)
			if (!openRef.current || latestOperationRef.current !== operationId) return
			if (!result.ok) {
				setError(result.error)
				return
			}
			onOpenChange(false)
		} catch (error) {
			if (!openRef.current || latestOperationRef.current !== operationId) return
			setError(error instanceof Error ? error.message : "Import failed.")
		} finally {
			if (openRef.current && latestOperationRef.current === operationId) {
				setIsImporting(false)
			}
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[52rem] border border-neutral-200 bg-white p-0 shadow-none">
				<DialogHeader className="gap-2 border-b border-neutral-200 px-5 py-4 text-left">
					<DialogTitle className="text-base font-semibold text-neutral-900">
						Import snippet
					</DialogTitle>
					<DialogDescription className="text-xs text-neutral-500">
						Paste a snippet from an external assistant. This replaces the current source and
						component files. Undo works.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 px-5 py-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<Label htmlFor="snippet-import" className="text-xs text-neutral-600">
								Paste snippet
							</Label>
							<div className="flex items-center gap-2">
								<input
									ref={fileInputRef}
									type="file"
									accept=".txt,.md,text/plain,text/markdown"
									data-testid="snippet-import-file-input"
									className="hidden"
									onChange={(event) => {
										const file = event.currentTarget.files?.[0]
										if (!file) return
										void loadImportFile(file)
										event.currentTarget.value = ""
									}}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8"
									onClick={() => fileInputRef.current?.click()}
								>
									Choose file
								</Button>
							</div>
						</div>
						<div className="relative">
							<textarea
								data-testid="snippet-import-dropzone"
								id="snippet-import"
								value={value}
								onChange={(event) => setValue(event.currentTarget.value)}
								onDragEnter={(event) => {
									if (event.dataTransfer.types.includes("Files")) {
										setIsDraggingFile(true)
									}
								}}
								onDragOver={(event) => {
									event.preventDefault()
									if (event.dataTransfer.types.includes("Files")) {
										setIsDraggingFile(true)
									}
								}}
								onDragLeave={() => setIsDraggingFile(false)}
								onDrop={(event) => {
									event.preventDefault()
									setIsDraggingFile(false)
									const file = event.dataTransfer.files?.[0]
									if (!file) return
									void loadImportFile(file)
								}}
								placeholder="Paste TSX (or chat output)…"
								className={cn(
									"min-h-[18rem] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-neutral-900",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
									isDraggingFile && "border-neutral-900",
								)}
							/>

							{isDraggingFile ? (
								<div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-neutral-900 bg-white/80 text-xs font-medium text-neutral-900">
									Drop .txt or .md to load
								</div>
							) : null}
						</div>
					</div>

					<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
						<ul className="list-disc pl-4">
							{HELPER_LINES.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
						<div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2">
							<span>Need a prompt template for an external assistant?</span>
							<Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
								<a href="/snippet-external-assistant-guide.md" download>
									Download guide
								</a>
							</Button>
						</div>
					</div>

					{error ? (
						<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
							{error}
						</div>
					) : null}
				</div>

				<DialogFooter className="border-t border-neutral-200 px-5 py-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isImporting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleImport}
						disabled={isImporting || value.trim().length === 0}
					>
						{isImporting ? "Importing…" : "Import"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
