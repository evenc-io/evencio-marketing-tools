# Evencio Snippets Editor — External Assistant Guide

Use this guide when you’re generating TSX snippets via an external assistant (until in-app integrations exist).

## How to use

1) In Evencio Studio: open **Snippets Editor → Snippet header → Import**
2) Paste the assistant output **or** drag-and-drop a `.md` / `.txt` file into the Import dialog
3) Click **Import** (this replaces the current source + component files; Undo works)

## Output requirements (assistant must follow)

- Output **ONLY** TSX source code (no Markdown fences like ``` and no explanations).
- Export **exactly one** component as:
  - `export default function <Name>(props) { ... }`
- Prefer **no imports**. Do not use any libraries.

## Hard constraints (must not violate)

- No React hooks: `useState/useEffect/useMemo/useRef/useCallback/useReducer/...`
- No global/browser APIs: `window/document/globalThis/self/parent/top/navigator/location/history/storage/indexedDB/caches/cookieStore`
- No network/timers/codegen: `fetch/eval/Function/setTimeout/setInterval/import()`
- No `dangerouslySetInnerHTML`
- Tailwind `className` must be **static string literals** in JSX (no computed class strings)
- Don’t rely on event handlers (`onClick/onChange/etc.`) — previews don’t attach them
- Root element must include `className="h-full w-full"`
- No external images/URLs (use a placeholder div or a `data:` URL)

## Optional: resolution directive

Add one line anywhere in the main source:

- `// @res 1920x1080` (or `// @res1920x1080`)

If multiple are present, the **last one wins**.

## Optional: multi-file snippets

If you need helper components or extra files, append them as file blocks:

```tsx
// @snippet-file components/ui/badge.tsx
export function Badge({ label = "Badge" }: { label?: string }) {
  return (
    <div className="inline-flex border border-neutral-200 px-2 py-1 text-[11px] uppercase tracking-[0.24em]">
      {label}
    </div>
  )
}
// @snippet-file-end
```

Important: Do **not** add `// @import …` lines. The editor manages imports automatically.

## Optional: Evencio logo + icon (Import Assets)

You may reference these components:

- `EvencioMark` (asset id: `evencio-mark`)
- `EvencioLockup` (asset id: `evencio-lockup`)

Recommended stable wrapper (layout + inspect stays predictable):

```tsx
<div
  className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start"
  data-snippet-asset="evencio-lockup"
>
  <EvencioLockup />
</div>
```

If you reference `EvencioMark` / `EvencioLockup` without providing `__imports.assets.tsx`, the **Import** dialog can auto-add it.

If you must include it manually, append this exact file block:

```tsx
// @snippet-file __imports.assets.tsx
const EvencioMark = ({ size = 80 }: { size?: number }) => (
  <svg
    data-snippet-inspect="ignore"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    aria-hidden="true"
    className="shrink-0 self-center"
  >
    <path d="M15 10H85V35H40V65H85V90H15V10Z" className="fill-neutral-950" />
    <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
  </svg>
)

const EvencioLockup = ({ markSize = 32 }: { markSize?: number }) => (
  <span data-snippet-inspect="ignore" className="inline-flex items-center gap-2 leading-none">
    <EvencioMark size={markSize} />
    <span className="font-unbounded text-[24px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
      EVENCIO
    </span>
  </span>
)
// @snippet-file-end
```

## Prompt template (copy/paste into your assistant)

```text
You are generating a TSX snippet for Evencio’s Snippets Editor.

Output requirements:
- Output ONLY the TSX source code. No Markdown, no ``` fences, no explanations.
- Export exactly one component as: export default function <Name>(props) { ... }.
- Use JSX return value (no ReactDOM calls).

Hard constraints (must not violate):
- No imports (preferred). Do not use any libraries.
- No React hooks: useState/useEffect/useMemo/useRef/useCallback/useReducer/etc.
- No global/browser APIs: window/document/globalThis/self/parent/top/navigator/location/history/storage/indexedDB/caches/cookieStore.
- No network/timers/codegen: fetch/eval/Function/setTimeout/setInterval/import().
- No dangerouslySetInnerHTML.
- Tailwind className strings must be static string literals inside JSX (not computed).
- Don’t rely on event handlers (onClick/onChange/etc.) — previews don’t attach them.
- Root element must include className="h-full w-full".
- No external images/URLs. If an image is needed, use a data: URL or a simple placeholder div.

Optional:
- Resolution directive: add a line like // @res 1920x1080 (or // @res1920x1080).
- Multi-file snippets: append file blocks like:
  // @snippet-file <filename>
  ...code...
  // @snippet-file-end
- Evencio Import Assets: you may use EvencioMark (id evencio-mark) and EvencioLockup (id evencio-lockup).

Style guidance:
- Swiss International 2026: neutral-first palette, 1px borders (border-neutral-200), no shadows, grid-based layouts.
- Prefer Tailwind utilities over inline styles.

Snippet brief:
[WRITE A 1-3 SENTENCE DESCRIPTION OF THE DESIGN + LAYOUT]

Component name:
<Name>

Props to support (with defaults):
- <propName>: <defaultValue>
- ...

Now output the TSX source only.
```

