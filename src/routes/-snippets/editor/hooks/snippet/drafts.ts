import { useCallback, useEffect, useRef, useState } from "react"
import { isIndexedDBAvailable } from "@/lib/storage/indexeddb"
import {
	deleteSnippetDraft,
	listSnippetDrafts,
	loadSnippetDraft,
	saveSnippetDraft,
} from "@/routes/-snippets/editor/snippet-drafts"
import type { SnippetDraftRecord } from "@/types/snippet-drafts"

interface UseSnippetDraftsResult {
	draftIds: Set<string>
	isReady: boolean
	refreshDrafts: () => Promise<void>
	loadDraft: (draftId: string) => Promise<SnippetDraftRecord | null>
	saveDraft: (draft: SnippetDraftRecord) => Promise<void>
	deleteDraft: (draftId: string) => Promise<void>
}

export function useSnippetDrafts(): UseSnippetDraftsResult {
	const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set())
	const [isReady, setIsReady] = useState(false)
	const isMountedRef = useRef(true)

	useEffect(() => {
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const refreshDrafts = useCallback(async () => {
		if (!isIndexedDBAvailable()) {
			if (isMountedRef.current) {
				setDraftIds(new Set())
				setIsReady(true)
			}
			return
		}
		try {
			const drafts = await listSnippetDrafts()
			if (!isMountedRef.current) return
			setDraftIds(new Set(drafts.map((draft) => draft.id)))
			setIsReady(true)
		} catch {
			if (!isMountedRef.current) return
			setDraftIds(new Set())
			setIsReady(true)
		}
	}, [])

	useEffect(() => {
		void refreshDrafts()
	}, [refreshDrafts])

	const loadDraft = useCallback(async (draftId: string) => {
		if (!isIndexedDBAvailable()) return null
		return loadSnippetDraft(draftId)
	}, [])

	const saveDraft = useCallback(async (draft: SnippetDraftRecord) => {
		if (!isIndexedDBAvailable()) return
		await saveSnippetDraft(draft)
		if (!isMountedRef.current) return
		setDraftIds((prev) => {
			const next = new Set(prev)
			next.add(draft.id)
			return next
		})
	}, [])

	const deleteDraft = useCallback(async (draftId: string) => {
		if (!isIndexedDBAvailable()) return
		await deleteSnippetDraft(draftId)
		if (!isMountedRef.current) return
		setDraftIds((prev) => {
			const next = new Set(prev)
			next.delete(draftId)
			return next
		})
	}, [])

	return {
		draftIds,
		isReady,
		refreshDrafts,
		loadDraft,
		saveDraft,
		deleteDraft,
	}
}
