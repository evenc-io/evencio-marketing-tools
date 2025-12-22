import { useEffect } from "react"
import { useEditorStore } from "@/stores/editor-store"

/**
 * Hook to warn users about unsaved changes before leaving the page.
 * Shows a browser confirmation dialog if there are unsaved changes.
 */
export function useBeforeUnload() {
	const isDirty = useEditorStore((s) => s.isDirty)

	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (isDirty) {
				e.preventDefault()
				// Chrome requires returnValue to be set
				e.returnValue = ""
			}
		}

		window.addEventListener("beforeunload", handler)
		return () => window.removeEventListener("beforeunload", handler)
	}, [isDirty])
}

export default useBeforeUnload
