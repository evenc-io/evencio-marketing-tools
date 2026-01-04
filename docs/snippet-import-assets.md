# Snippet Import Assets (Imports Panel + Preview Integration)

This document explains how **import assets** work in the snippets editor:

- How assets live inside `__imports.assets.tsx`
- How the main snippet preview can **use** those assets without explicit ES imports
- How drag-and-drop inserts assets into the snippet source (and why it uses the layout snapping grid)
- How the **Imports.assets.tsx** tab gets its own “gallery” preview (and can remove assets)

## Goals

- **Safe + deterministic:** imports are compiled inside the same sandboxed snippet runtime.
- **Fast UX:** dropping assets updates source + preview quickly with predictable placement.
- **Scalable:** the Imports file can grow to many items without the preview becoming unusable.
- **Non-invasive:** import assets should not force the user to write boilerplate imports.

## Key Files (Entry Points)

- Asset registry + source builders:
  - `src/routes/-snippets/editor/import-assets.ts`
- DnD insertion + preview messaging:
  - `src/routes/-snippets/editor/hooks/snippet/import-dnd.ts`
  - `src/lib/snippets/preview/runtime/srcdoc.ts`
- Monaco/Editor wiring:
  - `src/routes/-snippets/editor/hooks/snippet/editor-files.ts`
  - `src/routes/-snippets/editor/components/editor-panel.tsx`
- Route orchestration (preview mode switching):
  - `src/routes/snippets.editor.tsx`
- Preview wrapper (iframe lifecycle + scaling):
  - `src/components/asset-library/snippet-preview.tsx`

## The “Snippet Files” Model (Why No ES Imports Are Needed)

Snippets support **virtual files** embedded into a single source string:

- `serializeSnippetFiles(mainSource, files)` stores extra files as:
  - `// @snippet-file <name>`
  - file content
  - `// @snippet-file-end`
- The main source contains an auto-managed import block with lines like:
  - `// @import __imports.assets.tsx`
- The compiler/analyzer expands those imports via `expandSnippetSource(...)`, producing one normalized module.

### Consequence

`__imports.assets.tsx` is effectively pasted into the snippet module *before* the main component. That means:

- `const EvencioLockup = …` is in module scope.
- The main snippet can render `<EvencioLockup />` without any ES import statement.

This is why import assets are **defined as non-exported consts**: they’re available at runtime without affecting the snippet’s exported component surface.

## What “Import Assets” Are

In `src/routes/-snippets/editor/import-assets.ts`:

- `IMPORT_ASSETS` is the registry: `id`, `label`, `componentName`, `ghost` dimensions, and optional `dependsOn`.
- `buildImportAssetsFileSource(assetIds?)` returns the source for `__imports.assets.tsx` (the component implementations).
- `ensureImportAssetsFileSource(current, assetIds)` makes sure the given assets (and dependencies) exist in the file.
- `buildImportAssetWrapperJsx(asset)` returns the JSX snippet inserted into user code:
  - Wraps the component in a non-stretchy container
  - Adds `data-snippet-asset="<asset-id>"` for preview selection + stable hit-testing

## Drag & Drop Flow (Imports → Main Preview → Monaco Source)

### 1) Start drag (sidebar → pointer capture)

The Imports sidebar starts a drag via pointer events (not HTML5 drag events):

- `SnippetImportsPanel` calls `useSnippetImportDnd().handleAssetPointerDown(assetId, event)`
- The hook tracks the pointer and renders a lightweight overlay in the editor UI.

### 2) Preview “ghost” + snapping guides (iframe runtime)

While dragging over the snippet preview:

- The editor sends `postMessage({ type: "import-dnd-move", x, y, ghost })` into the iframe.
- The preview runtime:
  - Draws a ghost rectangle sized by `ghost.width/ghost.height`.
  - Applies the same grid/edge snapping visuals used by the layout tool (without enabling layout mode).
  - Highlights the “future parent” insertion target under the cursor.

### 3) Resolve insertion target (parent/siblings awareness)

To keep React trees stable, insertion is based on the **DOM node under the cursor** that maps back to source:

- The runtime resolves a source-backed element near the cursor.
- It determines the best insertion parent (walks upward to find a container element with source mapping).
- It reports a *source chain* back to the editor:
  - `postMessage({ type: "import-dnd-hover", sources: PreviewSourceLocation[] })`

The editor maps those locations back to file/line/column and tries insertion from “best parent” to fallback targets.

### 4) Insert JSX into the correct file (AST transform)

On pointer release inside the preview:

1. Ensure `__imports.assets.tsx` exists and contains the dropped asset implementation:
   - If missing, it’s created.
   - If present but missing the specific asset, it’s appended.
   - Dependencies are included automatically (e.g. `EvencioLockup` depends on `EvencioMark`).
2. Ensure the main source has the auto-managed `// @import __imports.assets.tsx` line.
3. Run insertion through the engine:
   - `insertSnippetChildInEngine({ source, line, column, jsx })`

This transform inserts the JSX **as a child** before the closing tag of the target element (and refuses invalid targets like self-closing tags / void HTML tags / SVG roots).

### 5) Commit placement (translate) after render

After the snippet re-renders, we ask the preview to “place” the newly inserted wrapper at the drop point:

- Editor sends: `postMessage({ type: "import-dnd-commit", source, x, y })`
- Preview runtime uses the layout snapping engine to compute a translate and emits a normal `layout-commit`.
- The editor uses the existing layout commit pipeline to write translate into source.

This is why import DnD feels consistent with the layout editor: it reuses the same snapping math and translate commit format, but does not toggle layout mode.

## Why the Wrapper Uses `data-snippet-asset` (Not `data-snippet-import`)

The snippet security scanner includes a WASM tokenizer that can misinterpret hyphenated JSX attribute names.

We previously used `data-snippet-import="evencio-lockup"` and hit a false-positive where the tokenizer saw `import` as a token and surfaced:

> Only React imports are allowed. Found: evencio-lockup

Using `data-snippet-asset` avoids that collision and keeps the marker purely semantic.

There is a migration in `useSnippetImportDnd` that rewrites old snippets to the new attribute.

## Keeping Dropped Assets “Static” (No Flex/Grid Stretching)

The inserted wrapper uses a conservative className:

- `inline-flex h-fit w-fit shrink-0 self-start justify-self-start`

This prevents common layout containers (flex/grid) from expanding the inserted asset to full width/height.

## Imports Gallery Preview (When Editing `Imports.assets.tsx`)

When the `Imports.assets.tsx` editor tab is active:

- The route switches the preview into an **imports gallery** mode.
- It builds a dedicated preview source with:
  - `// @import __imports.assets.tsx`
  - A grid that renders the assets currently present in `__imports.assets.tsx` (wide items can span 2 columns)
  - Scaling logic so large items (e.g. 1080×1080 templates) still fit in a tile
- Inspect/layout/layers and import DnD are disabled in this mode to avoid confusion.

This solves the “tens/hundreds of imports” problem: every import has its own box, and the preview can scroll vertically.

### Removing assets from the gallery

Each tile includes a **Remove** button. Clicking it:

- Removes the selected asset from `__imports.assets.tsx`
- Removes all usages from snippet sources (main + component files)
- Cascades to dependents (e.g. removing `EvencioMark` also removes `EvencioLockup` and its usages)

If the file becomes empty, the gallery shows an empty state and `Imports.assets.tsx` becomes removable via the file explorer
(right-click → Remove file). Removing the file also removes the `// @import __imports.assets.tsx` line from the auto-managed imports.

### Large imports (e.g. 1080×1080 templates)

The gallery treats `ghost.width/ghost.height` as the “design size” (fallback),
but auto-scales based on the **actual rendered bounds** so oversized components don’t get clipped.
Each tile:

- measures the available preview viewport (the dashed box)
- measures the rendered component bounds
- computes a scale factor (contain) and allows upscaling
- applies the transform in the **preview runtime** (no React hooks needed)

Auto-scale re-runs after render, after fonts load, and when the tile viewport resizes.

This keeps the gallery usable even for very large components while we keep “full edit” as a separate future experience.

## Monaco Type Safety for Non-Exported Imports

Because import asset components are **not exported**, TypeScript in Monaco would normally show:

- `Cannot find name 'EvencioLockup'. (2304)`

To keep the “non-exported” rule while still providing a good editor experience:

- We inject a Monaco extra-lib when `__imports.assets.tsx` exists:
  - `file:///snippets/imports/assets.d.ts`
  - Contains ambient declarations only for assets currently present in `__imports.assets.tsx`.

This is editor-only typing. The runtime still uses the real inlined code from `__imports.assets.tsx`.

## Adding a New Import Asset (Current Pattern)

1) Add a new entry to `IMPORT_ASSETS`:
   - `id` (stable string used in DOM markers)
   - `label`
   - `componentName` (JS identifier)
   - `ghost.width/ghost.height` (design size; used for drag ghost + gallery scaling)
   - optional `dependsOn` for shared building blocks

2) Add the component implementation to the imports source builder (in `import-assets.ts`):
   - Match the `componentName`
   - Keep it as a top-level `const` (not exported) unless the strategy changes in the future.

3) Sanity check:
   - DnD should insert `<YourComponentName />` wrapped with `data-snippet-asset="<id>"`.
   - The Imports gallery should render it as a tile once it exists in `__imports.assets.tsx`.

## Known Limitations (By Design)

- Gallery supports removal, but is otherwise **preview-only** (no direct editing interactions per tile).
- Import assets are currently “injected” into the module; there are no explicit ES imports.
- The registry (`IMPORT_ASSETS`) is the source of truth for what can be inserted via DnD; the gallery reflects what is present in `__imports.assets.tsx`.
