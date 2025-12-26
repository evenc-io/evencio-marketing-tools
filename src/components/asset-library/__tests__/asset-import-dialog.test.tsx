import { afterAll, describe, expect, it, mock, vi } from "bun:test"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

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

const { AssetImportDialog } = await import("@/components/asset-library/asset-import-dialog")

describe("AssetImportDialog", () => {
	afterAll(() => {
		mock.restore()
	})
	it("requires a file for uploads", async () => {
		render(<AssetImportDialog />)

		fireEvent.click(screen.getByRole("button", { name: /add asset/i }))
		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument()
		})

		const [uploadTitle] = screen.getAllByPlaceholderText(/launch hero graphic/i)
		fireEvent.change(uploadTitle, { target: { value: "Launch graphic" } })
		const [uploadTags] = screen.getAllByPlaceholderText(/brand, social, launch/i)
		fireEvent.change(uploadTags, { target: { value: "brand" } })

		const submit = screen.getByRole("button", { name: /import asset/i })
		const form = submit.closest("form")
		if (!form) {
			throw new Error("Missing upload form")
		}
		fireEvent.submit(form)

		await waitFor(() => {
			expect(screen.getByText(/file is required/i)).toBeInTheDocument()
		})
		expect(createAssetFromUpload).not.toHaveBeenCalled()
	})
})
