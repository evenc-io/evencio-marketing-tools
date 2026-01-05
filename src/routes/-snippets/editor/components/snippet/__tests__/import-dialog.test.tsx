import { describe, expect, it, vi } from "bun:test"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SnippetImportDialog } from "@/routes/-snippets/editor/components/snippet/import-dialog"

describe("SnippetImportDialog", () => {
	it("exposes a downloadable external assistant guide", () => {
		const onImport = vi.fn(async () => ({ ok: true as const }))

		render(<SnippetImportDialog open onOpenChange={() => {}} onImport={onImport} />)

		const link = screen.getByRole("link", { name: /download guide/i })
		expect(link).toHaveAttribute("href", "/snippet-external-assistant-guide.md")
		expect(link).toHaveAttribute("download")
	})

	it("loads dropped .md file content into the textarea", async () => {
		const onImport = vi.fn(async () => ({ ok: true as const }))

		render(<SnippetImportDialog open onOpenChange={() => {}} onImport={onImport} />)

		const file = new File(["export default function Demo() { return <div /> }"], "snippet.md", {
			type: "text/markdown",
		})

		await act(async () => {
			fireEvent.drop(screen.getByTestId("snippet-import-dropzone"), {
				dataTransfer: { files: [file] },
			})
		})

		await waitFor(() => {
			const textarea = screen.getByLabelText(/paste snippet/i) as HTMLTextAreaElement
			expect(textarea.value).toContain("export default function Demo")
		})
	})

	it("shows an error for unsupported file types", async () => {
		const onImport = vi.fn(async () => ({ ok: true as const }))

		render(<SnippetImportDialog open onOpenChange={() => {}} onImport={onImport} />)

		const file = new File(["nope"], "image.png", { type: "image/png" })

		await act(async () => {
			fireEvent.drop(screen.getByTestId("snippet-import-dropzone"), {
				dataTransfer: { files: [file] },
			})
		})

		await waitFor(() => {
			expect(screen.getByText(/unsupported file/i)).toBeInTheDocument()
		})
	})

	it("loads selected .txt file content into the textarea", async () => {
		const onImport = vi.fn(async () => ({ ok: true as const }))

		render(<SnippetImportDialog open onOpenChange={() => {}} onImport={onImport} />)

		const file = new File(
			["export default function FromFile() { return <div /> }"],
			"snippet.txt",
			{
				type: "text/plain",
			},
		)

		const input = screen.getByTestId("snippet-import-file-input") as HTMLInputElement
		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } })
		})

		await waitFor(() => {
			const textarea = screen.getByLabelText(/paste snippet/i) as HTMLTextAreaElement
			expect(textarea.value).toContain("export default function FromFile")
		})
	})
})
