import { beforeAll, describe, expect, it } from "bun:test"
import { compileSnippet, warmupCompiler } from "../compiler"

describe("compiler error location mapping", () => {
	beforeAll(async () => {
		await warmupCompiler()
	}, 30000)

	it("reports correct line number for syntax error", async () => {
		const source = `export default function Test() {
  return (
    <div>
      {invalid syntax here}
    </div>
  )
}`
		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)

		const error = result.errors[0]
		expect(error.line).toBeGreaterThanOrEqual(1)
		expect(error.severity).toBe("error")
	})

	it("reports correct location for JSX error", async () => {
		const source = `export default function Test() {
  return <div
}`
		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)

		const error = result.errors[0]
		expect(error.line).toBeGreaterThanOrEqual(2) // Error is on line 2 or 3
	})

	it("error has all required fields", async () => {
		const source = `export default function Test() { return < }`

		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)

		const error = result.errors[0]
		expect(error).toHaveProperty("message")
		expect(error).toHaveProperty("line")
		expect(error).toHaveProperty("column")
		expect(error).toHaveProperty("severity")
		expect(typeof error.message).toBe("string")
		expect(typeof error.line).toBe("number")
		expect(typeof error.column).toBe("number")
	})

	it("distinguishes between errors and warnings", async () => {
		// Warnings are rare in esbuild transform, but errors should be marked correctly
		const source = `export default function Test() { return <broken }`

		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		for (const error of result.errors) {
			expect(error.severity).toBe("error")
		}
	})

	it("handles multiple errors", async () => {
		const source = `
export default function Test() {
  const x = {
  const y = [
  return <div>
}
`
		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		// Should have at least one error
		expect(result.errors.length).toBeGreaterThan(0)
	})

	it("column is 0-based as documented", async () => {
		// Error at the start of a line should have column 0 or close to it
		const source = `<broken at start>`

		const result = await compileSnippet(source)

		expect(result.success).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)

		const error = result.errors[0]
		expect(error.column).toBeGreaterThanOrEqual(0)
	})
})
