import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

export const Route = createFileRoute("/docs/layout-snapping")({
	component: LayoutSnappingGuide,
})

const CODE_ALIGNMENT_ONLY = `<h1 className="font-lexend text-5xl mr-auto">\n  {title}\n</h1>`

const CODE_OFFSET_KEPT = `<h1 className="font-lexend text-5xl mx-auto" style={{ translate: "0px 475.21px" }}>\n  {title}\n</h1>`

const CODE_SIBLING_OFFSET = `<p className="mt-6 text-[40px] text-neutral-300" style={{ translate: "0px -24px" }}>\n  {subtitle}\n</p>`

function LayoutSnappingGuide() {
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">How-to</p>
				<h1 className="mt-4 font-lexend text-3xl font-semibold tracking-tight text-neutral-900">
					Layout snapping policy
				</h1>
				<p className="mt-3 max-w-2xl text-base text-neutral-600">
					Snapping updates source only when alignment alone explains the final position. If there is
					any leftover offset, we keep translate to preserve the exact layout.
				</p>
			</header>

			<section className="grid gap-6 border-t border-neutral-200 pt-8">
				<h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
					Policy rules
				</h2>
				<div className="grid gap-4">
					<div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Alignment-only snaps
						</p>
						<p className="mt-2 text-sm text-neutral-600">
							If a snap lands exactly on a parent edge or center (no residual offset), the editor
							writes alignment classes and removes translate.
						</p>
					</div>
					<div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Offsets keep translate
						</p>
						<p className="mt-2 text-sm text-neutral-600">
							Any non-zero offset stays as inline translate. This avoids conflicting with existing
							Tailwind spacing utilities and preserves pixel-accurate layout.
						</p>
					</div>
				</div>
			</section>

			<section className="grid gap-6 border-t border-neutral-200 pt-8">
				<h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
					Examples
				</h2>
				<div className="grid gap-4">
					<div className="rounded-md border border-neutral-200 p-5">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Alignment-only snap
						</p>
						<pre className="mt-3 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-700">
							{CODE_ALIGNMENT_ONLY}
						</pre>
					</div>
					<div className="rounded-md border border-neutral-200 p-5">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Offset stays translate
						</p>
						<pre className="mt-3 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-700">
							{CODE_OFFSET_KEPT}
						</pre>
					</div>
					<div className="rounded-md border border-neutral-200 p-5">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Sibling offset
						</p>
						<pre className="mt-3 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-700">
							{CODE_SIBLING_OFFSET}
						</pre>
					</div>
				</div>
			</section>

			<section className="border-t border-neutral-200 pt-8">
				<div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
					<h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
						Try the demo template
					</h2>
					<p className="mt-3 text-sm text-neutral-600">
						Open the layout snapping demo template and test snaps in Layout mode.
					</p>
					<Link
						to="/snippets/editor"
						search={{ template: "layout-policy" }}
						className="mt-4 inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-700 transition-colors hover:bg-neutral-100"
					>
						Open demo template
						<ArrowRight className="h-3 w-3" />
					</Link>
				</div>
			</section>
		</div>
	)
}
