# Snippet Style Editing (Styles Sidebar)

This document explains how the **Styles** sidebar in the snippet editor is wired end-to-end: how we pick a target element in the preview, read its current Tailwind/inline styles, and apply edits back to **Monaco source** and the **live preview**.

## Overview

The Styles sidebar provides:

- **Live editing** (no “Apply” button): changes flow to Monaco → compiler → preview automatically.
- **Two-way sync**: edits in Monaco update the sidebar; edits in the sidebar update Monaco.
- **Context + layout selection**: right click (context) opens the sidebar for a selected element; in layout mode, clicking a different element retargets the sidebar automatically.
- **Tag rules + code-only guard**: only intrinsic tags are supported, and elements with dynamic `className` are treated as code-only.

Supported style groups (v1):

- Background: `backgroundColor`
- Border: `borderWidth`, `borderColor`
- Radius: `borderRadius`
- Type: `textColor`, `fontSize`, `fontWeight`

## TRACE (User → Source → Preview)

1. User selects an element in the preview (context menu or layout select).
2. Editor resolves the selection to a `SnippetInspectTextRequest` (fileId + line + column + element name).
3. Sidebar reads styles from the current file source via the engine (`style-read`).
4. User changes a control in the sidebar.
5. Sidebar schedules an apply (`style-update`), producing a source edit.
6. Monaco source updates immediately.
7. Snippet compiler recompiles, preview hot-updates the iframe.
8. Sidebar re-reads styles from the updated source (with a short suspend window to avoid flicker).

## Key Pieces

### 1) Selection / Targeting

- Preview sends inspect events (`inspect-select`, `inspect-context`) from the iframe runtime to the parent.
- The snippet editor resolves preview source locations to editor file ids/line/column.
- When layout mode is enabled and the Styles panel is open, selecting a new element updates the Styles target automatically.

Relevant files:

- Preview messaging: `src/components/asset-library/snippet-preview.tsx`
- Inspect + context routing: `src/routes/-snippets/editor/hooks/snippet/inspect.ts`
- Context menu + styles open: `src/routes/-snippets/editor/hooks/snippet/inspect-text.ts`
- Page wiring (retarget in layout mode): `src/routes/-snippets/editor/page.tsx`

### 2) Reading styles (`style-read`)

We read styles *from source*, not from computed DOM styles. The goal is to show exactly what exists in code and provide safe edits.

- The sidebar calls `useSnippetInspectStyleState`, which requests `style-read` from the engine.
- The engine parses the file source, finds the JSX element at line/column, and extracts supported properties from:
  - static `className` tokens (Tailwind v4 utilities + semantic tokens), and
  - inline `style={{ ... }}` (simple literal values only)
- If `className` is dynamic (`className={...}`), the response marks the element as **not editable** (code-only).

Relevant files:

- Sidebar state hook: `src/routes/-snippets/editor/hooks/snippet/inspect-style-state.ts`
- Engine protocol + worker wiring: `src/lib/engine/protocol.ts`, `src/lib/engine/worker.ts`, `src/lib/engine/client.ts`
- Source reader: `src/lib/snippets/source/style-read.ts`

### 3) Applying styles (`style-update`)

- The sidebar debounces edits (200ms) and sends a style update payload.
- `useSnippetInspectStyle` applies the update by rewriting the TSX source:
  - Prefer Tailwind utilities when possible.
  - Fall back to inline styles when required.
  - Remove conflicting utilities/styles to keep output deterministic.
- The updated source is written back through the snippet editor’s file/update pipeline, which updates Monaco and triggers recompilation.

Relevant files:

- Apply hook: `src/routes/-snippets/editor/hooks/snippet/inspect-style.ts`
- Source rewriting: `src/lib/snippets/source/style.ts`

### 4) Sidebar UI (and why it’s split)

The sidebar UI lives under:

- `src/routes/-snippets/editor/components/snippet/styles-panel/`

Structure:

- `panel.tsx`: orchestration (state, debounced apply, syncing from reads)
- `sections/*`: grouped controls (Background/Border/Radius/Type)
- `constants.ts`: option lists (Tailwind v4 tokens + small palette subset)
- `utils.ts`: parsing helpers (hex normalization, number parsing, select option helpers)
- `types.ts`: shared types across UI modules

The `panel.tsx` owns:

- local draft state for inputs (so we can avoid overriding while typing),
- section open/close logic (auto-open when a property exists),
- and the debounced apply scheduler.

The `sections/*` files render controls only.

## Flicker + Focus Stability

There are three main causes of “flicker”:

1. **Preview selection resets** during hot updates (iframe can clear selection while code swaps).
2. **Sidebar re-reading immediately** after its own write (read → write → read loops can briefly show “missing” state).
3. **Conditional UI unmounts** (switching from a control to “Add …” while the input is focused).

Mitigations:

- The snippet editor ignores preview `inspect-select` events that have `{ reason: "reset" }` when the Styles panel is open, so the sidebar doesn’t retarget to `null` mid-update.
- `useSnippetInspectStyleState` supports a short “suspend” window after sidebar-driven writes to avoid overwriting drafts immediately.
- The panel keeps a section open while the user is actively editing that section (focus guard), so controls don’t unmount during an in-progress edit.

## Extending Supported Styles

To add a new editable property:

1. **Read:** Extend `src/lib/snippets/source/style-read.ts` to detect the Tailwind utility / inline style.
2. **Write:** Extend `src/lib/snippets/source/style.ts` to apply/remove the utility consistently.
3. **Protocol:** Update `StyleReadResponse` / `StyleUpdateRequest` in `src/lib/engine/protocol.ts` if a new field is needed.
4. **UI:** Add controls in `src/routes/-snippets/editor/components/snippet/styles-panel/sections/*`.
5. **Tests:** Add/extend tests in `src/lib/snippets/source/__tests__/` (both read + write).

## Known Limitations (v1)

- Only intrinsic HTML tags are editable.
- Dynamic `className` expressions are treated as code-only.
- Style-read focuses on supported properties only; it is not a full computed-style inspector.

