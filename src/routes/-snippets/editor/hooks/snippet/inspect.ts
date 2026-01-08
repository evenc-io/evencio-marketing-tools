import { useCallback, useEffect, useMemo, useState } from "react"
import type { SnippetInspectIndex } from "@/lib/snippets/inspect-index"
import { createInspectLookup } from "@/lib/snippets/inspect-index"
import type { PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import type { SnippetLineMapSegment } from "@/lib/snippets/source/files"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import {
	getComponentFileName,
	isComponentFileId,
} from "@/routes/-snippets/editor/snippet-file-utils"
import {
	buildSnippetInspectMap,
	createSnippetElementLocator,
	type SnippetInspectHighlight,
	type SnippetInspectTarget,
	type SnippetInspectTextRequest,
} from "@/routes/-snippets/editor/snippet-inspect-utils"

const isWithinTextRange = (
	range: { startLine: number; endLine: number; startColumn: number; endColumn: number },
	line: number,
	column: number,
) => {
	if (line < range.startLine || line > range.endLine) return false
	if (line === range.startLine && column < range.startColumn) return false
	if (line === range.endLine && column > range.endColumn) return false
	return true
}

interface UseSnippetInspectOptions {
	mainSource: string
	mainEditorSource: string
	componentFiles: Record<string, string>
	activeFile: SnippetEditorFileId
	isExamplePreviewActive: boolean
	onOpenFileForInspect: (fileId: SnippetEditorFileId) => void
	inspectIndexByFileId?: Record<string, SnippetInspectIndex | null>
	lineMapSegments?: SnippetLineMapSegment[]
	forceEnabled?: boolean
}

interface UseSnippetInspectResult {
	inspectMode: boolean
	setInspectMode: (next: boolean | ((prev: boolean) => boolean)) => void
	inspectEnabled: boolean
	inspectHighlight: SnippetInspectHighlight | null
	onPreviewInspectHover: (source: PreviewSourceLocation | null) => void
	onPreviewInspectSelect: (source: PreviewSourceLocation | null) => void
	onPreviewInspectContext: (
		source: PreviewSourceLocation | null,
	) => SnippetInspectTextRequest | null
	resolvePreviewSource: (source: PreviewSourceLocation | null) => SnippetInspectTarget | null
}

export function useSnippetInspect({
	mainSource,
	mainEditorSource,
	componentFiles,
	activeFile,
	isExamplePreviewActive,
	onOpenFileForInspect,
	inspectIndexByFileId,
	lineMapSegments,
	forceEnabled = false,
}: UseSnippetInspectOptions): UseSnippetInspectResult {
	const [inspectMode, setInspectMode] = useState(false)
	const [inspectHover, setInspectHover] = useState<SnippetInspectTarget | null>(null)
	const [inspectSelection, setInspectSelection] = useState<SnippetInspectTarget | null>(null)

	const inspectActive = inspectMode || forceEnabled

	const inspectMap = useMemo(
		() => buildSnippetInspectMap(mainSource, componentFiles, lineMapSegments),
		[componentFiles, lineMapSegments, mainSource],
	)

	const resolveInspectTarget = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!source?.lineNumber) return null
			return inspectMap.resolve(source.lineNumber, source.columnNumber)
		},
		[inspectMap],
	)

	const onPreviewInspectHover = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!inspectActive) return
			const target = resolveInspectTarget(source)
			if (!target) {
				setInspectHover(null)
				return
			}
			setInspectHover(target)
		},
		[inspectActive, resolveInspectTarget],
	)

	const onPreviewInspectSelect = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!inspectActive) return
			const target = resolveInspectTarget(source)
			if (!target) {
				setInspectSelection(null)
				return
			}
			setInspectSelection(target)
			setInspectHover(null)
			if (target.fileId !== activeFile) {
				onOpenFileForInspect(target.fileId)
			}
		},
		[activeFile, inspectActive, onOpenFileForInspect, resolveInspectTarget],
	)

	const getSourceForFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			if (fileId === "source") return mainEditorSource
			if (!isComponentFileId(fileId)) return ""
			const fileName = getComponentFileName(fileId)
			if (!fileName) return ""
			return componentFiles[fileName] ?? ""
		},
		[componentFiles, mainEditorSource],
	)

	const createLocatorFromIndex = useCallback((index: SnippetInspectIndex, source: string) => {
		const lookup = createInspectLookup(index, source)
		return {
			findMatch: (line: number, column: number) => {
				const entry = lookup.findMatch(line, column)
				if (!entry) return null
				return {
					startLine: entry.range.startLine,
					endLine: entry.range.endLine,
					textRanges: entry.textRanges,
					elementRange: entry.elementRange,
					elementType: entry.elementType,
					elementName: entry.elementName,
				}
			},
		}
	}, [])

	const getLocatorForFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			const source = getSourceForFile(fileId)
			if (!source || source.trim().length === 0) {
				return createSnippetElementLocator("")
			}
			const index = inspectIndexByFileId?.[fileId]
			if (index) {
				return createLocatorFromIndex(index, source)
			}
			return createSnippetElementLocator(source)
		},
		[createLocatorFromIndex, getSourceForFile, inspectIndexByFileId],
	)

	const elementLocator = useMemo(() => {
		if (!inspectActive) return createSnippetElementLocator("")
		return getLocatorForFile(activeFile)
	}, [activeFile, getLocatorForFile, inspectActive])

	const resolveHighlight = useCallback(
		(target: SnippetInspectTarget | null, kind: "hover" | "select") => {
			if (!target || target.fileId !== activeFile) return null
			const match = elementLocator.findMatch(target.line, target.column)
			const startLine = match?.startLine ?? target.line
			const endLine = match?.endLine ?? target.line
			return {
				...target,
				kind,
				startLine,
				endLine,
				textRanges: match?.textRanges ?? [],
			}
		},
		[activeFile, elementLocator],
	)

	const buildInspectTextRequest = useCallback(
		(target: SnippetInspectTarget) => {
			const locator = getLocatorForFile(target.fileId)
			const match = locator.findMatch(target.line, target.column)
			const ranges = match?.textRanges ?? []
			const range =
				ranges.find((entry) => isWithinTextRange(entry, target.line, target.column)) ??
				ranges[0] ??
				null
			return {
				...target,
				range,
				elementRange: match?.elementRange ?? null,
				elementType: match?.elementType ?? null,
				elementName: match?.elementName ?? null,
			}
		},
		[getLocatorForFile],
	)

	useEffect(() => {
		if (isExamplePreviewActive) {
			setInspectMode(false)
		}
	}, [isExamplePreviewActive])

	useEffect(() => {
		if (inspectActive) return
		setInspectHover(null)
		setInspectSelection(null)
	}, [inspectActive])

	const inspectHighlight = useMemo<SnippetInspectHighlight | null>(() => {
		if (inspectSelection) {
			return resolveHighlight(inspectSelection, "select")
		}
		if (inspectHover) {
			return resolveHighlight(inspectHover, "hover")
		}
		return null
	}, [inspectHover, inspectSelection, resolveHighlight])

	const onPreviewInspectContext = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!inspectActive) return null
			const target = resolveInspectTarget(source)
			if (!target) return null
			setInspectSelection(target)
			setInspectHover(null)
			return buildInspectTextRequest(target)
		},
		[buildInspectTextRequest, inspectActive, resolveInspectTarget],
	)

	return {
		inspectMode,
		setInspectMode,
		inspectEnabled: inspectActive && !isExamplePreviewActive,
		inspectHighlight,
		onPreviewInspectHover,
		onPreviewInspectSelect,
		onPreviewInspectContext,
		resolvePreviewSource: resolveInspectTarget,
	}
}
