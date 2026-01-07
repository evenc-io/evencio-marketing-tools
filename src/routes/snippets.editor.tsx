import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SnippetsEditorPage } from "@/routes/-snippets/editor/page"

export const Route = createFileRoute("/snippets/editor")({
	validateSearch: z.object({
		edit: z.string().optional(),
		template: z.string().optional(),
	}),
	component: SnippetsEditorRoute,
})

function SnippetsEditorRoute() {
	const search = Route.useSearch()
	return <SnippetsEditorPage search={search} />
}
