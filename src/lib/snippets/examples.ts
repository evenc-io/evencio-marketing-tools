import type { PreviewDimensions } from "@/lib/snippets/preview-runtime"
import { serializeSnippetFiles } from "@/lib/snippets/source-files"

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

const EVENCIO_HERO_MAIN_SOURCE = `// @import LogoMark.tsx
// @import LogoWordmark.tsx
// @import EvencioLogo.tsx

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
`

const EVENCIO_HERO_FILES: Record<string, string> = {
	"LogoMark.tsx": `export const LogoMark = ({ size = 28, variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill={fillColor} />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
  )
}
`,
	"LogoWordmark.tsx": `export const LogoWordmark = ({ variant = "dark" }) => {
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
`,
	"EvencioLogo.tsx": `export const EvencioLogo = ({ variant = "dark" }) => (
  <div className="flex items-center gap-2">
    <LogoMark size={28} variant={variant} />
    <LogoWordmark variant={variant} />
  </div>
)
`,
}

const EVENCIO_HERO_SOURCE = serializeSnippetFiles(EVENCIO_HERO_MAIN_SOURCE, EVENCIO_HERO_FILES)

const EVENCIO_INSTAGRAM_SQUARE_MAIN_SOURCE = `// @import EvencioLogo.tsx

export default function EvencioInstagramSquare({
  eyebrow = "Just announced",
  title = "Warehouse Sessions",
  subtitle = "A night of immersive sound and lights.",
  date = "Sat, Mar 02",
  time = "21:00 - 04:00",
  location = "Funkhaus, Berlin",
  cta = "Tickets live",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full flex-col border border-neutral-200 p-14">
        <EvencioLogo />
        <div className="mt-10 flex-1">
          <p className="font-mono text-[26px] uppercase tracking-[0.22em] text-neutral-400">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-[30rem] font-lexend text-[96px] font-semibold leading-[1.02] tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-5 max-w-[30rem] text-[36px] leading-[1.35] text-neutral-600">
            {subtitle}
          </p>
        </div>
        <div className="mt-6 grid gap-3 border-t border-neutral-200 pt-6 text-[32px] font-medium text-neutral-900">
          <span>
            {date} / {time}
          </span>
          <span className="text-[30px] text-neutral-700">{location}</span>
        </div>
        <div className="mt-5 border-t border-neutral-200 pt-4 text-[30px] uppercase tracking-[0.22em] text-neutral-400">
          {cta}
        </div>
      </div>
    </div>
  )
}
`

const EVENCIO_INSTAGRAM_SQUARE_FILES: Record<string, string> = {
	"EvencioLogo.tsx": `export const EvencioLogo = () => (
  <div className="flex items-center gap-3">
    <svg viewBox="0 0 100 100" width={66} height={66} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill="#0A0A0A" />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
    <span className="font-unbounded text-[28px] uppercase tracking-[-0.02em] text-neutral-900">
      EVENCIO
    </span>
  </div>
)
`,
}

const EVENCIO_INSTAGRAM_SQUARE_SOURCE = serializeSnippetFiles(
	EVENCIO_INSTAGRAM_SQUARE_MAIN_SOURCE,
	EVENCIO_INSTAGRAM_SQUARE_FILES,
)

const EVENCIO_INSTAGRAM_PORTRAIT_MAIN_SOURCE = `// @import EvencioLogo.tsx

export default function EvencioInstagramPortrait({
  eyebrow = "Featured",
  title = "Night Mode Residency",
  subtitle = "Three rooms. One night. Infinite tempo.",
  date = "Fri, Apr 12",
  time = "20:00 - 03:00",
  location = "Tobacco Dock, London",
  price = "Tickets from EUR 29",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="flex h-full flex-col border border-neutral-200 p-16">
        <EvencioLogo />
        <div className="mt-10">
          <p className="font-mono text-[26px] uppercase tracking-[0.22em] text-neutral-400">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-[32rem] font-lexend text-[104px] font-semibold leading-[1.02] tracking-tight text-neutral-900">
            {title}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[38px] leading-[1.4] text-neutral-600">
            {subtitle}
          </p>
        </div>
        <div className="mt-10 grid gap-4 border border-neutral-200 bg-neutral-50 p-6 text-[32px] font-medium text-neutral-900">
          <span>
            {date} / {time}
          </span>
          <span className="text-[30px] text-neutral-700">{location}</span>
        </div>
        <div className="mt-auto border-t border-neutral-200 pt-6 text-[30px] uppercase tracking-[0.22em] text-neutral-400">
          {price}
        </div>
      </div>
    </div>
  )
}
`

const EVENCIO_INSTAGRAM_PORTRAIT_FILES: Record<string, string> = {
	"EvencioLogo.tsx": `export const EvencioLogo = () => (
  <div className="flex items-center gap-3">
    <svg viewBox="0 0 100 100" width={68} height={68} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill="#0A0A0A" />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
    <span className="font-unbounded text-[28px] uppercase tracking-[-0.02em] text-neutral-900">
      EVENCIO
    </span>
  </div>
)
`,
}

const EVENCIO_INSTAGRAM_PORTRAIT_SOURCE = serializeSnippetFiles(
	EVENCIO_INSTAGRAM_PORTRAIT_MAIN_SOURCE,
	EVENCIO_INSTAGRAM_PORTRAIT_FILES,
)

const EVENCIO_INSTAGRAM_STORY_MAIN_SOURCE = `// @import EvencioLogo.tsx

export default function EvencioInstagramStory({
  eyebrow = "Tonight",
  title = "Neon Nights Festival",
  subtitle = "Kraftwerk, Berlin",
  date = "Fri, Feb 14",
  time = "19:00 - 02:00",
  cta = "Swipe for tickets",
}) {
  return (
    <div className="h-full w-full bg-neutral-950 text-white">
      <div className="flex h-full flex-col border border-neutral-800 p-20">
        <div className="font-mono text-[28px] uppercase tracking-[0.22em] text-neutral-500">
          {eyebrow}
        </div>
        <div className="mt-10 flex-1">
          <h1 className="max-w-[34rem] font-lexend text-[112px] font-semibold leading-[1.0] tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-6 text-[40px] text-neutral-300">{subtitle}</p>
        </div>
        <div className="grid gap-3 border-t border-neutral-800 pt-8 text-[40px] text-neutral-200">
          <span className="font-semibold">
            {date} / {time}
          </span>
          <span className="text-[36px] text-neutral-400">{cta}</span>
        </div>
        <div className="mt-8 flex items-center justify-end">
          <EvencioLogo variant="light" />
        </div>
      </div>
    </div>
  )
}
`

const EVENCIO_INSTAGRAM_STORY_FILES: Record<string, string> = {
	"EvencioLogo.tsx": `export const EvencioLogo = ({ variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  const textColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" width={66} height={66} aria-hidden="true">
        <path d="M15 10H85V35H40V65H85V90H15V10Z" fill={fillColor} />
        <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
      </svg>
      <span
        style={{ color: textColor }}
        className="font-unbounded text-[28px] uppercase tracking-[-0.02em]"
      >
        EVENCIO
      </span>
    </div>
  )
}
`,
}

const EVENCIO_INSTAGRAM_STORY_SOURCE = serializeSnippetFiles(
	EVENCIO_INSTAGRAM_STORY_MAIN_SOURCE,
	EVENCIO_INSTAGRAM_STORY_FILES,
)

const EVENCIO_FACEBOOK_MAIN_SOURCE = `// @import EvencioLogo.tsx

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
`

const EVENCIO_FACEBOOK_FILES: Record<string, string> = {
	"EvencioLogo.tsx": `export const EvencioLogo = () => {
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
`,
}

const EVENCIO_FACEBOOK_SOURCE = serializeSnippetFiles(
	EVENCIO_FACEBOOK_MAIN_SOURCE,
	EVENCIO_FACEBOOK_FILES,
)

const EVENCIO_X_MAIN_SOURCE = `// @import EvencioLogo.tsx

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
`

const EVENCIO_X_FILES: Record<string, string> = {
	"EvencioLogo.tsx": `export const EvencioLogo = () => {
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
`,
}

const EVENCIO_X_SOURCE = serializeSnippetFiles(EVENCIO_X_MAIN_SOURCE, EVENCIO_X_FILES)

const EVENCIO_LOGO_SYSTEM_MAIN_SOURCE = `// @import LogoMark.tsx
// @import LogoWordmark.tsx
// @import LogoLockup.tsx

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
`

const EVENCIO_LOGO_SYSTEM_FILES: Record<string, string> = {
	"LogoMark.tsx": `export const LogoMark = ({ size = 40, variant = "dark" }) => {
  const fillColor = variant === "light" ? "#FFFFFF" : "#0A0A0A"
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M15 10H85V35H40V65H85V90H15V10Z" fill={fillColor} />
      <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
    </svg>
  )
}
`,
	"LogoWordmark.tsx": `export const LogoWordmark = ({ variant = "dark" }) => {
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
`,
	"LogoLockup.tsx": `export const LogoLockup = ({ variant = "dark" }) => (
  <div className="flex items-center gap-3">
    <LogoMark size={32} variant={variant} />
    <LogoWordmark variant={variant} />
  </div>
)
`,
}

const EVENCIO_LOGO_SYSTEM_SOURCE = serializeSnippetFiles(
	EVENCIO_LOGO_SYSTEM_MAIN_SOURCE,
	EVENCIO_LOGO_SYSTEM_FILES,
)

export const SNIPPET_EXAMPLES: SnippetExample[] = [
	{
		id: "evencio-hero-key-visual",
		title: "Event Hero Key Visual",
		description: "Primary event key visual for animated stage or landing hero.",
		category: "hero",
		viewport: { width: 1600, height: 900 },
		tags: ["hero", "event", "key-visual"],
		source: EVENCIO_HERO_SOURCE,
	},
	{
		id: "evencio-instagram-post",
		title: "Instagram Square Post",
		description: "1:1 feed layout with large readable typography.",
		category: "social",
		viewport: { width: 1080, height: 1080 },
		tags: ["social", "instagram", "square", "announcement"],
		source: EVENCIO_INSTAGRAM_SQUARE_SOURCE,
	},
	{
		id: "evencio-instagram-portrait",
		title: "Instagram Portrait Post",
		description: "4:5 feed post with oversized headline and detail card.",
		category: "social",
		viewport: { width: 1080, height: 1350 },
		tags: ["social", "instagram", "portrait", "announcement"],
		source: EVENCIO_INSTAGRAM_PORTRAIT_SOURCE,
	},
	{
		id: "evencio-instagram-story",
		title: "Instagram Story",
		description: "9:16 story cover with high-contrast headline.",
		category: "social",
		viewport: { width: 1080, height: 1920 },
		tags: ["social", "instagram", "story", "reel"],
		source: EVENCIO_INSTAGRAM_STORY_SOURCE,
	},
	{
		id: "evencio-facebook-banner",
		title: "Facebook Banner",
		description: "Wide banner layout optimized for Facebook event promotion.",
		category: "banner",
		viewport: { width: 1200, height: 628 },
		tags: ["banner", "facebook", "social"],
		source: EVENCIO_FACEBOOK_SOURCE,
	},
	{
		id: "evencio-x-post",
		title: "X Post",
		description: "Compact horizontal post for X/Twitter announcements.",
		category: "social",
		viewport: { width: 1200, height: 675 },
		tags: ["social", "x", "announcement"],
		source: EVENCIO_X_SOURCE,
	},
	{
		id: "evencio-logo-system",
		title: "Logo System Board",
		description: "Logo mark, wordmark, and spacing guidance.",
		category: "logo",
		viewport: { width: 900, height: 600 },
		tags: ["logo", "brand", "guidelines"],
		source: EVENCIO_LOGO_SYSTEM_SOURCE,
	},
]
