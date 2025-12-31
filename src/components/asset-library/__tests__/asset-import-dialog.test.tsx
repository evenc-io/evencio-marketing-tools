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
const buildHref = (to: string, search?: Record<string, unknown>) => {
	if (!search || Object.keys(search).length === 0) return to
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(search)) {
		if (value === undefined || value === null) continue
		params.set(key, String(value))
	}
	const query = params.toString()
	return query ? `${to}?${query}` : to
}

mock.module("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		search,
		className,
		onClick,
	}: {
		children: ReactNode
		to: string
		search?: Record<string, unknown>
		className?: string
		onClick?: () => void
	}) => (
		<a href={buildHref(to, search)} className={className} onClick={onClick}>
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

	it("does not surface snippet templates in the import dialog", async () => {
		render(<AssetImportDialog />)

		fireEvent.click(screen.getByRole("button", { name: /add asset/i }))
		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument()
		})

		expect(screen.queryByText(/create a custom snippet/i)).not.toBeInTheDocument()
		expect(screen.queryByRole("link", { name: /single component/i })).not.toBeInTheDocument()
		expect(screen.queryByRole("link", { name: /multi-component/i })).not.toBeInTheDocument()
	})
})
