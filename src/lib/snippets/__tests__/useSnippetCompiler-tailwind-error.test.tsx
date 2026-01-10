import { describe, expect, it } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import { hashSnippetSourceSync } from "@/lib/snippets/source/hash"

const { useSnippetCompiler } = await import("@/lib/snippets/useSnippetCompiler")

describe("useSnippetCompiler", () => {
	it("keeps compiledCode when Tailwind generation errors", async () => {
		const source = `export default function Demo() { return <div className="p-4" /> }`
		const analysis = {
			sourceHash: hashSnippetSourceSync(source),
			exports: [],
			propsSchema: { version: 1, props: [] },
			defaultProps: {},
			duplicateKeys: [],
			propsSchemaJson: JSON.stringify({ version: 1, props: [] }),
			defaultPropsJson: JSON.stringify({}),
			securityIssues: [],
			tailwindCss: null,
			tailwindError: "Tailwind failed",
		} satisfies Partial<AnalyzeTsxResponse> as AnalyzeTsxResponse

		function Harness() {
			const compiler = useSnippetCompiler({
				source,
				debounceMs: 0,
				enableTailwindCss: true,
				analysis,
			})
			return (
				<div>
					<div data-testid="status">{compiler.status}</div>
					<div data-testid="compiled">{compiler.compiledCode ?? ""}</div>
					<div data-testid="error">{compiler.errors[0]?.message ?? ""}</div>
				</div>
			)
		}

		render(<Harness />)

		await waitFor(
			() => {
				expect(screen.getByTestId("status").textContent).toContain("error")
				expect(screen.getByTestId("compiled").textContent?.trim().length).toBeGreaterThan(0)
				expect(screen.getByTestId("error").textContent).toContain("Tailwind failed")
			},
			{ timeout: 5_000 },
		)
	})
})
