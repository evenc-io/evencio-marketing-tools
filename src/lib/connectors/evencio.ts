import { defineConnector } from "./define-connector"

export const evencioConnector = defineConnector({
	id: "evencio",
	name: "Evencio",
	summary: "Connect Evencio to sync events, venues, guests, and brand assets.",
	description:
		"Use Evencio OAuth to authorize the Marketing Tools app to access event data, venues, guests, and branding from your organization.",
	category: "events",
	status: "beta",
	icon: "cloud",
	publisher: {
		name: "Evencio",
	},
	auth: {
		type: "oauth",
		description: "Authorization Code + PKCE (admin approval required).",
		pkce: "required",
		grantTypes: ["authorization_code", "refresh_token"],
		scopes: ["events:read", "venues:read", "guests:read", "offline_access"],
		endpoints: {
			dev: {
				authorize: "https://dev-local-auth.evencio-cdn-secure.com/oauth/authorize",
				token: "https://dev-local-auth.evencio-cdn-secure.com/api/oauth/token",
				jwks: "https://dev-local-auth.evencio-cdn-secure.com/.well-known/jwks.json",
			},
			prod: {
				authorize: "https://auth.evenc.io/oauth/authorize",
				token: "https://auth.evenc.io/api/oauth/token",
				jwks: "https://auth.evenc.io/.well-known/jwks.json",
			},
		},
		redirectUris: {
			dev: ["https://dev-local-marketing.evencio-cdn-secure.com/oauth/callback"],
			prod: ["https://evencio-marketing-tools.vercel.app/oauth/callback"],
		},
		notes: [
			"Client secrets must remain server-side.",
			"Refresh tokens are rotated; store them securely.",
		],
	},
	capabilities: [
		{
			id: "events",
			label: "Event sync",
			description: "Pull event schedules, metadata, and descriptions.",
		},
		{
			id: "venues",
			label: "Venue details",
			description: "Sync venue locations and logistics details.",
		},
		{
			id: "guests",
			label: "Guest lists",
			description: "Access guest counts and segments for marketing assets.",
		},
		{
			id: "branding",
			label: "Brand assets",
			description: "Import logos, colors, and organizer branding.",
		},
	],
	tags: ["official", "oauth"],
	connection: {
		startPath: "/api/integrations/evencio/connect",
		statusPath: "/api/integrations/evencio/status",
		disconnectPath: "/api/integrations/evencio/disconnect",
	},
})
