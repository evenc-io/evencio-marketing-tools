import { describe, expect, it } from "bun:test"
import { deriveSnippetPropsFromSource } from "../source-derived"

describe("deriveSnippetPropsFromSource", () => {
	it("derives defaults from destructured params", async () => {
		const source = `
export default function MySnippet({ headline = "Hello Test" }) {
  return <h1>{headline}</h1>
}
`

		const result = await deriveSnippetPropsFromSource(source)

		expect(result.defaultProps).toEqual({ headline: "Hello Test" })
		expect(result.propsSchema.props[0]?.key).toBe("headline")
	})

	it("throws on parse errors", async () => {
		const source = `
export default function Broken({ headline = "Hello" }) {
  return <div>
}
`

		await expect(deriveSnippetPropsFromSource(source)).rejects.toThrow()
	})
})
