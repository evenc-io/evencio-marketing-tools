import type { ProjectListItem } from "@/types/project"
import { ProjectCard } from "./project-card"

interface ProjectGridProps {
	projects: ProjectListItem[]
	onRename?: (id: string) => void
	onDuplicate?: (id: string) => void
	onDelete?: (id: string) => void
}

export function ProjectGrid({ projects, onRename, onDuplicate, onDelete }: ProjectGridProps) {
	return (
		<div className="grid gap-px border-l border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{projects.map((project) => (
				<ProjectCard
					key={project.id}
					project={project}
					onRename={onRename}
					onDuplicate={onDuplicate}
					onDelete={onDelete}
				/>
			))}
		</div>
	)
}

export default ProjectGrid
