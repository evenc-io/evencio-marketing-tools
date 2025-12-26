import { afterAll, describe, expect, it, mock, vi } from "bun:test"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

const createAssetFromUpload = vi.fn(async () => ({ id: "asset" }))
const registerSnippetAsset = vi.fn(async () => ({ id: "snippet" }))

const assetStoreState = {
	tags: [{ id: "tag-1", name: "Brand" }],
	createAssetFromUpload,
	registerSnippetAsset,
}

mock.module("@/stores/asset-library-store", () => ({
	useAssetLibraryStore: (selector: (state: typeof assetStoreState) => unknown) =>
		selector(assetStoreState),
}))

mock.module("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
	TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const { AssetImportDialog } = await import("@/components/asset-library/asset-import-dialog")

describe("AssetImportDialog snippet", () => {
	afterAll(() => {
		mock.restore()
	})
	it("validates snippet props JSON", async () => {
		render(<AssetImportDialog />)
		fireEvent.click(screen.getByRole("button", { name: /add asset/i }))
		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument()
		})

		fireEvent.change(screen.getByPlaceholderText("@/lib/snippets/launch-hero"), {
			target: { value: "@/lib/snippets/launch-hero" },
		})
		const [uploadTitle, snippetTitle] = screen.getAllByPlaceholderText(/launch hero graphic/i)
		fireEvent.change(snippetTitle ?? uploadTitle, { target: { value: "Snippet" } })
		const [uploadTags, snippetTags] = screen.getAllByPlaceholderText(/brand, social, launch/i)
		fireEvent.change(snippetTags ?? uploadTags, { target: { value: "brand" } })
		fireEvent.change(screen.getByPlaceholderText(/version":1/i), {
			target: { value: "not json" },
		})

		fireEvent.click(screen.getByRole("button", { name: /register snippet/i }))

		await waitFor(() => {
			expect(screen.getByText(/props schema must be valid json/i)).toBeInTheDocument()
		})
	})
})
