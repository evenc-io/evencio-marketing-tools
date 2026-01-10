import { describe, expect, it } from "bun:test"
import { act, renderHook, waitFor } from "@testing-library/react"
import { DEFAULT_SNIPPET_EXPORT, type SnippetComponentExport } from "@/lib/snippets"
import { useSnippetEditorFiles } from "@/routes/-snippets/editor/hooks/snippet/editor-files"
import {
	IMPORT_ASSET_FILE_LEGACY_NAME,
	IMPORT_ASSET_FILE_NAME,
} from "@/routes/-snippets/editor/import-assets"
import { toComponentFileId } from "@/routes/-snippets/editor/snippet-file-utils"

describe("useSnippetEditorFiles", () => {
	it("resets legacy Imports.assets.tsx derived entry exports", async () => {
		const componentExports: SnippetComponentExport[] = [
			{ exportName: DEFAULT_SNIPPET_EXPORT, label: "Main", isDefault: true },
		]

		const { result } = renderHook(() =>
			useSnippetEditorFiles({
				parsedFiles: {
					mainSource: "export default function Snippet() { return <div /> }",
					files: { [IMPORT_ASSET_FILE_LEGACY_NAME]: "" },
				},
				componentExports,
				mainComponentLabel: "Main component",
				selectedTemplateId: "single",
			}),
		)

		act(() => {
			result.current.setActiveComponentExport("Imports.assets")
		})

		await waitFor(() => {
			expect(result.current.activeComponentExport).toBe(DEFAULT_SNIPPET_EXPORT)
		})
	})

	it("deduplicates legacy import-assets file when canonical exists", () => {
		const componentExports: SnippetComponentExport[] = [
			{ exportName: DEFAULT_SNIPPET_EXPORT, label: "Main", isDefault: true },
		]

		const { result } = renderHook(() =>
			useSnippetEditorFiles({
				parsedFiles: {
					mainSource: `export default function Snippet() { return <div /> }`,
					files: {
						[IMPORT_ASSET_FILE_NAME]: "",
						[IMPORT_ASSET_FILE_LEGACY_NAME]: `const EvencioMark = () => <svg viewBox="0 0 10 10" />`,
					},
				},
				componentExports,
				mainComponentLabel: "Main component",
				selectedTemplateId: "single",
			}),
		)

		expect(result.current.componentFileNames).not.toContain(IMPORT_ASSET_FILE_LEGACY_NAME)
		expect(result.current.componentDefinitionMap.EvencioMark).toBe(
			toComponentFileId(IMPORT_ASSET_FILE_NAME),
		)
	})

	it("resets __imports.assets.tsx derived entry exports", async () => {
		const componentExports: SnippetComponentExport[] = [
			{ exportName: DEFAULT_SNIPPET_EXPORT, label: "Main", isDefault: true },
		]

		const { result } = renderHook(() =>
			useSnippetEditorFiles({
				parsedFiles: {
					mainSource: "export default function Snippet() { return <div /> }",
					files: { [IMPORT_ASSET_FILE_NAME]: "" },
				},
				componentExports,
				mainComponentLabel: "Main component",
				selectedTemplateId: "single",
			}),
		)

		act(() => {
			result.current.setActiveComponentExport("__imports.assets")
		})

		await waitFor(() => {
			expect(result.current.activeComponentExport).toBe(DEFAULT_SNIPPET_EXPORT)
		})
	})
})
