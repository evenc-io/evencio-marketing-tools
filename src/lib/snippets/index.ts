import type { ComponentType } from "react"
import type { SnippetProps, SnippetRuntime } from "@/types/asset-library"
import LaunchHero from "./launch-hero"

export { LAYOUT_SNAPPING_SOURCE } from "./demos/layout-snapping"
export * from "./editing"
// Re-export preview runtime and hook
export * from "./preview/runtime"
export {
	DEFAULT_SNIPPET_EXPORT,
	deriveSnippetPropsFromAllExports,
	deriveSnippetPropsFromSource,
	getSnippetComponentSourceMap,
	listSnippetComponentExports,
	removeSnippetComponentExport,
	type SnippetComponentExport,
	type SnippetComponentSourceMap,
} from "./source/derived"
export * from "./source/files"
export {
	type CompileStatus,
	type UseSnippetCompilerOptions,
	type UseSnippetCompilerResult,
	useSnippetCompiler,
} from "./useSnippetCompiler"

export interface SnippetRegistryEntry {
	runtime: SnippetRuntime
	Component?: ComponentType<SnippetProps>
}

const registry: Record<string, SnippetRegistryEntry> = {
	"@/lib/snippets/launch-hero": {
		runtime: "react",
		Component: LaunchHero,
	},
}

export function getSnippetRegistryEntry(entry: string): SnippetRegistryEntry | null {
	return registry[entry] ?? null
}

export function listSnippetRegistryEntries(): string[] {
	return Object.keys(registry)
}
