# Build

## Implementation plan
- Define TypeScript types and data model for assets/tags/collections
- Implement asset registry (storage + metadata CRUD)
- Build library search/filter index
- Implement snippet renderer (SSR + PNG export)
- Add import flow for images/SVGs/snippets
- Wire library assets into editor asset picker

## Milestones
- Data model + storage layer complete
- Search/filter working for type/scope/tags
- Snippet render → PNG pipeline functional
- Library view usable for basic browse/import

## Integration points
- Editor canvas asset insertion
- Export pipeline (PNG)
- Auth/org scope enforcement
- Asset storage (local or S3-compatible)

## Open technical questions
- Best sandbox approach for React snippets (isolated VM vs. limited runtime)
- Cache strategy for PNG renders (props hash + version)
- Versioning strategy for assets and schema migrations
