import { Link } from "@tanstack/react-router"
import { Copy, Edit2, Image, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ProjectListItem } from "@/types/project"

interface ProjectCardProps {
	project: ProjectListItem
	onRename?: (id: string) => void
	onDuplicate?: (id: string) => void
	onDelete?: (id: string) => void
}

export function ProjectCard({ project, onRename, onDuplicate, onDelete }: ProjectCardProps) {
	const formattedDate = new Date(project.updatedAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

	return (
		<div className="group relative flex flex-col bg-white transition-colors hover:bg-neutral-50">
			{/* Thumbnail */}
			<Link to="/project/$projectId" params={{ projectId: project.id }} className="block">
				<div className="relative aspect-video w-full overflow-hidden border-b border-neutral-200 bg-neutral-100">
					{project.thumbnailDataUrl ? (
						<img
							src={project.thumbnailDataUrl}
							alt={project.name}
							className="h-full w-full object-contain"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<Image className="h-8 w-8 text-neutral-300" />
						</div>
					)}
				</div>
			</Link>

			{/* Content */}
			<div className="flex flex-1 flex-col p-4">
				<div className="flex items-start justify-between gap-2">
					<Link
						to="/project/$projectId"
						params={{ projectId: project.id }}
						className="min-w-0 flex-1"
					>
						<h3 className="truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
							{project.name}
						</h3>
					</Link>

					{/* Actions Menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onRename?.(project.id)}>
								<Edit2 className="mr-2 h-4 w-4" />
								Rename
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onDuplicate?.(project.id)}>
								<Copy className="mr-2 h-4 w-4" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete?.(project.id)}
								className="text-red-600 focus:text-red-600"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Metadata */}
				<div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
					<span>
						{project.slideCount} {project.slideCount === 1 ? "slide" : "slides"}
					</span>
					<span className="h-1 w-1 rounded-full bg-neutral-300" />
					<span>{formattedDate}</span>
				</div>
			</div>
		</div>
	)
}

export default ProjectCard
