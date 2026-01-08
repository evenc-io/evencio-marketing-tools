import { createHash, randomBytes, randomUUID } from "node:crypto"
import { z } from "zod"

const DEFAULT_SCOPES = ["events:read", "venues:read", "guests:read", "offline_access"]
const INTERNAL_OAUTH_PROVISION_PATHS = [
	"/api/oauth/internal/studio",
	"/api/oauth/internal/marketing-tool",
]

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().int().optional(),
	refresh_token: z.string().optional(),
	scope: z.string().optional(),
	token_type: z.string().optional(),
})

export interface EvencioTokenSet {
	accessToken: string
	refreshToken?: string
	scope?: string
	tokenType?: string
	expiresAt: number
	obtainedAt: number
}

interface OAuthRequestState {
	state: string
	codeVerifier: string
	createdAt: number
}

export interface EvencioOAuthEnv {
	authBaseUrl: string
	apiBaseUrl: string
	redirectUri: string
	scopes: string[]
}

const oauthRequests = new Map<string, OAuthRequestState>()
const tokenStore = new Map<string, EvencioTokenSet>()
const clientStore = new Map<string, EvencioOAuthClient>()

const SESSION_TTL_MS = 60 * 60 * 1000
const OAUTH_REQUEST_TTL_MS = 10 * 60 * 1000
const TOKEN_GRACE_MS = 5 * 60 * 1000

const pruneStaleSessions = (now = Date.now()) => {
	for (const [sessionId, request] of oauthRequests.entries()) {
		if (now - request.createdAt > OAUTH_REQUEST_TTL_MS) {
			oauthRequests.delete(sessionId)
		}
	}

	for (const [sessionId, token] of tokenStore.entries()) {
		const expired = token.expiresAt + TOKEN_GRACE_MS < now
		const tooOld = now - token.obtainedAt > SESSION_TTL_MS
		if (expired || tooOld) {
			tokenStore.delete(sessionId)
		}
	}

	for (const [sessionId, client] of clientStore.entries()) {
		if (now - client.createdAt > SESSION_TTL_MS) {
			clientStore.delete(sessionId)
		}
	}
}

const base64UrlEncode = (input: Buffer) =>
	input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")

const getEnvConfig = () => {
	const isProd = process.env.NODE_ENV === "production"
	const authBaseUrl =
		process.env.EVENCIO_AUTH_BASE_URL ??
		(isProd ? "https://auth.evenc.io" : "https://dev-local-auth.evencio-cdn-secure.com")
	const apiBaseUrl =
		process.env.EVENCIO_API_BASE_URL ??
		(isProd ? "https://api.evenc.io" : "https://dev-local-api.evencio-cdn-secure.com")
	const redirectUri =
		process.env.EVENCIO_OAUTH_REDIRECT_URI ??
		(isProd
			? "https://studio.evenc.io/oauth/callback"
			: "https://dev-local-marketing.evencio-cdn-secure.com/oauth/callback")
	const scopesRaw = process.env.EVENCIO_OAUTH_SCOPES?.trim()
	const scopes = (scopesRaw ? scopesRaw.split(" ") : DEFAULT_SCOPES).filter(Boolean)

	return {
		authBaseUrl,
		apiBaseUrl,
		redirectUri,
		scopes,
	}
}

/**
 * Read Evencio OAuth configuration from environment variables, with dev/prod defaults.
 */
export const getEvencioOAuthEnv = (): EvencioOAuthEnv => getEnvConfig()

/**
 * Create a new opaque session id used to key in-memory OAuth state for this process.
 */
export const getSessionId = () => {
	try {
		return randomUUID()
	} catch {
		return base64UrlEncode(randomBytes(16))
	}
}

/**
 * Create and persist an OAuth PKCE request (state + code verifier) for a given session.
 */
export const createOAuthRequest = (sessionId: string) => {
	pruneStaleSessions()
	const state = base64UrlEncode(randomBytes(16))
	const codeVerifier = base64UrlEncode(randomBytes(32))
	const codeChallenge = base64UrlEncode(createHash("sha256").update(codeVerifier).digest())

	oauthRequests.set(sessionId, {
		state,
		codeVerifier,
		createdAt: Date.now(),
	})

	return { state, codeChallenge }
}

/**
 * Read and delete the pending OAuth request for a session (returns null if missing/expired).
 */
export const consumeOAuthRequest = (sessionId: string) => {
	pruneStaleSessions()
	const request = oauthRequests.get(sessionId) ?? null
	if (!request) return null

	if (Date.now() - request.createdAt > OAUTH_REQUEST_TTL_MS) {
		oauthRequests.delete(sessionId)
		return null
	}

	oauthRequests.delete(sessionId)
	return request
}

/**
 * Get the active token set for a session (returns null if missing/expired).
 */
export const getActiveToken = (sessionId: string) => {
	pruneStaleSessions()
	return tokenStore.get(sessionId) ?? null
}

export interface EvencioOAuthClient {
	clientId: string
	clientSecret?: string
	createdAt: number
}

/**
 * Get the cached OAuth client for a session (returns null if missing/expired).
 */
export const getClient = (sessionId: string) => {
	pruneStaleSessions()
	return clientStore.get(sessionId) ?? null
}

/**
 * Cache an OAuth client for a session.
 */
export const setClient = (sessionId: string, client: EvencioOAuthClient) => {
	clientStore.set(sessionId, client)
}

/**
 * Ensure an OAuth client exists for a session, provisioning one if needed.
 */
export const ensureOAuthClient = async (
	env: EvencioOAuthEnv,
	sessionId: string,
	adminCookie: string,
) => {
	pruneStaleSessions()
	const existing = getClient(sessionId)
	if (existing) return existing

	const provisioned = await provisionOAuthClient(env, adminCookie)
	let clientId = provisioned.clientId
	let clientSecret = provisioned.clientSecret

	if (!clientSecret) {
		const rotated = await provisionOAuthClient(env, adminCookie, { rotateSecret: true })
		clientId = rotated.clientId || clientId
		clientSecret = rotated.clientSecret
	}

	if (!clientSecret) {
		throw new Error("OAuth client secret missing. Rotate the secret and try again.")
	}

	const client: EvencioOAuthClient = {
		clientId,
		clientSecret,
		createdAt: Date.now(),
	}
	setClient(sessionId, client)
	return client
}

const saveToken = (sessionId: string, payload: z.infer<typeof tokenResponseSchema>) => {
	const now = Date.now()
	const expiresIn = payload.expires_in ?? 3600
	const previous = tokenStore.get(sessionId)
	const nextToken: EvencioTokenSet = {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? previous?.refreshToken,
		scope: payload.scope ?? previous?.scope,
		tokenType: payload.token_type ?? previous?.tokenType,
		expiresAt: now + expiresIn * 1000,
		obtainedAt: now,
	}

	tokenStore.set(sessionId, nextToken)
	return nextToken
}

/**
 * Clear all OAuth state for a session (token, request, and cached client).
 */
export const clearToken = (sessionId: string) => {
	tokenStore.delete(sessionId)
	oauthRequests.delete(sessionId)
	clientStore.delete(sessionId)
}

const postTokenRequest = async (body: URLSearchParams, env: EvencioOAuthEnv) => {
	const response = await fetch(`${env.authBaseUrl}/api/oauth/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body,
	})

	const json = await response.json().catch(() => null)

	if (!response.ok) {
		const message =
			json && typeof json === "object" && "error" in json
				? String(json.error)
				: "Token request failed"
		throw new Error(message)
	}

	const parsed = tokenResponseSchema.safeParse(json)
	if (!parsed.success) {
		throw new Error("Invalid token response")
	}

	return parsed.data
}

/**
 * Exchange an authorization code for tokens and store them for the session.
 */
export const exchangeAuthorizationCode = async (
	env: EvencioOAuthEnv,
	client: EvencioOAuthClient,
	sessionId: string,
	code: string,
	codeVerifier: string,
) => {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: client.clientId,
		code,
		redirect_uri: env.redirectUri,
		code_verifier: codeVerifier,
	})

	if (client.clientSecret) {
		body.set("client_secret", client.clientSecret)
	}

	const payload = await postTokenRequest(body, env)
	return saveToken(sessionId, payload)
}

/**
 * Refresh the access token using the session's refresh token (returns null if unavailable).
 */
export const refreshAccessToken = async (
	env: EvencioOAuthEnv,
	client: EvencioOAuthClient,
	sessionId: string,
) => {
	const token = tokenStore.get(sessionId)
	if (!token?.refreshToken) {
		return null
	}

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: client.clientId,
		refresh_token: token.refreshToken,
	})

	if (client.clientSecret) {
		body.set("client_secret", client.clientSecret)
	}

	const payload = await postTokenRequest(body, env)
	return saveToken(sessionId, payload)
}

/**
 * Return a currently valid access token for the session, refreshing if near expiry.
 */
export const ensureValidAccessToken = async (env: EvencioOAuthEnv, sessionId: string) => {
	pruneStaleSessions()
	const token = tokenStore.get(sessionId)
	if (!token) return null
	const client = clientStore.get(sessionId)
	if (!client) return null

	const now = Date.now()
	if (token.expiresAt - now > 60_000) {
		return token.accessToken
	}

	const refreshed = await refreshAccessToken(env, client, sessionId)
	return refreshed?.accessToken ?? null
}

/**
 * Build the OAuth authorize URL for redirecting the user to Evencio Auth.
 */
export const buildAuthorizeUrl = (
	env: EvencioOAuthEnv,
	clientId: string,
	req: { state: string; codeChallenge: string },
) => {
	const url = new URL("/oauth/authorize", env.authBaseUrl)
	url.searchParams.set("response_type", "code")
	url.searchParams.set("client_id", clientId)
	url.searchParams.set("redirect_uri", env.redirectUri)
	url.searchParams.set("scope", env.scopes.join(" "))
	url.searchParams.set("state", req.state)
	url.searchParams.set("code_challenge", req.codeChallenge)
	url.searchParams.set("code_challenge_method", "S256")
	return url.toString()
}

/**
 * Fetch the current OAuth status from the Evencio API for an access token.
 */
export const readStatus = async (env: EvencioOAuthEnv, accessToken: string) => {
	const response = await fetch(`${env.apiBaseUrl}/oauth/status`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
	})

	if (!response.ok) {
		throw new Error("Failed to fetch OAuth status")
	}

	return response.json() as Promise<{
		userId: string
		organizationId: string
		clientId: string
		scopes: string[]
	}>
}

const provisionResponseSchema = z.object({
	clientId: z.string().min(1),
	clientSecret: z.string().min(1).optional(),
})

const normalizeProvisionResponse = (input: unknown) => {
	if (!input || typeof input !== "object") return null
	const data = input as Record<string, unknown>
	const clientId =
		typeof data.clientId === "string"
			? data.clientId
			: typeof data.client_id === "string"
				? data.client_id
				: undefined
	const clientSecret =
		typeof data.clientSecret === "string"
			? data.clientSecret
			: typeof data.client_secret === "string"
				? data.client_secret
				: undefined
	return { clientId, clientSecret }
}

export interface ProvisionOAuthClientOptions {
	redirectUris?: string[]
	scopes?: string[]
	rotateSecret?: boolean
}

/**
 * Provision an OAuth client via Evencio's internal endpoints (and optionally rotate its secret).
 */
export const provisionOAuthClient = async (
	env: EvencioOAuthEnv,
	cookie: string,
	options: ProvisionOAuthClientOptions = {},
) => {
	const redirectUris = options.redirectUris ?? [env.redirectUri]
	const scopes = options.scopes ?? env.scopes
	const rotateSecret = options.rotateSecret ?? false
	let lastError: Error | null = null

	for (const path of INTERNAL_OAUTH_PROVISION_PATHS) {
		const response = await fetch(`${env.authBaseUrl}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				cookie,
			},
			body: JSON.stringify({
				redirectUris,
				scopes,
				rotateSecret,
			}),
		})

		if (!response.ok) {
			if (response.status === 404 || response.status === 405) {
				lastError = new Error("OAuth provision endpoint not available")
				continue
			}
			throw new Error("Failed to provision OAuth client")
		}

		const json = await response.json().catch(() => null)
		const normalized = normalizeProvisionResponse(json)
		const parsed = provisionResponseSchema.safeParse(normalized)
		if (!parsed.success) {
			throw new Error("Invalid OAuth client response")
		}

		return parsed.data
	}

	throw lastError ?? new Error("Failed to provision OAuth client")
}
