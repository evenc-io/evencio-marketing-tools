import { CalendarDays, Cloud, KeyRound, Link2, Puzzle } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { ConnectorDefinition, ConnectorStatus } from "@/lib/connectors"
import { cn } from "@/lib/utils"

const iconMap = {
	cloud: Cloud,
	calendar: CalendarDays,
	key: KeyRound,
	link: Link2,
	puzzle: Puzzle,
} as const

const statusStyles: Record<ConnectorStatus, string> = {
	available: "border-emerald-200 bg-emerald-50 text-emerald-700",
	beta: "border-amber-200 bg-amber-50 text-amber-700",
	"coming-soon": "border-neutral-200 bg-neutral-100 text-neutral-500",
	deprecated: "border-rose-200 bg-rose-50 text-rose-700",
}

const statusLabels: Record<ConnectorStatus, string> = {
	available: "Available",
	beta: "Beta",
	"coming-soon": "Coming soon",
	deprecated: "Deprecated",
}

function formatAuthSummary(connector: ConnectorDefinition): string {
	switch (connector.auth.type) {
		case "oauth":
			return "OAuth 2.0 (PKCE required)"
		case "api-key":
			return connector.auth.headerName ? `API key (${connector.auth.headerName})` : "API key"
		case "none":
			return "No authentication"
	}
}

type ConnectionState = "connected" | "disconnected" | "loading" | "error"

interface ConnectorCardProps {
	connector: ConnectorDefinition
	action?: ReactNode
	connectionState?: ConnectionState
	connectionDetail?: string
}

const connectionLabels: Record<ConnectionState, string> = {
	connected: "Connected",
	disconnected: "Not connected",
	loading: "Checking connection",
	error: "Connection error",
}

const connectionStyles: Record<ConnectionState, string> = {
	connected: "text-emerald-600",
	disconnected: "text-neutral-500",
	loading: "text-neutral-400",
	error: "text-rose-600",
}

export function ConnectorCard({
	connector,
	action,
	connectionState,
	connectionDetail,
}: ConnectorCardProps) {
	const iconKey =
		connector.icon && Object.hasOwn(iconMap, connector.icon) ? connector.icon : "puzzle"
	const Icon = iconMap[iconKey as keyof typeof iconMap]

	return (
		<Card className="shadow-none">
			<CardHeader className="flex flex-col gap-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
							<Icon className="h-5 w-5 text-neutral-500" />
						</div>
						<div className="space-y-1">
							<CardTitle className="text-base">{connector.name}</CardTitle>
							<p className="text-sm text-neutral-500">{connector.summary}</p>
						</div>
					</div>
					<span
						className={cn(
							"inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium",
							statusStyles[connector.status],
						)}
					>
						{statusLabels[connector.status]}
					</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<p className="text-sm text-neutral-600">{connector.description}</p>
				{connectionState && (
					<div className="space-y-1 text-xs">
						<p className={cn("font-medium", connectionStyles[connectionState])}>
							{connectionLabels[connectionState]}
						</p>
						{connectionDetail && <p className="text-neutral-400">{connectionDetail}</p>}
					</div>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
							Capabilities
						</p>
						<ul className="mt-2 space-y-1 text-sm text-neutral-600">
							{connector.capabilities.map((capability) => (
								<li key={capability.id}>{capability.label}</li>
							))}
						</ul>
					</div>
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Auth</p>
						<p className="mt-2 text-sm text-neutral-600">{formatAuthSummary(connector)}</p>
						{connector.auth.type === "oauth" && (
							<p className="mt-2 text-xs text-neutral-500">
								Scopes: {connector.auth.scopes.join(", ")}
							</p>
						)}
					</div>
				</div>

				{connector.setup?.length ? (
					<div className="space-y-3 border-t border-neutral-200 pt-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
							Setup steps
						</p>
						<ol className="space-y-3 text-sm text-neutral-600">
							{connector.setup.map((step, index) => (
								<li key={`${connector.id}-step-${step.title}`}>
									<span className="font-medium text-neutral-900">
										{index + 1}. {step.title}
									</span>
									{step.description && (
										<p className="mt-1 text-sm text-neutral-600">{step.description}</p>
									)}
									{step.bullets?.length ? (
										<ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-neutral-500">
											{step.bullets.map((bullet) => (
												<li key={bullet}>{bullet}</li>
											))}
										</ul>
									) : null}
								</li>
							))}
						</ol>
					</div>
				) : null}
			</CardContent>
			<CardFooter className="flex flex-wrap items-center justify-between gap-3">
				{action ? (
					<div className="flex flex-wrap items-center gap-2">{action}</div>
				) : (
					<span className="text-xs text-neutral-400">
						Setup is configured through the server-side OAuth flow.
					</span>
				)}
			</CardFooter>
		</Card>
	)
}
