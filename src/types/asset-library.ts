export type AssetId = string
export type AssetTagId = string
export type AssetCollectionId = string
export type AssetFavoriteId = string
export type AssetVersionId = string

export type AssetScope = "global" | "org" | "event" | "personal"
export type AssetType = "image" | "svg" | "snippet"
export type SnippetRuntime = "react" | "html"

export interface GlobalScopeRef {
	scope: "global"
}

export interface OrgScopeRef {
	scope: "org"
	orgId: string
}

export interface EventScopeRef {
	scope: "event"
	orgId: string
	eventId: string
}

export interface PersonalScopeRef {
	scope: "personal"
	orgId: string
	ownerUserId: string
	eventId?: string | null
}

export type AssetScopeRef = GlobalScopeRef | OrgScopeRef | EventScopeRef | PersonalScopeRef

export interface AssetTag {
	id: AssetTagId
	name: string
	slug: string
	scope: AssetScopeRef
	createdAt: string
	updatedAt: string
}

export interface AssetCollection {
	id: AssetCollectionId
	name: string
	description?: string | null
	scope: AssetScopeRef
	assetIds: AssetId[]
	createdAt: string
	updatedAt: string
}

export interface AssetFavorite {
	id: AssetFavoriteId
	assetId: AssetId
	userId: string
	createdAt: string
}

export interface AssetVersion {
	id: AssetVersionId
	assetId: AssetId
	version: number
	changelog?: string | null
	createdAt: string
	createdBy?: string | null
}

export interface AssetLicense {
	id: string
	name: string
	url?: string | null
	attributionRequired: boolean
}

export interface AssetAttribution {
	text: string
	url?: string | null
}

export interface AssetMetadata {
	title: string
	description?: string | null
	tags: AssetTagId[]
	license: AssetLicense
	attribution?: AssetAttribution | null
	createdAt: string
	updatedAt: string
	createdBy?: string | null
	updatedBy?: string | null
}

export type AssetMetadataInput = Omit<AssetMetadata, "createdAt" | "updatedAt">

export interface AssetFileRef {
	storageKey: string
	contentType: string
	sizeBytes: number
	checksum: string
	width?: number | null
	height?: number | null
}

export interface AssetStorageRecord extends AssetStorageObject {
	storageKey: string
}

export type SnippetPropType =
	| "string"
	| "number"
	| "boolean"
	| "color"
	| "image"
	| "enum"
	| "object"
	| "array"

export interface SnippetPropDefinition {
	key: string
	label: string
	type: SnippetPropType
	required?: boolean
	default?: unknown
	description?: string | null
	enumValues?: string[]
}

export interface SnippetPropsSchemaDefinition {
	version: 1
	props: SnippetPropDefinition[]
}

export type SnippetProps = Record<string, unknown>

export interface SnippetAssetDefinition {
	entry: string
	runtime: SnippetRuntime
	propsSchema: SnippetPropsSchemaDefinition
}

export interface AssetBase {
	id: AssetId
	type: AssetType
	scope: AssetScopeRef
	metadata: AssetMetadata
	version: number
}

export interface ImageAsset extends AssetBase {
	type: "image"
	file: AssetFileRef
}

export interface SvgAsset extends AssetBase {
	type: "svg"
	file: AssetFileRef
}

export interface SnippetAsset extends AssetBase {
	type: "snippet"
	snippet: SnippetAssetDefinition
	defaultProps: SnippetProps
}

export type Asset = ImageAsset | SvgAsset | SnippetAsset

export interface AssetListQuery {
	types?: AssetType[]
	scope?: AssetScope
	scopeRef?: AssetScopeRef
	tagIds?: AssetTagId[]
	search?: string
}

export interface AssetAccessContext {
	orgId?: string | null
	eventId?: string | null
	userId?: string | null
	allowGlobalRead?: boolean
	allowGlobalWrite?: boolean
}

export interface AssetStorageObject {
	bytes: Uint8Array
	contentType: string
}

export type AssetFileInput = AssetFileRef | AssetStorageObject

export type AssetCreateInput =
	| {
			type: "image"
			scope: AssetScopeRef
			metadata: AssetMetadataInput
			file: AssetFileInput
	  }
	| {
			type: "svg"
			scope: AssetScopeRef
			metadata: AssetMetadataInput
			file: AssetFileInput
	  }
	| {
			type: "snippet"
			scope: AssetScopeRef
			metadata: AssetMetadataInput
			snippet: SnippetAssetDefinition
			defaultProps: SnippetProps
	  }

export interface AssetUpdateInput {
	scope?: AssetScopeRef
	metadata?: Partial<AssetMetadataInput>
	file?: AssetFileInput
	snippet?: SnippetAssetDefinition
	defaultProps?: SnippetProps
	changelog?: string | null
}
