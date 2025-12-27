import { Link } from "@tanstack/react-router"
import { AlertCircle, Loader2 } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { SCREEN_GUARD_DEFAULTS, type ScreenGateInfo } from "@/lib/screen-guard"

interface SnippetScreenGuardProps {
	gate: ScreenGateInfo
}

export function SnippetScreenGuard({ gate }: SnippetScreenGuardProps) {
	const isChecking = gate.status === "unknown"
	const showMetrics = !isChecking && gate.viewport.width > 0

	return (
		<div className="flex h-screen flex-col items-center justify-center bg-white px-6">
			<div
				className="flex w-full max-w-xl flex-col items-center gap-4 text-center"
				role={gate.status === "unsupported" ? "alert" : undefined}
			>
				<Logo size="sm" href="/" animateOnHover />
				<div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
					{isChecking ? (
						<Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
					) : (
						<AlertCircle className="h-5 w-5 text-red-500" />
					)}
				</div>
				<div className="space-y-2">
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
						Snippet editor
					</p>
					<h1 className="text-lg font-semibold text-neutral-900">
						{isChecking ? "Checking screen size..." : "Desktop screen required"}
					</h1>
					<p className="text-sm text-neutral-600">
						{isChecking
							? "Preparing the editor layout."
							: "This editor needs a wide screen and full keyboard support. Open it on a larger display or expand your browser window."}
					</p>
					{showMetrics && (
						<p className="text-xs text-neutral-400">
							Minimum: {SCREEN_GUARD_DEFAULTS.minViewportWidth}x
							{SCREEN_GUARD_DEFAULTS.minViewportHeight} viewport and{" "}
							{SCREEN_GUARD_DEFAULTS.minScreenWidth}x{SCREEN_GUARD_DEFAULTS.minScreenHeight} screen.
							Current viewport: {gate.viewport.width}x{gate.viewport.height}.
						</p>
					)}
				</div>
				<Button variant="outline" size="sm" asChild>
					<Link to="/library">Back to library</Link>
				</Button>
			</div>
		</div>
	)
}
