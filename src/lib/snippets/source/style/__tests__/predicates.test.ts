import { describe, expect, it } from "bun:test"
import { isColorSuffix } from "../colors"
import { normalizeTailwindClassName } from "../normalize-classname"
import { isFontSizeClass, isTextColorClass } from "../predicates"

describe("isColorSuffix", () => {
	describe("standard color tokens", () => {
		it("accepts transparent/current/black/white", () => {
			expect(isColorSuffix("transparent")).toBe(true)
			expect(isColorSuffix("current")).toBe(true)
			expect(isColorSuffix("black")).toBe(true)
			expect(isColorSuffix("white")).toBe(true)
		})

		it("accepts palette colors", () => {
			expect(isColorSuffix("red-500")).toBe(true)
			expect(isColorSuffix("blue-600")).toBe(true)
			expect(isColorSuffix("green-400")).toBe(true)
			expect(isColorSuffix("neutral-900")).toBe(true)
		})

		it("accepts theme tokens", () => {
			expect(isColorSuffix("background")).toBe(true)
			expect(isColorSuffix("foreground")).toBe(true)
			expect(isColorSuffix("primary")).toBe(true)
			expect(isColorSuffix("muted-foreground")).toBe(true)
		})
	})

	describe("arbitrary color values", () => {
		it("accepts hex colors", () => {
			expect(isColorSuffix("[#ff0000]")).toBe(true)
			expect(isColorSuffix("[#abc]")).toBe(true)
			expect(isColorSuffix("[#aabbcc]")).toBe(true)
		})

		it("accepts rgb/rgba colors", () => {
			expect(isColorSuffix("[rgb(255,0,0)]")).toBe(true)
			expect(isColorSuffix("[rgba(255,0,0,0.5)]")).toBe(true)
		})

		it("accepts hsl/hsla colors", () => {
			expect(isColorSuffix("[hsl(0,100%,50%)]")).toBe(true)
			expect(isColorSuffix("[hsla(0,100%,50%,0.5)]")).toBe(true)
		})

		it("accepts CSS variables", () => {
			expect(isColorSuffix("[var(--some-color)]")).toBe(true)
			expect(isColorSuffix("[var(--primary)]")).toBe(true)
		})
	})

	describe("arbitrary size values (should be rejected)", () => {
		it("rejects pixel values", () => {
			expect(isColorSuffix("[44px]")).toBe(false)
			expect(isColorSuffix("[16px]")).toBe(false)
			expect(isColorSuffix("[1px]")).toBe(false)
		})

		it("rejects rem values", () => {
			expect(isColorSuffix("[1.5rem]")).toBe(false)
			expect(isColorSuffix("[2rem]")).toBe(false)
			expect(isColorSuffix("[0.875rem]")).toBe(false)
		})

		it("rejects em values", () => {
			expect(isColorSuffix("[1em]")).toBe(false)
			expect(isColorSuffix("[2.5em]")).toBe(false)
		})

		it("rejects percentage values", () => {
			expect(isColorSuffix("[100%]")).toBe(false)
			expect(isColorSuffix("[50%]")).toBe(false)
		})

		it("rejects viewport units", () => {
			expect(isColorSuffix("[100vw]")).toBe(false)
			expect(isColorSuffix("[50vh]")).toBe(false)
			expect(isColorSuffix("[100dvh]")).toBe(false)
		})

		it("rejects negative size values", () => {
			expect(isColorSuffix("[-10px]")).toBe(false)
			expect(isColorSuffix("[-1.5rem]")).toBe(false)
		})
	})
})

describe("isTextColorClass", () => {
	it("matches standard text color classes", () => {
		expect(isTextColorClass("text-red-500")).toBe(true)
		expect(isTextColorClass("text-green-500")).toBe(true)
		expect(isTextColorClass("text-neutral-900")).toBe(true)
		expect(isTextColorClass("text-white")).toBe(true)
		expect(isTextColorClass("text-black")).toBe(true)
	})

	it("matches arbitrary color values", () => {
		expect(isTextColorClass("text-[#ff0000]")).toBe(true)
		expect(isTextColorClass("text-[rgb(255,0,0)]")).toBe(true)
	})

	it("does NOT match font size classes", () => {
		expect(isTextColorClass("text-[44px]")).toBe(false)
		expect(isTextColorClass("text-[1.5rem]")).toBe(false)
		expect(isTextColorClass("text-lg")).toBe(false)
		expect(isTextColorClass("text-xl")).toBe(false)
		expect(isTextColorClass("text-2xl")).toBe(false)
	})

	it("does NOT match text alignment classes", () => {
		expect(isTextColorClass("text-left")).toBe(false)
		expect(isTextColorClass("text-center")).toBe(false)
		expect(isTextColorClass("text-right")).toBe(false)
	})
})

describe("isFontSizeClass", () => {
	it("matches standard font size classes", () => {
		expect(isFontSizeClass("text-xs")).toBe(true)
		expect(isFontSizeClass("text-sm")).toBe(true)
		expect(isFontSizeClass("text-base")).toBe(true)
		expect(isFontSizeClass("text-lg")).toBe(true)
		expect(isFontSizeClass("text-xl")).toBe(true)
		expect(isFontSizeClass("text-2xl")).toBe(true)
		expect(isFontSizeClass("text-9xl")).toBe(true)
	})

	it("matches arbitrary size values", () => {
		expect(isFontSizeClass("text-[44px]")).toBe(true)
		expect(isFontSizeClass("text-[1.5rem]")).toBe(true)
		expect(isFontSizeClass("text-[2em]")).toBe(true)
	})

	it("does NOT match text color classes", () => {
		expect(isFontSizeClass("text-red-500")).toBe(false)
		expect(isFontSizeClass("text-[#ff0000]")).toBe(false)
	})
})

describe("normalizeTailwindClassName", () => {
	describe("text color update preserves font size", () => {
		it("preserves arbitrary font size when updating text color", () => {
			const input = "font-lexend text-[44px] leading-[1.05] tracking-[-0.02em] text-neutral-900"
			const result = normalizeTailwindClassName(input, { textColor: "text-green-500" })
			expect(result).toContain("text-[44px]")
			expect(result).toContain("text-green-500")
			expect(result).not.toContain("text-neutral-900")
		})

		it("preserves standard font size when updating text color", () => {
			const input = "font-lexend text-2xl text-neutral-900"
			const result = normalizeTailwindClassName(input, { textColor: "text-blue-600" })
			expect(result).toContain("text-2xl")
			expect(result).toContain("text-blue-600")
			expect(result).not.toContain("text-neutral-900")
		})

		it("preserves multiple text-related classes when updating color", () => {
			const input = "text-[44px] text-left text-neutral-900"
			const result = normalizeTailwindClassName(input, { textColor: "text-red-500" })
			expect(result).toContain("text-[44px]")
			expect(result).toContain("text-left")
			expect(result).toContain("text-red-500")
		})
	})

	describe("font size update preserves text color", () => {
		it("preserves text color when updating font size", () => {
			const input = "text-neutral-900 text-[44px]"
			const result = normalizeTailwindClassName(input, { fontSize: "text-2xl" })
			expect(result).toContain("text-neutral-900")
			expect(result).toContain("text-2xl")
			expect(result).not.toContain("text-[44px]")
		})

		it("preserves arbitrary color when updating font size", () => {
			const input = "text-[#ff0000] text-xl"
			const result = normalizeTailwindClassName(input, { fontSize: "text-[32px]" })
			expect(result).toContain("text-[#ff0000]")
			expect(result).toContain("text-[32px]")
			expect(result).not.toContain("text-xl")
		})
	})

	describe("simultaneous updates", () => {
		it("correctly handles both text color and font size updates", () => {
			const input = "text-neutral-900 text-[44px]"
			const result = normalizeTailwindClassName(input, {
				textColor: "text-green-500",
				fontSize: "text-2xl",
			})
			expect(result).toContain("text-green-500")
			expect(result).toContain("text-2xl")
			expect(result).not.toContain("text-neutral-900")
			expect(result).not.toContain("text-[44px]")
		})
	})
})
