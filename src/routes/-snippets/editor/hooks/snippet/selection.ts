import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { DEFAULT_SNIPPET_EXPORT } from "@/lib/snippets"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	type PreviewSourceLocation,
} from "@/lib/snippets/preview/runtime"
import { SNIPPET_TEMPLATES, type SnippetTemplateId } from "@/lib/snippets/templates"
import {
	CUSTOM_PRESET_ID,
	DEFAULT_DEFAULT_PROPS,
	DEFAULT_PROPS_SCHEMA,
	SNIPPET_FILES,
	STARTER_SOURCE,
} from "@/routes/-snippets/editor/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import { shouldRestoreDraftForAsset } from "@/routes/-snippets/editor/snippet-draft-resolution"
import { getSnippetDraftId, NEW_SNIPPET_DRAFT_ID } from "@/routes/-snippets/editor/snippet-drafts"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"
import {
	invalidateSelectionToken,
	nextSelectionToken,
} from "@/routes/-snippets/editor/snippet-selection-token"
import type { AssetScope, SnippetAsset } from "@/types/asset-library"
import type { SnippetDraftRecord } from "@/types/snippet-drafts"

const normalizeDraftScope = (scope: AssetScope): CustomSnippetValues["scope"] =>
	scope === "global" ? "personal" : scope

const buildFormValuesFromDraft = (draft: SnippetDraftRecord): CustomSnippetValues => ({
	title: draft.title ?? "",
	description: draft.description ?? "",
	scope: normalizeDraftScope(draft.scope),
	licenseName: draft.licenseName ?? "",
	licenseId: draft.licenseId ?? "",
	licenseUrl: draft.licenseUrl ?? "",
	attributionRequired: Boolean(draft.attributionRequired),
	attributionText: draft.attributionText ?? "",
	attributionUrl: draft.attributionUrl ?? "",
	viewportPreset: draft.viewportPreset ?? CUSTOM_PRESET_ID,
	viewportWidth: draft.viewportWidth ?? DEFAULT_PREVIEW_DIMENSIONS.width,
	viewportHeight: draft.viewportHeight ?? DEFAULT_PREVIEW_DIMENSIONS.height,
	source: draft.source ?? "",
	propsSchema: draft.propsSchema ?? JSON.stringify(DEFAULT_PROPS_SCHEMA, null, 2),
	defaultProps: draft.defaultProps ?? JSON.stringify(DEFAULT_DEFAULT_PROPS, null, 2),
})

const resolveDraftTemplate = (value?: string | null): SnippetTemplateId | undefined => {
	if (!value) return undefined
	return Object.hasOwn(SNIPPET_TEMPLATES, value) ? (value as SnippetTemplateId) : undefined
}

interface UseSnippetSelectionOptions {
	isEditing: boolean
	editAssetId: string | null
	isLibraryLoading: boolean
	assetsLength: number
	editableSnippetById: Map<string, SnippetAsset>
	currentDraftId: string
	defaultSnippetValues: CustomSnippetValues
	watchedSource: string
	form: UseFormReturn<CustomSnippetValues>
	activeComponentExport: string
	openFiles: SnippetEditorFileId[]
	activeFile: SnippetEditorFileId
	selectedTemplateId: SnippetTemplateId
	setActiveComponentExport: Dispatch<SetStateAction<string>>
	setOpenFiles: Dispatch<SetStateAction<SnippetEditorFileId[]>>
	setActiveFile: Dispatch<SetStateAction<SnippetEditorFileId>>
	setSelectedTemplateId: Dispatch<SetStateAction<SnippetTemplateId>>
	setIsExamplePreviewActive: Dispatch<SetStateAction<boolean>>
	resetAutoOpenComponents: () => void
	resetComponentExports: () => void
	resetAnalysis: () => void
	resetHistory: (source: string, label?: string) => void
	fileMigrationRef: MutableRefObject<boolean>
	templateAppliedRef: MutableRefObject<boolean>
	loadDraft: (draftId: string) => Promise<SnippetDraftRecord | null>
	saveDraft: (draft: SnippetDraftRecord) => Promise<void>
	setError: Dispatch<SetStateAction<string | null>>
	navigate: (options: { to: "/snippets/editor"; search: { edit?: string } }) => void
	setComponentTreeSelectedId: Dispatch<SetStateAction<string | null>>
	setComponentTreeSelection: Dispatch<SetStateAction<PreviewSourceLocation | null>>
	setComponentTreeSelectionToken: Dispatch<SetStateAction<number>>
}

interface UseSnippetSelectionResult {
	autoCompile: boolean
	handleSnippetSelect: (snippetId: string | null) => void
}

export function useSnippetSelection(
	options: UseSnippetSelectionOptions,
): UseSnippetSelectionResult {
	const {
		isEditing,
		editAssetId,
		isLibraryLoading,
		assetsLength,
		editableSnippetById,
		currentDraftId,
		defaultSnippetValues,
		watchedSource,
		form,
		activeComponentExport,
		openFiles,
		activeFile,
		selectedTemplateId,
		setActiveComponentExport,
		setOpenFiles,
		setActiveFile,
		setSelectedTemplateId,
		setIsExamplePreviewActive,
		resetAutoOpenComponents,
		resetComponentExports,
		resetAnalysis,
		resetHistory,
		fileMigrationRef,
		templateAppliedRef,
		loadDraft,
		saveDraft,
		setError,
		navigate,
		setComponentTreeSelectedId,
		setComponentTreeSelection,
		setComponentTreeSelectionToken,
	} = options

	const editAppliedRef = useRef<string | null>(null)
	const previousEditAssetIdRef = useRef<string | null>(null)
	const previousDraftIdRef = useRef<string | null>(null)
	const newDraftAppliedRef = useRef(false)
	const selectionTokenRef = useRef(0)
	const draftAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const suppressDraftAutosaveRef = useRef(false)
	const pendingSnippetReadyRef = useRef<{ draftId: string; source: string } | null>(null)
	const [snippetReadyDraftId, setSnippetReadyDraftId] = useState<string | null>(null)
	// Trigger counter to ensure the readiness effect runs even when source/draftId
	// don't change (e.g., fresh load where form already has starter source)
	const [pendingReadyTrigger, setPendingReadyTrigger] = useState(0)

	useEffect(() => {
		if (previousEditAssetIdRef.current === editAssetId) return
		previousEditAssetIdRef.current = editAssetId
		editAppliedRef.current = null
		newDraftAppliedRef.current = false
		setSnippetReadyDraftId(null)
		pendingSnippetReadyRef.current = null
	}, [editAssetId])

	const resetSnippetState = useCallback(
		(
			values: CustomSnippetValues,
			optionsOverride?: {
				entryExport?: string
				openFiles?: SnippetEditorFileId[]
				activeFile?: SnippetEditorFileId
				historyLabel?: string
				selectedTemplateId?: SnippetTemplateId
			},
		) => {
			suppressDraftAutosaveRef.current = true
			setError(null)
			setComponentTreeSelectedId(null)
			setComponentTreeSelection(null)
			setComponentTreeSelectionToken((prev) => prev + 1)
			resetAutoOpenComponents()
			fileMigrationRef.current = false
			resetComponentExports()
			resetAnalysis()
			form.reset(values, { keepDirty: false, keepTouched: false })
			resetHistory(values.source ?? "", optionsOverride?.historyLabel ?? "Loaded snippet")
			setOpenFiles(optionsOverride?.openFiles ?? SNIPPET_FILES.map((file) => file.id))
			setActiveFile(optionsOverride?.activeFile ?? "source")
			setActiveComponentExport(optionsOverride?.entryExport ?? DEFAULT_SNIPPET_EXPORT)
			setIsExamplePreviewActive(false)
			if (optionsOverride?.selectedTemplateId) {
				setSelectedTemplateId(optionsOverride.selectedTemplateId)
			}
			const releaseAutosave = () => {
				suppressDraftAutosaveRef.current = false
			}
			if (typeof queueMicrotask === "function") {
				queueMicrotask(releaseAutosave)
			} else {
				setTimeout(releaseAutosave, 0)
			}
		},
		[
			fileMigrationRef,
			form,
			resetAnalysis,
			resetAutoOpenComponents,
			resetComponentExports,
			resetHistory,
			setActiveComponentExport,
			setActiveFile,
			setComponentTreeSelectedId,
			setComponentTreeSelection,
			setComponentTreeSelectionToken,
			setError,
			setIsExamplePreviewActive,
			setOpenFiles,
			setSelectedTemplateId,
		],
	)

	const buildDraftRecord = useCallback(
		(draftId: string): SnippetDraftRecord => {
			const values = form.getValues()
			const now = new Date().toISOString()
			return {
				id: draftId,
				assetId: draftId === NEW_SNIPPET_DRAFT_ID ? null : draftId,
				title: values.title ?? "",
				description: values.description ?? "",
				scope: values.scope,
				licenseName: values.licenseName ?? "",
				licenseId: values.licenseId ?? "",
				licenseUrl: values.licenseUrl ?? "",
				attributionRequired: Boolean(values.attributionRequired),
				attributionText: values.attributionText ?? "",
				attributionUrl: values.attributionUrl ?? "",
				viewportPreset: values.viewportPreset ?? CUSTOM_PRESET_ID,
				viewportWidth: values.viewportWidth ?? DEFAULT_PREVIEW_DIMENSIONS.width,
				viewportHeight: values.viewportHeight ?? DEFAULT_PREVIEW_DIMENSIONS.height,
				source: values.source ?? "",
				propsSchema: values.propsSchema ?? JSON.stringify(DEFAULT_PROPS_SCHEMA, null, 2),
				defaultProps: values.defaultProps ?? JSON.stringify(DEFAULT_DEFAULT_PROPS, null, 2),
				entryExport: activeComponentExport || DEFAULT_SNIPPET_EXPORT,
				openFiles: [...openFiles],
				activeFile,
				selectedTemplateId,
				updatedAt: now,
			}
		},
		[activeComponentExport, activeFile, form, openFiles, selectedTemplateId],
	)

	const applyDraftToEditor = useCallback(
		(draft: SnippetDraftRecord, label = "Draft restored") => {
			const templateId = resolveDraftTemplate(draft.selectedTemplateId)
			const nextOpenFiles =
				draft.openFiles && draft.openFiles.length > 0
					? (draft.openFiles as SnippetEditorFileId[])
					: SNIPPET_FILES.map((file) => file.id)
			const nextActiveFile = (draft.activeFile as SnippetEditorFileId) ?? "source"
			resetSnippetState(buildFormValuesFromDraft(draft), {
				entryExport: draft.entryExport || DEFAULT_SNIPPET_EXPORT,
				openFiles: nextOpenFiles,
				activeFile: nextActiveFile,
				historyLabel: label,
				selectedTemplateId: templateId,
			})
			if (!isEditing) {
				templateAppliedRef.current = true
			}
		},
		[isEditing, resetSnippetState, templateAppliedRef],
	)
	const applyDraftToEditorRef = useRef(applyDraftToEditor)
	applyDraftToEditorRef.current = applyDraftToEditor

	const safeLoadDraft = useCallback(
		async (draftId: string) => {
			try {
				return await loadDraft(draftId)
			} catch {
				return null
			}
		},
		[loadDraft],
	)

	const applyEditAssetState = useCallback(
		(asset: SnippetAsset) => {
			const license = asset.metadata.license
			const attribution = asset.metadata.attribution
			const viewport = asset.snippet.viewport ?? DEFAULT_PREVIEW_DIMENSIONS
			const propsSchema = asset.snippet.propsSchema ?? DEFAULT_PROPS_SCHEMA
			const defaultProps = asset.defaultProps ?? DEFAULT_DEFAULT_PROPS
			resetSnippetState(
				{
					title: asset.metadata.title ?? "",
					description: asset.metadata.description ?? "",
					scope: asset.scope.scope === "global" ? "personal" : asset.scope.scope,
					licenseName: license.name ?? "",
					licenseId: license.id ?? "",
					licenseUrl: license.url ?? "",
					attributionRequired: license.attributionRequired ?? false,
					attributionText: attribution?.text ?? "",
					attributionUrl: attribution?.url ?? "",
					viewportPreset: CUSTOM_PRESET_ID,
					viewportWidth: viewport.width,
					viewportHeight: viewport.height,
					source: asset.snippet.source ?? "",
					propsSchema: JSON.stringify(propsSchema, null, 2),
					defaultProps: JSON.stringify(defaultProps, null, 2),
				},
				{
					entryExport: asset.snippet.entryExport ?? DEFAULT_SNIPPET_EXPORT,
					historyLabel: "Loaded snippet",
				},
			)
		},
		[resetSnippetState],
	)

	const resetToDefaultSnippet = useCallback(() => {
		resetSnippetState(defaultSnippetValues, {
			entryExport: DEFAULT_SNIPPET_EXPORT,
			historyLabel: "Start",
			selectedTemplateId: "single",
		})
		templateAppliedRef.current = false
	}, [defaultSnippetValues, resetSnippetState, templateAppliedRef])

	const applySnippetSelection = useCallback(
		async (snippetId: string | null): Promise<boolean> => {
			const { isStale } = nextSelectionToken(selectionTokenRef)
			setError(null)
			setSnippetReadyDraftId(null)
			pendingSnippetReadyRef.current = null
			if (!snippetId) {
				const draft = await safeLoadDraft(NEW_SNIPPET_DRAFT_ID)
				if (isStale()) return false
				if (draft) {
					applyDraftToEditorRef.current(draft)
					pendingSnippetReadyRef.current = {
						draftId: NEW_SNIPPET_DRAFT_ID,
						source: draft.source ?? "",
					}
				} else {
					resetToDefaultSnippet()
					pendingSnippetReadyRef.current = {
						draftId: NEW_SNIPPET_DRAFT_ID,
						source: defaultSnippetValues.source ?? "",
					}
				}
				// Trigger readiness check even if source/draftId didn't change
				setPendingReadyTrigger((prev) => prev + 1)
				return true
			}

			const asset = editableSnippetById.get(snippetId) ?? null
			if (!asset || !asset.snippet.source) {
				if (isLibraryLoading || assetsLength === 0) {
					return false
				}
				setError("Snippet not found or not editable.")
				return false
			}
			if (asset.scope.scope === "global") {
				setError("Global snippets are not editable.")
				return false
			}

			const draft = await safeLoadDraft(asset.id)
			if (isStale()) return false
			const shouldRestoreDraft =
				draft &&
				shouldRestoreDraftForAsset({
					draftUpdatedAt: draft.updatedAt,
					assetUpdatedAt: asset.metadata.updatedAt,
					draftSource: draft.source ?? "",
					assetSource: asset.snippet.source ?? "",
					starterSource: STARTER_SOURCE,
				})
			if (draft && shouldRestoreDraft) {
				applyDraftToEditorRef.current(draft)
				pendingSnippetReadyRef.current = {
					draftId: asset.id,
					source: draft.source ?? "",
				}
			} else {
				applyEditAssetState(asset)
				pendingSnippetReadyRef.current = {
					draftId: asset.id,
					source: asset.snippet.source ?? "",
				}
			}
			// Trigger readiness check even if source/draftId didn't change
			setPendingReadyTrigger((prev) => prev + 1)
			return true
		},
		[
			applyEditAssetState,
			assetsLength,
			defaultSnippetValues.source,
			editableSnippetById,
			isLibraryLoading,
			setError,
			resetToDefaultSnippet,
			safeLoadDraft,
		],
	)

	// Check if the pending snippet is ready (source matches what we loaded).
	// pendingReadyTrigger ensures this runs even when source/draftId don't change
	// (e.g., fresh load where form already contains starter source).
	// biome-ignore lint/correctness/useExhaustiveDependencies: pendingReadyTrigger is a trigger dependency - we intentionally re-run when it changes even though we don't read its value
	useEffect(() => {
		const pending = pendingSnippetReadyRef.current
		if (!pending) return
		if (pending.draftId !== currentDraftId) return
		const expected = pending.source.replaceAll("\r\n", "\n")
		const actual = watchedSource.replaceAll("\r\n", "\n")
		if (expected !== actual) return
		pendingSnippetReadyRef.current = null
		setSnippetReadyDraftId(pending.draftId)
	}, [currentDraftId, watchedSource, pendingReadyTrigger])

	useEffect(() => {
		let cancelled = false
		const applySnippetState = async () => {
			if (!isEditing) {
				editAppliedRef.current = null
				if (newDraftAppliedRef.current) return
				const applied = await applySnippetSelection(null)
				if (cancelled) return
				if (applied) {
					newDraftAppliedRef.current = true
				}
				return
			}

			newDraftAppliedRef.current = false
			if (isLibraryLoading) return
			if (editAppliedRef.current === editAssetId) return

			const applied = await applySnippetSelection(editAssetId)
			if (cancelled) return
			if (applied) {
				editAppliedRef.current = editAssetId
			}
		}
		void applySnippetState()
		return () => {
			cancelled = true
		}
	}, [applySnippetSelection, editAssetId, isEditing, isLibraryLoading])

	const scheduleDraftAutosave = useCallback(() => {
		if (suppressDraftAutosaveRef.current) return
		if (!form.formState.isDirty) return
		if (draftAutosaveTimerRef.current) {
			clearTimeout(draftAutosaveTimerRef.current)
		}
		draftAutosaveTimerRef.current = setTimeout(() => {
			void saveDraft(buildDraftRecord(currentDraftId))
		}, 1200)
	}, [buildDraftRecord, currentDraftId, form.formState.isDirty, saveDraft])

	useEffect(() => {
		const subscription = form.watch(() => {
			scheduleDraftAutosave()
		})
		return () => subscription.unsubscribe()
	}, [form, scheduleDraftAutosave])

	useEffect(() => {
		return () => {
			if (draftAutosaveTimerRef.current) {
				clearTimeout(draftAutosaveTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		if (previousDraftIdRef.current === currentDraftId) return
		previousDraftIdRef.current = currentDraftId
		if (draftAutosaveTimerRef.current) {
			clearTimeout(draftAutosaveTimerRef.current)
			draftAutosaveTimerRef.current = null
		}
	}, [currentDraftId])

	const handleSnippetSelect = useCallback(
		(snippetId: string | null) => {
			const nextDraftId = getSnippetDraftId(snippetId)
			if (nextDraftId === currentDraftId) return
			setSnippetReadyDraftId(null)
			pendingSnippetReadyRef.current = null
			setError(null)
			if (draftAutosaveTimerRef.current) {
				clearTimeout(draftAutosaveTimerRef.current)
				draftAutosaveTimerRef.current = null
			}
			void saveDraft(buildDraftRecord(currentDraftId))
			editAppliedRef.current = null
			newDraftAppliedRef.current = false
			invalidateSelectionToken(selectionTokenRef)
			if (snippetId) {
				navigate({ to: "/snippets/editor", search: { edit: snippetId } })
				return
			}
			navigate({ to: "/snippets/editor", search: {} })
		},
		[buildDraftRecord, currentDraftId, navigate, saveDraft, setError],
	)

	return {
		autoCompile: snippetReadyDraftId === currentDraftId,
		handleSnippetSelect,
	}
}
