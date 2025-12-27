import { serializeSnippetFiles } from "./source-files"
import { STARTER_SNIPPET_SOURCE } from "./starter-snippet"

export type SnippetTemplateId = "single" | "multi"

export type SnippetTemplate = {
	id: SnippetTemplateId
	label: string
	description: string
	source: string
}

const MULTI_COMPONENT_FILES: Record<string, string> = {
	"EventBadge.tsx": `export const EventBadge = ({ badgeLabel = "On sale" }) => (
  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
    {badgeLabel}
  </span>
)
`,
	"EventDetail.tsx": `export const EventDetail = ({
  detailLabel,
  detailValue,
}: {
  detailLabel: string
  detailValue: string
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{detailLabel}</p>
    <p className="mt-2 text-sm font-medium text-neutral-900">{detailValue}</p>
  </div>
)
`,
}

const MULTI_COMPONENT_MAIN_SOURCE = `// @import EventBadge.tsx
// @import EventDetail.tsx

export default function EvencioMultiComponentSnippet({
  eyebrow = "Event Spotlight",
  title = "Cityline Sessions",
  subtitle = "Multiple components stitched into one layout.",
  date = "Saturday, Mar 16",
  time = "20:00 - 01:30",
  venue = "Tobacco Dock",
  city = "London",
  ctaLabel = "Reserve seat",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_320px] border border-neutral-200">
        <div className="flex h-full flex-col px-12 py-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-neutral-400">
            <span className="font-mono">{eyebrow}</span>
            <span className="text-neutral-500">Evencio</span>
          </div>

          <div className="mt-8">
            <h1 className="font-lexend text-[44px] leading-[1.05] tracking-[-0.02em] text-neutral-900">
              {title}
            </h1>
            <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-neutral-600">
              {subtitle}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 border border-neutral-200 bg-neutral-50 p-5">
            <EventDetail detailLabel="Date" detailValue={date} />
            <EventDetail detailLabel="Time" detailValue={time} />
            <div className="col-span-2">
              <EventDetail detailLabel="Location" detailValue={\`\${venue}, \${city}\`} />
            </div>
          </div>

          <div className="mt-auto pt-8 text-xs text-neutral-400">
            Powered by Evencio - Swiss International 2026
          </div>
        </div>

        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-950 text-white">
          <div className="flex-1 border-b border-neutral-800 p-6">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-neutral-400">
              <span>Release</span>
              <EventBadge badgeLabel="On sale" />
            </div>
            <div className="mt-6 h-40 w-full border border-neutral-800 bg-neutral-900" />
            <p className="mt-4 text-xs text-neutral-400">Doors open 19:30. Limited capacity.</p>
          </div>

          <div className="p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Next step</p>
            <div className="mt-4 inline-flex items-center border border-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              {ctaLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`

const MULTI_COMPONENT_SNIPPET_SOURCE = serializeSnippetFiles(
	MULTI_COMPONENT_MAIN_SOURCE,
	MULTI_COMPONENT_FILES,
)

export const SNIPPET_TEMPLATES: Record<SnippetTemplateId, SnippetTemplate> = {
	single: {
		id: "single",
		label: "Single component",
		description: "One exported component with inline layout.",
		source: STARTER_SNIPPET_SOURCE,
	},
	multi: {
		id: "multi",
		label: "Multi-component",
		description: "Main component plus helper components for structure.",
		source: MULTI_COMPONENT_SNIPPET_SOURCE,
	},
}

export const SNIPPET_TEMPLATE_OPTIONS = Object.values(SNIPPET_TEMPLATES)
