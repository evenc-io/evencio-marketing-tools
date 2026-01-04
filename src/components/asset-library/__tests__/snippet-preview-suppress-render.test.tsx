import { describe, expect, it, vi } from "bun:test"
import { act, render, screen, waitFor } from "@testing-library/react"
import { SnippetPreview } from "@/components/asset-library/snippet-preview"

describe("SnippetPreview", () => {
	it("still forwards props updates when suppressing the next code render", async () => {
		const { rerender } = render(
			<SnippetPreview compiledCode="export default () => null" props={{ a: 1 }} />,
		)

		const iframe = screen.getByTitle("Snippet Preview") as HTMLIFrameElement
		const iframeWindow =
			iframe.contentWindow ??
			(() => {
				const value = { postMessage: vi.fn() } as unknown as Window
				Object.defineProperty(iframe, "contentWindow", { value })
				return value
			})()

		const postMessageSpy = vi.spyOn(iframeWindow, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "ready" },
					source: iframeWindow,
				}),
			)
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "render-success" },
					source: iframeWindow,
				}),
			)
		})

		postMessageSpy.mockClear()

		rerender(
			<SnippetPreview
				compiledCode="export default () => null"
				props={{ a: 2 }}
				suppressNextRenderToken={1}
			/>,
		)

		await waitFor(() => {
			const types = postMessageSpy.mock.calls.map((call) => call[0]?.type)
			expect(types).toContain("props-update")
		})

		const propsUpdateCall = postMessageSpy.mock.calls.find(
			(call) => call[0]?.type === "props-update",
		)
		expect(propsUpdateCall).toBeTruthy()
		expect(propsUpdateCall?.[0]?.skipRender).toBeUndefined()
	})

	it("still sends a props update when code updates are suppressed", async () => {
		const { rerender } = render(
			<SnippetPreview compiledCode="export default () => null" props={{ a: 1 }} />,
		)

		const iframe = screen.getByTitle("Snippet Preview") as HTMLIFrameElement
		const iframeWindow =
			iframe.contentWindow ??
			(() => {
				const value = { postMessage: vi.fn() } as unknown as Window
				Object.defineProperty(iframe, "contentWindow", { value })
				return value
			})()

		const postMessageSpy = vi.spyOn(iframeWindow, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "ready" },
					source: iframeWindow,
				}),
			)
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "render-success" },
					source: iframeWindow,
				}),
			)
		})

		postMessageSpy.mockClear()

		rerender(
			<SnippetPreview
				compiledCode="export default () => 42"
				props={{ a: 2 }}
				suppressNextRenderToken={1}
			/>,
		)

		await waitFor(() => {
			const types = postMessageSpy.mock.calls.map((call) => call[0]?.type)
			expect(types).toContain("code-update")
			expect(types).toContain("props-update")
		})

		const codeUpdateCall = postMessageSpy.mock.calls.find((call) => call[0]?.type === "code-update")
		expect(codeUpdateCall?.[0]?.skipRender).toBe(true)

		const propsUpdateCall = postMessageSpy.mock.calls.find(
			(call) => call[0]?.type === "props-update",
		)
		expect(propsUpdateCall?.[0]?.skipRender).toBeUndefined()
	})

	it("preserves repeated prop references in propsJson", async () => {
		const shared = { x: 1 }
		const { rerender } = render(
			<SnippetPreview compiledCode="export default () => null" props={{ a: shared, b: shared }} />,
		)

		const iframe = screen.getByTitle("Snippet Preview") as HTMLIFrameElement
		const iframeWindow =
			iframe.contentWindow ??
			(() => {
				const value = { postMessage: vi.fn() } as unknown as Window
				Object.defineProperty(iframe, "contentWindow", { value })
				return value
			})()

		const postMessageSpy = vi.spyOn(iframeWindow, "postMessage")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "ready" },
					source: iframeWindow,
				}),
			)
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "render-success" },
					source: iframeWindow,
				}),
			)
		})

		postMessageSpy.mockClear()

		rerender(
			<SnippetPreview compiledCode="export default () => 42" props={{ a: shared, b: shared }} />,
		)

		let payload: unknown = null
		await waitFor(() => {
			const call = postMessageSpy.mock.calls.find((entry) => entry[0]?.type === "code-update")
			expect(call).toBeTruthy()
			payload = call?.[0] ?? null
		})

		const propsJson = (payload as { propsJson?: unknown } | null)?.propsJson
		expect(typeof propsJson).toBe("string")

		const parsed = JSON.parse(String(propsJson))
		expect(parsed).toEqual({ a: { x: 1 }, b: { x: 1 } })
	})
})
