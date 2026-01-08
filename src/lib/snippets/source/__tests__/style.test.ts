import { describe, expect, it } from "bun:test"
import { applySnippetStyleUpdate } from "../style"

const runStyleUpdate = async (
	source: string,
	updates: Partial<Parameters<typeof applySnippetStyleUpdate>[0]>,
) =>
	applySnippetStyleUpdate({
		source,
		line: 2,
		column: 4,
		...updates,
	})

describe("applySnippetStyleUpdate", () => {
	it("writes background/border/radius/type as Tailwind classes when possible", async () => {
		const source = `
export const Snip = () => (
  <div className="box bg-red-500 border-2 border-blue-500 border-dashed rounded-md text-neutral-500 text-sm font-bold" />
)
`.trim()
		const result = await runStyleUpdate(source, {
			backgroundColor: "#ff0000",
			borderWidth: 3,
			borderColor: "#00ff00",
			borderRadius: 12,
			textColor: "#111111",
			fontSize: 20,
			fontWeight: 600,
		})

		expect(result.changed).toBe(true)
		expect(result.source).toContain("box")
		expect(result.source).toContain("border-dashed")
		expect(result.source).toContain("bg-[#ff0000]")
		expect(result.source).toContain("border-[3px]")
		expect(result.source).toContain("border-[#00ff00]")
		expect(result.source).toContain("rounded-[12px]")
		expect(result.source).toContain("text-[#111111]")
		expect(result.source).toContain("text-[20px]")
		expect(result.source).toContain("font-semibold")
		expect(result.source).not.toContain("bg-red-500")
		expect(result.source).not.toContain("border-2")
		expect(result.source).not.toContain("border-blue-500")
		expect(result.source).not.toContain("rounded-md")
		expect(result.source).not.toContain("text-neutral-500")
		expect(result.source).not.toContain("text-sm")
		expect(result.source).not.toContain("font-bold")
	})

	it("preserves fractional border widths when writing Tailwind classes", async () => {
		const source = `
export const Snip = () => (
  <div className="box border" />
)
`.trim()
		const result = await runStyleUpdate(source, { borderWidth: 1.5 })
		expect(result.changed).toBe(true)
		expect(result.source).toContain("border-[1.5px]")
		expect(result.source).not.toContain("border-2")
	})

	it("falls back to inline styles when className is dynamic", async () => {
		const source = `
import { cn } from "@/lib/utils"

export const Snip = () => (
  <div className={cn("box", true && "bg-red-500")} />
)
`.trim()
		const result = await runStyleUpdate(source, { line: 4, backgroundColor: "#ff0000" })
		expect(result.changed).toBe(true)
		expect(result.source).toContain('style={{ backgroundColor: "#ff0000" }}')
		expect(result.source).not.toContain("bg-[#ff0000]")
		expect(result.notice).toContain("Falling back to inline styles")
	})

	it("removes conflicting inline styles when rewriting Tailwind classes", async () => {
		const source = `
export const Snip = () => (
  <div className="box" style={{ backgroundColor: "#00ff00" }} />
)
`.trim()
		const result = await runStyleUpdate(source, { backgroundColor: "#ff0000" })
		expect(result.changed).toBe(true)
		expect(result.source).toContain('className="box bg-[#ff0000]"')
		expect(result.source).not.toContain("backgroundColor")
		expect(result.source).not.toContain("style=")
	})

	it("keeps font family classes while updating font weight", async () => {
		const source = `
export const Snip = () => (
  <div className="font-unbounded font-bold" />
)
`.trim()
		const result = await runStyleUpdate(source, { fontWeight: 500 })
		expect(result.changed).toBe(true)
		expect(result.source).toContain("font-unbounded")
		expect(result.source).toContain("font-medium")
		expect(result.source).not.toContain("font-bold")
	})

	it("updates typography + padding while preserving variant classes", async () => {
		const source = `
export const Snip = () => (
  <p className="font-lexend font-bold md:font-black leading-tight tracking-wide text-left uppercase italic underline p-4 px-2 md:text-lg text-sm" />
)
`.trim()
		const result = await runStyleUpdate(source, {
			fontFamily: "unbounded",
			fontWeight: 500,
			fontSize: "xl",
			lineHeight: 1.02,
			letterSpacing: "-0.02em",
			textAlign: "center",
			textTransform: "lowercase",
			fontStyle: "not-italic",
			textDecoration: "no-underline",
			padding: "16",
			paddingX: "6",
			paddingTop: "2",
		})

		expect(result.changed).toBe(true)
		expect(result.source).toContain("md:text-lg")
		expect(result.source).toContain("md:font-black")

		expect(result.source).toContain("font-unbounded")
		expect(result.source).toContain("font-medium")
		expect(result.source).toContain("text-xl")
		expect(result.source).toContain("leading-[1.02]")
		expect(result.source).toContain("tracking-[-0.02em]")
		expect(result.source).toContain("text-center")
		expect(result.source).toContain("lowercase")
		expect(result.source).toContain("not-italic")
		expect(result.source).toContain("no-underline")
		expect(result.source).toContain("p-16")
		expect(result.source).toContain("px-6")
		expect(result.source).toContain("pt-2")

		expect(result.source).not.toContain("font-lexend")
		expect(result.source).not.toContain("font-bold")
		expect(result.source).not.toContain("text-sm")
		expect(result.source).not.toContain("leading-tight")
		expect(result.source).not.toContain("tracking-wide")
		expect(result.source).not.toContain("text-left")
		expect(result.source).not.toContain("uppercase")
		expect(result.source).not.toMatch(/(^|\s|")italic(\s|")/)
		expect(result.source).not.toMatch(/(^|\s|")underline(\s|")/)
		expect(result.source).not.toContain("p-4")
		expect(result.source).not.toContain("px-2")
	})
})
