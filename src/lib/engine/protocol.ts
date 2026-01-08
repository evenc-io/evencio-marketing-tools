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
	notice?: string
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

export type StyleUpdateRequest = {
	source: string
	line: number
	column: number
	backgroundColor?: string | null
	borderWidth?: number | null
	borderColor?: string | null
	borderRadius?: number | string | null
	textColor?: string | null
	fontSize?: number | string | null
	fontWeight?: number | string | null
}

export type StyleUpdateResponse = {
	source: string
	changed: boolean
	reason?: string
	notice?: string
}

export type StyleReadRequest = {
	source: string
	line: number
	column: number
}

export type StyleReadResponse = {
	found: boolean
	reason?: string
	elementName?: string | null
	classNameKind: "none" | "static" | "dynamic"
	editable: boolean
	properties: {
		backgroundColor: { present: boolean; value: string | null }
		borderWidth: { present: boolean; value: number | null }
		borderColor: { present: boolean; value: string | null }
		borderRadius: { present: boolean; value: number | string | null }
		textColor: { present: boolean; value: string | null }
		fontSize: { present: boolean; value: number | string | null }
		fontWeight: { present: boolean; value: number | string | null }
	}
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
	| {
			id: string
			type: "style-update"
			payload: StyleUpdateRequest
	  }
	| {
			id: string
			type: "style-read"
			payload: StyleReadRequest
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
			type: "style-update"
			payload: StyleUpdateResponse
	  }
	| {
			id: string
			type: "style-read"
			payload: StyleReadResponse
	  }
	| {
			id: string
			type: "error"
			error: string
			stack?: string
	  }
