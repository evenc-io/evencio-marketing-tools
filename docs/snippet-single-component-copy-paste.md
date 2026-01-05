# Single-Component Snippet (Copy/Paste)

This guide is for generating **one TSX component** that can be pasted into the **Snippets Editor** and reliably render in the sandboxed preview.

## Recommended paste flow (Import)

If you’re pasting from an external assistant, use **Snippet header → Import**.
You can paste text directly, or drag-and-drop a `.md` / `.txt` file into the Import dialog.
The Import dialog also includes a downloadable guide/prompt template.

Why: pasting directly into the Source editor can strip `// @import …` lines and will not reliably create component files from `// @snippet-file …` blocks.

## Why this isn’t “normal React”

The preview iframe uses a tiny React-like renderer for safety and determinism:

- **No hooks** (`useState`, `useEffect`, etc.) — they throw in the preview runtime.
- **Security scan blocks globals/APIs** like `window`, `document`, `fetch`, `setTimeout`, etc.
- **Tailwind is extracted statically** from source; dynamic class composition won’t style.
- **Event handlers are ignored** (`onClick`, `onChange`, …) — snippets are effectively static.
- **No network** in preview: `img-src` is restricted to `data:` and `blob:` URLs.

## Hard rules (must follow)

1) Paste **TSX source only** (no Markdown fences like ``` and no explanations).
2) Export **one** component:
   - `export default function YourSnippetName(...) { ... }`
3) Prefer **no imports**. If you import anything other than `react` (or `react/jsx-runtime`), it will fail.
4) Do not use:
   - Hooks (`useState`, `useEffect`, `useMemo`, …)
   - `window`, `document`, `globalThis`, `parent`, `top`, `navigator`, `location`, storage APIs
   - `fetch`, `eval`, `Function`, `setTimeout`, `setInterval`, dynamic `import()`
   - `dangerouslySetInnerHTML`
5) Keep Tailwind classes **static**:
   - ✅ `className="p-10 bg-white text-neutral-900"`
   - ❌ `className={someVar}` / `className={cond ? "..." : "..."}`

## Props pattern (for auto-generated props schema)

Use **destructured props with defaults** in the first parameter. The editor derives the props schema + default props from this.

Example:

```tsx
export default function MySnippet({
  title = "Hello",
  subtitle = "World",
}) {
  return <div className="h-full w-full">{title}</div>
}
```

## Minimal working template (copy/paste)

```tsx
export default function EvencioSingleComponentSnippet({
  eyebrow = "Event Spotlight",
  title = "Evencio Launch Night",
  subtitle = "Founders, operators, and designers in one room.",
  date = "Friday, Feb 14",
  time = "19:00 - 23:30",
  location = "Kraftwerk, Berlin",
  cta = "Reserve seat",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full w-full flex-col border border-neutral-200 p-14">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-neutral-400">
          <span className="font-mono">{eyebrow}</span>
          <span className="text-neutral-500">Evencio</span>
        </div>

        <div className="mt-10 flex-1">
          <h1 className="max-w-[34rem] font-lexend text-[72px] font-semibold leading-[1.02] tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[30px] leading-[1.4] text-neutral-600">
            {subtitle}
          </p>
        </div>

        <div className="grid gap-3 border-t border-neutral-200 pt-6 text-[26px] font-medium text-neutral-900">
          <span>
            {date} / {time}
          </span>
          <span className="text-[24px] text-neutral-700">{location}</span>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-4 text-[22px] uppercase tracking-[0.22em] text-neutral-400">
          {cta}
        </div>
      </div>
    </div>
  )
}
```

## Evencio logo + icon (Import Assets)

The Snippets Editor supports “import assets” via a virtual file named `__imports.assets.tsx`.
When that file exists, the editor auto-manages the `// @import …` wiring for you (don’t write `// @import` by hand).

Available assets (from the Imports panel):

- **Evencio icon:** `EvencioMark` (wrapper id: `evencio-mark`)
- **Evencio logo:** `EvencioLockup` (wrapper id: `evencio-lockup`, depends on `EvencioMark`)

### Recommended wrapper (keeps assets stable in layout/inspect)

```tsx
<div
  className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start"
  data-snippet-asset="evencio-lockup"
>
  <EvencioLockup />
</div>
```

### Assets-enabled template (copy/paste)

```tsx
export default function EvencioSingleComponentWithLogo({
  eyebrow = "Event Spotlight",
  title = "Evencio Launch Night",
  subtitle = "Founders, operators, and designers in one room.",
  date = "Friday, Feb 14",
  time = "19:00 - 23:30",
  location = "Kraftwerk, Berlin",
  cta = "Reserve seat",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full w-full flex-col border border-neutral-200 p-14">
        <div className="flex items-center justify-between">
          <div
            className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start"
            data-snippet-asset="evencio-lockup"
          >
            <EvencioLockup />
          </div>
          <span className="text-[11px] uppercase tracking-[0.32em] text-neutral-400">
            {eyebrow}
          </span>
        </div>

        <div className="mt-10 flex-1">
          <h1 className="max-w-[34rem] font-lexend text-[72px] font-semibold leading-[1.02] tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[30px] leading-[1.4] text-neutral-600">
            {subtitle}
          </p>
        </div>

        <div className="grid gap-3 border-t border-neutral-200 pt-6 text-[26px] font-medium text-neutral-900">
          <span>
            {date} / {time}
          </span>
          <span className="text-[24px] text-neutral-700">{location}</span>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4">
          <div className="text-[22px] uppercase tracking-[0.22em] text-neutral-400">{cta}</div>
          <div
            className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start"
            data-snippet-asset="evencio-mark"
          >
            <EvencioMark />
          </div>
        </div>
      </div>
    </div>
  )
}

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

const EvencioLockup = () => (
  <span
    data-snippet-inspect="ignore"
    className="inline-flex items-center gap-2 leading-none"
  >
    <EvencioMark size={32} />
    <span className="font-unbounded text-[24px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
      EVENCIO
    </span>
  </span>
)
// @snippet-file-end
```

Tip: if you use the **Import** dialog, you can paste a snippet that references `EvencioMark` / `EvencioLockup` without providing `__imports.assets.tsx` — the importer will auto-add it.

## Prompt template for external assistants

Copy the prompt below into your assistant, then fill in the brief/props. It forces output that’s safe to paste into the Snippets Editor.

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

Optional (Evencio Import Assets: logo + icon):
- You may use `EvencioMark` (id `evencio-mark`) and `EvencioLockup` (id `evencio-lockup`).
- If you reference either one:
  - Prefer using the Snippets Editor **Import** dialog (it can auto-add `__imports.assets.tsx`).
  - If you must provide it manually, append this exact file block at the end of the output (do not wrap it in ```):

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

  const EvencioLockup = () => (
    <span
      data-snippet-inspect="ignore"
      className="inline-flex items-center gap-2 leading-none"
    >
      <EvencioMark size={32} />
      <span className="font-unbounded text-[24px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
        EVENCIO
      </span>
    </span>
  )
  // @snippet-file-end
- Wrap usages in a stable container with `data-snippet-asset="..."`:
  <div className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start" data-snippet-asset="evencio-lockup"><EvencioLockup /></div>

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
