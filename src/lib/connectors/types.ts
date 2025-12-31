import { z } from "zod"

export const connectorIdSchema = z
	.string()
	.min(2)
	.max(48)
	.regex(/^[a-z0-9-]+$/, "Connector id must be kebab-case (a-z, 0-9, -)")

export const connectorStatusSchema = z.enum(["available", "beta", "coming-soon", "deprecated"])
export type ConnectorStatus = z.infer<typeof connectorStatusSchema>

const connectorEndpointSchema = z.object({
	authorize: z.string().url(),
	token: z.string().url(),
	jwks: z.string().url().optional(),
})

const connectorEndpointsByEnvSchema = z
	.object({
		dev: connectorEndpointSchema.optional(),
		prod: connectorEndpointSchema.optional(),
	})
	.refine((value) => value.dev || value.prod, "Provide at least one environment endpoint")

const connectorRedirectUrisSchema = z.object({
	dev: z.array(z.string().url()).optional(),
	prod: z.array(z.string().url()).optional(),
})

const connectorOAuthSchema = z.object({
	type: z.literal("oauth"),
	description: z.string().min(1),
	pkce: z.literal("required"),
	grantTypes: z.array(z.enum(["authorization_code", "refresh_token"])).min(1),
	scopes: z.array(z.string().min(1)).min(1),
	endpoints: connectorEndpointsByEnvSchema.optional(),
	redirectUris: connectorRedirectUrisSchema.optional(),
	notes: z.array(z.string().min(1)).optional(),
})

const connectorApiKeySchema = z.object({
	type: z.literal("api-key"),
	description: z.string().min(1),
	headerName: z.string().min(1).optional(),
})

const connectorNoneSchema = z.object({
	type: z.literal("none"),
	description: z.string().min(1).optional(),
})

export const connectorAuthSchema = z.discriminatedUnion("type", [
	connectorOAuthSchema,
	connectorApiKeySchema,
	connectorNoneSchema,
])

export type ConnectorAuth = z.infer<typeof connectorAuthSchema>

export const connectorCapabilitySchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	description: z.string().min(1).optional(),
})

export type ConnectorCapability = z.infer<typeof connectorCapabilitySchema>

export const connectorLinkSchema = z.object({
	label: z.string().min(1),
	href: z.string().min(1),
})

export type ConnectorLink = z.infer<typeof connectorLinkSchema>

const connectorPublisherSchema = z.object({
	name: z.string().min(1),
	url: z.string().url().optional(),
	email: z.string().email().optional(),
})

const connectorSetupStepSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1).optional(),
	bullets: z.array(z.string().min(1)).optional(),
})

const connectorConnectionSchema = z.object({
	startPath: z.string().min(1),
	statusPath: z.string().min(1).optional(),
	disconnectPath: z.string().min(1).optional(),
})

export type ConnectorConnection = z.infer<typeof connectorConnectionSchema>

export const connectorDefinitionSchema = z.object({
	id: connectorIdSchema,
	name: z.string().min(2),
	summary: z.string().min(5),
	description: z.string().min(10),
	category: z.enum(["events", "ticketing", "marketing", "assets", "analytics", "custom"]),
	status: connectorStatusSchema,
	auth: connectorAuthSchema,
	capabilities: z.array(connectorCapabilitySchema).min(1),
	setup: z.array(connectorSetupStepSchema).optional(),
	tags: z.array(z.string().min(1)).optional(),
	docsPath: z.string().min(1).optional(),
	links: z.array(connectorLinkSchema).optional(),
	publisher: connectorPublisherSchema.optional(),
	icon: z.string().min(1).optional(),
	connection: connectorConnectionSchema.optional(),
})

export type ConnectorDefinition = z.infer<typeof connectorDefinitionSchema>
export type ConnectorDefinitionInput = z.input<typeof connectorDefinitionSchema>
