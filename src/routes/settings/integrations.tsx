import { createFileRoute } from "@tanstack/react-router"
import { Cloud, Puzzle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

export const Route = createFileRoute("/settings/integrations")({
	component: IntegrationsPage,
})

function IntegrationsPage() {
	return (
		<div className="p-4 md:p-8">
			{/* Header */}
			<div className="mb-6 md:mb-8">
				<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">
					Integrations
				</h1>
				<p className="mt-2 text-neutral-500">Connect to Evencio platform</p>
			</div>

			{/* Content */}
			<div className="space-y-6">
				{/* Coming Soon Banner */}
				<EmptyState
					icon={<Puzzle className="h-6 w-6" />}
					title="Integration coming soon"
					description="We're working on connecting to the Evencio platform"
					className="min-h-32"
				/>

				{/* Evencio Integration */}
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Evencio Connector</CardTitle>
						<CardDescription>Connect your marketing tools to the Evencio platform</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-start gap-4">
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
								<Cloud className="h-6 w-6 text-neutral-400" />
							</div>
							<div className="flex-1">
								<p className="font-medium text-neutral-900">Evencio Events API</p>
								<ul className="mt-2 space-y-1 text-sm text-neutral-500">
									<li>Sync events and branding from your Evencio organization</li>
									<li>Import event details, logos, and color schemes automatically</li>
									<li>Export designs directly to Evencio for use in your events</li>
								</ul>
								<span className="mt-3 inline-block rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-500">
									Coming soon
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
