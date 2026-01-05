import { describe, expect, it } from "bun:test"
import { parseSnippetFiles } from "@/lib/snippets"
import { IMPORT_ASSET_FILE_NAME } from "@/routes/-snippets/editor/import-assets"
import { parseSnippetImportText } from "@/routes/-snippets/editor/snippet-import-utils"

describe("snippet-import-utils", () => {
	it("extracts TSX from code fences and applies @res", () => {
		const input = `
Here is the snippet:

\`\`\`json
{ "ignored": true }
\`\`\`

\`\`\`tsx
// @res 1920x1080
export default function Demo() {
  return (
    <div className="h-full w-full">
      <EvencioLockup />
    </div>
  )
}
\`\`\`
`.trim()

		const result = parseSnippetImportText(input)
		expect(result.ok).toBe(true)
		if (!result.ok) return

		expect(result.value.viewport).toEqual({ width: 1920, height: 1080 })

		const parsed = parseSnippetFiles(result.value.source)
		expect(Object.hasOwn(parsed.files, IMPORT_ASSET_FILE_NAME)).toBe(true)
		expect(parsed.mainSource).toContain("// @res 1920x1080")
	})

	it("uses the last @res directive when multiple are present", () => {
		const input = `
\`\`\`tsx
// @res 1080x1920
// @res 1920x1080
export default function Demo() {
  return <div className="h-full w-full" />
}
\`\`\`
`.trim()

		const result = parseSnippetImportText(input)
		expect(result.ok).toBe(true)
		if (!result.ok) return

		expect(result.value.viewport).toEqual({ width: 1920, height: 1080 })
	})

	it("strips external assistant citation artifacts from the imported source", () => {
		const input = `
\`\`\`tsx
// @res 1080x1920
// :contentReference[oaicite:0]{index=0}
:contentReference[oaicite:1]{index=1}
export default function Demo() {
  return <div className="h-full w-full" />
}
\`\`\`
`.trim()

		const result = parseSnippetImportText(input)
		expect(result.ok).toBe(true)
		if (!result.ok) return

		expect(result.value.source).toContain("// @res 1080x1920")
		expect(result.value.source).not.toContain("contentReference[oaicite:0]")
		expect(result.value.source).not.toContain("contentReference[oaicite:1]")
	})
})
