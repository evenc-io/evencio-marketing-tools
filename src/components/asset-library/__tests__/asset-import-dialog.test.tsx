import { afterAll, describe, expect, it, mock, vi } from "bun:test"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

const createAssetFromUpload = vi.fn(async () => ({ id: "asset" }))

const assetStoreState = {
	tags: [{ id: "tag-1", name: "Brand" }],
	createAssetFromUpload,
}

mock.module("@/stores/asset-library-store", () => ({
	useAssetLibraryStore: (selector: (state: typeof assetStoreState) => unknown) =>
		selector(assetStoreState),
}))

// Mock TanStack Router Link component
mock.module("@tanstack/react-router", () => ({
	Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
		<a href={to} className={className}>
			{children}
		</a>
	),
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

		const uploadTitle = screen.getByPlaceholderText(/launch hero graphic/i)
		fireEvent.change(uploadTitle, { target: { value: "Launch graphic" } })
		const uploadTags = screen.getByPlaceholderText(/brand, social, launch/i)
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

	it("shows link to custom snippet page", async () => {
		render(<AssetImportDialog />)

		fireEvent.click(screen.getByRole("button", { name: /add asset/i }))
		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument()
		})

		expect(screen.getByText(/create a custom snippet/i)).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /new snippet/i })).toBeInTheDocument()
	})
})
