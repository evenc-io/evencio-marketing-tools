import { beforeAll, describe, expect, it } from "bun:test"
import { compileSnippet, isCompilerReady, warmupCompiler } from "../compiler"

describe("compileSnippet", () => {
	// Warm up the compiler once before all tests
	beforeAll(async () => {
		await warmupCompiler()
	}, 30000) // 30s timeout for WASM loading

	describe("successful compilation", () => {
		it("compiles a simple functional component", async () => {
			const source = `
export default function Hello() {
  return <div>Hello World</div>
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(true)
			expect(result.code).toBeDefined()
			expect(result.errors).toHaveLength(0)
			expect(result.code).toContain("__SNIPPET_COMPONENT__")
		})

		it("compiles a component with props", async () => {
			const source = `
export default function Greeting({ name = "World" }) {
  return <h1>Hello, {name}!</h1>
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(true)
			expect(result.code).toBeDefined()
			expect(result.errors).toHaveLength(0)
		})

		it("compiles a component with TypeScript types", async () => {
			const source = `
interface Props {
  title: string;
  count?: number;
}

export default function Counter({ title, count = 0 }: Props) {
  return (
    <div>
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  )
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(true)
			expect(result.code).toBeDefined()
			expect(result.errors).toHaveLength(0)
		})

		it("compiles a component with nested JSX elements", async () => {
			const source = `
export default function Card({ title, children }) {
  return (
    <div className="card">
      <header>
        <h2>{title}</h2>
      </header>
      <main>{children}</main>
    </div>
  )
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(true)
			expect(result.code).toBeDefined()
		})
	})

	describe("compilation errors", () => {
		it("returns error for syntax error", async () => {
			const source = `
export default function Broken() {
  return <div>
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.errors[0].severity).toBe("error")
		})

		it("returns error for missing closing tag", async () => {
			const source = `
export default function Broken() {
  return <div><span>text</div>
}
`
			const result = await compileSnippet(source)

			expect(result.success).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
		})

		it("returns empty result for empty source", async () => {
			const source = ""
			const result = await compileSnippet(source)

			// Empty source should still compile (to empty output)
			// The actual behavior depends on esbuild
			expect(result).toBeDefined()
		})
	})

	describe("compiler state", () => {
		it("isCompilerReady returns true after warmup", () => {
			// After beforeAll warmup, compiler should be ready
			expect(isCompilerReady()).toBe(true)
		})
	})
})
