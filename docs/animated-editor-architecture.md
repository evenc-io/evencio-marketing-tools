# Animated Editor Architecture (Web, 2D)

## Goal
Build a Figma-like editor for event visuals that supports **animated, non-GIF** headers/images. Organizers design in the editor, then export a **JSON scene** that can be rendered by a player.

## Core Thesis
TanStack Start + Bun are fine for hosting the app. The real success or failure depends on the **client-side editor engine** (scene graph + timeline + renderer). The framework won’t limit performance; the renderer and animation model will.

## Key Requirements (Web-only, 2D)
- Smooth editing for large canvases and many layers
- 2D animations (transforms, opacity, masks, simple effects)
- Asset uploads (images, fonts)
- Export as JSON for a runtime player

## Architecture Overview
### 1) Scene Graph (Data Model)
A structured representation of the design (nodes with transforms, fills, text, images, groups).
- **Why it matters:** This is the single source of truth. If it’s clean and versioned, the editor and player can stay in sync as features evolve.

### 2) Timeline + Keyframes
Track-based animation system for each node (position, scale, rotation, opacity, masks, etc.).
- **Why it matters:** A predictable animation model makes playback reliable and exportable.

### 3) Renderer Adapter(s)
A rendering layer that takes the scene + timeline and draws frames.
- **Why it matters:** A renderer adapter keeps you flexible (WebGL for playback, Canvas 2D for editing, and future React Native).

### 4) Player Runtime
A lightweight player that consumes JSON and renders animations.
- **Why it matters:** This is how event pages, embeds, and exports will display animations consistently.

## Renderer Options (Recommendation)
### Best Long-Term: WebGL (Pixi-style)
- **Pros:** GPU acceleration, better scaling for many layers, smooth 60fps playback.
- **Cons:** Higher initial setup, custom text rendering complexity.
- **Why:** Figma-like performance requires GPU-friendly rendering for large scenes.

### Fastest MVP: Canvas 2D (Fabric.js/Konva)
- **Pros:** Quick to implement, great for basic editing.
- **Cons:** Performance degrades with many objects and animations.
- **Why:** Good for early validation, but not ideal for “huge editor” scale.

### SVG + Web Animations API
- **Pros:** Simple for vector-only scenes.
- **Cons:** Performance issues with large DOMs and image-heavy scenes.

## Recommendation Given Current State (Fabric.js Started)
- Keep Fabric.js for an **MVP editor** (fast iteration).
- Build the **scene graph + timeline model** in a renderer-agnostic way.
- Add a **WebGL playback renderer** as the second phase for performance.

## Data Contract: JSON Export (v1)
Minimum fields to keep stable:
- `version`: schema version
- `canvas`: size, background
- `assets`: image/font references + metadata
- `nodes`: id, type, props, transforms
- `animations`: per-node tracks + keyframes

**Why it matters:** A strict, versioned schema prevents breakage when the editor evolves.

## Performance Strategies
- Imperative canvas layer (avoid React re-rendering per frame)
- Virtualize layers in UI lists
- Batch rendering and cache static nodes
- Offscreen rendering for previews where possible
- Use Web Workers for export and heavy computation

## Proposed Phases
### Phase 1 — MVP Editor (Fabric.js)
- Basic layers, image upload, text, transforms
- Simple keyframes (position, scale, opacity)
- JSON export v1

### Phase 2 — Playback Runtime (WebGL)
- Implement player to render JSON
- Ensure parity with editor output

### Phase 3 — Performance + Scale
- Optimize timeline playback
- Add batching, caching, and improved text rendering

## Risks & Mitigations
- **Risk:** Fabric.js editor slows down at scale
  - **Mitigation:** Limit complexity in MVP, shift playback to WebGL
- **Risk:** Export schema drift
  - **Mitigation:** Versioned JSON + migration path
- **Risk:** Text rendering mismatch (editor vs player)
  - **Mitigation:** Define deterministic font handling and fallback rules

## Next Decisions Needed
- Target max layers per design
- Target FPS (30 vs 60)
- Typical image sizes and counts
- Required animation types (masking, filters, text effects)

---

If needed, I can draft the JSON schema, timeline data structure, and a minimal WebGL player scaffold.
