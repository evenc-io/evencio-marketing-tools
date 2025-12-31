import { defineEventHandler, getCookie, getQuery, sendRedirect } from "h3"
import {
	consumeOAuthRequest,
	exchangeAuthorizationCode,
	getClient,
	getEvencioOAuthEnv,
} from "../../lib/integrations/evencio-oauth"

const SESSION_COOKIE = "evencio_oauth_session"

const redirectToIntegrations = (
	event: Parameters<typeof sendRedirect>[0],
	status: string,
	reason?: string,
) => {
	const params = new URLSearchParams({ evencio: status })
	if (reason) {
		params.set("reason", reason)
	}
	return sendRedirect(event, `/settings/integrations?${params.toString()}`, 302)
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	const error = typeof query.error === "string" ? query.error : null
	const errorDescription =
		typeof query.error_description === "string" ? query.error_description : null
	const code = typeof query.code === "string" ? query.code : null
	const state = typeof query.state === "string" ? query.state : null

	if (error) {
		return redirectToIntegrations(event, "error", errorDescription ?? error)
	}

	if (!code || !state) {
		return redirectToIntegrations(event, "error", "missing_code")
	}

	const env = getEvencioOAuthEnv()

	const sessionId = getCookie(event, SESSION_COOKIE)
	if (!sessionId) {
		return redirectToIntegrations(event, "error", "missing_session")
	}

	const request = consumeOAuthRequest(sessionId)
	if (!request || request.state !== state) {
		return redirectToIntegrations(event, "error", "state_mismatch")
	}

	const client = getClient(sessionId)
	if (!client) {
		return redirectToIntegrations(event, "error", "missing_client")
	}

	try {
		await exchangeAuthorizationCode(env, client, sessionId, code, request.codeVerifier)
		return redirectToIntegrations(event, "connected")
	} catch (err) {
		return redirectToIntegrations(
			event,
			"error",
			err instanceof Error ? err.message : "token_exchange_failed",
		)
	}
})
