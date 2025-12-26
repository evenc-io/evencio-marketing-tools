"use client"

import { Editor, loader, type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

const MONACO_CDN_VERSION = "0.55.1"

// Configure Monaco to use CDN-hosted assets for the editor worker/runtime.
if (typeof window !== "undefined") {
	loader.config({
		paths: {
			vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_CDN_VERSION}/min/vs`,
		},
	})
}

type MonacoLanguage = "typescript" | "javascript" | "json" | "css" | "html"

/** External marker to display in the editor gutter */
interface MonacoMarker {
	message: string
	severity: "error" | "warning" | "info"
	startLine: number
	startColumn: number
	endLine: number
	endColumn: number
}

interface MonacoEditorProps {
	value: string
	onChange?: (value: string) => void
	language?: MonacoLanguage
	readOnly?: boolean
	height?: string | number
	className?: string
	placeholder?: string
	/** Callback when editor mounts, provides editor instance and monaco namespace */
	onMount?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void
	/** External markers to display (e.g., compile errors) */
	markers?: MonacoMarker[]
	/** Unique owner ID for markers (default: "external") */
	markerOwner?: string
}

function MonacoEditor({
	value,
	onChange,
	language = "typescript",
	readOnly = false,
	height = 300,
	className,
	placeholder,
	onMount: onMountProp,
	markers,
	markerOwner = "external",
}: MonacoEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const monacoRef = useRef<Monaco | null>(null)

	const handleChange = (newValue?: string) => {
		if (onChange && newValue !== undefined) {
			onChange(newValue)
		}
	}

	const handleMount = (mountedEditor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
		editorRef.current = mountedEditor
		monacoRef.current = monaco
		onMountProp?.(mountedEditor, monaco)
	}

	// Apply external markers when they change
	useEffect(() => {
		const editor = editorRef.current
		const monaco = monacoRef.current
		if (!editor || !monaco) return

		const model = editor.getModel()
		if (!model) return

		if (!markers || markers.length === 0) {
			// Clear markers
			monaco.editor.setModelMarkers(model, markerOwner, [])
			return
		}

		// Convert our markers to Monaco markers
		const monacoMarkers: editor.IMarkerData[] = markers.map((m) => ({
			severity:
				m.severity === "error"
					? monaco.MarkerSeverity.Error
					: m.severity === "warning"
						? monaco.MarkerSeverity.Warning
						: monaco.MarkerSeverity.Info,
			message: m.message,
			startLineNumber: m.startLine,
			startColumn: m.startColumn,
			endLineNumber: m.endLine,
			endColumn: m.endColumn,
		}))

		monaco.editor.setModelMarkers(model, markerOwner, monacoMarkers)
	}, [markers, markerOwner])

	// Clear markers on unmount
	useEffect(() => {
		return () => {
			const editor = editorRef.current
			const monaco = monacoRef.current
			if (editor && monaco) {
				const model = editor.getModel()
				if (model) {
					monaco.editor.setModelMarkers(model, markerOwner, [])
				}
			}
		}
	}, [markerOwner])

	return (
		<div
			data-slot="monaco-editor"
			className={cn(
				"relative overflow-hidden rounded-md border border-neutral-200 bg-white",
				"focus-within:ring-2 focus-within:ring-neutral-900 focus-within:ring-offset-0",
				className,
			)}
		>
			<Editor
				height={height}
				language={language}
				value={value}
				onChange={handleChange}
				onMount={handleMount}
				options={{
					readOnly,
					minimap: { enabled: false },
					lineNumbers: "on",
					scrollBeyondLastLine: false,
					fontSize: 13,
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
					wordWrap: "on",
					automaticLayout: true,
					tabSize: 2,
					insertSpaces: false,
					padding: { top: 8, bottom: 8 },
					scrollbar: {
						vertical: "auto",
						horizontal: "auto",
						verticalScrollbarSize: 10,
						horizontalScrollbarSize: 10,
					},
					overviewRulerLanes: 0,
					hideCursorInOverviewRuler: true,
					overviewRulerBorder: false,
					renderLineHighlight: readOnly ? "none" : "line",
					contextmenu: !readOnly,
					quickSuggestions: !readOnly,
					suggestOnTriggerCharacters: !readOnly,
					folding: true,
					foldingHighlight: false,
					bracketPairColorization: { enabled: true },
				}}
				theme="vs"
				beforeMount={(monaco) => {
					// Configure TypeScript/JavaScript for JSX support
					monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
						target: monaco.languages.typescript.ScriptTarget.ESNext,
						module: monaco.languages.typescript.ModuleKind.ESNext,
						jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
						moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
						allowNonTsExtensions: true,
						allowJs: true,
						esModuleInterop: true,
						strict: true,
					})

					monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
						target: monaco.languages.typescript.ScriptTarget.ESNext,
						module: monaco.languages.typescript.ModuleKind.ESNext,
						jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
						moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
						allowNonTsExtensions: true,
						allowJs: true,
					})
				}}
			/>
			{placeholder && !value && (
				<div className="pointer-events-none absolute inset-0 flex items-start p-3 text-sm text-neutral-400">
					{placeholder}
				</div>
			)}
		</div>
	)
}

export { MonacoEditor, type MonacoEditorProps, type MonacoLanguage, type MonacoMarker }
