import { type MouseEvent, useCallback, useState } from "react"
import type { ExampleFilterId, ImportFilterId } from "@/routes/-snippets/new/constants"

export function useSnippetFilters() {
	const [exampleFilters, setExampleFilters] = useState<ExampleFilterId[]>(["all"])
	const [importsFilters, setImportsFilters] = useState<ImportFilterId[]>(["all"])

	const handleExampleFilterClick = useCallback(
		(id: ExampleFilterId, event: MouseEvent<HTMLButtonElement>) => {
			if (id === "all") {
				setExampleFilters(["all"])
				return
			}
			const isMulti = event.shiftKey || event.metaKey || event.ctrlKey
			if (!isMulti) {
				setExampleFilters([id])
				return
			}
			setExampleFilters((prev) => {
				const withoutAll = prev.filter((entry) => entry !== "all")
				const hasId = withoutAll.includes(id)
				const next = hasId ? withoutAll.filter((entry) => entry !== id) : [...withoutAll, id]
				return next.length > 0 ? next : ["all"]
			})
		},
		[],
	)

	const handleImportsFilterClick = useCallback(
		(id: ImportFilterId, event: MouseEvent<HTMLButtonElement>) => {
			if (id === "all") {
				setImportsFilters(["all"])
				return
			}
			const isMulti = event.shiftKey || event.metaKey || event.ctrlKey
			if (!isMulti) {
				setImportsFilters([id])
				return
			}
			setImportsFilters((prev) => {
				const withoutAll = prev.filter((entry) => entry !== "all")
				const hasId = withoutAll.includes(id)
				const next = hasId ? withoutAll.filter((entry) => entry !== id) : [...withoutAll, id]
				return next.length > 0 ? next : ["all"]
			})
		},
		[],
	)

	return {
		exampleFilters,
		importsFilters,
		handleExampleFilterClick,
		handleImportsFilterClick,
		setExampleFilters,
		setImportsFilters,
	}
}
