import type { AssetScope } from "./asset-library"

export interface SnippetDraftRecord {
	id: string
	assetId: string | null
	title: string
	description?: string | null
	scope: AssetScope
	licenseName: string
	licenseId: string
	licenseUrl?: string | null
	attributionRequired: boolean
	attributionText?: string | null
	attributionUrl?: string | null
	viewportPreset?: string | null
	viewportWidth: number
	viewportHeight: number
	source: string
	propsSchema: string
	defaultProps?: string | null
	entryExport: string
	openFiles: string[]
	activeFile: string
	selectedTemplateId?: string | null
	updatedAt: string
}
