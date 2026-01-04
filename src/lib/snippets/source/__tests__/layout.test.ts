import { describe, expect, it } from "bun:test"
import { applySnippetTranslate } from "../layout"

const runLayoutUpdate = async (source: string) =>
	applySnippetTranslate({
		source,
		line: 2,
		column: 4,
		translateX: 10,
		translateY: 20,
		width: 120,
		height: 80,
	})

describe("applySnippetTranslate", () => {
	it("adds width/height inline when no style exists", async () => {
		const source = `
export const Snip = () => (
  <div className="box">Hello</div>
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain('translate: "10px 20px"')
		expect(result.source).toContain('width: "120px"')
		expect(result.source).toContain('height: "80px"')
	})

	it("updates existing style object while preserving other properties", async () => {
		const source = `
export const Snip = () => (
  <div style={{ color: "red", translate: "1px 2px" }} />
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain('color: "red"')
		expect(result.source).toContain('translate: "10px 20px"')
		expect(result.source).toContain('width: "120px"')
		expect(result.source).toContain('height: "80px"')
	})

	it("merges into style spread expressions", async () => {
		const source = `
export const Snip = () => (
  <div style={styles.card} />
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain("...styles.card")
		expect(result.source).toContain('translate: "10px 20px"')
		expect(result.source).toContain('width: "120px"')
		expect(result.source).toContain('height: "80px"')
	})
})
