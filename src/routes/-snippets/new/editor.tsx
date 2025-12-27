import { lazy, useEffect, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"

export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export const LazyMonacoEditor = lazy(() =>
	import("@/components/ui/monaco-editor").then((mod) => ({
		default: mod.MonacoEditor,
	})),
)

export const MonacoEditorSkeleton = ({ className }: { className?: string }) => (
	<div
		className={cn(
			"h-full w-full animate-pulse rounded-md border border-neutral-200 bg-white/70",
			className,
		)}
		aria-busy="true"
	/>
)
