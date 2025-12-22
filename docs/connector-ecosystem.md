# OSS + Connector Ecosystem Strategy

## Goal
Open-source the editor while keeping Evencio the best hosted experience. Let other event/ticketing SaaS platforms build connectors, without diluting the Evencio brand.

## Why This Matters
A permissive OSS core grows adoption and trust, but trademark control preserves identity and user trust. The connector ecosystem expands usage while keeping Evencio the default, high-quality option.

## Licensing & Brand Control
- **Code license:** MIT (max adoption)
- **Brand control:** Evencio name/logo governed by `TRADEMARKS.md`

## OSS Scope (Public)
- Editor UI and core scene/timeline model
- JSON schema + export utilities
- Connector SDK and reference connector(s)
- Basic templates and local export

## Hosted Scope (Evencio-only)
- Official template library + premium assets
- Fonts and brand kits
- Analytics and performance metrics
- Hosted rendering/preview pipeline
- Official connector directory with verification

## Connector SDK (Draft Design)
### Connector Interface
A connector should define:
- **Auth**: OAuth or API key flow
- **Event data sources**: list events, fetch details
- **Asset sync**: images, logos, colors, fonts
- **Publish hooks**: export JSON -> upload or link back

### Developer Experience
- Typed TypeScript SDK with strict interfaces
- Local dev mode with mocked data
- Test harness for validation

### Security & Data Boundaries
- Read-only by default (event metadata + assets)
- Explicit scopes for writes (if enabled later)
- No cross-tenant access

## Connector Registry
- Public list of connectors with metadata
- “Verified” badge for connectors that pass Evencio tests
- Simple submission process (PR + checklist)

## Monetization & Differentiation
- Highlight “Official Evencio Hosting” as the fastest, most reliable option
- Offer premium templates and render guarantees
- Provide usage analytics and performance tooling

## Governance
- Publish a roadmap and contribution guidelines
- Keep JSON schema versioned and documented
- Maintain a clear compatibility policy

## Repo Structure (Suggested)
```
/ (root)
  /src                 # Editor app
  /packages
    /core              # Scene graph + timeline model
    /export            # JSON export utilities
    /connector-sdk     # Connector interfaces + helpers
  /docs
    connector-ecosystem.md
    schema.md
```

## Next Steps
1) Formalize JSON schema v1 (scene + timeline + assets)
2) Implement connector SDK interfaces and tests
3) Add a reference connector for Evencio
