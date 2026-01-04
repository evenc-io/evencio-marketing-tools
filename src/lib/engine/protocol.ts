import type { CompileResult } from "@/lib/snippets/compiler"
import type { SnippetComponentTreeNode } from "@/lib/snippets/component-tree"
import type { SnippetInspectIndex } from "@/lib/snippets/inspect-index"
import type { SnippetComponentExport } from "@/lib/snippets/source/derived"
import type { SnippetLineMapSegment } from "@/lib/snippets/source/files"
import type { SourceSecurityIssue } from "@/lib/snippets/source/security"
import type { SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"

export type AnalyzeTsxRequest = {
	source: string
	includeTailwind?: boolean
	includeInspect?: boolean
}

export type AnalyzeTsxResponse = {
	exports: SnippetComponentExport[]
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	duplicateKeys: string[]
	propsSchemaJson: string
	defaultPropsJson: string
	securityIssues: SourceSecurityIssue[]
	tailwindCss: string | null
	tailwindError: string | null
	sourceHash: number
	inspectIndexByFile?: Record<string, SnippetInspectIndex | null>
	inspectIndexByFileId?: Record<string, SnippetInspectIndex | null>
	lineMapSegments?: SnippetLineMapSegment[]
}

export type ComponentTreeRequest = {
	source: string
	entryExport?: string
}

export type ComponentTreeResponse = SnippetComponentTreeNode[]

export type CompileSnippetRequest = {
	source: string
	entryExport?: string
}

export type CompileSnippetResponse = CompileResult

export type LayoutTranslateRequest = {
	source: string
	line: number
	column: number
	translateX: number
	translateY: number
	alignX?: "left" | "center" | "right" | null
	alignY?: "top" | "center" | "bottom" | null
	width?: number
	height?: number
}

export type LayoutTranslateResponse = {
	source: string
	changed: boolean
	reason?: string
}

export type InsertChildRequest = {
	source: string
	line: number
	column: number
	jsx: string
}

export type InsertChildResponse = {
	source: string
	changed: boolean
	insertedAt?: { line: number; column: number }
	reason?: string
}

export type EngineRequest =
	| {
			id: string
			type: "analyze"
			payload: AnalyzeTsxRequest
	  }
	| {
			id: string
			type: "component-tree"
			payload: ComponentTreeRequest
	  }
	| {
			id: string
			type: "component-tree-js"
			payload: ComponentTreeRequest
	  }
	| {
			id: string
			type: "compile"
			payload: CompileSnippetRequest
	  }
	| {
			id: string
			type: "layout-translate"
			payload: LayoutTranslateRequest
	  }
	| {
			id: string
			type: "insert-child"
			payload: InsertChildRequest
	  }

export type EngineResponse =
	| {
			id: string
			type: "analyze"
			payload: AnalyzeTsxResponse
	  }
	| {
			id: string
			type: "component-tree"
			payload: ComponentTreeResponse
	  }
	| {
			id: string
			type: "component-tree-js"
			payload: ComponentTreeResponse
	  }
	| {
			id: string
			type: "compile"
			payload: CompileSnippetResponse
	  }
	| {
			id: string
			type: "layout-translate"
			payload: LayoutTranslateResponse
	  }
	| {
			id: string
			type: "insert-child"
			payload: InsertChildResponse
	  }
	| {
			id: string
			type: "error"
			error: string
			stack?: string
	  }
