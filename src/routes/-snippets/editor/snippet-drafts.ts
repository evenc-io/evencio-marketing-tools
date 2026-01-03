import { getDb, isIndexedDBAvailable } from "@/lib/storage/indexeddb"
import type { SnippetDraftRecord } from "@/types/snippet-drafts"

export const NEW_SNIPPET_DRAFT_ID = "snippet-draft:new"

const draftWriteQueues = new Map<string, Promise<unknown>>()

const enqueueDraftWrite = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
	const previous = draftWriteQueues.get(key) ?? Promise.resolve()
	const next = previous.then(task, task)
	draftWriteQueues.set(key, next)
	try {
		return await next
	} finally {
		if (draftWriteQueues.get(key) === next) {
			draftWriteQueues.delete(key)
		}
	}
}

export const getSnippetDraftId = (assetId: string | null) => assetId ?? NEW_SNIPPET_DRAFT_ID

export async function loadSnippetDraft(draftId: string): Promise<SnippetDraftRecord | null> {
	if (!isIndexedDBAvailable()) return null
	const db = await getDb()
	const draft = await db.get("snippetDrafts", draftId)
	return draft ?? null
}

export async function listSnippetDrafts(): Promise<SnippetDraftRecord[]> {
	if (!isIndexedDBAvailable()) return []
	const db = await getDb()
	const drafts = await db.getAll("snippetDrafts")
	return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function saveSnippetDraft(draft: SnippetDraftRecord): Promise<void> {
	if (!isIndexedDBAvailable()) return
	await enqueueDraftWrite(draft.id, async () => {
		const db = await getDb()
		await db.put("snippetDrafts", draft)
	})
}

export async function deleteSnippetDraft(draftId: string): Promise<void> {
	if (!isIndexedDBAvailable()) return
	const db = await getDb()
	await db.delete("snippetDrafts", draftId)
}
