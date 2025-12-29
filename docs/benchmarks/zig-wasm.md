# Zig/WASM — Implementation and Benchmarks

## Why Zig/WASM in the snippet editor

The snippet editor performs repeated, CPU‑bound work while users type:

- Scanning JSX for Tailwind class candidates.
- Hashing source to drive caches and invalidation.
- Preparing data for preview compilation and inspection.

Doing this in JavaScript proved too slow on large snippets because it competes
with Monaco and React on the main thread, causing keystroke latency and preview
jank. Zig compiled to WASM solves that by keeping the hot path small, predictable,
GC‑free, and fast.

## What moved to WASM

- Tailwind class scanning (`scan_tailwind_candidates`).
- Source hashing (`hash_bytes`).
- Snippet security scanning (imports, banned globals, dynamic calls).
- JSX inspect indexing for preview highlighting.
- Snippet file scanning (`scan_snippet_files`) for `@snippet-file` blocks, nested `@import` expansion, and line-map segments.

These are deterministic, CPU‑bound kernels with tight loops — ideal for WASM.

## Integration

- Zig source: `scripts/wasm/snippet_wasm.zig`
- WASM binary: `src/lib/wasm/snippet_wasm.wasm`
- JS bridge: `src/lib/wasm/snippet-wasm.ts`
- Engine analysis: `src/lib/snippets/analyze-tsx.ts`

The analysis pipeline **requires WASM in the browser**. If the WASM binary is
missing, analysis fails fast with an explicit error so the issue is surfaced
immediately rather than silently falling back to slower JS.

## What improves

- Tailwind scanning latency drops by ~8–9x on medium/heavy sources in the
  current benchmark suite.
- Combined scan+hash work stays inside the debounce budget, keeping previews
  responsive even during fast edits.
- CPU usage is lower and more consistent, with fewer long GC pauses.
- Snippet file scanning improves on heavier, multi-file sources; smaller sources can be faster in JS because the WASM boundary adds fixed overhead.

## Run

```bash
bun run wasm:snippets
bun run perf:wasm
```

## Latest results (2025-12-29)

Machine: MacBook M4 Max (36GB RAM)

```
[bench] medium scan: wasm 2.62ms vs js 27.90ms (10.65x)
[bench] medium hash: wasm 3.42ms vs js 6.00ms (1.75x)
[bench] medium combined: wasm 0.81ms vs js 7.95ms (9.78x)
[bench] medium security scan: wasm 1.46ms vs js 14.18ms (9.70x)
[bench] medium inspect index: wasm 3.08ms vs js 9.85ms (3.20x)
[bench] medium snippet files: wasm 0.57ms vs js 0.26ms (0.45x)
[bench] medium strip directives: wasm 1.04ms vs js 1.92ms (1.84x)
[bench] medium strip auto imports: wasm 0.67ms vs js 1.42ms (2.12x)
[bench] medium export names: wasm 0.87ms vs js 1.51ms (1.74x)
[bench] medium primary export: wasm 0.33ms vs js 0.08ms (0.25x)
[bench] medium import offset: wasm 0.62ms vs js 2.07ms (3.32x)
[bench] medium worker roundtrip: 19.22ms for 20 iters (0.96ms/iter)
[bench] heavy scan: wasm 2.13ms vs js 21.67ms (10.18x)
[bench] heavy hash: wasm 5.03ms vs js 5.19ms (1.03x)
[bench] heavy combined: wasm 1.34ms vs js 13.18ms (9.87x)
[bench] heavy security scan: wasm 1.21ms vs js 11.57ms (9.60x)
[bench] heavy inspect index: wasm 2.72ms vs js 6.76ms (2.48x)
[bench] heavy snippet files: wasm 0.26ms vs js 0.28ms (1.08x)
[bench] heavy strip directives: wasm 0.74ms vs js 1.75ms (2.38x)
[bench] heavy strip auto imports: wasm 0.69ms vs js 1.66ms (2.39x)
[bench] heavy export names: wasm 0.83ms vs js 1.17ms (1.42x)
[bench] heavy primary export: wasm 0.16ms vs js 0.03ms (0.20x)
[bench] heavy import offset: wasm 0.46ms vs js 2.49ms (5.42x)
[bench] large snippet files: wasm 0.24ms vs js 0.23ms (0.94x)
[bench] heavy worker roundtrip: 9.73ms for 6 iters (1.62ms/iter)
```

Notes:
- Results depend on machine and workload. Re-run after major changes.
- WASM scan is the primary win; hash is roughly parity with JS.
- New header scanners (strip directives/import block/export names/import offset) are wins, but primary export is still faster in JS for these workloads.
