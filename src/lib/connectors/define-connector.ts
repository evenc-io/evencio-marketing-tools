import {
	type ConnectorDefinition,
	type ConnectorDefinitionInput,
	connectorDefinitionSchema,
} from "./types"

/**
 * Validate and normalize a connector definition input.
 */
export function defineConnector<const T extends ConnectorDefinitionInput>(
	input: T,
): ConnectorDefinition {
	return connectorDefinitionSchema.parse(input)
}
