import { evencioConnector } from "./evencio"
import { type ConnectorDefinition, connectorDefinitionSchema } from "./types"

export interface ConnectorRegistry {
	list: ConnectorDefinition[]
	get: (id: string) => ConnectorDefinition | null
}

/**
 * Create a connector registry that validates definitions and provides lookup by id.
 */
export function createConnectorRegistry(definitions: ConnectorDefinition[]): ConnectorRegistry {
	const byId = new Map<string, ConnectorDefinition>()
	const parsed = definitions.map((definition) => connectorDefinitionSchema.parse(definition))

	for (const connector of parsed) {
		if (byId.has(connector.id)) {
			throw new Error(`Duplicate connector id: ${connector.id}`)
		}
		byId.set(connector.id, connector)
	}

	const list = [...parsed].sort((a, b) => a.name.localeCompare(b.name))

	return {
		list,
		get: (id) => byId.get(id) ?? null,
	}
}

export const connectorRegistry = createConnectorRegistry([evencioConnector])
export const connectors = connectorRegistry.list
export const getConnectorById = connectorRegistry.get
