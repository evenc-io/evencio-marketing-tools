import { describe, expect, it } from "bun:test"
import {
	DEFAULT_SNIPPET_EXPORT,
	deriveSnippetPropsFromSource,
	listSnippetComponentExports,
} from "../source-derived"

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

	it("derives props from a named export", async () => {
		const source = `
export function Banner({ title = "Hello Banner" }) {
  return <h1>{title}</h1>
}
`

		const result = await deriveSnippetPropsFromSource(source, "Banner")

		expect(result.defaultProps).toEqual({ title: "Hello Banner" })
		expect(result.propsSchema.props[0]?.key).toBe("title")
	})

	it("lists component exports", async () => {
		const source = `
export const Alpha = () => <div />
export function Beta() { return <div /> }
export default function Gamma() { return <div /> }
`
		const exports = await listSnippetComponentExports(source)
		const names = exports.map((entry) => entry.exportName)
		expect(names).toContain(DEFAULT_SNIPPET_EXPORT)
		expect(names).toContain("Alpha")
		expect(names).toContain("Beta")
	})
})
