import { createError, defineEventHandler, getCookie, getHeader, sendRedirect, setCookie } from "h3"
import {
	buildAuthorizeUrl,
	createOAuthRequest,
	type EvencioOAuthClient,
	ensureOAuthClient,
	getEvencioOAuthEnv,
	getSessionId,
} from "../../../../lib/integrations/evencio-oauth"

const SESSION_COOKIE = "evencio_oauth_session"

export default defineEventHandler(async (event) => {
	const env = getEvencioOAuthEnv()
	const adminCookie = getHeader(event, "cookie")
	if (!adminCookie) {
		throw createError({
			statusCode: 401,
			statusMessage:
				"Missing admin session cookie. Run the app on evencio-cdn-secure.com and sign in.",
		})
	}

	const existingSession = getCookie(event, SESSION_COOKIE)
	const sessionId = existingSession ?? getSessionId()

	if (!existingSession) {
		setCookie(event, SESSION_COOKIE, sessionId, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 60 * 60,
		})
	}

	let client: EvencioOAuthClient
	try {
		client = await ensureOAuthClient(env, sessionId, adminCookie)
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: error instanceof Error ? error.message : "OAuth provisioning failed",
		})
	}

	const { state, codeChallenge } = createOAuthRequest(sessionId)
	const authorizeUrl = buildAuthorizeUrl(env, client.clientId, { state, codeChallenge })
	return sendRedirect(event, authorizeUrl, 302)
})
