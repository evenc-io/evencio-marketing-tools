import { defineEventHandler, deleteCookie, getCookie } from "h3"
import { clearToken } from "../../../../lib/integrations/evencio-oauth"

const SESSION_COOKIE = "evencio_oauth_session"

export default defineEventHandler((event) => {
	const sessionId = getCookie(event, SESSION_COOKIE)
	if (sessionId) {
		clearToken(sessionId)
	}

	deleteCookie(event, SESSION_COOKIE, { path: "/" })

	return { disconnected: true }
})
