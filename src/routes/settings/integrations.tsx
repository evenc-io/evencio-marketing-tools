import { createFileRoute } from "@tanstack/react-router"
import { Puzzle } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ConnectorCard } from "@/components/integrations/connector-card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { connectors } from "@/lib/connectors"

export const Route = createFileRoute("/settings/integrations")({
	component: IntegrationsPage,
})

function IntegrationsPage() {
	const hasConnectors = connectors.length > 0
	const [connectionState, setConnectionState] = useState<
		Record<string, { state: "loading" | "connected" | "disconnected" | "error"; detail?: string }>
	>({})
	const isMountedRef = useRef(true)
	const pendingControllers = useRef(new Map<string, AbortController>())

	const updateConnectionState = useCallback(
		(
			updater: (
				prev: Record<
					string,
					{ state: "loading" | "connected" | "disconnected" | "error"; detail?: string }
				>,
			) => Record<
				string,
				{ state: "loading" | "connected" | "disconnected" | "error"; detail?: string }
			>,
		) => {
			if (!isMountedRef.current) return
			setConnectionState(updater)
		},
		[],
	)

	const loadConnectorStatus = useCallback(
		async (connectorId: string, statusPath: string) => {
			const existing = pendingControllers.current.get(connectorId)
			if (existing) {
				existing.abort()
			}

			const controller = new AbortController()
			pendingControllers.current.set(connectorId, controller)

			updateConnectionState((prev) => ({ ...prev, [connectorId]: { state: "loading" } }))
			try {
				const response = await fetch(statusPath, {
					headers: { Accept: "application/json" },
					signal: controller.signal,
				})
				if (!response.ok) {
					throw new Error("Status request failed")
				}
				const data = (await response.json()) as {
					connected: boolean
					status?: { organizationId?: string; userId?: string }
					error?: string
				}

				if (!isMountedRef.current || controller.signal.aborted) {
					return
				}

				if (data.connected) {
					const detail = data.status?.organizationId
						? `Organization: ${data.status.organizationId}`
						: undefined
					updateConnectionState((prev) => ({
						...prev,
						[connectorId]: { state: "connected", detail },
					}))
					return
				}

				const nextState = data.error ? "error" : "disconnected"
				updateConnectionState((prev) => ({
					...prev,
					[connectorId]: { state: nextState, detail: data.error },
				}))
			} catch (error) {
				if (!isMountedRef.current || controller.signal.aborted) {
					return
				}
				updateConnectionState((prev) => ({
					...prev,
					[connectorId]: {
						state: "error",
						detail: error instanceof Error ? error.message : "Unable to reach connector service.",
					},
				}))
			} finally {
				if (pendingControllers.current.get(connectorId) === controller) {
					pendingControllers.current.delete(connectorId)
				}
			}
		},
		[updateConnectionState],
	)

	useEffect(() => {
		isMountedRef.current = true
		const withStatus = connectors.filter((connector) => connector.connection?.statusPath)
		for (const connector of withStatus) {
			if (connector.connection?.statusPath) {
				loadConnectorStatus(connector.id, connector.connection.statusPath)
			}
		}
		return () => {
			isMountedRef.current = false
			for (const controller of pendingControllers.current.values()) {
				controller.abort()
			}
			pendingControllers.current.clear()
		}
	}, [loadConnectorStatus])

	const handleDisconnect = useCallback(
		async (connectorId: string, disconnectPath: string, statusPath?: string) => {
			updateConnectionState((prev) => ({ ...prev, [connectorId]: { state: "loading" } }))
			try {
				await fetch(disconnectPath, { method: "POST" })
			} finally {
				if (statusPath) {
					await loadConnectorStatus(connectorId, statusPath)
				} else {
					updateConnectionState((prev) => ({
						...prev,
						[connectorId]: { state: "disconnected" },
					}))
				}
			}
		},
		[loadConnectorStatus, updateConnectionState],
	)

	return (
		<div className="p-4 md:p-8">
			{/* Header */}
			<div className="mb-6 md:mb-8">
				<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">
					Integrations
				</h1>
				<p className="mt-2 text-neutral-500">Connect external services and data sources</p>
			</div>

			{/* Content */}
			<div className="space-y-6">
				{hasConnectors ? (
					<div className="grid gap-6">
						{connectors.map((connector) => {
							const connection = connector.connection
							const status = connectionState[connector.id]
							const hasStatus = Boolean(connection?.statusPath)
							const connectionStateValue = status?.state ?? (hasStatus ? "loading" : undefined)
							let action: ReactNode

							if (connection?.startPath) {
								if (connectionStateValue === "connected") {
									if (connection.disconnectPath) {
										const disconnectPath = connection.disconnectPath
										const statusPath = connection.statusPath
										action = (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDisconnect(connector.id, disconnectPath, statusPath)}
											>
												Disconnect
											</Button>
										)
									}
								} else if (connectionStateValue === "loading") {
									action = (
										<Button variant="outline" size="sm" disabled>
											Checking...
										</Button>
									)
								} else if (connectionStateValue === "error") {
									action = (
										<Button variant="outline" size="sm" asChild>
											<a href={connection.startPath}>Retry</a>
										</Button>
									)
								} else {
									action = (
										<Button variant="outline" size="sm" asChild>
											<a href={connection.startPath}>Connect</a>
										</Button>
									)
								}
							}

							return (
								<ConnectorCard
									key={connector.id}
									connector={connector}
									action={action}
									connectionState={connectionStateValue}
									connectionDetail={status?.detail}
								/>
							)
						})}
					</div>
				) : (
					<EmptyState
						icon={<Puzzle className="h-6 w-6" />}
						title="No connectors yet"
						description="Connector modules will appear here once they are registered."
						className="min-h-32"
					/>
				)}
			</div>
		</div>
	)
}
