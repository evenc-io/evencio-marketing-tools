import { createFileRoute } from "@tanstack/react-router"
import { AssetLibraryPage } from "@/routes/-library/page"

export const Route = createFileRoute("/library")({
	component: AssetLibraryPage,
})
