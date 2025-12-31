# Connector Modules

## Purpose
Connector modules let the Marketing Tools app discover integrations in a consistent, typed way. Each connector is a small manifest that describes auth requirements, capabilities, and setup steps so third parties can add their own connectors without editing the UI.

## Directory layout
```
src/lib/connectors/
  define-connector.ts   # validation helper
  types.ts              # schema + types
  registry.ts           # registered connectors
  evencio.ts            # official Evencio connector
  __tests__/
    registry.test.ts
```

## Connector definition
Connector manifests are validated by Zod at runtime and typed in TypeScript. Required fields are kept small so third-party connectors can stay lightweight.

| Field | Type | Notes |
| --- | --- | --- |
| id | string | kebab-case identifier (e.g. `eventbrite`) |
| name | string | Display name shown in settings |
| summary | string | One-line marketing summary |
| description | string | Longer explanation for the connector card |
| category | string | One of `events`, `ticketing`, `marketing`, `assets`, `analytics`, `custom` |
| status | string | `available`, `beta`, `coming-soon`, `deprecated` |
| auth | object | OAuth, API key, or none (see schema in `types.ts`) |
| capabilities | array | Short list of supported features |
| setup | array | Optional setup steps shown in the UI |
| docsPath | string | Optional public URL for hosted docs (repo paths won't render in the web UI) |
| tags | array | Optional tags for filtering |
| publisher | object | Optional publisher metadata |
| connection | object | Optional server paths for connect/status/disconnect |

## Adding a connector
1. Create a new file in `src/lib/connectors/` (for example `eventbrite.ts`).
2. Use `defineConnector` to validate your manifest.
3. Register the connector in `src/lib/connectors/registry.ts`.
4. Add a short setup guide in `docs/connectors/<connector-id>.md`.
5. Update or add tests in `src/lib/connectors/__tests__/` if your connector introduces new schema fields.

### Connection paths
If you want the Integrations UI to show Connect/Disconnect buttons, provide `connection.startPath` (and optional `statusPath`/`disconnectPath`). These routes must run server-side so client secrets and refresh tokens never reach the browser.

### Server-side endpoints (recommended)
Create integration endpoints under `server/routes/api/integrations/<connector-id>/` so each connector has a consistent API surface.

Minimum endpoints:
- `GET /api/integrations/<id>/connect` - starts the auth flow (redirects to provider)
- `GET /api/integrations/<id>/status` - returns `{ connected: boolean, status?: object, error?: string }`
- `POST /api/integrations/<id>/disconnect` - clears stored tokens/secrets

If your provider uses OAuth:
1. Generate PKCE (`code_verifier` + `code_challenge`).
2. Redirect to the provider authorize endpoint from `/connect`.
3. Handle the callback on a server route (example: `server/routes/oauth/callback.get.ts`).
4. Exchange the code for tokens server-side.
5. Store refresh tokens encrypted, and rotate on refresh.

If your provider uses API keys:
1. Store the key server-side (never in the browser).
2. `/connect` can be a server UI or a simple POST that saves the key.

### Storage expectations
The current Evencio connector stores tokens in memory for dev. For production connectors, persist:
- client credentials (if applicable)
- refresh tokens (encrypted)
- org/account identifiers

### Status contract (UI)
The Integrations UI expects `statusPath` responses to look like:
```json
{
  "connected": true,
  "status": { "organizationId": "org_123", "userId": "user_456" }
}
```
If a connector is not connected, return `{ "connected": false, "error": "reason" }`.

### Security checklist
- Never expose `clientSecret` or refresh tokens to the browser.
- Use server-side routes for token exchange and refresh.
- Use least-privilege scopes.

### Example
```ts
import { defineConnector } from "@/lib/connectors"

export const exampleConnector = defineConnector({
  id: "example",
  name: "Example",
  summary: "Sync example events into Marketing Tools.",
  description: "Example connector used for third-party integrations.",
  category: "events",
  status: "beta",
  auth: {
    type: "api-key",
    description: "API key stored on the server.",
    headerName: "X-Example-Key",
  },
  capabilities: [
    { id: "events", label: "Event sync" },
  ],
  setup: [
    { title: "Create an API key", description: "Generate a key in the vendor dashboard." },
  ],
  docsPath: "https://docs.example.com/connectors/marketing-tools",
  connection: {
    startPath: "/api/integrations/example/connect",
    statusPath: "/api/integrations/example/status",
    disconnectPath: "/api/integrations/example/disconnect",
  },
})
```

## Testing
Run connector tests with:
```
bun test src/lib/connectors/__tests__/registry.test.ts
```

The registry test suite enforces schema validation and duplicate id protection.
