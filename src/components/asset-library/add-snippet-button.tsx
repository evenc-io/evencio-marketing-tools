import { Link } from "@tanstack/react-router"
import { ChevronDown, FileCode2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SNIPPET_TEMPLATE_OPTIONS } from "@/lib/snippets/templates"

export function AddSnippetButton() {
	return (
		<DropdownMenu>
			<div className="inline-flex items-center">
				<Button size="sm" className="rounded-r-none" asChild>
					<Link to="/snippets/editor" search={{ template: "single" }}>
						<FileCode2 className="h-4 w-4" />
						Add Snippet
					</Link>
				</Button>
				<DropdownMenuTrigger asChild>
					<Button
						size="sm"
						className="rounded-l-none border-l border-primary/30 px-2"
						aria-label="Select snippet template"
					>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent align="end" className="w-56">
				{SNIPPET_TEMPLATE_OPTIONS.map((template) => (
					<DropdownMenuItem key={template.id} asChild className="flex flex-col items-start gap-1">
						<Link to="/snippets/editor" search={{ template: template.id }} className="w-full">
							<span className="text-xs font-medium text-neutral-900">{template.label}</span>
							<span className="text-[11px] text-neutral-500">{template.description}</span>
						</Link>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
