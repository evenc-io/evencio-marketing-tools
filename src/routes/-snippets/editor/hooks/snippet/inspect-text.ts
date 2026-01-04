import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { applySnippetLayoutInEngine } from "@/lib/engine/client"
import type { PreviewLayoutCommit, PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import type {
	InspectContextMenuState,
	InspectTextEditState,
} from "@/routes/-snippets/editor/components/snippet/inspect-overlays"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import { getComponentFileName } from "@/routes/-snippets/editor/snippet-file-utils"
import {
	buildSnippetTextLiteral,
	getSnippetTextRangeValue,
	replaceSnippetTextRange,
	resolveSnippetElementContext,
	type SnippetInspectTarget,
	type SnippetInspectTextRequest,
	type SnippetTextRange,
} from "@/routes/-snippets/editor/snippet-inspect-utils"

type UseSnippetInspectTextOptions = {
	getSourceForFile: (fileId: SnippetEditorFileId) => string
	updateSourceForFile: (fileId: SnippetEditorFileId, nextFileSource: string) => void
	applyLayoutSourceForFile: (
		fileId: SnippetEditorFileId,
		nextFileSource: string,
		label: string,
	) => boolean
	resolvePreviewSource: (source: PreviewSourceLocation | null) => SnippetInspectTarget | null
	onPreviewInspectSelect: (source: PreviewSourceLocation | null) => void
	onPreviewInspectContext: (
		source: PreviewSourceLocation | null,
	) => SnippetInspectTextRequest | null
	layoutMode: boolean
	isExamplePreviewActive: boolean
	inspectEnabled: boolean
	onLayoutCommitApplied?: () => void
}

type UseSnippetInspectTextResult = {
	inspectTextEdit: InspectTextEditState | null
	inspectContextMenu: InspectContextMenuState
	selectedInspectSource: PreviewSourceLocation | null
	inspectTextEditRef: RefObject<HTMLDivElement | null>
	inspectContextMenuRef: RefObject<HTMLDivElement | null>
	handleInspectTextChange: (nextValue: string) => void
	closeInspectTextEdit: () => void
	handleInspectContextEdit: () => void
	handleInspectContextRemove: () => void
	handleInspectContextRemoveContainer: () => void
	handlePreviewInspectSelect: (
		source: PreviewSourceLocation | null,
		meta?: { reason?: "reset" },
	) => void
	handleInspectContext: (payload: {
		source: PreviewSourceLocation | null
		clientX: number
		clientY: number
	}) => void
	handleInspectEscape: () => void
	handleLayoutCommit: (commit: PreviewLayoutCommit) => void
}

export const useSnippetInspectText = ({
	getSourceForFile,
	updateSourceForFile,
	applyLayoutSourceForFile,
	resolvePreviewSource,
	onPreviewInspectSelect,
	onPreviewInspectContext,
	layoutMode,
	isExamplePreviewActive,
	inspectEnabled,
	onLayoutCommitApplied,
}: UseSnippetInspectTextOptions): UseSnippetInspectTextResult => {
	const inspectTextEditRef = useRef<HTMLDivElement>(null)
	const inspectTextEditStateRef = useRef<InspectTextEditState | null>(null)
	const inspectTextCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const inspectTextPendingValueRef = useRef<string | null>(null)
	const inspectContextMenuRef = useRef<HTMLDivElement>(null)
	const layoutCommitQueueRef = useRef<Promise<void>>(Promise.resolve())
	const [inspectTextEdit, setInspectTextEdit] = useState<InspectTextEditState | null>(null)
	const [inspectContextMenu, setInspectContextMenu] = useState<InspectContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		label: "Snippet text",
		editable: false,
		canRemoveContainer: false,
		containerLabel: "container",
		request: null,
	})
	const [selectedInspectSource, setSelectedInspectSource] = useState<PreviewSourceLocation | null>(
		null,
	)

	const enqueueLayoutCommit = useCallback((task: () => Promise<void>) => {
		const next = layoutCommitQueueRef.current.catch(() => {}).then(task)
		layoutCommitQueueRef.current = next
		return next
	}, [])

	const buildTextRangeFromValue = useCallback((range: SnippetTextRange, rawValue: string) => {
		const lines = rawValue.split(/\r?\n/)
		if (lines.length <= 1) {
			return {
				...range,
				endLine: range.startLine,
				endColumn: range.startColumn + rawValue.length,
			}
		}
		const lastLine = lines[lines.length - 1] ?? ""
		return {
			...range,
			endLine: range.startLine + lines.length - 1,
			endColumn: lastLine.length + 1,
		}
	}, [])

	const flushInspectTextEdit = useCallback(
		(nextValue?: string | null) => {
			const pendingValue =
				typeof nextValue === "string" ? nextValue : inspectTextPendingValueRef.current
			if (pendingValue === null || pendingValue === undefined) return
			const current = inspectTextEditStateRef.current
			if (!current) return
			const resolvedValue = current.quote
				? pendingValue
				: `${current.leadingWhitespace}${pendingValue}${current.trailingWhitespace}`
			const fileSource = getSourceForFile(current.fileId)
			const nextSource = replaceSnippetTextRange(
				fileSource,
				current.range,
				resolvedValue,
				current.quote,
			)
			if (nextSource !== fileSource) {
				updateSourceForFile(current.fileId, nextSource)
			}
			const rawValue = buildSnippetTextLiteral(resolvedValue, current.quote)
			const nextRange = buildTextRangeFromValue(current.range, rawValue)
			setInspectTextEdit((prev) => (prev ? { ...prev, range: nextRange } : prev))
			inspectTextPendingValueRef.current = null
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
				inspectTextCommitTimerRef.current = null
			}
		},
		[buildTextRangeFromValue, getSourceForFile, updateSourceForFile],
	)

	const closeInspectTextEdit = useCallback(() => {
		flushInspectTextEdit()
		setInspectTextEdit(null)
	}, [flushInspectTextEdit])

	const handleInspectTextChange = useCallback(
		(nextValue: string) => {
			setInspectTextEdit((prev) => {
				if (!prev) return prev
				return {
					...prev,
					value: nextValue,
				}
			})
			inspectTextPendingValueRef.current = nextValue
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
			}
			inspectTextCommitTimerRef.current = setTimeout(() => {
				flushInspectTextEdit()
			}, 300)
		},
		[flushInspectTextEdit],
	)

	const openInspectTextEditor = useCallback(
		(request: { fileId: SnippetEditorFileId; range: SnippetTextRange }, x: number, y: number) => {
			const fileSource = getSourceForFile(request.fileId)
			const { text, quote } = getSnippetTextRangeValue(fileSource, request.range)
			const leadingWhitespace = quote ? "" : (text.match(/^\s+/)?.[0] ?? "")
			const trailingWhitespace = quote ? "" : (text.match(/\s+$/)?.[0] ?? "")
			const coreText = quote ? text : text.trim()
			const normalizedText =
				/[\r\n\t]/.test(coreText) || /\s{2,}/.test(coreText)
					? coreText.replace(/\s+/g, " ").trim()
					: coreText
			const panelWidth = 288
			const panelHeight = 156
			const maxX = Math.max(12, window.innerWidth - panelWidth - 12)
			const maxY = Math.max(12, window.innerHeight - panelHeight - 12)
			setInspectTextEdit({
				fileId: request.fileId,
				range: request.range,
				value: normalizedText,
				quote,
				leadingWhitespace,
				trailingWhitespace,
				x: Math.min(Math.max(12, x), maxX),
				y: Math.min(Math.max(12, y), maxY),
			})
		},
		[getSourceForFile],
	)

	const closeInspectContextMenu = useCallback(() => {
		setInspectContextMenu((prev) => ({
			...prev,
			open: false,
			label: "Snippet text",
			canRemoveContainer: false,
			containerLabel: "container",
			request: null,
		}))
	}, [])

	const handleInspectContextEdit = useCallback(() => {
		setInspectContextMenu((prev) => {
			if (!prev.open || !prev.editable || !prev.request?.range) {
				return { ...prev, open: false, request: null }
			}
			const offset = 10
			openInspectTextEditor(
				{ fileId: prev.request.fileId, range: prev.request.range },
				prev.x + offset,
				prev.y + offset,
			)
			return { ...prev, open: false, request: null }
		})
	}, [openInspectTextEditor])

	const handleInspectContextRemove = useCallback(() => {
		setInspectContextMenu((prev) => {
			if (!prev.open || !prev.editable || !prev.request?.range) {
				return { ...prev, open: false, request: null }
			}
			const fileSource = getSourceForFile(prev.request.fileId)
			const { quote } = getSnippetTextRangeValue(fileSource, prev.request.range)
			const nextSource = replaceSnippetTextRange(fileSource, prev.request.range, "", quote)
			updateSourceForFile(prev.request.fileId, nextSource)
			return { ...prev, open: false, request: null }
		})
	}, [getSourceForFile, updateSourceForFile])

	const handleInspectContextRemoveContainer = useCallback(() => {
		setInspectContextMenu((prev) => {
			if (!prev.open || !prev.request?.elementRange) {
				return { ...prev, open: false, request: null }
			}
			const fileSource = getSourceForFile(prev.request.fileId)
			const context = resolveSnippetElementContext(fileSource, prev.request.elementRange)
			const replacement = context === "expression" ? "null" : ""
			const nextSource = replaceSnippetTextRange(
				fileSource,
				prev.request.elementRange,
				replacement,
				null,
			)
			updateSourceForFile(prev.request.fileId, nextSource)
			return { ...prev, open: false, request: null }
		})
	}, [getSourceForFile, updateSourceForFile])

	const handlePreviewInspectSelect = useCallback(
		(
			source: PreviewSourceLocation | null,
			meta?: {
				reason?: "reset"
			},
		) => {
			onPreviewInspectSelect(source)
			if (!source && meta?.reason === "reset") {
				setSelectedInspectSource(null)
				return
			}
			setSelectedInspectSource(source)
			if (inspectTextEdit) {
				closeInspectTextEdit()
			}
			if (inspectContextMenu.open) {
				closeInspectContextMenu()
			}
		},
		[
			closeInspectContextMenu,
			closeInspectTextEdit,
			inspectContextMenu.open,
			inspectTextEdit,
			onPreviewInspectSelect,
		],
	)

	const handleInspectEscape = useCallback(() => {
		if (inspectTextEdit) {
			closeInspectTextEdit()
		}
		if (inspectContextMenu.open) {
			closeInspectContextMenu()
		}
	}, [closeInspectContextMenu, closeInspectTextEdit, inspectContextMenu.open, inspectTextEdit])

	const handleInspectContext = useCallback(
		(payload: { source: PreviewSourceLocation | null; clientX: number; clientY: number }) => {
			const request = onPreviewInspectContext(payload.source)
			flushInspectTextEdit()
			setInspectTextEdit(null)
			if (!request) return
			const menuWidth = 208
			const menuHeight = 176
			const maxX = Math.max(12, window.innerWidth - menuWidth - 12)
			const maxY = Math.max(12, window.innerHeight - menuHeight - 12)
			const fileLabel =
				request.fileId === "source"
					? "Snippet.tsx"
					: (getComponentFileName(request.fileId) ?? "Component")
			const containerLabel =
				request.elementType === "fragment"
					? "fragment"
					: request.elementName
						? `<${request.elementName}>`
						: "container"
			setInspectContextMenu({
				open: true,
				x: Math.min(payload.clientX, maxX),
				y: Math.min(payload.clientY, maxY),
				label: fileLabel,
				editable: Boolean(request.range),
				canRemoveContainer: Boolean(request.elementRange),
				containerLabel,
				request,
			})
		},
		[flushInspectTextEdit, onPreviewInspectContext],
	)

	const handleLayoutCommit = useCallback(
		(commit: PreviewLayoutCommit) => {
			if (!layoutMode || isExamplePreviewActive) return
			if (!commit?.source) return
			if (!Number.isFinite(commit.translate?.x) || !Number.isFinite(commit.translate?.y)) {
				return
			}
			const target = resolvePreviewSource(commit.source)
			if (!target) {
				toast.error("Unable to map the selected element back to the source.")
				return
			}
			const translateX = commit.translate.x
			const translateY = commit.translate.y
			const alignX = commit.alignX ?? null
			const alignY = commit.alignY ?? null
			const width =
				typeof commit.width === "number" && Number.isFinite(commit.width) ? commit.width : null
			const height =
				typeof commit.height === "number" && Number.isFinite(commit.height) ? commit.height : null
			const historyLabel = width !== null || height !== null ? "Resize element" : "Move element"

			enqueueLayoutCommit(async () => {
				const fileSource = getSourceForFile(target.fileId)
				if (!fileSource.trim()) {
					toast.error("Selected element source is empty.")
					return
				}
				try {
					const result = await applySnippetLayoutInEngine({
						source: fileSource,
						line: target.line,
						column: target.column,
						translateX,
						translateY,
						alignX,
						alignY,
						width: width ?? undefined,
						height: height ?? undefined,
					})
					if (!result.changed) {
						if (result.reason) {
							toast.error(result.reason)
						}
						return
					}
					const applied = applyLayoutSourceForFile(target.fileId, result.source, historyLabel)
					if (applied) {
						onLayoutCommitApplied?.()
					}
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Failed to update layout.")
				}
			})
		},
		[
			applyLayoutSourceForFile,
			enqueueLayoutCommit,
			getSourceForFile,
			isExamplePreviewActive,
			layoutMode,
			onLayoutCommitApplied,
			resolvePreviewSource,
		],
	)

	useEffect(() => {
		inspectTextEditStateRef.current = inspectTextEdit
	}, [inspectTextEdit])

	useEffect(() => {
		if (!inspectTextEdit) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" || event.key === "Esc") {
				closeInspectTextEdit()
			}
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null
			if (inspectTextEditRef.current && target && inspectTextEditRef.current.contains(target)) {
				return
			}
			flushInspectTextEdit()
			closeInspectTextEdit()
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("pointerdown", handlePointerDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("pointerdown", handlePointerDown)
		}
	}, [closeInspectTextEdit, flushInspectTextEdit, inspectTextEdit])

	useEffect(() => {
		return () => {
			if (inspectTextCommitTimerRef.current) {
				clearTimeout(inspectTextCommitTimerRef.current)
				inspectTextCommitTimerRef.current = null
			}
			inspectTextPendingValueRef.current = null
		}
	}, [])

	useEffect(() => {
		if (!inspectContextMenu.open) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" || event.key === "Esc") {
				closeInspectContextMenu()
			}
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null
			if (
				inspectContextMenuRef.current &&
				target &&
				inspectContextMenuRef.current.contains(target)
			) {
				return
			}
			closeInspectContextMenu()
		}

		window.addEventListener("keydown", handleKeyDown)
		window.addEventListener("pointerdown", handlePointerDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			window.removeEventListener("pointerdown", handlePointerDown)
		}
	}, [closeInspectContextMenu, inspectContextMenu.open])

	useEffect(() => {
		if (!inspectEnabled && inspectTextEdit) {
			closeInspectTextEdit()
		}
	}, [closeInspectTextEdit, inspectEnabled, inspectTextEdit])

	useEffect(() => {
		if (!inspectEnabled && inspectContextMenu.open) {
			closeInspectContextMenu()
		}
	}, [closeInspectContextMenu, inspectContextMenu.open, inspectEnabled])

	useEffect(() => {
		if (!inspectEnabled) {
			setSelectedInspectSource(null)
		}
	}, [inspectEnabled])

	return {
		inspectTextEdit,
		inspectContextMenu,
		selectedInspectSource,
		inspectTextEditRef,
		inspectContextMenuRef,
		handleInspectTextChange,
		closeInspectTextEdit,
		handleInspectContextEdit,
		handleInspectContextRemove,
		handleInspectContextRemoveContainer,
		handlePreviewInspectSelect,
		handleInspectContext,
		handleInspectEscape,
		handleLayoutCommit,
	}
}
