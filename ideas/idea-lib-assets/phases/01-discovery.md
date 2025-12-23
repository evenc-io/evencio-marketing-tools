# Discovery

## Objectives
- Validate asset types and priority use cases (image, SVG, code snippet)
- Confirm metadata needed for search, governance, and reuse
- Understand scope expectations (global/org/event/personal)
- Identify minimum viable flows for code-driven assets and export

## Methods
- 5–8 organizer interviews (mix of OSS + org teams)
- 2–3 designer interviews focused on reuse and governance
- Review existing asset folders and naming/tagging patterns
- Lightweight competitive scan (Canva, Figma Community, event tools)

## Research questions
- What asset types do organizers reuse most (image, SVG, code snippet)?
- What metadata is required to make assets discoverable?
- How do organizers want to scope assets (global/org/event/personal)?
- What is the minimum viable flow for code-driven assets?
- What is the minimum set of metadata required for governance and licensing?
- Where do assets originate today (Figma, Dropbox, local folders)?
- What is the expected promotion path across scopes (personal → event → org)?

## User needs
- Fast search and filtering by type, scope, and usage
- Safe reuse of brand-approved assets
- Easy creation of event-specific variants
- Exportable output for event pages and social
- Clear licensing and attribution fields at import
- Confidence that exports match in-editor preview

## Insights
- Static-only libraries limit differentiation
- Code-driven assets unlock animation and interactivity
- Organization-level governance is required for real teams
- Mixed sources create inconsistent metadata unless guided

## Competitive scan summary
- Assess template libraries in Canva, Figma Community, and event tools
- Identify how they handle reusability and brand governance

## Participants (targets)
- 3–4 event organizers (OSS/community + paid orgs)
- 2–3 marketing managers
- 2–3 designers maintaining reusable templates

## Artifacts produced
- Interview notes and key quotes
- Draft metadata schema (fields + required/optional)
- Scope and governance workflow sketch
- MVP flow diagram for snippet → PNG export

## Risks discovered
- Security/sandboxing for React snippets
- Asset sprawl without strong metadata
- Confusing permissions between org and event

## Decision inputs
- Prioritized asset types for MVP
- Required metadata fields (tags, license, owner, scope)
- MVP flows: import, search, reuse, export
