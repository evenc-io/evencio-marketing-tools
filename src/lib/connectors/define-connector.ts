import {
	type ConnectorDefinition,
	type ConnectorDefinitionInput,
	connectorDefinitionSchema,
} from "./types"

export function defineConnector<const T extends ConnectorDefinitionInput>(
	input: T,
): ConnectorDefinition {
	return connectorDefinitionSchema.parse(input)
}
