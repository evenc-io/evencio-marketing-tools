import { describe, expect, it } from "bun:test"
import { readSnippetStyleState } from "../style-read"

describe("readSnippetStyleState", () => {
	it("reads Tailwind v4 semantic tokens from className", async () => {
		const source = `
export const Snip = () => (
  <div className="bg-background text-foreground border-border rounded-md" />
)
`.trim()

		const result = await readSnippetStyleState({ source, line: 2, column: 4 })
		expect(result.found).toBe(true)
		expect(result.classNameKind).toBe("static")
		expect(result.editable).toBe(true)
		expect(result.properties.backgroundColor.present).toBe(true)
		expect(result.properties.backgroundColor.value).toBe("background")
		expect(result.properties.textColor.present).toBe(true)
		expect(result.properties.textColor.value).toBe("foreground")
		expect(result.properties.borderColor.present).toBe(true)
		expect(result.properties.borderColor.value).toBe("border")
		expect(result.properties.borderRadius.present).toBe(true)
		expect(result.properties.borderRadius.value).toBe("md")
	})

	it("prefers inline style values over className tokens", async () => {
		const source = `
export const Snip = () => (
  <div className="bg-background text-foreground" style={{ backgroundColor: "#ff0000" }} />
)
`.trim()

		const result = await readSnippetStyleState({ source, line: 2, column: 4 })
		expect(result.found).toBe(true)
		expect(result.properties.backgroundColor.present).toBe(true)
		expect(result.properties.backgroundColor.value).toBe("#ff0000")
	})

	it("marks elements with dynamic className as code-only", async () => {
		const source = `
import { cn } from "@/lib/utils"

export const Snip = () => (
  <div className={cn("bg-background")} />
)
`.trim()

		const result = await readSnippetStyleState({ source, line: 4, column: 4 })
		expect(result.found).toBe(true)
		expect(result.classNameKind).toBe("dynamic")
		expect(result.editable).toBe(false)
	})
})
