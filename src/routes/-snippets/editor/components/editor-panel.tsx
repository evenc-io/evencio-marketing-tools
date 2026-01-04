import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core"
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Monaco } from "@monaco-editor/react"
import { AlertCircle, CheckCircle2, Loader2, Plus, Upload, X } from "lucide-react"
import type { editor } from "monaco-editor"
import {
	type ChangeEvent,
	type MouseEvent,
	type Ref,
	type RefObject,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	type WheelEvent,
} from "react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { ClientOnly } from "@/components/ui/client-only"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import type { MonacoMarker } from "@/components/ui/monaco-editor"
import type { CompileError } from "@/lib/snippets/compiler"
import { SNIPPET_COMPONENT_LIMITS } from "@/lib/snippets/constraints"
import type { CompileStatus } from "@/lib/snippets/useSnippetCompiler"
import { cn } from "@/lib/utils"
import { SnippetHistoryActions } from "@/routes/-snippets/editor/components/snippet/history-actions"
import { LazyMonacoEditor, MonacoEditorSkeleton } from "@/routes/-snippets/editor/editor"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import type {
	SnippetEditorFile,
	SnippetEditorFileId,
} from "@/routes/-snippets/editor/snippet-editor-types"
import type { SnippetInspectHighlight } from "@/routes/-snippets/editor/snippet-inspect-utils"

interface SnippetEditorPanelProps {
	containerRef?: Ref<HTMLDivElement>
	editorCollapsed: boolean
	explorerCollapsed: boolean
	openFiles: SnippetEditorFileId[]
	editorFiles: SnippetEditorFile[]
	editorFilesById: Map<SnippetEditorFileId, SnippetEditorFile>
	activeFile: SnippetEditorFileId
	activeFileMeta: SnippetEditorFile | null
	isSourceEditorActive: boolean
	isComponentEditorActive: boolean
	isPropsSchemaActive: boolean
	isDefaultPropsActive: boolean
	componentCount: number
	hasComponentExports: boolean
	canAddComponent: boolean
	overSoftComponentLimit: boolean
	overHardComponentLimit: boolean
	onSelectFile: (fileId: SnippetEditorFileId) => void
	onCloseFileTab: (fileId: SnippetEditorFileId) => void
	onReorderOpenFiles: (fileIds: SnippetEditorFileId[]) => void
	onFileContextMenu: (event: MouseEvent<HTMLButtonElement>, fileId: SnippetEditorFileId) => void
	onAddComponent: () => void
	fileInputRef: RefObject<HTMLInputElement | null>
	onSourceUpload: (event: ChangeEvent<HTMLInputElement>) => void
	form: UseFormReturn<CustomSnippetValues>
	mainEditorSource: string
	onMainSourceChange: (value: string | undefined) => void
	componentTypeLibs: Array<{ content: string; filePath: string }>
	componentDefinitionMap: Record<string, SnippetEditorFileId>
	onDefinitionSelect: (symbol: string, target: string) => void
	monacoMarkers: MonacoMarker[]
	hasActiveComponentFile: boolean
	activeComponentSource: string
	activeComponentFileName: string | null
	onComponentSourceChange: (value: string | undefined) => void
	derivedDuplicateKeys: string[]
	compileStatus: CompileStatus
	compileErrors: CompileError[]
	inspectHighlight?: SnippetInspectHighlight | null
	canUndo: boolean
	canRedo: boolean
	onUndo: () => void
	onRedo: () => void
}

interface SnippetEditorTabProps {
	file: SnippetEditorFile
	isActive: boolean
	isOnlyTab: boolean
	onSelectFile: (fileId: SnippetEditorFileId) => void
	onCloseFileTab: (fileId: SnippetEditorFileId) => void
}

function SnippetEditorTab({
	file,
	isActive,
	isOnlyTab,
	onSelectFile,
	onCloseFileTab,
}: SnippetEditorTabProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: file.id,
	})
	const Icon = file.icon
	const style = {
		transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
		transition,
	}

	const handleMiddleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (event.button !== 1) return
		event.preventDefault()
		event.stopPropagation()
		if (isOnlyTab) return
		onCloseFileTab(file.id)
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-1 rounded-t-md border border-transparent px-1",
				isActive
					? "border-neutral-200 bg-white text-neutral-900"
					: "text-neutral-500 hover:text-neutral-700",
				isDragging && "opacity-60",
			)}
		>
			<button
				type="button"
				onMouseDown={handleMiddleClick}
				onClick={() => onSelectFile(file.id)}
				className="flex cursor-grab touch-none items-center gap-1.5 px-1 py-1 text-[11px] font-medium"
				{...attributes}
				{...listeners}
			>
				<Icon className="h-3 w-3 text-neutral-400" />
				{file.label}
			</button>
			<button
				type="button"
				onClick={() => onCloseFileTab(file.id)}
				disabled={isOnlyTab}
				aria-label={`Close ${file.label} tab`}
				className={cn(
					"rounded-sm p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600",
					isOnlyTab && "pointer-events-none opacity-30",
				)}
			>
				<X className="h-3 w-3" />
			</button>
		</div>
	)
}

export function SnippetEditorPanel({
	containerRef,
	editorCollapsed,
	explorerCollapsed,
	openFiles,
	editorFiles,
	editorFilesById,
	activeFile,
	activeFileMeta,
	isSourceEditorActive,
	isComponentEditorActive,
	isPropsSchemaActive,
	isDefaultPropsActive,
	componentCount,
	hasComponentExports,
	canAddComponent,
	overSoftComponentLimit,
	overHardComponentLimit,
	onSelectFile,
	onCloseFileTab,
	onReorderOpenFiles,
	onFileContextMenu,
	onAddComponent,
	fileInputRef,
	onSourceUpload,
	form,
	mainEditorSource,
	onMainSourceChange,
	componentTypeLibs,
	componentDefinitionMap,
	onDefinitionSelect,
	monacoMarkers,
	hasActiveComponentFile,
	activeComponentSource,
	activeComponentFileName,
	onComponentSourceChange,
	derivedDuplicateKeys,
	compileStatus,
	compileErrors,
	inspectHighlight = null,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
}: SnippetEditorPanelProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const monacoRef = useRef<Monaco | null>(null)
	const decorationIdsRef = useRef<string[]>([])
	const handleTabBarWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
		const container = event.currentTarget
		if (!container) return
		if (container.scrollWidth <= container.clientWidth) return
		if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
		container.scrollLeft += event.deltaY
		event.preventDefault()
	}, [])
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	const handleTabDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return
		const activeId = active.id as SnippetEditorFileId
		const overId = over.id as SnippetEditorFileId
		const oldIndex = openFiles.indexOf(activeId)
		const newIndex = openFiles.indexOf(overId)
		if (oldIndex === -1 || newIndex === -1) return
		const nextOrder = arrayMove(openFiles, oldIndex, newIndex)
		onReorderOpenFiles(nextOrder)
	}

	const applyInspectHighlight = useCallback(
		(nextHighlight: SnippetInspectHighlight | null) => {
			const editorInstance = editorRef.current
			const monacoInstance = monacoRef.current
			if (!editorInstance || !monacoInstance) return
			const model = editorInstance.getModel()
			if (!model) return

			const decorations: editor.IModelDeltaDecoration[] = []
			if (nextHighlight && nextHighlight.fileId === activeFile) {
				const maxLine = model.getLineCount()
				const startLine = Math.min(Math.max(nextHighlight.startLine, 1), Math.max(maxLine, 1))
				const endLine = Math.min(Math.max(nextHighlight.endLine, 1), Math.max(maxLine, 1))
				const normalizedStart = Math.min(startLine, endLine)
				const normalizedEnd = Math.max(startLine, endLine)
				decorations.push({
					range: new monacoInstance.Range(normalizedStart, 1, normalizedEnd, 1),
					options: {
						isWholeLine: true,
						className:
							nextHighlight.kind === "select"
								? "snippet-inspect-line"
								: "snippet-inspect-line-hover",
						linesDecorationsClassName:
							nextHighlight.kind === "select"
								? "snippet-inspect-gutter"
								: "snippet-inspect-gutter-hover",
					},
				})

				if (nextHighlight.textRanges.length > 0) {
					const inlineClass =
						nextHighlight.kind === "select" ? "snippet-inspect-text" : "snippet-inspect-text-hover"
					for (const range of nextHighlight.textRanges) {
						const rangeStartLine = Math.min(Math.max(range.startLine, 1), Math.max(maxLine, 1))
						const rangeEndLine = Math.min(Math.max(range.endLine, 1), Math.max(maxLine, 1))
						const lineLength = model.getLineLength(rangeStartLine)
						const endLineLength = model.getLineLength(rangeEndLine)
						const rangeStartColumn = Math.min(
							Math.max(range.startColumn, 1),
							Math.max(lineLength + 1, 1),
						)
						const rangeEndColumn = Math.min(
							Math.max(range.endColumn, 1),
							Math.max(endLineLength + 1, 1),
						)
						let startLineNumber = rangeStartLine
						let startColumnNumber = rangeStartColumn
						let endLineNumber = rangeEndLine
						let endColumnNumber = rangeEndColumn
						if (
							startLineNumber > endLineNumber ||
							(startLineNumber === endLineNumber && startColumnNumber >= endColumnNumber)
						) {
							startLineNumber = rangeEndLine
							startColumnNumber = rangeEndColumn
							endLineNumber = rangeStartLine
							endColumnNumber = rangeStartColumn
						}
						if (startLineNumber === endLineNumber && startColumnNumber >= endColumnNumber) {
							continue
						}
						decorations.push({
							range: new monacoInstance.Range(
								startLineNumber,
								startColumnNumber,
								endLineNumber,
								endColumnNumber,
							),
							options: {
								inlineClassName: inlineClass,
							},
						})
					}
				}

				if (nextHighlight.kind === "select") {
					editorInstance.revealLineInCenterIfOutsideViewport(normalizedStart)
				}
			}

			decorationIdsRef.current = editorInstance.deltaDecorations(
				decorationIdsRef.current,
				decorations,
			)
		},
		[activeFile],
	)

	const handleMonacoMount = useCallback(
		(nextEditor: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
			editorRef.current = nextEditor
			monacoRef.current = monacoInstance
			decorationIdsRef.current = []
			applyInspectHighlight(inspectHighlight)
		},
		[applyInspectHighlight, inspectHighlight],
	)

	useEffect(() => {
		applyInspectHighlight(inspectHighlight)
	}, [applyInspectHighlight, inspectHighlight])

	return (
		<div
			ref={containerRef}
			className={cn(
				"flex min-w-0 flex-none overflow-hidden border-r border-neutral-200 transition-[flex-basis] duration-200",
				editorCollapsed && explorerCollapsed && "border-r-0",
			)}
			style={{
				flexBasis: editorCollapsed
					? explorerCollapsed
						? "0px"
						: "13rem"
					: "var(--snippet-editor-basis, 60%)",
			}}
		>
			<div
				className={cn(
					"shrink-0 overflow-hidden bg-neutral-50 transition-all duration-200",
					explorerCollapsed ? "w-0 border-r-0" : "w-52 border-r border-neutral-200",
				)}
			>
				<div
					className={cn(
						"w-52 space-y-1 p-2 transition-opacity duration-200",
						explorerCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
					)}
					aria-hidden={explorerCollapsed}
				>
					<div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
						Explorer
					</div>
					<div className="space-y-2">
						<div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
							<span>Files</span>
							<span>
								{componentCount}/{SNIPPET_COMPONENT_LIMITS.hard} components
							</span>
						</div>
						<div className="space-y-1">
							{editorFiles.map((file) => {
								const Icon = file.icon
								const isActive = activeFile === file.id
								const isMainFile = file.id === "source"
								return (
									<button
										key={file.id}
										type="button"
										onClick={() => onSelectFile(file.id)}
										onContextMenu={(event) => onFileContextMenu(event, file.id)}
										className={cn(
											"flex w-full flex-col gap-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
											isActive
												? "border-neutral-200 bg-white text-neutral-900"
												: "border-transparent text-neutral-600 hover:bg-neutral-100",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex min-w-0 items-center gap-2">
												<Icon className="h-3.5 w-3.5 text-neutral-400" />
												<span className="truncate font-medium">{file.label}</span>
											</div>
											<div className="flex items-center gap-1">
												{isMainFile && (
													<span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
														Main
													</span>
												)}
											</div>
										</div>
										<span className="text-[10px] text-neutral-400">{file.description}</span>
									</button>
								)
							})}
						</div>

						{!hasComponentExports && (
							<div className="rounded-md border border-dashed border-neutral-200 bg-white px-2 py-2 text-[11px] text-neutral-500">
								Export a component to enable preview and props generation.
							</div>
						)}

						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full justify-start text-[11px]"
							onClick={onAddComponent}
							disabled={!canAddComponent}
						>
							<Plus className="mr-2 h-3 w-3" />
							Add component
						</Button>

						{overSoftComponentLimit && !overHardComponentLimit && (
							<div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] text-amber-700">
								Soft limit is {SNIPPET_COMPONENT_LIMITS.soft} components. Consider consolidating
								exports.
							</div>
						)}
						{overHardComponentLimit && (
							<div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-[10px] text-red-700">
								Hard limit reached ({SNIPPET_COMPONENT_LIMITS.hard}). Remove extra exports to
								continue.
							</div>
						)}
					</div>
				</div>
			</div>

			<div
				className={cn(
					"flex flex-1 flex-col overflow-hidden transition-opacity duration-200",
					editorCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
				)}
			>
				<div className="flex h-9 shrink-0 items-center border-b border-neutral-200 bg-neutral-50">
					<div
						className="scrollbar-hidden flex h-full w-full items-center overflow-x-auto overflow-y-hidden"
						onWheel={handleTabBarWheel}
					>
						<div className="flex min-w-full w-max items-center gap-2 px-2">
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleTabDragEnd}
							>
								<SortableContext items={openFiles} strategy={horizontalListSortingStrategy}>
									<div className="flex items-center gap-1">
										{openFiles.map((fileId) => {
											const file = editorFilesById.get(fileId)
											if (!file) return null
											const isActive = activeFile === file.id
											const isOnlyTab = openFiles.length <= 1
											return (
												<SnippetEditorTab
													key={file.id}
													file={file}
													isActive={isActive}
													isOnlyTab={isOnlyTab}
													onSelectFile={onSelectFile}
													onCloseFileTab={onCloseFileTab}
												/>
											)
										})}
									</div>
								</SortableContext>
							</DndContext>
							<div className="ml-auto flex items-center gap-2">
								{isSourceEditorActive && (
									<>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() => fileInputRef.current?.click()}
											disabled={activeFile !== "source"}
										>
											<Upload className="mr-1 h-3 w-3" />
											Upload
										</Button>
										<input
											ref={fileInputRef}
											type="file"
											accept=".jsx,.tsx,.js,.ts"
											className="hidden"
											onChange={onSourceUpload}
										/>
									</>
								)}
								<SnippetHistoryActions
									canUndo={canUndo}
									canRedo={canRedo}
									onUndo={onUndo}
									onRedo={onRedo}
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="flex-1 overflow-hidden">
					{isSourceEditorActive && (
						<FormField
							control={form.control}
							name="source"
							render={() => (
								<FormItem className="relative h-full">
									<FormControl>
										<ClientOnly fallback={<MonacoEditorSkeleton />}>
											<Suspense fallback={<MonacoEditorSkeleton />}>
												<LazyMonacoEditor
													value={mainEditorSource}
													onChange={onMainSourceChange}
													language="typescript"
													path="Snippet.tsx"
													extraLibs={componentTypeLibs}
													definitionMap={componentDefinitionMap}
													onDefinitionSelect={onDefinitionSelect}
													onMount={handleMonacoMount}
													height="100%"
													className="h-full"
													markers={monacoMarkers}
													markerOwner="snippet-compiler"
												/>
											</Suspense>
										</ClientOnly>
									</FormControl>
									<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
								</FormItem>
							)}
						/>
					)}

					{isComponentEditorActive && (
						<div className="h-full">
							<ClientOnly fallback={<MonacoEditorSkeleton />}>
								<Suspense fallback={<MonacoEditorSkeleton />}>
									<LazyMonacoEditor
										value={
											hasActiveComponentFile
												? activeComponentSource
												: "// Component file not found. Add a component to create this file."
										}
										onChange={onComponentSourceChange}
										language="typescript"
										path={activeComponentFileName ?? "Component.tsx"}
										extraLibs={componentTypeLibs}
										onMount={handleMonacoMount}
										height="100%"
										className="h-full"
										markers={[]}
										markerOwner="snippet-compiler"
									/>
								</Suspense>
							</ClientOnly>
						</div>
					)}

					{isPropsSchemaActive && (
						<FormField
							control={form.control}
							name="propsSchema"
							render={({ field }) => (
								<FormItem className="relative h-full">
									<FormControl>
										<ClientOnly fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}>
											<Suspense fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}>
												<LazyMonacoEditor
													value={field.value}
													onChange={field.onChange}
													language="json"
													path="props.schema.json"
													height="100%"
													className="h-full bg-neutral-50"
													readOnly
													onMount={handleMonacoMount}
												/>
											</Suspense>
										</ClientOnly>
									</FormControl>
									<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
								</FormItem>
							)}
						/>
					)}

					{isDefaultPropsActive && (
						<FormField
							control={form.control}
							name="defaultProps"
							render={({ field }) => (
								<FormItem className="relative h-full">
									<FormControl>
										<ClientOnly fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}>
											<Suspense fallback={<MonacoEditorSkeleton className="bg-neutral-50" />}>
												<LazyMonacoEditor
													value={field.value ?? "{}"}
													onChange={field.onChange}
													language="json"
													path="default.props.json"
													height="100%"
													className="h-full bg-neutral-50"
													readOnly
													onMount={handleMonacoMount}
												/>
											</Suspense>
										</ClientOnly>
									</FormControl>
									<FormMessage className="absolute bottom-0 left-0 right-0 bg-red-50 px-4 py-1 text-xs" />
								</FormItem>
							)}
						/>
					)}
				</div>

				<div className="flex h-6 shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4">
					<div className="flex items-center gap-3">
						<p className="text-[11px] text-neutral-500">
							{isSourceEditorActive && "Editing Snippet.tsx. Select a file to preview or edit."}
							{isComponentEditorActive &&
								`Editing ${activeFileMeta?.label ?? "component"} component file.`}
							{isPropsSchemaActive &&
								"Auto-generated from source. Defines the props contract used to validate inputs."}
							{isDefaultPropsActive &&
								"Auto-generated from source. Used when inserting the snippet and in preview mode."}
						</p>
						{derivedDuplicateKeys.length > 0 && (
							<div className="flex items-center gap-1 text-[11px] text-amber-600">
								<AlertCircle className="h-3 w-3" />
								<span>Duplicate prop keys merged: {derivedDuplicateKeys.join(", ")}</span>
							</div>
						)}
					</div>
					<div className="flex items-center gap-1.5">
						{compileStatus === "compiling" && (
							<>
								<Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
								<span className="text-[11px] text-neutral-400">Compiling...</span>
							</>
						)}
						{compileStatus === "success" && (
							<>
								<CheckCircle2 className="h-3 w-3 text-green-500" />
								<span className="text-[11px] text-green-600">Ready</span>
							</>
						)}
						{compileStatus === "error" && (
							<>
								<AlertCircle className="h-3 w-3 text-red-500" />
								<span className="text-[11px] text-red-600">
									{compileErrors.length} error{compileErrors.length !== 1 ? "s" : ""}
								</span>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
