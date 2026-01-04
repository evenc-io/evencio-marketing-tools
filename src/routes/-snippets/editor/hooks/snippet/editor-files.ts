import { FileCode } from "lucide-react"
import type { Dispatch, MouseEvent, SetStateAction } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_SNIPPET_EXPORT, type SnippetComponentExport } from "@/lib/snippets"
import type { SnippetTemplateId } from "@/lib/snippets/templates"
import { SNIPPET_FILES } from "@/routes/-snippets/editor/constants"
import {
	getImportAssetsInFileSource,
	IMPORT_ASSET_FILE_NAME,
} from "@/routes/-snippets/editor/import-assets"
import type {
	SnippetEditorFile,
	SnippetEditorFileId,
} from "@/routes/-snippets/editor/snippet-editor-types"
import {
	extractNamedExports,
	getComponentExportName,
	getComponentFileName,
	getExportNameFromFile,
	isComponentFileId,
	stripAutoImportBlock,
	toComponentFileId,
} from "@/routes/-snippets/editor/snippet-file-utils"

type FileContextMenuState = {
	open: boolean
	x: number
	y: number
	fileId: SnippetEditorFileId | null
}

type UseSnippetEditorFilesOptions = {
	parsedFiles: { mainSource: string; files: Record<string, string> }
	componentExports: SnippetComponentExport[]
	mainComponentLabel: string
	selectedTemplateId: SnippetTemplateId
}

type UseSnippetEditorFilesResult = {
	openFiles: SnippetEditorFileId[]
	setOpenFiles: Dispatch<SetStateAction<SnippetEditorFileId[]>>
	activeFile: SnippetEditorFileId
	setActiveFile: Dispatch<SetStateAction<SnippetEditorFileId>>
	activeComponentExport: string
	setActiveComponentExport: Dispatch<SetStateAction<string>>
	resetAutoOpenComponents: () => void
	fileContextMenu: FileContextMenuState
	contextMenuFile: SnippetEditorFile | null
	canCloseContextTab: boolean
	editorFiles: SnippetEditorFile[]
	editorFilesById: Map<SnippetEditorFileId, SnippetEditorFile>
	componentDefinitionMap: Record<string, SnippetEditorFileId>
	componentTypeLibs: Array<{ content: string; filePath: string }>
	componentFileNames: string[]
	mainEditorSource: string
	isSourceEditorActive: boolean
	isComponentEditorActive: boolean
	isPropsSchemaActive: boolean
	isDefaultPropsActive: boolean
	activeComponentFileName: string | null
	hasActiveComponentFile: boolean
	activeComponentSource: string
	getSourceForFile: (fileId: SnippetEditorFileId) => string
	openFileTab: (fileId: SnippetEditorFileId) => void
	openFileForInspect: (fileId: SnippetEditorFileId) => void
	closeFileTab: (fileId: SnippetEditorFileId) => void
	selectFile: (fileId: SnippetEditorFileId) => void
	handleReorderOpenFiles: (fileIds: SnippetEditorFileId[]) => void
	handleDefinitionSelect: (_symbol: string, target: string) => void
	handleFileContextMenu: (event: MouseEvent<HTMLButtonElement>, fileId: SnippetEditorFileId) => void
	handleFileContextMenuOpenChange: (open: boolean) => void
}

export const useSnippetEditorFiles = ({
	parsedFiles,
	componentExports,
	mainComponentLabel,
	selectedTemplateId,
}: UseSnippetEditorFilesOptions): UseSnippetEditorFilesResult => {
	const contextMenuStampRef = useRef<number | null>(null)
	const suppressComponentSyncRef = useRef(false)
	const autoOpenComponentsRef = useRef(false)
	const [openFiles, setOpenFiles] = useState<SnippetEditorFileId[]>(() =>
		SNIPPET_FILES.map((file) => file.id),
	)
	const [activeFile, setActiveFile] = useState<SnippetEditorFileId>("source")
	const [activeComponentExport, setActiveComponentExport] = useState(DEFAULT_SNIPPET_EXPORT)
	const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		fileId: null,
	})

	const componentFileNames = useMemo(
		() => Object.keys(parsedFiles.files).sort((a, b) => a.localeCompare(b)),
		[parsedFiles.files],
	)
	const importAssetsFileSource = parsedFiles.files[IMPORT_ASSET_FILE_NAME] ?? ""
	const canDeleteImportAssetsFile =
		Object.hasOwn(parsedFiles.files, IMPORT_ASSET_FILE_NAME) &&
		importAssetsFileSource.trim().length === 0
	const editorFiles = useMemo<SnippetEditorFile[]>(() => {
		const mainFile = SNIPPET_FILES.find((file) => file.id === "source")
		const jsonFiles = SNIPPET_FILES.filter((file) => file.id !== "source")
		const staticFiles: SnippetEditorFile[] = [
			...(mainFile
				? [
						{
							id: mainFile.id,
							label: mainFile.label,
							description: mainComponentLabel,
							kind: mainFile.id,
							icon: mainFile.icon,
							deletable: false,
						},
					]
				: []),
		]

		const componentFiles: SnippetEditorFile[] = componentFileNames.map((fileName) => {
			if (fileName === IMPORT_ASSET_FILE_NAME) {
				const canDelete = canDeleteImportAssetsFile
				return {
					id: toComponentFileId(fileName),
					label: "Imports.assets.tsx",
					description: canDelete
						? "Auto-managed imports (assets) — empty"
						: "Auto-managed imports (assets)",
					kind: "component",
					icon: FileCode,
					exportName: getExportNameFromFile(fileName),
					fileName,
					deletable: canDelete,
				}
			}
			const exportName = getExportNameFromFile(fileName)
			return {
				id: toComponentFileId(fileName),
				label: fileName,
				description: "Component file",
				kind: "component",
				icon: FileCode,
				exportName,
				fileName,
				deletable: true,
			}
		})

		return [
			...staticFiles,
			...componentFiles,
			...jsonFiles.map((file) => ({
				id: file.id,
				label: file.label,
				description: file.description,
				kind: file.id,
				icon: file.icon,
				deletable: false,
			})),
		]
	}, [canDeleteImportAssetsFile, componentFileNames, mainComponentLabel])

	const editorFilesById = useMemo(
		() => new Map(editorFiles.map((file) => [file.id, file])),
		[editorFiles],
	)

	const componentTypeLibs = useMemo(() => {
		const libs: Array<{ content: string; filePath: string }> = []
		if (Object.hasOwn(parsedFiles.files, IMPORT_ASSET_FILE_NAME)) {
			const activeAssets = getImportAssetsInFileSource(
				parsedFiles.files[IMPORT_ASSET_FILE_NAME] ?? "",
			)
			if (activeAssets.length) {
				const declarations = activeAssets
					.map((asset) => `declare const ${asset.componentName}: (props: any) => JSX.Element;`)
					.join("\n")
				libs.push({
					filePath: "file:///snippets/imports/assets.d.ts",
					content: declarations,
				})
			}
		}
		for (const [fileName, fileSource] of Object.entries(parsedFiles.files)) {
			const exportNames = extractNamedExports(fileSource)
			if (exportNames.length === 0) continue
			const declarations = exportNames
				.map((name) => `declare const ${name}: (props: any) => JSX.Element;`)
				.join("\n")
			libs.push({
				filePath: `file:///snippets/components/${fileName}.d.ts`,
				content: declarations,
			})
		}
		return libs
	}, [parsedFiles.files])

	const componentDefinitionMap = useMemo(() => {
		const map: Record<string, SnippetEditorFileId> = {}
		for (const [fileName, fileSource] of Object.entries(parsedFiles.files)) {
			if (fileName === IMPORT_ASSET_FILE_NAME) {
				const fileId = toComponentFileId(fileName)
				const activeAssets = getImportAssetsInFileSource(fileSource)
				for (const asset of activeAssets) {
					if (!map[asset.componentName]) {
						map[asset.componentName] = fileId
					}
				}
			}
			const exportNames = extractNamedExports(fileSource)
			if (exportNames.length === 0) continue
			const fileId = toComponentFileId(fileName)
			for (const name of exportNames) {
				if (!map[name]) {
					map[name] = fileId
				}
			}
		}
		return map
	}, [parsedFiles.files])

	const contextMenuFile = fileContextMenu.fileId
		? (editorFilesById.get(fileContextMenu.fileId) ?? null)
		: null
	const canCloseContextTab = contextMenuFile
		? openFiles.includes(contextMenuFile.id) && openFiles.length > 1
		: false

	const isSourceEditorActive = activeFile === "source"
	const isComponentEditorActive = isComponentFileId(activeFile)
	const isPropsSchemaActive = activeFile === "propsSchema"
	const isDefaultPropsActive = activeFile === "defaultProps"
	const mainEditorSource = useMemo(
		() => stripAutoImportBlock(parsedFiles.mainSource),
		[parsedFiles.mainSource],
	)

	const getSourceForFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			if (fileId === "source") return mainEditorSource
			if (!isComponentFileId(fileId)) return ""
			const fileName = getComponentFileName(fileId)
			if (!fileName) return ""
			return parsedFiles.files[fileName] ?? ""
		},
		[mainEditorSource, parsedFiles.files],
	)

	const activeComponentFileName = isComponentFileId(activeFile)
		? getComponentFileName(activeFile)
		: null
	const hasActiveComponentFile = activeComponentFileName
		? Object.hasOwn(parsedFiles.files, activeComponentFileName)
		: false
	const activeComponentSource =
		activeComponentFileName && hasActiveComponentFile
			? (parsedFiles.files[activeComponentFileName] ?? "")
			: ""

	const openFileTab = useCallback((fileId: SnippetEditorFileId) => {
		setOpenFiles((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
		setActiveFile(fileId)
	}, [])

	const openFileForInspect = useCallback(
		(fileId: SnippetEditorFileId) => {
			setOpenFiles((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
			if (fileId !== activeFile && isComponentFileId(fileId)) {
				suppressComponentSyncRef.current = true
			}
			if (fileId !== activeFile) {
				setActiveFile(fileId)
			}
		},
		[activeFile],
	)

	const closeFileTab = useCallback(
		(fileId: SnippetEditorFileId) => {
			setOpenFiles((prev) => {
				if (!prev.includes(fileId) || prev.length <= 1) return prev
				const next = prev.filter((entry) => entry !== fileId)
				if (activeFile === fileId) {
					const index = prev.indexOf(fileId)
					const nextActive = next[index] ?? next[index - 1] ?? next[0]
					if (nextActive) {
						setActiveFile(nextActive)
						if (isComponentFileId(nextActive)) {
							const fileName = getComponentFileName(nextActive)
							if (fileName !== IMPORT_ASSET_FILE_NAME) {
								const exportName = getComponentExportName(nextActive)
								if (exportName) {
									setActiveComponentExport(exportName)
								}
							}
						} else if (nextActive === "source") {
							setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
						}
					}
				}
				return next
			})
		},
		[activeFile],
	)

	const selectFile = useCallback(
		(fileId: SnippetEditorFileId) => {
			openFileTab(fileId)
			if (isComponentFileId(fileId)) {
				const fileName = getComponentFileName(fileId)
				if (fileName !== IMPORT_ASSET_FILE_NAME) {
					const exportName = getComponentExportName(fileId)
					if (exportName) {
						setActiveComponentExport(exportName)
					}
				}
				return
			}
			if (fileId === "source") {
				setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
			}
		},
		[openFileTab],
	)

	const handleReorderOpenFiles = useCallback((fileIds: SnippetEditorFileId[]) => {
		setOpenFiles(fileIds)
	}, [])

	const handleDefinitionSelect = useCallback(
		(_symbol: string, target: string) => {
			const fileId = target as SnippetEditorFileId
			if (componentDefinitionMap[_symbol] === fileId) {
				selectFile(fileId)
			}
		},
		[componentDefinitionMap, selectFile],
	)

	const handleFileContextMenu = useCallback(
		(event: MouseEvent<HTMLButtonElement>, fileId: SnippetEditorFileId) => {
			if (contextMenuStampRef.current === event.timeStamp) return
			contextMenuStampRef.current = event.timeStamp
			event.preventDefault()
			setFileContextMenu({
				open: true,
				x: event.clientX,
				y: event.clientY,
				fileId,
			})
		},
		[],
	)

	const handleFileContextMenuOpenChange = useCallback((open: boolean) => {
		setFileContextMenu((prev) => ({ ...prev, open, fileId: open ? prev.fileId : null }))
	}, [])

	useEffect(() => {
		const hasActiveExport = componentExports.some(
			(component) => component.exportName === activeComponentExport,
		)
		const hasActiveFile = componentFileNames.some(
			(fileName) => getExportNameFromFile(fileName) === activeComponentExport,
		)
		if (hasActiveExport || hasActiveFile) return
		if (componentExports.length === 0) {
			return
		}
		const fallback =
			componentExports.find((component) => component.isDefault) ?? componentExports[0]
		if (fallback) {
			setActiveComponentExport(fallback.exportName)
		}
	}, [activeComponentExport, componentExports, componentFileNames])

	useEffect(() => {
		if (!isComponentFileId(activeFile)) return
		const activeFileName = getComponentFileName(activeFile)
		if (activeFileName === IMPORT_ASSET_FILE_NAME) return
		if (suppressComponentSyncRef.current) {
			suppressComponentSyncRef.current = false
			return
		}
		const exportName = getComponentExportName(activeFile)
		if (exportName && exportName !== activeComponentExport) {
			setActiveComponentExport(exportName)
		}
	}, [activeComponentExport, activeFile])

	useEffect(() => {
		const validIds = new Set(editorFiles.map((file) => file.id))
		setOpenFiles((prev) => {
			const next = prev.filter((fileId) => validIds.has(fileId))
			if (next.length === 0) return ["source"]
			return next.length === prev.length ? prev : next
		})
		if (!validIds.has(activeFile)) {
			setActiveFile("source")
			setActiveComponentExport(DEFAULT_SNIPPET_EXPORT)
		}
	}, [activeFile, editorFiles])

	useEffect(() => {
		if (autoOpenComponentsRef.current) return
		if (selectedTemplateId !== "multi") return
		const componentIds = componentFileNames.map((fileName) => toComponentFileId(fileName))
		if (componentIds.length === 0) return
		setOpenFiles((prev) => {
			const next = [...prev]
			for (const fileId of componentIds) {
				if (!next.includes(fileId)) {
					next.push(fileId)
				}
			}
			return next
		})
		autoOpenComponentsRef.current = true
	}, [componentFileNames, selectedTemplateId])

	const resetAutoOpenComponents = useCallback(() => {
		autoOpenComponentsRef.current = false
	}, [])

	return {
		openFiles,
		setOpenFiles,
		activeFile,
		setActiveFile,
		activeComponentExport,
		setActiveComponentExport,
		resetAutoOpenComponents,
		fileContextMenu,
		contextMenuFile,
		canCloseContextTab,
		editorFiles,
		editorFilesById,
		componentDefinitionMap,
		componentTypeLibs,
		componentFileNames,
		mainEditorSource,
		isSourceEditorActive,
		isComponentEditorActive,
		isPropsSchemaActive,
		isDefaultPropsActive,
		activeComponentFileName,
		hasActiveComponentFile,
		activeComponentSource,
		getSourceForFile,
		openFileTab,
		openFileForInspect,
		closeFileTab,
		selectFile,
		handleReorderOpenFiles,
		handleDefinitionSelect,
		handleFileContextMenu,
		handleFileContextMenuOpenChange,
	}
}
