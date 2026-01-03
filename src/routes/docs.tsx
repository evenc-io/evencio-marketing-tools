import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router"
import { ArrowLeft, BookOpen, Grid2x2 } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/docs")({
	component: DocsLayout,
})

const DOC_ITEMS = [
	{ to: "/docs", label: "Overview", icon: BookOpen, exact: true },
	{ to: "/docs/layout-snapping", label: "Layout snapping", icon: Grid2x2, exact: false },
] as const

function DocsLayout() {
	const matchRoute = useMatchRoute()

	return (
		<div className="flex min-h-screen flex-col bg-white md:flex-row">
			<header className="flex flex-col border-b border-neutral-200 md:hidden">
				<div className="flex h-14 items-center justify-between px-4">
					<Logo size="sm" href="/" />
					<Link
						to="/"
						className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
					>
						<ArrowLeft className="h-4 w-4" />
						Dashboard
					</Link>
				</div>

				<nav className="overflow-x-auto px-4 pb-3">
					<ul className="flex gap-2">
						{DOC_ITEMS.map((item) => {
							const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })
							return (
								<li key={item.to}>
									<Link
										to={item.to}
										className={cn(
											"flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
											"focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
											isActive
												? "border border-neutral-900 bg-neutral-50 text-neutral-900"
												: "border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
										)}
									>
										<item.icon className="h-4 w-4" />
										{item.label}
									</Link>
								</li>
							)
						})}
					</ul>
				</nav>
			</header>

			<aside className="hidden w-72 shrink-0 flex-col border-r border-neutral-200 md:flex">
				<div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
					<Logo size="sm" href="/" />
					<Link
						to="/"
						className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
					>
						<ArrowLeft className="h-4 w-4" />
						Dashboard
					</Link>
				</div>

				<nav className="flex-1 p-4">
					<ul className="space-y-1">
						{DOC_ITEMS.map((item) => {
							const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })
							return (
								<li key={item.to}>
									<Link
										to={item.to}
										className={cn(
											"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
											"focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
											isActive
												? "border border-neutral-900 bg-neutral-50 text-neutral-900"
												: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
										)}
									>
										<item.icon className="h-4 w-4" />
										{item.label}
									</Link>
								</li>
							)
						})}
					</ul>
				</nav>
			</aside>

			<main className="flex-1 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	)
}
