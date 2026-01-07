import { describe, expect, it } from "bun:test"
import { buildSnippetImportsIndex } from "@/routes/-snippets/editor/hooks/snippet/imports-index"
import { IMPORT_ASSET_FILE_NAME } from "@/routes/-snippets/editor/import-assets"

describe("imports-index", () => {
	it("detects imported assets from the imports file source", () => {
		const index = buildSnippetImportsIndex({
			mainSource: `export default function Demo() { return <div /> }`,
			files: {
				[IMPORT_ASSET_FILE_NAME]: `
const EvencioMark = () => <svg viewBox="0 0 10 10" />
const EvencioLockup = () => (
  <div>
    <EvencioMark />
  </div>
)
`.trim(),
			},
		})

		expect(index.importedImportAssetIds).toContain("evencio-mark")
		expect(index.importedImportAssetIds).toContain("evencio-lockup")
		expect(index.importAssetsById.get("evencio-mark")?.imported).toBe(true)
		expect(index.importAssetsById.get("evencio-lockup")?.imported).toBe(true)
	})

	it("detects usage via data-snippet-asset wrappers", () => {
		const index = buildSnippetImportsIndex({
			mainSource: `
export default function Demo() {
  return (
    <div>
      <div data-snippet-asset="evencio-lockup">
        <EvencioLockup />
      </div>
    </div>
  )
}
`.trim(),
			files: {
				[IMPORT_ASSET_FILE_NAME]: `
const EvencioMark = () => <svg viewBox="0 0 10 10" />
const EvencioLockup = () => <EvencioMark />
`.trim(),
			},
		})

		expect(index.importAssetsById.get("evencio-lockup")?.used).toBe(true)
		expect(index.importAssetsById.get("evencio-lockup")?.wrapperCount).toBe(1)
		expect(index.importAssetsById.get("evencio-lockup")?.usageCount).toBe(1)
		expect(index.importAssetsById.get("evencio-mark")?.used).toBe(true)
		expect(index.importAssetsById.get("evencio-mark")?.wrapperCount).toBe(0)
		expect(index.importAssetsById.get("evencio-mark")?.componentCount).toBe(0)
		expect(index.importAssetsById.get("evencio-mark")?.usageCount).toBe(1)
	})

	it("detects usage via component tags outside of the imports file", () => {
		const index = buildSnippetImportsIndex({
			mainSource: `
// @import Header.tsx
export default function Demo() {
  return <Header />
}
`.trim(),
			files: {
				[IMPORT_ASSET_FILE_NAME]: `
const EvencioMark = () => <svg viewBox="0 0 10 10" />
`.trim(),
				"Header.tsx": `
export const Header = () => (
  <header>
    <EvencioMark />
  </header>
)
`.trim(),
			},
		})

		expect(index.importAssetsById.get("evencio-mark")?.used).toBe(true)
		expect(index.importAssetsById.get("evencio-mark")?.wrapperCount).toBe(0)
		expect(index.importAssetsById.get("evencio-mark")?.componentCount).toBe(1)
		expect(index.importAssetsById.get("evencio-mark")?.usageCount).toBe(1)
	})

	it("does not treat imports file contents as usage", () => {
		const index = buildSnippetImportsIndex({
			mainSource: `export default function Demo() { return <div /> }`,
			files: {
				[IMPORT_ASSET_FILE_NAME]: `
const EvencioMark = () => <svg viewBox="0 0 10 10" />
const EvencioLockup = () => (
  <div>
    <EvencioMark />
  </div>
)
`.trim(),
			},
		})

		expect(index.importAssetsById.get("evencio-mark")?.used).toBe(false)
		expect(index.importAssetsById.get("evencio-lockup")?.used).toBe(false)
	})
})
