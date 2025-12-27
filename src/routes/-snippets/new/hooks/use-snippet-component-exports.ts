import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import {
	getSnippetComponentSourceMap,
	listSnippetComponentExports,
	parseSnippetFiles,
	removeSnippetComponentExport,
	type SnippetComponentExport,
	serializeSnippetFiles,
} from "@/lib/snippets"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"
import { syncImportBlock } from "@/routes/-snippets/new/snippet-file-utils"

interface UseSnippetComponentExportsOptions {
	source: string
	form: UseFormReturn<CustomSnippetValues>
	fileMigrationRef: MutableRefObject<boolean>
}

export function useSnippetComponentExports({
	source,
	form,
	fileMigrationRef,
}: UseSnippetComponentExportsOptions) {
	const [componentExports, setComponentExports] = useState<SnippetComponentExport[]>([])
	const [componentExportsLoaded, setComponentExportsLoaded] = useState(false)
	const exportVersionRef = useRef(0)

	const resetComponentExports = useCallback(() => {
		setComponentExportsLoaded(false)
	}, [])

	useEffect(() => {
		let isCancelled = false
		const version = ++exportVersionRef.current
		const timer = setTimeout(async () => {
			try {
				const exportEntries = await listSnippetComponentExports(source)
				if (isCancelled || version !== exportVersionRef.current) return
				setComponentExports(exportEntries)
				setComponentExportsLoaded(true)
			} catch {
				if (isCancelled || version !== exportVersionRef.current) return
				setComponentExports([])
				setComponentExportsLoaded(true)
			}
		}, 250)

		return () => {
			isCancelled = true
			clearTimeout(timer)
		}
	}, [source])

	useEffect(() => {
		if (fileMigrationRef.current) return
		if (!componentExportsLoaded) return
		const parsed = parseSnippetFiles(source)
		if (parsed.hasFileBlocks) {
			fileMigrationRef.current = true
			return
		}
		const namedExports = componentExports.filter((component) => !component.isDefault)
		if (namedExports.length === 0) {
			fileMigrationRef.current = true
			return
		}

		void (async () => {
			try {
				const currentSource = form.getValues("source") ?? ""
				const { mainSource } = parseSnippetFiles(currentSource)
				const sourceMap = await getSnippetComponentSourceMap(currentSource)
				let nextMain = mainSource
				const nextFiles: Record<string, string> = {}

				for (const component of namedExports) {
					const exportName = component.exportName
					const fileName = `${exportName}.tsx`
					const componentSource = sourceMap[exportName]
					if (!componentSource) continue
					nextFiles[fileName] = componentSource.trimEnd()
					const removal = await removeSnippetComponentExport(nextMain, exportName)
					if (removal.removed) {
						nextMain = removal.source
					}
				}

				if (Object.keys(nextFiles).length === 0) {
					fileMigrationRef.current = true
					return
				}

				const nextSerialized = serializeSnippetFiles(
					syncImportBlock(nextMain, Object.keys(nextFiles)),
					nextFiles,
				)
				form.setValue("source", nextSerialized, {
					shouldValidate: true,
					shouldDirty: true,
				})
			} catch {
				// Ignore migration errors to avoid blocking edits.
			} finally {
				fileMigrationRef.current = true
			}
		})()
	}, [componentExports, componentExportsLoaded, fileMigrationRef, form, source])

	return {
		componentExports,
		resetComponentExports,
	}
}
