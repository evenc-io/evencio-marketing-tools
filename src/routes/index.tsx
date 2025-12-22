import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog"
import { ProjectGrid } from "@/components/dashboard/project-grid"
import { Navbar } from "@/components/layout/navbar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useProjectsStore } from "@/stores/projects-store"

export const Route = createFileRoute("/")({ component: DashboardPage })

function DashboardPage() {
	const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)

	const projects = useProjectsStore((s) => s.projects)
	const isLoading = useProjectsStore((s) => s.isLoading)
	const loadProjects = useProjectsStore((s) => s.loadProjects)
	const deleteProject = useProjectsStore((s) => s.deleteProject)

	useEffect(() => {
		loadProjects()
	}, [loadProjects])

	const handleDelete = async (id: string) => {
		if (window.confirm("Are you sure you want to delete this project?")) {
			await deleteProject(id)
		}
	}

	const handleRename = (id: string) => {
		// TODO: Implement rename dialog
		console.log("Rename project:", id)
	}

	const handleDuplicate = (id: string) => {
		// TODO: Implement duplicate
		console.log("Duplicate project:", id)
	}

	return (
		<div className="min-h-screen bg-white">
			<Navbar variant="dashboard" onNewProject={() => setShowNewProjectDialog(true)} />

			<main className="mx-auto max-w-7xl px-6 pt-24 pb-12">
				{/* Header */}
				<div className="mb-8">
					<h1 className="font-lexend text-3xl font-bold tracking-tight text-neutral-900">
						Your Projects
					</h1>
					<p className="mt-2 text-neutral-500">Create and manage your marketing designs</p>
				</div>

				{/* Content */}
				{isLoading ? (
					<div className="flex h-64 items-center justify-center">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
					</div>
				) : projects.length > 0 ? (
					<ProjectGrid
						projects={projects}
						onRename={handleRename}
						onDuplicate={handleDuplicate}
						onDelete={handleDelete}
					/>
				) : (
					<EmptyState
						icon={<FolderOpen className="h-6 w-6" />}
						title="No projects yet"
						description="Create your first project to get started"
						action={
							<Button onClick={() => setShowNewProjectDialog(true)} className="gap-1.5">
								<Plus className="h-4 w-4" />
								New Project
							</Button>
						}
						className="min-h-64"
					/>
				)}
			</main>

			{/* New Project Dialog */}
			<NewProjectDialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog} />
		</div>
	)
}
