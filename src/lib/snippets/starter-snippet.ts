import type { SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"

export const STARTER_SNIPPET_SOURCE = `export default function EvencioEventSpotlight({
  eyebrow = "Event Spotlight",
  title = "Evencio Launch Night",
  subtitle = "Founders, operators, and designers in one room.",
  date = "Friday, Feb 14",
  time = "19:00 - 23:30",
  venue = "Kraftwerk",
  city = "Berlin",
  priceLabel = "Tickets from",
  price = "EUR 29",
  ctaLabel = "Reserve seat",
  ctaNote = "Limited capacity - Early bird ends Jan 10",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_360px] border border-neutral-200">
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
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Date</div>
              <div className="mt-2 text-sm font-medium text-neutral-900">{date}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Time</div>
              <div className="mt-2 text-sm font-medium text-neutral-900">{time}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                Location
              </div>
              <div className="mt-2 text-sm font-medium text-neutral-900">
                {venue}, {city}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-8 text-xs text-neutral-400">
            Powered by Evencio - Swiss International 2026
          </div>
        </div>

        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-950 text-white">
          <div className="flex-1 border-b border-neutral-800 p-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
              Just announced
            </div>
            <div className="mt-4 h-40 w-full border border-neutral-800 bg-neutral-900" />
            <div className="mt-4 text-xs text-neutral-400">{ctaNote}</div>
          </div>

          <div className="p-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
              {priceLabel}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{price}</div>
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

export const STARTER_SNIPPET_PROPS_SCHEMA: SnippetPropsSchemaDefinition = {
	version: 1,
	props: [
		{ key: "eyebrow", label: "Eyebrow", type: "string" },
		{ key: "title", label: "Title", type: "string" },
		{ key: "subtitle", label: "Subtitle", type: "string" },
		{ key: "date", label: "Date", type: "string" },
		{ key: "time", label: "Time", type: "string" },
		{ key: "venue", label: "Venue", type: "string" },
		{ key: "city", label: "City", type: "string" },
		{ key: "priceLabel", label: "Price Label", type: "string" },
		{ key: "price", label: "Price", type: "string" },
		{ key: "ctaLabel", label: "CTA Label", type: "string" },
		{ key: "ctaNote", label: "CTA Note", type: "string" },
	],
}

export const STARTER_SNIPPET_DEFAULT_PROPS: SnippetProps = {
	eyebrow: "Event Spotlight",
	title: "Evencio Launch Night",
	subtitle: "Founders, operators, and designers in one room.",
	date: "Friday, Feb 14",
	time: "19:00 - 23:30",
	venue: "Kraftwerk",
	city: "Berlin",
	priceLabel: "Tickets from",
	price: "EUR 29",
	ctaLabel: "Reserve seat",
	ctaNote: "Limited capacity - Early bird ends Jan 10",
}
