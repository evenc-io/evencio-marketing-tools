"use client"

import { Editor, loader, type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const MONACO_CDN_VERSION = "0.55.1"
let didAddReactTypes = false

const REACT_TYPE_DEFS = `
declare namespace JSX {
  interface Element {}
  interface ElementClass {
    render: unknown;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module "react" {
  export const Fragment: unique symbol;
}

declare module "react/jsx-runtime" {
  export const jsx: (...args: any[]) => any;
  export const jsxs: (...args: any[]) => any;
  export const Fragment: any;
}

declare module "react/jsx-dev-runtime" {
  export const jsx: (...args: any[]) => any;
  export const jsxs: (...args: any[]) => any;
  export const Fragment: any;
}
`.trim()

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
	path?: string
	extraLibs?: Array<{ content: string; filePath: string }>
	definitionMap?: Record<string, string>
	onDefinitionSelect?: (symbol: string, target: string) => void
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
	path,
	extraLibs,
	definitionMap,
	onDefinitionSelect,
	onMount: onMountProp,
	markers,
	markerOwner = "external",
}: MonacoEditorProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
	const monacoRef = useRef<Monaco | null>(null)
	const lastValueRef = useRef(value)
	const [modelValue, setModelValue] = useState(value)
	const pendingValueRef = useRef<string | null>(null)
	const isFocusedRef = useRef(false)
	const [monacoReady, setMonacoReady] = useState(false)
	const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([])
	const definitionMapRef = useRef<Record<string, string>>({})
	const definitionSelectRef = useRef<((symbol: string, target: string) => void) | undefined>(
		undefined,
	)
	const extraLibsRef = useRef(
		new Map<
			string,
			{
				content: string
				dispose: () => void
			}
		>(),
	)

	const handleChange = (newValue?: string) => {
		if (onChange && newValue !== undefined) {
			lastValueRef.current = newValue
			onChange(newValue)
		}
	}

	const clearEditorDisposables = useCallback(() => {
		for (const disposable of editorDisposablesRef.current) {
			disposable.dispose()
		}
		editorDisposablesRef.current = []
	}, [])

	const handleMount = (mountedEditor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
		editorRef.current = mountedEditor
		monacoRef.current = monaco
		setMonacoReady(true)
		clearEditorDisposables()
		editorDisposablesRef.current = [
			mountedEditor.onMouseDown((mouseEvent) => {
				const map = definitionMapRef.current
				const handler = definitionSelectRef.current
				if (!handler) return
				if (!mouseEvent.event.leftButton) return
				if (!mouseEvent.event.metaKey && !mouseEvent.event.ctrlKey) return
				const position = mouseEvent.target.position
				if (!position) return
				const model = mountedEditor.getModel()
				if (!model) return
				const word = model.getWordAtPosition(position)
				if (!word) return
				const target = map[word.word]
				if (!target) return
				mouseEvent.event.preventDefault()
				mouseEvent.event.stopPropagation()
				handler(word.word, target)
			}),
			mountedEditor.onDidFocusEditorText(() => {
				isFocusedRef.current = true
			}),
			mountedEditor.onDidBlurEditorText(() => {
				isFocusedRef.current = false
				const pending = pendingValueRef.current
				if (pending !== null && pending !== lastValueRef.current) {
					pendingValueRef.current = null
					lastValueRef.current = pending
					setModelValue(pending)
				}
			}),
		]
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

	useEffect(() => {
		if (value === lastValueRef.current) return
		const editor = editorRef.current
		if (editor?.hasTextFocus()) {
			pendingValueRef.current = value
			return
		}
		lastValueRef.current = value
		pendingValueRef.current = null
		setModelValue(value)
	}, [value])

	useEffect(() => {
		const monaco = monacoRef.current
		if (!monaco || !monacoReady) return
		const nextLibs = extraLibs ?? []
		const existing = extraLibsRef.current
		const nextPaths = new Set(nextLibs.map((lib) => lib.filePath))

		for (const [filePath, entry] of existing.entries()) {
			if (!nextPaths.has(filePath)) {
				entry.dispose()
				existing.delete(filePath)
			}
		}

		for (const lib of nextLibs) {
			const current = existing.get(lib.filePath)
			if (current && current.content === lib.content) {
				continue
			}
			current?.dispose()
			const disposable = monaco.languages.typescript.typescriptDefaults.addExtraLib(
				lib.content,
				lib.filePath,
			)
			existing.set(lib.filePath, { content: lib.content, dispose: disposable.dispose })
		}
	}, [extraLibs, monacoReady])

	useEffect(() => {
		definitionMapRef.current = definitionMap ?? {}
	}, [definitionMap])

	useEffect(() => {
		definitionSelectRef.current = onDefinitionSelect
	}, [onDefinitionSelect])

	useEffect(() => {
		return () => {
			clearEditorDisposables()
			for (const entry of extraLibsRef.current.values()) {
				entry.dispose()
			}
			extraLibsRef.current.clear()
		}
	}, [clearEditorDisposables])

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
				defaultLanguage={language}
				value={modelValue}
				path={path}
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
					if (!didAddReactTypes) {
						didAddReactTypes = true
						monaco.languages.typescript.typescriptDefaults.addExtraLib(
							REACT_TYPE_DEFS,
							"file:///node_modules/@types/react/index.d.ts",
						)
						monaco.languages.typescript.javascriptDefaults.addExtraLib(
							REACT_TYPE_DEFS,
							"file:///node_modules/@types/react/index.d.ts",
						)
					}
					monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
						target: monaco.languages.typescript.ScriptTarget.ESNext,
						module: monaco.languages.typescript.ModuleKind.ESNext,
						jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
						jsxImportSource: "react",
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
