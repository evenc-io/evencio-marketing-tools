import { describe, expect, it } from "bun:test"
import {
	DEFAULT_PREVIEW_DIMENSIONS,
	generatePreviewSrcdoc,
	type PreviewDimensions,
} from "../preview-runtime"

describe("generatePreviewSrcdoc", () => {
	const mockCompiledCode = `
(function() {
  const React = window.React;
  window.__SNIPPET_COMPONENT__ = function Hello() {
    return React.createElement('div', null, 'Hello World');
  };
})();
`

	describe("HTML structure", () => {
		it("generates valid HTML document", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("<!DOCTYPE html>")
			expect(srcdoc).toContain("<html")
			expect(srcdoc).toContain("</html>")
			expect(srcdoc).toContain("<head>")
			expect(srcdoc).toContain("</head>")
			expect(srcdoc).toContain("<body>")
			expect(srcdoc).toContain("</body>")
		})

		it("includes CSP meta tag", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("Content-Security-Policy")
			expect(srcdoc).toContain("default-src 'none'")
			expect(srcdoc).toContain("script-src 'nonce-")
			expect(srcdoc).toContain("nonce-")
		})

		it("does not reference external script CDNs", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).not.toContain("unpkg.com")
			expect(srcdoc).not.toMatch(/<script[^>]+src=/i)
			expect(srcdoc).not.toContain("cdn.jsdelivr.net")
		})

		it("includes root container element", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain('id="root"')
			expect(srcdoc).toContain('id="snippet-container"')
		})
	})

	describe("dimensions", () => {
		it("uses provided dimensions", () => {
			const dimensions: PreviewDimensions = { width: 800, height: 400 }
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, dimensions)

			expect(srcdoc).toContain("800px")
			expect(srcdoc).toContain("400px")
		})

		it("uses default dimensions when not specified", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain(`${DEFAULT_PREVIEW_DIMENSIONS.width}px`)
			expect(srcdoc).toContain(`${DEFAULT_PREVIEW_DIMENSIONS.height}px`)
		})
	})

	describe("props injection", () => {
		it("serializes props as JSON", () => {
			const props = { title: "Hello", count: 42 }
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, props, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain('"title"')
			expect(srcdoc).toContain('"Hello"')
			expect(srcdoc).toContain("42")
		})

		it("handles empty props object", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("{}")
		})

		it("handles nested props", () => {
			const props = { config: { nested: { value: true } } }
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, props, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("config")
			expect(srcdoc).toContain("nested")
		})
	})

	describe("code injection", () => {
		it("includes compiled code", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("__SNIPPET_COMPONENT__")
		})

		it("escapes script closing tags in code", () => {
			const codeWithScriptTag = `
(function() {
  const html = "</script><script>alert('xss')</script>";
  window.__SNIPPET_COMPONENT__ = function() { return null; };
})();
`
			const srcdoc = generatePreviewSrcdoc(codeWithScriptTag, {}, DEFAULT_PREVIEW_DIMENSIONS)

			// Should escape </script to prevent XSS
			expect(srcdoc).not.toContain("</script><script>alert")
		})
	})

	describe("error handling", () => {
		it("includes lightweight renderer helpers", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("renderNode")
			expect(srcdoc).toContain("__snippetElement")
		})

		it("includes postMessage for error reporting", () => {
			const srcdoc = generatePreviewSrcdoc(mockCompiledCode, {}, DEFAULT_PREVIEW_DIMENSIONS)

			expect(srcdoc).toContain("postMessage")
			expect(srcdoc).toContain("render-error")
			expect(srcdoc).toContain("render-success")
		})
	})

	describe("DEFAULT_PREVIEW_DIMENSIONS", () => {
		it("has expected default values", () => {
			expect(DEFAULT_PREVIEW_DIMENSIONS.width).toBe(1200)
			expect(DEFAULT_PREVIEW_DIMENSIONS.height).toBe(630)
		})
	})
})
