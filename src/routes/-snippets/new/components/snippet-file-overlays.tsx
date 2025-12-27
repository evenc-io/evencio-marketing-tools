import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
	SnippetEditorFile,
	SnippetEditorFileId,
} from "@/routes/-snippets/new/snippet-editor-types"
import { getExportNameFromFile } from "@/routes/-snippets/new/snippet-file-utils"

interface DeleteTarget {
	exportName: string
	label: string
	fileName?: string
}

interface SnippetFileOverlaysProps {
	contextMenu: {
		open: boolean
		x: number
		y: number
		fileId: SnippetEditorFileId | null
	}
	contextMenuFile: SnippetEditorFile | null
	openFiles: SnippetEditorFileId[]
	canCloseContextTab: boolean
	deleteTarget: DeleteTarget | null
	isDeletingComponent: boolean
	onContextMenuOpenChange: (open: boolean) => void
	onSelectFile: (fileId: SnippetEditorFileId) => void
	onCloseFileTab: (fileId: SnippetEditorFileId) => void
	onRequestDelete: (target: DeleteTarget) => void
	onCancelDelete: () => void
	onConfirmDelete: () => void
}

export function SnippetFileOverlays({
	contextMenu,
	contextMenuFile,
	openFiles,
	canCloseContextTab,
	deleteTarget,
	isDeletingComponent,
	onContextMenuOpenChange,
	onSelectFile,
	onCloseFileTab,
	onRequestDelete,
	onCancelDelete,
	onConfirmDelete,
}: SnippetFileOverlaysProps) {
	return (
		<>
			<DropdownMenu open={contextMenu.open} onOpenChange={onContextMenuOpenChange}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-hidden="true"
						tabIndex={-1}
						className="pointer-events-none fixed h-px w-px opacity-0"
						style={{ left: contextMenu.x, top: contextMenu.y }}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" sideOffset={4} className="w-48">
					{contextMenuFile ? (
						<>
							<DropdownMenuItem onSelect={() => onSelectFile(contextMenuFile.id)}>
								Open file
							</DropdownMenuItem>
							{openFiles.includes(contextMenuFile.id) && (
								<DropdownMenuItem
									disabled={!canCloseContextTab}
									onSelect={() => onCloseFileTab(contextMenuFile.id)}
								>
									Close tab
								</DropdownMenuItem>
							)}
							{contextMenuFile.deletable && contextMenuFile.exportName && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => {
											onRequestDelete({
												exportName:
													contextMenuFile.exportName ??
													getExportNameFromFile(contextMenuFile.label),
												label: contextMenuFile.label,
												fileName: contextMenuFile.fileName,
											})
										}}
									>
										<Trash2 className="h-4 w-4" />
										Remove file
									</DropdownMenuItem>
								</>
							)}
						</>
					) : (
						<DropdownMenuItem disabled>No file actions</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open) onCancelDelete()
				}}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove component file?</DialogTitle>
						<DialogDescription>
							This removes the file and its @import reference. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{deleteTarget && (
						<div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
							{deleteTarget.label.replace(/\.tsx$/, "")}
						</div>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onCancelDelete}>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={onConfirmDelete}
							disabled={isDeletingComponent}
						>
							{isDeletingComponent ? "Removing..." : "Remove file"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
