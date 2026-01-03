import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, Grid2x2 } from "lucide-react"

export const Route = createFileRoute("/docs/")({
	component: DocsOverview,
})

function DocsOverview() {
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
					Evencio Docs
				</p>
				<h1 className="mt-4 font-lexend text-3xl font-semibold tracking-tight text-neutral-900">
					Snippets editor documentation
				</h1>
				<p className="mt-3 max-w-2xl text-base text-neutral-600">
					Guides for building, snapping, and exporting snippet-based marketing layouts.
				</p>
			</header>

			<section className="grid gap-6 border-t border-neutral-200 pt-8">
				<h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
					How-to guides
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<Link
						to="/docs/layout-snapping"
						className="group flex flex-col justify-between rounded-md border border-neutral-200 bg-white p-5 transition-colors hover:bg-neutral-50"
					>
						<div>
							<div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
								<Grid2x2 className="h-4 w-4" />
								Layout snapping policy
							</div>
							<p className="mt-2 text-sm text-neutral-600">
								Learn when snapping creates alignment classes vs. keeps translate offsets.
							</p>
						</div>
						<span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Read guide
							<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
						</span>
					</Link>
				</div>
			</section>

			<section className="border-t border-neutral-200 pt-8">
				<div className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
					<h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">
						Need a demo?
					</h2>
					<p className="mt-3 text-sm text-neutral-600">
						Open the layout snapping demo template to see the policy in action.
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
