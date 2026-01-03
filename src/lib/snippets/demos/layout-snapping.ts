import { serializeSnippetFiles } from "@/lib/snippets/source/files"

const LAYOUT_SNAPPING_MAIN_SOURCE = `export default function LayoutSnappingPolicyDemo({
  title = "Layout Snapping Policy",
  subtitle = "Alignment-only snaps remove translate. Offsets keep translate for pixel-accurate placement.",
  note = "Toggle Layout mode, then drag the cards to snap to edges, centers, and siblings.",
  leftLabel = "Alignment-only",
  leftDetail = "If the element lands exactly on an edge or center, the source updates to alignment classes.",
  rightLabel = "Offsets stay",
  rightDetail = "If there is any leftover offset, we keep translate to avoid layout conflicts.",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_360px] border border-neutral-200">
        <div className="flex h-full flex-col px-12 py-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-neutral-400">
            <span className="font-mono">Docs demo</span>
            <span className="text-neutral-500">Evencio</span>
          </div>

          <div className="mt-10">
            <h1 className="font-lexend text-[46px] leading-[1.05] tracking-[-0.02em] text-neutral-900">
              {title}
            </h1>
            <p className="mt-4 max-w-[32rem] text-lg leading-relaxed text-neutral-600">
              {subtitle}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">{leftLabel}</p>
              <p className="mt-2 text-sm text-neutral-600">{leftDetail}</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">{rightLabel}</p>
              <p className="mt-2 text-sm text-neutral-600">{rightDetail}</p>
            </div>
          </div>

          <div className="mt-auto border-t border-neutral-200 pt-6 text-xs text-neutral-500">
            {note}
          </div>
        </div>

        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-50 p-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Drag targets</p>
          <div className="mt-6 flex flex-1 flex-col justify-between gap-6">
            <div className="rounded-md border border-neutral-200 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-400">Card A</p>
              <p className="mt-2 text-sm text-neutral-700">Snap me to top/center/bottom.</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-400">Card B</p>
              <p className="mt-2 text-sm text-neutral-700">Snap me left/center/right.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`

export const LAYOUT_SNAPPING_SOURCE = serializeSnippetFiles(LAYOUT_SNAPPING_MAIN_SOURCE, {})
