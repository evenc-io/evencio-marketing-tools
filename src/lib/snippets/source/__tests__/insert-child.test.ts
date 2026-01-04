import { describe, expect, it } from "bun:test"
import { insertSnippetChild } from "../insert-child"

const columnFor = (source: string, needle: string) => {
	const index = source.indexOf(needle)
	if (index < 0) {
		throw new Error(`Needle not found: ${needle}`)
	}
	return index + 2
}

describe("insertSnippetChild", () => {
	it("inserts a child before the closing tag in multiline JSX", async () => {
		const source = `
export const Snip = () => (
  <div>
    <span>Hi</span>
  </div>
)
`.trim()

		const result = await insertSnippetChild({
			source,
			line: 2,
			column: columnFor(source.split("\n")[1] ?? "", "<div"),
			jsx: "<Injected />",
		})

		expect(result.changed).toBe(true)
		if (!result.changed) return
		expect(result.source).toContain("\n    <Injected />\n")
		expect(result.insertedAt).toEqual({ line: 4, column: 5 })
	})

	it("refuses insertion into self-closing elements", async () => {
		const source = `
export const Snip = () => <img />
`.trim()

		const result = await insertSnippetChild({
			source,
			line: 1,
			column: columnFor(source, "<img"),
			jsx: "<Injected />",
		})

		expect(result.changed).toBe(false)
		if (result.changed) return
		expect(result.reason).toContain("does not accept children")
	})

	it("converts empty inline elements into multiline when inserting", async () => {
		const source = `
export const Snip = () => <div></div>
`.trim()

		const result = await insertSnippetChild({
			source,
			line: 1,
			column: columnFor(source, "<div"),
			jsx: "<Injected />",
		})

		expect(result.changed).toBe(true)
		if (!result.changed) return
		expect(result.source).toContain("<div>\n  <Injected />\n</div>")
		expect(result.insertedAt).toEqual({ line: 2, column: 3 })
	})

	it("refuses insertion into void HTML tags even if written with a closing tag", async () => {
		const source = `
export const Snip = () => <img></img>
`.trim()

		const result = await insertSnippetChild({
			source,
			line: 1,
			column: columnFor(source, "<img"),
			jsx: "<Injected />",
		})

		expect(result.changed).toBe(false)
		if (result.changed) return
		expect(result.reason).toContain("<img>")
	})

	it("refuses insertion into svg tags", async () => {
		const source = `
export const Snip = () => <svg></svg>
`.trim()

		const result = await insertSnippetChild({
			source,
			line: 1,
			column: columnFor(source, "<svg"),
			jsx: "<Injected />",
		})

		expect(result.changed).toBe(false)
		if (result.changed) return
		expect(result.reason).toContain("<svg>")
	})
})
