import { afterAll, describe, expect, it, mock, vi } from "bun:test"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SOCIAL_DIMENSIONS } from "@/types/editor"

const editorState = {
	contentType: "social-image",
	dimensions: SOCIAL_DIMENSIONS["instagram-post"],
	slideId: "slide-1",
	getCanvasJSON: vi.fn(() => null),
	setDimensions: vi.fn(),
	setIsDirty: vi.fn(),
}

const projectsState = {
	updateSlide: vi.fn(),
	markDirty: vi.fn(),
	currentProject: {
		id: "project-1",
		slides: [
			{
				id: "slide-1",
				fabricJSON: "",
			},
		],
	},
}

mock.module("@/stores/editor-store", () => ({
	useEditorStore: (selector: (state: typeof editorState) => unknown) => selector(editorState),
}))

mock.module("@/stores/projects-store", () => ({
	useProjectsStore: (selector: (state: typeof projectsState) => unknown) => selector(projectsState),
	selectSlideById: (state: typeof projectsState, slideId: string) =>
		state.currentProject?.slides.find((slide) => slide.id === slideId) ?? null,
}))

const storageModule = await import("@/lib/storage")
const generateThumbnailSpy = vi
	.spyOn(storageModule, "generateThumbnailFromJSON")
	.mockResolvedValue(null)

const { DimensionsPanel } = await import("@/components/editor/dimensions-panel")

describe("DimensionsPanel", () => {
	afterAll(() => {
		generateThumbnailSpy.mockRestore()
		mock.restore()
	})
	it("disables apply for invalid custom dimensions", async () => {
		render(<DimensionsPanel />)

		const widthInput = screen.getByLabelText(/width \(px\)/i)
		await act(async () => {
			fireEvent.change(widthInput, { target: { value: "50" } })
		})

		expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled()
	})

	it("applies custom dimensions and marks dirty", async () => {
		render(<DimensionsPanel />)

		const form = screen.getByRole("button", { name: /apply/i }).closest("form")
		if (!form) {
			throw new Error("Missing custom dimensions form")
		}
		await act(async () => {
			fireEvent.change(screen.getByLabelText(/width \(px\)/i), {
				target: { value: "1200" },
			})
			fireEvent.change(screen.getByLabelText(/height \(px\)/i), {
				target: { value: "800" },
			})
			fireEvent.submit(form)
		})

		await waitFor(() => {
			expect(projectsState.updateSlide).toHaveBeenCalledTimes(1)
		})
		expect(projectsState.markDirty).toHaveBeenCalledTimes(1)
		expect(editorState.setIsDirty).toHaveBeenCalledWith(true)
		expect(editorState.setDimensions).toHaveBeenCalledWith({
			width: 1200,
			height: 800,
			label: "Custom",
		})
	})
})
