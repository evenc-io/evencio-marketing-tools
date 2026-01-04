export interface PreviewDimensions {
	width: number
	height: number
}

export interface PreviewSourceLocation {
	fileName?: string
	lineNumber?: number
	columnNumber?: number
}

export interface PreviewLayerNode {
	id: string
	tag: string
	rect: { x: number; y: number; width: number; height: number }
	depth: number
	stackDepth: number
	zIndex: number | null
	opacity: number
	order: number
	parentId: string | null
	source?: PreviewSourceLocation | null
}

export interface PreviewLayerSnapshot {
	width: number
	height: number
	capturedAt: number
	nodes: PreviewLayerNode[]
}

export interface PreviewLayoutCommit {
	source: PreviewSourceLocation | null
	translate: { x: number; y: number }
	alignX?: "left" | "center" | "right" | null
	alignY?: "top" | "center" | "bottom" | null
	width?: number
	height?: number
}

export interface PreviewLayoutDebugEvent {
	seq: number
	time: number
	kind: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "commit" | "debug-toggle"
	pointerId: number | null
	clientX: number | null
	clientY: number | null
	movementX: number | null
	movementY: number | null
	startX: number
	startY: number
	latestX: number
	latestY: number
	dx: number
	dy: number
	baseTranslate: { x: number; y: number }
	currentTranslate: { x: number; y: number }
	translate?: { x: number; y: number } | null
	moved?: boolean
	tag?: string | null
	rect?: { x: number; y: number; width: number; height: number } | null
	source?: PreviewSourceLocation | null
	inspectScale?: number
	inlineTranslate?: string | null
	computedTranslate?: string | null
	computedTransform?: string | null
	parsedInline?: { x: number; y: number; partsCount: number } | null
	parsedComputed?: { x: number; y: number; partsCount: number } | null
	sourceKey?: string | null
	note?: string
}

export type PreviewMessage =
	| { type: "ready" }
	| { type: "render-success" }
	| { type: "render-error"; error?: string; stack?: string }
	| { type: "inspect-hover"; source: PreviewSourceLocation | null }
	| { type: "inspect-select"; source: PreviewSourceLocation | null }
	| { type: "inspect-context"; source: PreviewSourceLocation | null; x: number; y: number }
	| { type: "inspect-escape" }
	| { type: "layers-snapshot"; snapshot: PreviewLayerSnapshot }
	| { type: "layers-error"; error: string }
	| { type: "layout-commit"; commit: PreviewLayoutCommit }
	| { type: "layout-debug"; entry: PreviewLayoutDebugEvent }
	| { type: "import-assets-remove"; assetId: string }
