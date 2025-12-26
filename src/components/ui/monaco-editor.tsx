"use client"

import { Editor, loader } from "@monaco-editor/react"

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

interface MonacoEditorProps {
	value: string
	onChange?: (value: string) => void
	language?: MonacoLanguage
	readOnly?: boolean
	height?: string | number
	className?: string
	placeholder?: string
}

function MonacoEditor({
	value,
	onChange,
	language = "typescript",
	readOnly = false,
	height = 300,
	className,
	placeholder,
}: MonacoEditorProps) {
	const handleChange = (newValue?: string) => {
		if (onChange && newValue !== undefined) {
			onChange(newValue)
		}
	}

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

export { MonacoEditor, type MonacoEditorProps, type MonacoLanguage }
