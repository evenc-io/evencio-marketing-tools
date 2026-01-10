import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { insertSnippetChildInEngine } from "@/lib/engine/client"
import {
	buildSnippetLineMapSegments,
	parseSnippetFiles,
	serializeSnippetFiles,
} from "@/lib/snippets"
import type { PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import type { SnippetLineMapSegment } from "@/lib/snippets/source/files"
import {
	buildImportAssetWrapperJsx,
	ensureImportAssetsFileSource,
	getImportAsset,
	type ImportAssetDescriptor,
	type ImportAssetId,
	normalizeImportAssetsFileMap,
	resolveImportAssetsFileName,
} from "@/routes/-snippets/editor/import-assets"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import {
	getComponentFileName,
	isComponentFileId,
	stripAutoImportBlock,
	stripSnippetFileDirectives,
	syncImportBlock,
} from "@/routes/-snippets/editor/snippet-file-utils"

type DragOverlayState = {
	asset: ImportAssetDescriptor
	clientX: number
	clientY: number
	overPreview: boolean
}

type PendingPlacement = {
	source: PreviewSourceLocation
	x: number
	y: number
}

type UseSnippetImportDndOptions = {
	enabled: boolean
	form: Pick<UseFormReturn<CustomSnippetValues>, "getValues">
	setSource: (nextSource: string) => void
	commitHistoryNow: (label: string, nextSource: string) => void
	previewContainerRef: RefObject<HTMLElement | null>
	resolvePreviewSource: (source: PreviewSourceLocation | null) => {
		fileId: SnippetEditorFileId
		line: number
		column: number
	} | null
}

type ImportDndMessage = {
	type: string
	sources?: unknown
}

const isPreviewSourceLocation = (value: unknown): value is PreviewSourceLocation => {
	if (!value || typeof value !== "object") return false
	const record = value as Record<string, unknown>
	return typeof record.lineNumber === "number"
}

const migrateImportAssetAttributes = (source: string) => {
	if (!source.includes("data-snippet-import")) return source
	return source
		.replaceAll('data-snippet-import="', 'data-snippet-asset="')
		.replaceAll("data-snippet-import='", "data-snippet-asset='")
		.replaceAll("data-snippet-import", "data-snippet-asset")
}

const getAutoImportOffset = (mainSource: string) => {
	const lines = mainSource.split(/\r?\n/)
	let index = 0
	let sawImport = false

	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}

	return index
}

const buildPreviewSourceLocation = (
	insertedAt: { fileId: SnippetEditorFileId; line: number; column: number },
	segments: SnippetLineMapSegment[],
	mainSource: string,
) => {
	const fileName = insertedAt.fileId === "source" ? null : getComponentFileName(insertedAt.fileId)
	const autoImportOffset = insertedAt.fileId === "source" ? getAutoImportOffset(mainSource) : 0
	const originalLine =
		insertedAt.fileId === "source" ? insertedAt.line + autoImportOffset : insertedAt.line

	const segment = segments.find((entry) => {
		if (entry.fileName !== fileName) return false
		const end = entry.originalStartLine + entry.lineCount - 1
		return originalLine >= entry.originalStartLine && originalLine <= end
	})
	if (!segment) return null
	const expandedLine = segment.expandedStartLine + (originalLine - segment.originalStartLine)
	return {
		fileName: "Snippet.tsx",
		lineNumber: expandedLine,
		columnNumber: insertedAt.column,
	} satisfies PreviewSourceLocation
}

type InternalDragState = {
	asset: ImportAssetDescriptor
	pointerId: number
	latestClientX: number
	latestClientY: number
	overPreview: boolean
	previewX: number | null
	previewY: number | null
}

const getPreviewIframe = (container: HTMLElement | null) =>
	(container?.querySelector?.(
		'iframe[data-snippet-preview="iframe"]',
	) as HTMLIFrameElement | null) ?? null

export const useSnippetImportDnd = ({
	enabled,
	form,
	setSource,
	commitHistoryNow,
	previewContainerRef,
	resolvePreviewSource,
}: UseSnippetImportDndOptions) => {
	const resolvePreviewSourceRef = useRef(resolvePreviewSource)
	const enabledRef = useRef(enabled)
	const dragRef = useRef<InternalDragState | null>(null)
	const frameRafRef = useRef<number | null>(null)
	const lastHoverSourcesRef = useRef<PreviewSourceLocation[]>([])
	const pendingPlacementRef = useRef<PendingPlacement | null>(null)
	const cleanupListenersRef = useRef<(() => void) | null>(null)
	const [overlay, setOverlay] = useState<DragOverlayState | null>(null)

	useEffect(() => {
		resolvePreviewSourceRef.current = resolvePreviewSource
		enabledRef.current = enabled
	}, [enabled, resolvePreviewSource])

	useEffect(() => {
		const currentSource = (form.getValues("source") as string | undefined) ?? ""
		if (!currentSource.includes("data-snippet-import")) return
		const nextSource = migrateImportAssetAttributes(currentSource)
		if (nextSource === currentSource) return
		setSource(nextSource)
		commitHistoryNow("Migrate import markers", nextSource)
	}, [commitHistoryNow, form, setSource])

	const clearRafs = useCallback(() => {
		if (frameRafRef.current) {
			window.cancelAnimationFrame(frameRafRef.current)
			frameRafRef.current = null
		}
	}, [])

	const sendToPreview = useCallback(
		(message: unknown) => {
			const container = previewContainerRef.current
			const iframe = getPreviewIframe(container)
			if (!iframe?.contentWindow) return false
			iframe.contentWindow.postMessage(message, "*")
			return true
		},
		[previewContainerRef],
	)

	const computePreviewPoint = useCallback(
		(clientX: number, clientY: number) => {
			const container = previewContainerRef.current
			const iframe = getPreviewIframe(container)
			if (!iframe) return null

			const rect = iframe.getBoundingClientRect()
			if (!rect.width || !rect.height) return null
			const within =
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			if (!within) return { over: false, x: null, y: null }

			const designWidth = iframe.offsetWidth || rect.width
			const designHeight = iframe.offsetHeight || rect.height
			const scaleX = rect.width > 0 ? rect.width / designWidth : 1
			const scaleY = rect.height > 0 ? rect.height / designHeight : 1
			const x = scaleX > 0 ? (clientX - rect.left) / scaleX : 0
			const y = scaleY > 0 ? (clientY - rect.top) / scaleY : 0
			return { over: true, x, y }
		},
		[previewContainerRef],
	)

	const cancelDrag = useCallback(() => {
		cleanupListenersRef.current?.()
		cleanupListenersRef.current = null
		dragRef.current = null
		lastHoverSourcesRef.current = []
		pendingPlacementRef.current = null
		clearRafs()
		setOverlay(null)
		sendToPreview({ type: "import-dnd-end" })
	}, [clearRafs, sendToPreview])

	useEffect(() => {
		return () => {
			cleanupListenersRef.current?.()
			cleanupListenersRef.current = null
			clearRafs()
			sendToPreview({ type: "import-dnd-end" })
			dragRef.current = null
		}
	}, [clearRafs, sendToPreview])

	const commitDrop = useCallback(
		async ({
			asset,
			x,
			y,
			hoverSources,
		}: {
			asset: ImportAssetDescriptor
			x: number
			y: number
			hoverSources: PreviewSourceLocation[]
		}) => {
			if (!enabledRef.current) return
			if (!hoverSources.length) {
				toast.error("Drop target not found. Try dropping over a container element.")
				return
			}

			const resolvedTargets = hoverSources
				.map((source) => resolvePreviewSourceRef.current(source))
				.filter((entry): entry is { fileId: SnippetEditorFileId; line: number; column: number } =>
					Boolean(entry),
				)

			if (!resolvedTargets.length) {
				toast.error("Drop target could not be mapped back to source.")
				return
			}

			const orderedTargets = (
				resolvedTargets.length >= 2
					? [resolvedTargets[1], ...resolvedTargets.slice(2), resolvedTargets[0]]
					: [resolvedTargets[0]]
			).filter((entry): entry is { fileId: SnippetEditorFileId; line: number; column: number } =>
				Boolean(entry),
			)

			const currentSource = (form.getValues("source") as string | undefined) ?? ""
			const parsed = parseSnippetFiles(currentSource)
			const baseFiles = { ...normalizeImportAssetsFileMap(parsed.files).files }
			const importAssetsFileName = resolveImportAssetsFileName(baseFiles)
			baseFiles[importAssetsFileName] = ensureImportAssetsFileSource(
				baseFiles[importAssetsFileName] ?? "",
				[asset.id],
			)
			const baseMain = syncImportBlock(parsed.mainSource, Object.keys(baseFiles))
			const jsxToInsert = buildImportAssetWrapperJsx(asset)

			for (const target of orderedTargets) {
				const fileSource =
					target.fileId === "source"
						? stripAutoImportBlock(baseMain)
						: isComponentFileId(target.fileId)
							? (() => {
									const name = getComponentFileName(target.fileId)
									return name ? (baseFiles[name] ?? "") : ""
								})()
							: ""
				if (!fileSource.trim()) continue

				let insertResult: Awaited<ReturnType<typeof insertSnippetChildInEngine>>
				try {
					insertResult = await insertSnippetChildInEngine({
						source: fileSource,
						line: target.line,
						column: target.column,
						jsx: jsxToInsert,
					})
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Unable to insert asset into source.")
					return
				}

				if (!insertResult.changed || !insertResult.insertedAt) {
					continue
				}

				const nextFiles = { ...baseFiles }
				let nextMain = baseMain

				const sanitized = stripSnippetFileDirectives(insertResult.source)
				if (target.fileId === "source") {
					nextMain = syncImportBlock(sanitized, Object.keys(nextFiles))
				} else if (isComponentFileId(target.fileId)) {
					const name = getComponentFileName(target.fileId)
					if (!name) continue
					nextFiles[name] = sanitized
					nextMain = syncImportBlock(nextMain, Object.keys(nextFiles))
				} else {
					continue
				}

				const nextSource = serializeSnippetFiles(nextMain, nextFiles)
				if (nextSource !== currentSource) {
					setSource(nextSource)
					commitHistoryNow("Drop import", nextSource)
				}

				const segments = buildSnippetLineMapSegments(nextMain, nextFiles)
				const previewSource = buildPreviewSourceLocation(
					{
						fileId: target.fileId,
						line: insertResult.insertedAt.line,
						column: insertResult.insertedAt.column,
					},
					segments,
					nextMain,
				)
				if (previewSource) {
					pendingPlacementRef.current = {
						source: previewSource,
						x,
						y,
					}
				}

				return
			}

			toast.error("No suitable parent found to insert this asset.")
		},
		[commitHistoryNow, form, setSource],
	)

	const scheduleFrameSync = useCallback(() => {
		if (frameRafRef.current) return
		frameRafRef.current = window.requestAnimationFrame(() => {
			frameRafRef.current = null
			const drag = dragRef.current
			if (!drag) return

			const point = computePreviewPoint(drag.latestClientX, drag.latestClientY)
			const wasOverPreview = drag.overPreview
			drag.overPreview = Boolean(point?.over)
			drag.previewX = point?.over ? point.x : null
			drag.previewY = point?.over ? point.y : null

			setOverlay({
				asset: drag.asset,
				clientX: drag.latestClientX,
				clientY: drag.latestClientY,
				overPreview: drag.overPreview,
			})

			if (!enabledRef.current) return

			if (drag.overPreview && drag.previewX !== null && drag.previewY !== null) {
				sendToPreview({
					type: "import-dnd-move",
					x: drag.previewX,
					y: drag.previewY,
					ghost: drag.asset.ghost,
				})
				return
			}

			if (wasOverPreview) {
				sendToPreview({ type: "import-dnd-end" })
			}
		})
	}, [computePreviewPoint, sendToPreview])

	const startDrag = useCallback(
		(asset: ImportAssetDescriptor, event: ReactPointerEvent<HTMLElement>) => {
			if (!enabledRef.current) return
			cancelDrag()
			event.preventDefault()
			event.stopPropagation()
			const pointerId = event.pointerId
			dragRef.current = {
				asset,
				pointerId,
				latestClientX: event.clientX,
				latestClientY: event.clientY,
				overPreview: false,
				previewX: null,
				previewY: null,
			}
			try {
				event.currentTarget.setPointerCapture(pointerId)
			} catch {
				// Ignore pointer capture failures.
			}
			setOverlay({ asset, clientX: event.clientX, clientY: event.clientY, overPreview: false })

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const drag = dragRef.current
				if (!drag) return
				if (moveEvent.pointerId !== pointerId) return

				drag.latestClientX = moveEvent.clientX
				drag.latestClientY = moveEvent.clientY
				scheduleFrameSync()
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				const drag = dragRef.current
				if (!drag) return
				if (upEvent.pointerId !== pointerId) return

				const hoverSources = lastHoverSourcesRef.current
				const drop = {
					asset: drag.asset,
					overPreview: drag.overPreview,
					x: drag.previewX,
					y: drag.previewY,
					hoverSources,
				}

				cancelDrag()

				if (!enabledRef.current) return
				if (!drop.overPreview || drop.x === null || drop.y === null) {
					return
				}

				void commitDrop({
					asset: drop.asset,
					x: drop.x,
					y: drop.y,
					hoverSources: drop.hoverSources,
				})
			}

			const handleKeyDown = (keyEvent: KeyboardEvent) => {
				if (keyEvent.key === "Escape" || keyEvent.key === "Esc") {
					cancelDrag()
				}
			}

			const cleanup = () => {
				window.removeEventListener("pointermove", handlePointerMove)
				window.removeEventListener("pointerup", handlePointerUp)
				window.removeEventListener("pointercancel", handlePointerUp)
				window.removeEventListener("keydown", handleKeyDown)
			}

			cleanupListenersRef.current = cleanup
			window.addEventListener("pointermove", handlePointerMove)
			window.addEventListener("pointerup", handlePointerUp)
			window.addEventListener("pointercancel", handlePointerUp)
			window.addEventListener("keydown", handleKeyDown)
		},
		[cancelDrag, commitDrop, scheduleFrameSync],
	)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ImportDndMessage>) => {
			const container = previewContainerRef.current
			const iframe = getPreviewIframe(container)
			const iframeWindow = iframe?.contentWindow
			if (!iframeWindow || event.source !== iframeWindow) return
			const data = event.data
			if (!data || typeof data.type !== "string") return

			if (data.type === "import-dnd-hover") {
				const sources = Array.isArray(data.sources) ? data.sources : []
				lastHoverSourcesRef.current = sources.filter(isPreviewSourceLocation)
				return
			}

			if (data.type === "render-success") {
				const pending = pendingPlacementRef.current
				if (!pending) return
				pendingPlacementRef.current = null
				sendToPreview({
					type: "import-dnd-commit",
					source: pending.source,
					x: pending.x,
					y: pending.y,
				})
				return
			}

			if (data.type === "render-error") {
				pendingPlacementRef.current = null
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [previewContainerRef, sendToPreview])

	const handleAssetPointerDown = useCallback(
		(assetId: ImportAssetId, event: ReactPointerEvent<HTMLElement>) => {
			const asset = getImportAsset(assetId)
			if (!asset) return
			startDrag(asset, event)
		},
		[startDrag],
	)

	return {
		dragOverlay: overlay,
		handleAssetPointerDown,
	}
}
