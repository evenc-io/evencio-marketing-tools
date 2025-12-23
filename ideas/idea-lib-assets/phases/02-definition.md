# Definition

## Scope
- Library supports assets of type image, SVG, and React/HTML code snippets
- Code snippets are constrained to a renderable, sandboxed React subset
- Snippets can be rendered to static PNG for exports
- Same snippet can be used as interactive component on event pages
- Assets are discoverable via tags, collections, and scope filters

## Out of scope
- Arbitrary JS execution or external network access in snippets
- Full design system governance in MVP
- User-supplied npm dependencies in snippet runtime

## Success criteria
- A React snippet renders deterministically to PNG
- A snippet can be previewed in the editor with controlled props
- No cross-org access to assets
- Search by type + scope returns results under 200ms for typical org libraries

## Constraints
- Deterministic rendering: fixed viewport, fonts, and time
- Allowed APIs: React + approved UI primitives only
- Asset loading: local or whitelisted host only
- Props must pass schema validation before render

## Dependencies confirmed
- Server-side rendering pipeline
- Asset registry with versioning
- Sandbox execution environment
- Search index (for tags, scope, type)

## Definitions
- Asset: a reusable media or code unit stored in the library
- Scope: where the asset is visible (global/org/event/personal)
- Snippet: a React/HTML component with a defined prop schema
- Collection: a curated set of assets (by theme, event, or campaign)
