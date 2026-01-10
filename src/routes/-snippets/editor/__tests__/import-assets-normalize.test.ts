import { describe, expect, it } from "bun:test"
import {
	IMPORT_ASSET_FILE_LEGACY_NAME,
	IMPORT_ASSET_FILE_NAME,
	normalizeImportAssetsFileMap,
} from "@/routes/-snippets/editor/import-assets"

describe("normalizeImportAssetsFileMap", () => {
	it("merges legacy import-assets file into canonical and removes legacy entry", () => {
		const result = normalizeImportAssetsFileMap({
			[IMPORT_ASSET_FILE_NAME]: "",
			[IMPORT_ASSET_FILE_LEGACY_NAME]: `const EvencioMark = () => <svg viewBox="0 0 10 10" />`,
		})

		expect(result.changed).toBe(true)
		expect(Object.hasOwn(result.files, IMPORT_ASSET_FILE_NAME)).toBe(true)
		expect(Object.hasOwn(result.files, IMPORT_ASSET_FILE_LEGACY_NAME)).toBe(false)
		expect(result.files[IMPORT_ASSET_FILE_NAME]).toContain("type EvencioAssetProps")
		expect(result.files[IMPORT_ASSET_FILE_NAME]).toContain("const EvencioMark")
	})
})
