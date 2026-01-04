# Snippet Preview Architecture

This document explains how the **custom snippet preview** works end-to-end: how we go from TSX source → analysis (Tailwind/security/inspect) → compilation → a sandboxed iframe render. The preview pipeline is core infrastructure: most “snippet editor feels broken” issues are usually one of these stages not running, not matching, or not updating.

## Goals and Constraints

- **Safety:** user-provided snippet code must not access the parent app, storage, or network.
- **Determinism:** preview output should match the selected snippet source + props, not a stale previous compile.
- **Fast iteration:** edits should feel responsive (debounced work on keystrokes, but no “stuck until refresh”).
- **Feature support:** Tailwind styling, component tree, inspect overlays, and layout tools.

## High-Level Data Flow

At a high level the editor is a pipeline:

1) **Editor source state** (React Hook Form)
2) **Analysis** (Tailwind CSS + security scan + exports + inspect index)
3) **Compilation** (TSX → JS)
4) **Preview render** (sandboxed iframe with a small runtime)

The most important rule is:

> Tailwind CSS comes from **analysis**, not from compilation.

If compilation succeeds but analysis is “idle” or “stale”, the preview can render but be unstyled.

## Where Each Stage Lives

### 1) Source of truth: the form

- `src/routes/snippets.editor.tsx`
  - Holds the snippet editor form (`useForm`) and reads the current source via `useWatch`.
  - Applies selected snippet/draft into the form via `form.reset(...)`.
  - Drives preview hooks with the watched `source`.

**Why it matters:** the analysis and compilation hooks only run when they “see” source changes. If the form updates aren’t subscribed correctly, downstream stages can remain stale.

### 2) Analysis: Tailwind/security/inspect

- Scheduler hook: `src/routes/-snippets/editor/hooks/snippet/analysis.ts`
  - Debounces analysis while typing.
  - Ensures analysis runs immediately after `resetAnalysis()` (so initial loads/snippet switches don’t sit in “idle”).
- Engine entrypoint: `src/lib/engine/client.ts` (`analyzeSnippetInEngine`)
  - Runs analysis either in a worker (preferred) or in-process.
  - Uses an internal “stale” versioning mechanism keyed by `key`.
- Actual analyzer: `src/lib/snippets/analyze-tsx.ts` (`analyzeSnippetTsx`)
  - Expands snippet-file blocks into a single “normalized source”.
  - Computes `sourceHash`.
  - Extracts Tailwind candidates and builds CSS (`tailwindCss`).
  - Produces `tailwindError` if Tailwind generation fails.
  - Produces inspect indexes + line maps.

### 3) Compilation: TSX → JS

- Hook: `src/lib/snippets/useSnippetCompiler.ts`
  - Debounced compilation for typing.
  - Runs compilation immediately when `autoCompile` becomes enabled or when the compiler is reset (prevents “nothing happens until I type”).
  - Calls `compileSnippetInEngine(...)` with an `engineKey` to isolate staleness and caching.
  - Uses analysis output (if available and matching) to attach Tailwind CSS and surface security/tailwind errors.

### 4) Preview iframe: render + updates

- React wrapper: `src/components/asset-library/snippet-preview.tsx`
  - Owns an iframe and its lifecycle.
  - Either:
    - **Hot-swaps** code via `postMessage({ type: "code-update" })` if the iframe is ready and dimensions didn’t change, or
    - **Recreates** the iframe document by setting `iframe.srcdoc` when needed.
  - Sends `tailwind-update` messages when Tailwind CSS changes (without forcing a full reload).
- Runtime generator: `src/lib/snippets/preview/runtime/srcdoc.ts`
  - Generates the complete `srcdoc` HTML.
  - Injects Tailwind CSS into `<style id="snippet-tailwind">…</style>`.
  - Implements a tiny render runtime with a restricted “React-like” API and a DOM renderer.
  - Listens for `code-update`, `tailwind-update`, `props-update`, inspect/layout/layers toggles.
- Message types (iframe → parent): `src/lib/snippets/preview/runtime/types.ts` (`PreviewMessage`)

## Safety Model (Sandbox + CSP)

The preview is intentionally “hostile” to user code:

- `sandbox="allow-scripts"` on the iframe prevents access to parent DOM/storage.
- CSP in `srcdoc` blocks:
  - `connect-src 'none'` (no network)
  - `default-src 'none'`
  - only nonced inline scripts are allowed
- The runtime provides a minimal `React` substitute and explicitly throws for hooks like `useState`.

**Why it matters:** this is what makes custom snippets safe to render.

## Tailwind: How Styling Gets into the Preview

1) The analyzer (`analyzeSnippetTsx`) extracts class candidates from the normalized source.
2) Tailwind is compiled from those candidates + `tailwindcss/index.css` + `src/styles.css`.
3) The resulting CSS string is returned as `analysis.tailwindCss`.
4) The compiler hook exposes it as `tailwindCss` (only if analysis matches the compiled source; see next section).
5) The iframe gets the CSS either:
   - inline in the initial `srcdoc`, or
   - via `postMessage({ type: "tailwind-update", css })` after the iframe is running.

If Tailwind is missing, it is almost always one of:

- Analysis never ran (analysis status stays “idle”).
- Analysis is stale (source hash mismatch).
- Tailwind generation errored (`analysis.tailwindError`).
- The iframe never received the CSS update (not “ready” / not in “success” state yet).

## Hashing and “Stale” Protection (Why Tailwind Can Be Null)

Analysis returns `sourceHash`. Compilation computes a hash for the source being compiled and only trusts analysis when:

- `analysis.sourceHash === hash(compiledSource)`

If hashes don’t match, we intentionally treat analysis as **not applicable**:

- `effectiveAnalysis = null`
- `tailwindCss` is set to `null`

**Why it matters:** without this, it’s easy to apply Tailwind CSS from one snippet to another (especially when switching quickly), which produces very confusing “random styling” bugs.

## Iframe Lifecycle and Update Strategy

In `src/components/asset-library/snippet-preview.tsx`:

- On first successful compile, we generate `srcdoc` and set `iframe.srcdoc`.
- Once the iframe posts `{ type: "ready" }`, we can hot-swap:
  - `code-update` for new compiled code
  - `tailwind-update` for new Tailwind CSS
  - `props-update` for new props
- If preview dimensions change, we recreate the `srcdoc` so the runtime reinitializes with the new viewport.

**Why it matters:** hot-swapping makes typing fast; full reload is reserved for cases that require a fresh document.

## Editor Orchestration: Applying a Snippet vs. Draft

In `src/routes/snippets.editor.tsx` the route orchestrator:

- Loads the asset library (`loadLibrary()`).
- Determines if we’re editing an existing snippet (`?edit=assetId`) or working on a new draft.
- Applies the chosen snippet/draft into the form (`form.reset(...)`) and resets supporting state (history, exports, analysis).
- Enables auto-compile after the snippet is applied (so the compiler doesn’t compile the starter template by accident).

This stage is where most navigation-related “wrong preview” bugs come from:

- if the form resets but analysis/compile aren’t re-armed, the preview can show stale code or no Tailwind until you type.

## Debug Checklist (When Preview Looks Wrong)

1) In **Settings → logs**:
   - `WASM module` should be OK (expected for best performance).
   - `Analysis pipeline` should go Loading → OK (if it says “Waiting for source”, analysis is not running).
   - `Tailwind output` should not have a warning.
2) In the editor:
   - Monaco “Ready” only indicates compilation succeeded; it does not guarantee Tailwind is present.
3) In devtools:
   - Inspect the iframe document and verify `#snippet-tailwind` has CSS content.
4) If content is correct but unstyled:
   - suspect “analysis didn’t run” or “analysis hash mismatch”.

## Change Safety: Things to Preserve

When changing preview-related code, keep these invariants:

- Form updates must reliably propagate to `watchedSource` (avoid missed resets).
- `resetAnalysis()` must result in a new analysis run (even if the source string is unchanged).
- Tailwind must only be used when analysis is for the same source (hash match).
- Iframe message protocol must remain compatible (`ready`, `code-update`, `tailwind-update`, `props-update`, etc.).

## Manual Verification (Fast)

1) Create/select a snippet that uses obvious Tailwind classes (e.g., `bg-red-500`, `p-10`, `text-4xl`).
2) Go **Library → Edit** and confirm:
   - Correct snippet content is rendered.
   - Tailwind styling is applied without typing.
3) Switch snippets inside the editor and confirm the same.

## Related Docs

- `docs/snippet-import-assets.md` — Import assets (Imports panel), drag-and-drop insertion, and the Imports gallery preview.
