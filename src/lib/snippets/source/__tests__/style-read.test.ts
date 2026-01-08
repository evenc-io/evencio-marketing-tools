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

	it("reads typography + padding utilities from className", async () => {
		const source = `
export const Snip = () => (
  <h1 className="font-lexend leading-[1.02] tracking-[0.22em] text-center uppercase italic underline p-4 px-2 py-1 pt-0.5" />
)
`.trim()

		const result = await readSnippetStyleState({ source, line: 2, column: 4 })
		expect(result.found).toBe(true)
		expect(result.properties.fontFamily.present).toBe(true)
		expect(result.properties.fontFamily.value).toBe("lexend")
		expect(result.properties.lineHeight.present).toBe(true)
		expect(result.properties.lineHeight.value).toBe(1.02)
		expect(result.properties.letterSpacing.present).toBe(true)
		expect(result.properties.letterSpacing.value).toBe("[0.22em]")
		expect(result.properties.textAlign.present).toBe(true)
		expect(result.properties.textAlign.value).toBe("center")
		expect(result.properties.textTransform.present).toBe(true)
		expect(result.properties.textTransform.value).toBe("uppercase")
		expect(result.properties.fontStyle.present).toBe(true)
		expect(result.properties.fontStyle.value).toBe("italic")
		expect(result.properties.textDecoration.present).toBe(true)
		expect(result.properties.textDecoration.value).toBe("underline")
		expect(result.properties.padding.present).toBe(true)
		expect(result.properties.padding.value).toBe("4")
		expect(result.properties.paddingX.present).toBe(true)
		expect(result.properties.paddingX.value).toBe("2")
		expect(result.properties.paddingY.present).toBe(true)
		expect(result.properties.paddingY.value).toBe("1")
		expect(result.properties.paddingTop.present).toBe(true)
		expect(result.properties.paddingTop.value).toBe("0.5")
	})

	it("prefers inline style values over className tokens", async () => {
		const source = `
	export const Snip = () => (
	  <h1
	    className="leading-tight tracking-wide text-right uppercase italic underline p-4 bg-background"
	    style={{
	      backgroundColor: "#ff0000",
	      lineHeight: "1.4",
	      letterSpacing: "0.22em",
	      textAlign: "center",
	      textTransform: "none",
	      fontStyle: "normal",
	      textDecoration: "none",
	      padding: "16px",
	    }}
	  />
	)
	`.trim()

		const result = await readSnippetStyleState({ source, line: 2, column: 4 })
		expect(result.found).toBe(true)
		expect(result.properties.backgroundColor.present).toBe(true)
		expect(result.properties.backgroundColor.value).toBe("#ff0000")
		expect(result.properties.lineHeight.present).toBe(true)
		expect(result.properties.lineHeight.value).toBe(1.4)
		expect(result.properties.letterSpacing.present).toBe(true)
		expect(result.properties.letterSpacing.value).toBe("[0.22em]")
		expect(result.properties.textAlign.present).toBe(true)
		expect(result.properties.textAlign.value).toBe("center")
		expect(result.properties.textTransform.present).toBe(true)
		expect(result.properties.textTransform.value).toBe("normal-case")
		expect(result.properties.fontStyle.present).toBe(true)
		expect(result.properties.fontStyle.value).toBe("not-italic")
		expect(result.properties.textDecoration.present).toBe(true)
		expect(result.properties.textDecoration.value).toBe("no-underline")
		expect(result.properties.padding.present).toBe(true)
		expect(result.properties.padding.value).toBe("[16px]")
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
