import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { closeDb } from "@/lib/storage/indexeddb"
import {
	deleteSnippetDraft,
	listSnippetDrafts,
	loadSnippetDraft,
	NEW_SNIPPET_DRAFT_ID,
	saveSnippetDraft,
} from "@/routes/-snippets/editor/snippet-drafts"
import type { SnippetDraftRecord } from "@/types/snippet-drafts"
import { resetIndexedDb } from "../../../../../tests/utils/indexeddb"

const buildDraft = (id: string, overrides?: Partial<SnippetDraftRecord>): SnippetDraftRecord => ({
	id,
	assetId: id === NEW_SNIPPET_DRAFT_ID ? null : id,
	title: "Draft title",
	description: "",
	scope: "personal",
	licenseName: "",
	licenseId: "",
	licenseUrl: "",
	attributionRequired: false,
	attributionText: "",
	attributionUrl: "",
	viewportPreset: "custom",
	viewportWidth: 1200,
	viewportHeight: 800,
	source: "export default function Snippet() { return null }",
	propsSchema: "{}",
	defaultProps: "{}",
	entryExport: "default",
	openFiles: ["source"],
	activeFile: "source",
	selectedTemplateId: "single",
	updatedAt: new Date().toISOString(),
	...overrides,
})

describe("snippet-drafts", () => {
	beforeEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	afterEach(async () => {
		await closeDb()
		await resetIndexedDb()
	})

	it("saves and loads drafts", async () => {
		const draft = buildDraft("snippet-1")
		await saveSnippetDraft(draft)
		const stored = await loadSnippetDraft(draft.id)
		expect(stored).not.toBeNull()
		expect(stored?.title).toBe(draft.title)
		expect(stored?.source).toBe(draft.source)
	})

	it("lists and deletes drafts", async () => {
		const draftA = buildDraft("snippet-a")
		const draftB = buildDraft("snippet-b")
		await saveSnippetDraft(draftA)
		await saveSnippetDraft(draftB)

		const drafts = await listSnippetDrafts()
		const ids = drafts.map((draft) => draft.id)
		expect(ids).toContain(draftA.id)
		expect(ids).toContain(draftB.id)

		await deleteSnippetDraft(draftA.id)
		const removed = await loadSnippetDraft(draftA.id)
		expect(removed).toBeNull()
	})

	it("serializes draft writes per id", async () => {
		const baseDraft = buildDraft("snippet-queue")
		const first = saveSnippetDraft({ ...baseDraft, source: "first" })
		const second = saveSnippetDraft({ ...baseDraft, source: "second" })
		await Promise.all([first, second])
		const stored = await loadSnippetDraft(baseDraft.id)
		expect(stored?.source).toBe("second")
	})
})
