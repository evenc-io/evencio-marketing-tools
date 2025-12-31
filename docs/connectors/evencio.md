# Evencio Connector

## Overview
The Evencio connector uses OAuth 2.0 Authorization Code with PKCE to authorize access to Evencio data. Organization admins approve consent and the app receives access and refresh tokens that are used with `evencio-bun-api`.

## OAuth requirements
- Authorization Code + PKCE (S256)
- Refresh tokens require the `offline_access` scope
- Client secrets are confidential and must remain server-side

## Environment URLs
**Auth base**
- Dev: `https://dev-local-auth.evencio-cdn-secure.com`
- Prod: `https://auth.evenc.io`

**API base**
- Dev: `https://dev-local-api.evencio-cdn-secure.com`
- Prod: `https://api.evenc.io`

**JWKS**
- Dev: `https://dev-local-auth.evencio-cdn-secure.com/.well-known/jwks.json`
- Prod: `https://auth.evenc.io/.well-known/jwks.json`

## Redirect URIs
- Dev: `https://dev-local-marketing.evencio-cdn-secure.com/oauth/callback`
- Prod: `https://studio.evenc.io/oauth/callback`

## Supported scopes
- `events:read`
- `venues:read`
- `tickets:read`
- `guests:read`
- `organizations:read`
- `offline_access`

## Recommended setup flow
1. **Provision OAuth client**
   - Call `POST /api/oauth/internal/marketing-tool` from the server with the admin session cookie.
   - Store `clientId` and `clientSecret` per organization on the server.
2. **Start admin consent**
   - Generate PKCE values and redirect the admin to `/oauth/authorize` with `response_type=code`.
3. **Exchange the code**
   - Server-side `POST /api/oauth/token` with `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`, and `code_verifier`.
4. **Store tokens**
   - Persist refresh tokens securely (encrypted). Store access tokens in memory or short-lived storage.
5. **Call data APIs**
   - Use `Authorization: Bearer <access_token>` with `evencio-bun-api` endpoints.
6. **Refresh tokens**
   - When the access token expires, use `grant_type=refresh_token` with the refresh token.

## Marketing Tools server endpoints
The Marketing Tools app exposes server routes to run the OAuth flow securely:

- `GET /api/integrations/evencio/connect` - Starts OAuth and redirects to the Evencio authorize page.
- `GET /oauth/callback` - Handles the OAuth redirect and exchanges the authorization code.
- `GET /api/integrations/evencio/status` - Returns connection status and resolved org/user data.
- `POST /api/integrations/evencio/disconnect` - Clears stored tokens for the current session.

## Environment variables (Marketing Tools)
Set these on the Marketing Tools server:

No env vars are required for local dev or production defaults. Use these only to override:

- `EVENCIO_OAUTH_REDIRECT_URI` (optional, overrides local/prod callback)
- `EVENCIO_OAUTH_SCOPES` (optional, space-delimited)
- `EVENCIO_AUTH_BASE_URL` (optional, overrides dev/prod base)
- `EVENCIO_API_BASE_URL` (optional, overrides dev/prod base)

**Note:** OAuth clients are auto-provisioned per org using the admin session cookie. The current implementation stores client credentials and tokens in memory. For production use, persist refresh tokens (and client secrets) in a database or vault per organization.

## Admin session cookie (local dev)
The auto-provision endpoint requires the Evencio admin session cookie. For local dev, run the Marketing Tools app on a subdomain of `evencio-cdn-secure.com` (for example via hosts + proxy) so the cookie is sent to the app server. For production, run on a subdomain of `evenc.io` (for example `studio.evenc.io`).

## OAuth events API behavior
All `/oauth/*` endpoints require `Authorization: Bearer <access_token>` (RS256 JWT) with `events:read` for event data.
Token claims must include `orgId`, `sub`, `clientId`, `jti`, and `scope`.

### GET /oauth/status
- No scope required.
- Returns `{ "userId": "...", "organizationId": "...", "clientId": "...", "scopes": ["..."] }`.

### GET /oauth/events
- Query parameters:
  - `filter`: `current | upcoming | recent | all` (default `all`)
  - `search`: string, max 255 (optional)
  - `venueId`: UUID (optional)
  - `limit`: int 1-100 (default 20)
  - `cursor`: UUID (optional)
- Sorted by `startDate` DESC, then `id` ASC.
- Cursor filter: `event.id > cursor` (UUID comparison).
- `nextCursor` is the last event id in the current response if `hasMore` is true.
- `total` counts for the applied filter/search/venue (ignores cursor).
- `filters.counts` are org-wide only (ignore search/venue and applied filter).

### GET /oauth/events/:eventId
- `eventId` must be UUID.
- Returns `{ "event": EventSummary, "capabilities": { all: false } }`.
- Returns 404 if the event is not found or not in the org.

### Event filtering rules
- `current`: `startDate <= now <= endDate`
- `upcoming`: `startDate > now`
- `recent`: `endDate < now` and `endDate >= now - 30 days`
- `all`: no time filter

### EventSummary fields
- `id`, `name`, `nameUniqueUrl`, `startDate`, `endDate`, `timezone`
- `status`: `cancelled` > `completed` (endDate < now & published) > `published` > `draft`
- `venue`: `{ id, name, address }` or `null`
- `coverImage`, `guestCount`, `ticketsSold`, `ticketingEnabled`, `isHappeningNow`

### Org scoping
Events are scoped by org via venue joins; the org is derived from the token claim (no orgId param).

## Security notes
- Refresh tokens are rotated; always overwrite stored values after a refresh.
- Do not expose client secrets or refresh tokens in the browser.
- Validate `iss`, `aud`, `exp`, and `scope` claims on the API side.

## Troubleshooting
- `invalid_redirect_uri`: redirect URI mismatch
- `invalid_grant`: expired or reused authorization code, or PKCE mismatch
- `invalid_client`: missing or incorrect client secret for confidential clients
- `invalid_scope`: scope not allowed for the client
