import type { ComponentType } from "react"
import type { SnippetProps, SnippetRuntime } from "@/types/asset-library"
import LaunchHero from "./launch-hero"

// Re-export compiler, preview runtime, and hook
export * from "./compiler"
export * from "./preview-runtime"
export { deriveSnippetPropsFromSource } from "./source-derived"
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
