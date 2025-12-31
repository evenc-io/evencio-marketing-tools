import { defineEventHandler, getCookie } from "h3"
import {
	clearToken,
	ensureValidAccessToken,
	getActiveToken,
	getClient,
	getEvencioOAuthEnv,
	readStatus,
} from "../../../../lib/integrations/evencio-oauth"

const SESSION_COOKIE = "evencio_oauth_session"

export default defineEventHandler(async (event) => {
	const sessionId = getCookie(event, SESSION_COOKIE)
	if (!sessionId) {
		return { connected: false }
	}

	const token = getActiveToken(sessionId)
	if (!token) {
		return { connected: false }
	}

	const env = getEvencioOAuthEnv()
	const client = getClient(sessionId)
	if (!client) {
		return { connected: false, error: "missing_client" }
	}

	const accessToken = await ensureValidAccessToken(env, sessionId)
	if (!accessToken) {
		clearToken(sessionId)
		return { connected: false, error: "token_expired" }
	}

	const activeToken = getActiveToken(sessionId)

	try {
		const status = await readStatus(env, accessToken)
		return {
			connected: true,
			status,
			expiresAt: activeToken ? new Date(activeToken.expiresAt).toISOString() : undefined,
		}
	} catch (error) {
		return {
			connected: false,
			error: error instanceof Error ? error.message : "status_failed",
		}
	}
})
