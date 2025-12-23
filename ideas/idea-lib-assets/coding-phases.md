# Coding Phases

## Phase 0: Foundations
### Goal
Establish shared types, validation, and interfaces for asset storage, scopes, and metadata.

### Key tasks
- Define TypeScript types and Zod schemas for assets, tags, collections, scopes, and snippet props.
- Specify deterministic render constraints (viewport, fonts, time, locale) in shared config.
- Establish the asset registry interface (storage adapter + metadata store).
- Add feature flags for snippet rendering and scoped access.

### Exit criteria
- Types and schemas compile and validate sample asset JSON.
- Registry interface is implemented with a stub adapter.

## Phase 1: Asset Registry + Metadata CRUD
### Goal
Implement storage and governance basics for image, SVG, and snippet assets.

### Key tasks
- Persist assets, tags, collections, favorites, and versions.
- Implement CRUD endpoints with scope enforcement (global/org/event/personal).
- Store asset metadata (title, description, tags, license, attribution).
- Add versioning records and basic changelog support.

### Exit criteria
- Create/read/update/delete for assets and metadata works end-to-end.
- Scope rules prevent cross-org access.

## Phase 2: Search + Browse (MVP IA)
### Goal
Deliver fast browsing, filtering, and smart views for the library.

### Key tasks
- Build a search index covering title, tags, type, scope, and owner.
- Implement filters (type, scope, tags) and smart views (recent, favorites, most used).
- Provide minimal library UI: grid/list, detail preview, metadata panel.
- Ensure keyboard navigation and visible focus states.

### Exit criteria
- Search and filter results return within target latency for typical org libraries.
- Library view supports discoverability and basic metadata review.

## Phase 3: Snippet Runtime + PNG Render Pipeline
### Goal
Render React/HTML snippets deterministically to PNG with sandboxing.

### Key tasks
- Implement sandboxed snippet execution with restricted imports and no network access.
- Validate snippet props against JSON schema before render.
- Build SSR pipeline and PNG export with caching (props hash + version).
- Add deterministic environment controls (fonts, viewport, locale).

### Exit criteria
- Same snippet + props renders identical PNG outputs.
- Disallowed imports or APIs are blocked and reported.

## Phase 4: Import + Registration Flows
### Goal
Allow reliable ingestion of images, SVGs, and code snippets with governance metadata.

### Key tasks
- Build import flow for image/SVG uploads and snippet registration.
- Require metadata for license, attribution, scope, and tags.
- Add validation errors and user-friendly metadata guidance.
- Support promotion between scopes (personal -> event -> org).

### Exit criteria
- Assets can be imported/registered with required metadata and are immediately searchable.

## Phase 5: Editor Integration + Reuse
### Goal
Make library assets usable inside the editor and export pipeline.

### Key tasks
- Add library asset picker and insertion into the editor canvas.
- Support asset variants and presets for different sizes.
- Wire snippet assets into export pipeline (PNG) for event pages.
- Track asset usage for analytics and smart views.

### Exit criteria
- Assets can be inserted into the editor and exported without fidelity loss.

## Phase 6: QA + Launch Prep
### Goal
Stabilize performance, security, and documentation for release.

### Key tasks
- Add unit and integration tests for validation, search, and rendering.
- Perform sandbox security checks and error-path testing.
- Document import and snippet registration workflows.
- Add monitoring for render latency, error rates, and asset usage.

### Exit criteria
- Acceptance criteria met and feature flags ready for rollout.

## Phase 7: Iterate + Expand
### Goal
Refine usability and expand governance based on real usage.

### Key tasks
- Address top usability issues from early users.
- Improve snippet debugging and error messaging.
- Expand governance (draft/publish), versioning, and smart views.

### Exit criteria
- Prioritized backlog items ship with measurable usability improvements.
