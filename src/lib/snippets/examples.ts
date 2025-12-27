import type { PreviewDimensions } from "@/lib/snippets/preview-runtime"

export type SnippetExampleCategory = "hero" | "social" | "banner" | "logo"

export interface SnippetExample {
	id: string
	title: string
	description: string
	category: SnippetExampleCategory
	source: string
	viewport: PreviewDimensions
	tags: string[]
	previewProps?: Record<string, unknown>
}

export const SNIPPET_EXAMPLE_LABELS: Record<SnippetExampleCategory, string> = {
	hero: "Hero",
	social: "Social",
	banner: "Banner",
	logo: "Logo",
}

export const SNIPPET_EXAMPLES: SnippetExample[] = [
	{
		id: "evencio-hero-key-visual",
		title: "Event Hero Key Visual",
		description: "Primary event key visual for animated stage or landing hero.",
		category: "hero",
		viewport: { width: 1600, height: 900 },
		tags: ["hero", "event", "key-visual"],
		source: `const LogoMark = ({ size = 28, variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill={fillColor} />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
  )
}

const LogoWordmark = ({ variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <span
      style={{ color: fillColor }}
      className="font-unbounded text-sm uppercase tracking-[-0.02em]"
    >
      EVENCIO
    </span>
  )
}

const EvencioLogo = ({ variant = "dark" }) => (
  <div className="flex items-center gap-2">
    <LogoMark size={28} variant={variant} />
    <LogoWordmark variant={variant} />
  </div>
)

export default function EvencioEventHero({
  eyebrow = "Event Launch",
  title = "Neon Nights Festival",
  subtitle = "Event operations that move with the crowd.",
  date = "Fri, Feb 14",
  time = "19:00 - 02:00",
  venue = "Kraftwerk, Berlin",
  price = "Tickets from EUR 29",
  cta = "Reserve seat",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full w-full grid-cols-[1.2fr_0.8fr] border border-neutral-200">
        <div className="flex h-full flex-col p-16">
          <EvencioLogo />
          <p className="mt-10 font-mono text-xs uppercase tracking-widest text-neutral-400">
            {eyebrow}
          </p>
          <h1 className="mt-6 font-lexend text-5xl font-bold tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-neutral-600">{subtitle}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Date</p>
              <p className="mt-2 font-medium text-neutral-900">{date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Time</p>
              <p className="mt-2 font-medium text-neutral-900">{time}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Venue</p>
              <p className="mt-2 font-medium text-neutral-900">{venue}</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-neutral-200 pt-6 text-sm">
            <span className="text-neutral-500">{price}</span>
            <span className="border border-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-900">
              {cta}
            </span>
          </div>
        </div>
        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-950 p-10 text-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-500">
            <span>Key visual</span>
            <span>Evencio</span>
          </div>
          <div className="mt-8 flex-1 border border-neutral-800 bg-neutral-900" />
          <div className="mt-6 border-t border-neutral-800 pt-4 text-sm text-neutral-400">
            Designed for motion scenes and hero placements.
          </div>
        </div>
      </div>
    </div>
  )
}
`,
	},
	{
		id: "evencio-instagram-post",
		title: "Instagram Announcement",
		description: "Vertical Instagram post with bold typography and schedule highlights.",
		category: "social",
		viewport: { width: 1080, height: 1350 },
		tags: ["social", "instagram", "announcement"],
		source: `const EvencioLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 100 100" width={26} height={26} aria-hidden="true">
        <path d="M15 10H85V35H40V65H85V90H15V10Z" fill="#0A0A0A" />
        <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
      </svg>
      <span className="font-unbounded text-xs uppercase tracking-[-0.02em] text-neutral-900">
        EVENCIO
      </span>
    </div>
  )
}

export default function EvencioInstagramPost({
  eyebrow = "Just announced",
  title = "Warehouse Sessions",
  subtitle = "A night of immersive sound and lights.",
  date = "Sat, Mar 02",
  time = "21:00 - 04:00",
  location = "Funkhaus, Berlin",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full flex-col border border-neutral-200 p-12">
        <div className="flex items-center justify-between">
          <EvencioLogo />
          <span className="text-[10px] uppercase tracking-[0.32em] text-neutral-400">
            Instagram
          </span>
        </div>
        <div className="mt-12">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">{eyebrow}</p>
          <h1 className="mt-4 font-lexend text-4xl font-bold tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">{subtitle}</p>
        </div>
        <div className="mt-10 flex-1 border border-neutral-200 bg-neutral-50" />
        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Date</p>
            <p className="mt-2 font-medium text-neutral-900">{date}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Time</p>
            <p className="mt-2 font-medium text-neutral-900">{time}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Venue</p>
            <p className="mt-2 font-medium text-neutral-900">{location}</p>
          </div>
        </div>
        <div className="mt-12 border-t border-neutral-200 pt-6 text-xs uppercase tracking-[0.3em] text-neutral-400">
          evenc.io
        </div>
      </div>
    </div>
  )
}
`,
	},
	{
		id: "evencio-facebook-banner",
		title: "Facebook Banner",
		description: "Wide banner layout optimized for Facebook event promotion.",
		category: "banner",
		viewport: { width: 1200, height: 628 },
		tags: ["banner", "facebook", "social"],
		source: `const EvencioLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 100 100" width={24} height={24} aria-hidden="true">
        <path d="M15 10H85V35H40V65H85V90H15V10Z" fill="#0A0A0A" />
        <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
      </svg>
      <span className="font-unbounded text-xs uppercase tracking-[-0.02em] text-neutral-900">
        EVENCIO
      </span>
    </div>
  )
}

export default function EvencioFacebookBanner({
  headline = "Evencio Live Session",
  subtitle = "Behind the scenes with Berlin nightlife operators.",
  date = "Thu, Apr 11",
  time = "18:00 CET",
  cta = "Reserve spot",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full grid-cols-[1.1fr_0.9fr] border border-neutral-200">
        <div className="flex h-full flex-col p-12">
          <EvencioLogo />
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-neutral-400">Facebook banner</p>
          <h1 className="mt-4 font-lexend text-3xl font-bold tracking-tight text-neutral-900">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
          <div className="mt-6 grid gap-2 text-sm">
            <p className="text-neutral-500">{date}</p>
            <p className="text-neutral-500">{time}</p>
          </div>
          <div className="mt-auto">
            <span className="inline-flex items-center border border-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-900">
              {cta}
            </span>
          </div>
        </div>
        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-50 p-10">
          <div className="flex-1 border border-neutral-200 bg-white" />
          <div className="mt-6 border-t border-neutral-200 pt-4 text-xs uppercase tracking-[0.3em] text-neutral-400">
            Event promotion
          </div>
        </div>
      </div>
    </div>
  )
}
`,
	},
	{
		id: "evencio-x-post",
		title: "X Post",
		description: "Compact horizontal post for X/Twitter announcements.",
		category: "social",
		viewport: { width: 1200, height: 675 },
		tags: ["social", "x", "announcement"],
		source: `const EvencioLogo = () => {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 100 100" width={22} height={22} aria-hidden="true">
        <path d="M15 10H85V35H40V65H85V90H15V10Z" fill="#0A0A0A" />
        <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
      </svg>
      <span className="font-unbounded text-[11px] uppercase tracking-[-0.02em] text-neutral-900">
        EVENCIO
      </span>
    </div>
  )
}

export default function EvencioXPost({
  headline = "Doors open in 48h",
  description = "Final release tickets are live. Limited capacity.",
  date = "Fri, May 03",
  location = "Berghain, Berlin",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full flex-col border border-neutral-200 p-10">
        <div className="flex items-center justify-between">
          <EvencioLogo />
          <span className="text-[10px] uppercase tracking-[0.32em] text-neutral-400">X</span>
        </div>
        <div className="mt-10 grid grid-cols-[1.2fr_0.8fr] gap-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Announcement</p>
            <h1 className="mt-4 font-lexend text-3xl font-bold tracking-tight text-neutral-900">
              {headline}
            </h1>
            <p className="mt-3 text-sm text-neutral-600">{description}</p>
          </div>
          <div className="border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Date</p>
            <p className="mt-2 font-medium text-neutral-900">{date}</p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-neutral-400">Venue</p>
            <p className="mt-2 font-medium text-neutral-900">{location}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-neutral-200 pt-6 text-xs uppercase tracking-[0.3em] text-neutral-400">
          <span>evenc.io</span>
          <span>Share</span>
        </div>
      </div>
    </div>
  )
}
`,
	},
	{
		id: "evencio-logo-system",
		title: "Logo System Board",
		description: "Logo mark, wordmark, and spacing guidance.",
		category: "logo",
		viewport: { width: 900, height: 600 },
		tags: ["logo", "brand", "guidelines"],
		source: `const LogoMark = ({ size = 40, variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill={fillColor} />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
  )
}

const LogoWordmark = ({ variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <span
      style={{ color: fillColor }}
      className="font-unbounded text-lg uppercase tracking-[-0.02em]"
    >
      EVENCIO
    </span>
  )
}

const LogoLockup = ({ variant = "dark" }) => (
  <div className="flex items-center gap-3">
    <LogoMark size={32} variant={variant} />
    <LogoWordmark variant={variant} />
  </div>
)

export default function EvencioLogoSystem({
  note = "Maintain clear space equal to the mark height.",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-10 border border-neutral-200 p-10">
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">01 / Logo</p>
            <h2 className="mt-4 font-lexend text-3xl font-bold text-neutral-900">
              Primary Lockup
            </h2>
          </div>
          <div className="border border-neutral-200 bg-neutral-50 p-6">
            <LogoLockup />
          </div>
          <div className="border border-neutral-200 bg-neutral-950 p-6">
            <LogoLockup variant="light" />
          </div>
          <p className="text-sm text-neutral-500">{note}</p>
        </div>
        <div className="grid gap-4">
          <div className="border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Mark sizes</p>
            <div className="mt-4 flex items-center justify-between">
              {[20, 28, 36, 44].map((size) => (
                <div key={size} className="flex flex-col items-center gap-2">
                  <LogoMark size={size} />
                  <span className="text-[10px] text-neutral-400">{size}px</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Wordmark</p>
            <div className="mt-4">
              <LogoWordmark />
            </div>
          </div>
          <div className="border border-neutral-200 bg-white p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Icon only</p>
            <div className="mt-4 flex items-center gap-4">
              <LogoMark size={32} />
              <span className="text-sm text-neutral-500">Use mark for compact layouts.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`,
	},
]
