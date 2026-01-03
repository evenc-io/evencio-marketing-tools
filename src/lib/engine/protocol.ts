import type { CompileResult } from "@/lib/snippets/compiler"
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
}

export type LayoutTranslateResponse = {
	source: string
	changed: boolean
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
			type: "compile"
			payload: CompileSnippetRequest
	  }
	| {
			id: string
			type: "layout-translate"
			payload: LayoutTranslateRequest
	  }

export type EngineResponse =
	| {
			id: string
			type: "analyze"
			payload: AnalyzeTsxResponse
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
			type: "error"
			error: string
			stack?: string
	  }
