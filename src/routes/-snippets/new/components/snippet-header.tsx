import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

interface SnippetHeaderProps {
	canCreateSnippet: boolean
	isCreating: boolean
	onCreate: () => void
}

export function SnippetHeader({ canCreateSnippet, isCreating, onCreate }: SnippetHeaderProps) {
	return (
		<header className="h-12 shrink-0 border-b border-neutral-200 bg-white">
			<div className="flex h-full items-center justify-between px-4">
				<div className="flex items-center gap-3">
					<Logo size="sm" href="/" animateOnHover />
					<span className="text-neutral-300">/</span>
					<Link
						to="/library"
						className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
					>
						<ArrowLeft className="h-4 w-4" />
						Library
					</Link>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link to="/library">Cancel</Link>
					</Button>
					<Button size="sm" disabled={!canCreateSnippet} onClick={onCreate}>
						{isCreating ? "Creating..." : "Create snippet"}
					</Button>
				</div>
			</div>
		</header>
	)
}
