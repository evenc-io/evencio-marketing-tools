import { describe, expect, it } from "bun:test"
import {
	type ConnectorDefinitionInput,
	createConnectorRegistry,
	defineConnector,
} from "@/lib/connectors"

const baseConnector: ConnectorDefinitionInput = {
	id: "sample",
	name: "Sample Connector",
	summary: "Sync sample events into the marketing tool.",
	description: "A sample connector manifest used for unit testing.",
	category: "events",
	status: "beta",
	auth: {
		type: "none",
		description: "No authentication required for tests.",
	},
	capabilities: [{ id: "events", label: "Event sync" }],
}

const createConnector = (overrides: Partial<ConnectorDefinitionInput> = {}) =>
	defineConnector({
		...baseConnector,
		...overrides,
	})

describe("defineConnector", () => {
	it("validates a connector manifest", () => {
		const connector = createConnector({ id: "valid-connector" })
		expect(connector.id).toBe("valid-connector")
	})

	it("rejects invalid ids", () => {
		expect(() => createConnector({ id: "Invalid Id" })).toThrow()
	})
})

describe("createConnectorRegistry", () => {
	it("sorts connectors by name", () => {
		const bravo = createConnector({ id: "bravo", name: "Bravo" })
		const alpha = createConnector({ id: "alpha", name: "Alpha" })
		const registry = createConnectorRegistry([bravo, alpha])

		expect(registry.list.map((connector) => connector.id)).toEqual(["alpha", "bravo"])
	})

	it("throws on duplicate ids", () => {
		const first = createConnector({ id: "duplicate", name: "First" })
		const second = createConnector({ id: "duplicate", name: "Second" })

		expect(() => createConnectorRegistry([first, second])).toThrow(
			"Duplicate connector id: duplicate",
		)
	})
})
