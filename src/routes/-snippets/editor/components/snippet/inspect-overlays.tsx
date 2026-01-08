import { type RefObject, useEffect, useRef } from "react"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import type {
	SnippetInspectTextRequest,
	SnippetTextQuote,
	SnippetTextRange,
} from "@/routes/-snippets/editor/snippet-inspect-utils"

export type InspectTextEditState = {
	fileId: SnippetEditorFileId
	range: SnippetTextRange
	value: string
	quote: SnippetTextQuote
	leadingWhitespace: string
	trailingWhitespace: string
	x: number
	y: number
}

export type InspectContextMenuState = {
	open: boolean
	x: number
	y: number
	label: string
	editable: boolean
	stylesEditable: boolean
	canRemoveContainer: boolean
	containerLabel: string
	request: SnippetInspectTextRequest | null
}

interface SnippetInspectOverlaysProps {
	contextMenu: InspectContextMenuState
	onContextEditStyles: () => void
	onContextEdit: () => void
	onContextRemove: () => void
	onContextRemoveContainer: () => void
	editor: InspectTextEditState | null
	editorLabel?: string
	editorRef: RefObject<HTMLDivElement | null>
	menuRef: RefObject<HTMLDivElement | null>
	onEditorChange: (value: string) => void
	onEditorClose: () => void
}

export function SnippetInspectOverlays({
	contextMenu,
	onContextEditStyles,
	onContextEdit,
	onContextRemove,
	onContextRemoveContainer,
	editor,
	editorLabel,
	editorRef,
	menuRef,
	onEditorChange,
	onEditorClose,
}: SnippetInspectOverlaysProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (editor) {
			textareaRef.current?.focus()
		}
	}, [editor])

	return (
		<>
			{contextMenu.open && (
				<div
					ref={menuRef}
					role="menu"
					aria-label="Inspect actions"
					className="fixed z-50 w-48 rounded-md border border-neutral-200 bg-white"
					style={{ left: contextMenu.x, top: contextMenu.y }}
				>
					<div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
						{contextMenu.label}
					</div>
					<div className="border-t border-neutral-200">
						<button
							type="button"
							role="menuitem"
							onClick={onContextEditStyles}
							disabled={!contextMenu.stylesEditable}
							className="flex w-full items-center px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
						>
							Edit styles
						</button>
						<div className="border-t border-neutral-200" />
						<button
							type="button"
							role="menuitem"
							onClick={onContextEdit}
							disabled={!contextMenu.editable}
							className="flex w-full items-center px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
						>
							Edit text
						</button>
						<button
							type="button"
							role="menuitem"
							onClick={onContextRemove}
							disabled={!contextMenu.editable}
							className="flex w-full items-center px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-300"
						>
							Remove text
						</button>
						<button
							type="button"
							role="menuitem"
							onClick={onContextRemoveContainer}
							disabled={!contextMenu.canRemoveContainer}
							className="flex w-full items-center px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-neutral-300"
						>
							Remove {contextMenu.containerLabel}
						</button>
						{!contextMenu.editable && (
							<div className="border-t border-neutral-200 px-2 py-1 text-[10px] text-neutral-400">
								Text is dynamic
							</div>
						)}
						{!contextMenu.stylesEditable && contextMenu.request?.elementName && (
							<div className="border-t border-neutral-200 px-2 py-1 text-[10px] text-neutral-400">
								Styles unavailable for &lt;{contextMenu.request.elementName}&gt;
							</div>
						)}
					</div>
				</div>
			)}

			{editor && (
				<div
					ref={editorRef}
					className="fixed z-50 w-[18rem] rounded-md border border-neutral-200 bg-white p-3"
					style={{ left: editor.x, top: editor.y }}
				>
					<div className="flex items-center justify-between">
						<span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
							Edit text
						</span>
						<button
							type="button"
							className="text-[10px] font-semibold uppercase tracking-widest text-neutral-300 hover:text-neutral-500"
							onClick={onEditorClose}
						>
							Esc
						</button>
					</div>
					{editorLabel && (
						<p className="mt-1 text-[10px] text-neutral-400">Editing {editorLabel}</p>
					)}
					<textarea
						value={editor.value}
						onChange={(event) => onEditorChange(event.target.value)}
						rows={3}
						ref={textareaRef}
						className="mt-2 w-full resize-none rounded-sm border border-neutral-200 px-2 py-1 text-xs text-neutral-700 focus:border-neutral-900 focus:outline-none"
					/>
					<p className="mt-2 text-[10px] text-neutral-400">
						Right click another element to edit. Changes apply immediately.
					</p>
				</div>
			)}
		</>
	)
}
