import { describe, expect, it } from "bun:test"
import { DEFAULT_PREVIEW_DIMENSIONS, generatePreviewSrcdoc } from "../preview-runtime"

const mockCompiledCode = `
(function() {
  const React = window.React;
  window.__SNIPPET_COMPONENT__ = function Hello() {
    return React.createElement('div', null, 'Hello World');
  };
})();
`

type ParsedTranslate = { x: number; y: number; partsCount: number }

const extractParseTranslateValue = (srcdoc: string) => {
	const match = srcdoc.match(/const parseTranslateValue = ([\s\S]*?)\n\s*const normalizeChildren =/)
	if (!match?.[1]) {
		throw new Error("parseTranslateValue not found in preview srcdoc")
	}
	const functionSource = match[1].trim().replace(/;\s*$/, "")
	return new Function(`return (${functionSource});`)() as (value: string) => ParsedTranslate
}

describe("preview runtime translate parsing", () => {
	const parseTranslateValue = extractParseTranslateValue(
		generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS),
	)

	it("parses a two-value translate string", () => {
		const parsed = parseTranslateValue("-27.64px -3.15px")
		expect(parsed.partsCount).toBeGreaterThanOrEqual(2)
		expect(parsed.x).toBeCloseTo(-27.64, 5)
		expect(parsed.y).toBeCloseTo(-3.15, 5)
	})

	it("parses positive decimals with px units", () => {
		const parsed = parseTranslateValue("0.00634766px 316.146px")
		expect(parsed.x).toBeCloseTo(0.00634766, 8)
		expect(parsed.y).toBeCloseTo(316.146, 6)
	})

	it("handles translate() style values", () => {
		const parsed = parseTranslateValue("translate(10px, 20px)")
		expect(parsed.x).toBeCloseTo(10, 5)
		expect(parsed.y).toBeCloseTo(20, 5)
	})

	it("defaults missing y to 0", () => {
		const parsed = parseTranslateValue("15px")
		expect(parsed.partsCount).toBe(1)
		expect(parsed.x).toBeCloseTo(15, 5)
		expect(parsed.y).toBeCloseTo(0, 5)
	})

	it("returns zeros for none", () => {
		const parsed = parseTranslateValue("none")
		expect(parsed.partsCount).toBe(0)
		expect(parsed.x).toBe(0)
		expect(parsed.y).toBe(0)
	})

	it("ignores non-numeric tokens", () => {
		const parsed = parseTranslateValue("foo bar")
		expect(parsed.partsCount).toBe(0)
		expect(parsed.x).toBe(0)
		expect(parsed.y).toBe(0)
	})

	it("parses negative values with leading dot", () => {
		const parsed = parseTranslateValue("-.5px .25px")
		expect(parsed.x).toBeCloseTo(-0.5, 5)
		expect(parsed.y).toBeCloseTo(0.25, 5)
	})

	it("parses values with commas", () => {
		const parsed = parseTranslateValue("12px, -8px")
		expect(parsed.x).toBeCloseTo(12, 5)
		expect(parsed.y).toBeCloseTo(-8, 5)
	})
})
