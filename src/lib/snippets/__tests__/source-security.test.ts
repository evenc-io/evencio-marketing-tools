import { describe, expect, it } from "bun:test"
import { analyzeSnippetSource } from "../source-security"

describe("analyzeSnippetSource", () => {
	it("allows React-only imports", async () => {
		const source = `
import React from "react"
export default function Ok() {
  return <div>Hello</div>
}
`
		const issues = await analyzeSnippetSource(source)
		expect(issues).toHaveLength(0)
	})

	it("blocks fetch and member fetch", async () => {
		const source = `
export default function Bad() {
  fetch("/api")
  window.fetch("/api")
  globalThis.fetch("/api")
  return null
}
`
		const issues = await analyzeSnippetSource(source)
		expect(issues.some((issue) => issue.message.includes("fetch"))).toBe(true)
	})

	it("blocks document cookie access", async () => {
		const source = `
export default function Bad() {
  const value = document["cookie"]
  return <div>{value}</div>
}
`
		const issues = await analyzeSnippetSource(source)
		expect(issues.some((issue) => issue.message.includes("cookie"))).toBe(true)
	})

	it("blocks storage access", async () => {
		const source = `
export default function Bad() {
  localStorage.setItem("x", "y")
  sessionStorage.getItem("x")
  indexedDB.open("db")
  return null
}
`
		const issues = await analyzeSnippetSource(source)
		expect(issues.length).toBeGreaterThan(0)
	})

	it("blocks dynamic import and sockets", async () => {
		const source = `
export default function Bad() {
  import("fs")
  new WebSocket("wss://example.com")
  return null
}
`
		const issues = await analyzeSnippetSource(source)
		expect(issues.some((issue) => issue.message.includes("import"))).toBe(true)
		expect(issues.some((issue) => issue.message.includes("WebSocket"))).toBe(true)
	})
})
