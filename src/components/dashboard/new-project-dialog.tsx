import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useProjectsStore } from "@/stores/projects-store"
import type { CanvasDimensions, ContentType } from "@/types/editor"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "@/types/editor"

interface NewProjectDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

type PresetType =
	| "instagram-post"
	| "instagram-story"
	| "facebook-cover"
	| "twitter-header"
	| "linkedin-banner"
	| "a4"
	| "a3"
	| "letter"

const PRESETS: Array<{
	id: PresetType
	label: string
	contentType: ContentType
	dimensions: CanvasDimensions
}> = [
	{
		id: "instagram-post",
		label: "Instagram Post",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["instagram-post"],
	},
	{
		id: "instagram-story",
		label: "Instagram Story",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["instagram-story"],
	},
	{
		id: "facebook-cover",
		label: "Facebook Cover",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["facebook-cover"],
	},
	{
		id: "twitter-header",
		label: "Twitter/X Header",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["twitter-header"],
	},
	{
		id: "linkedin-banner",
		label: "LinkedIn Banner",
		contentType: "social-image",
		dimensions: SOCIAL_DIMENSIONS["linkedin-banner"],
	},
	{ id: "a4", label: "A4 Poster", contentType: "poster", dimensions: POSTER_DIMENSIONS.a4 },
	{ id: "a3", label: "A3 Poster", contentType: "poster", dimensions: POSTER_DIMENSIONS.a3 },
	{ id: "letter", label: "Letter", contentType: "poster", dimensions: POSTER_DIMENSIONS.letter },
]

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
	const navigate = useNavigate()
	const createProject = useProjectsStore((s) => s.createProject)
	const isLoading = useProjectsStore((s) => s.isLoading)

	const [name, setName] = useState("")
	const [selectedPreset, setSelectedPreset] = useState<PresetType>("instagram-post")

	const handleCreate = async () => {
		if (!name.trim()) return

		const preset = PRESETS.find((p) => p.id === selectedPreset)
		if (!preset) return

		try {
			const projectId = await createProject(name.trim(), preset.contentType, preset.dimensions)
			onOpenChange(false)
			setName("")
			setSelectedPreset("instagram-post")
			navigate({ to: "/project/$projectId", params: { projectId } })
		} catch (error) {
			console.error("Failed to create project:", error)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && name.trim()) {
			handleCreate()
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-lexend">New Project</DialogTitle>
					<DialogDescription>Create a new project to start designing</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Project Name */}
					<div className="space-y-2">
						<Label htmlFor="project-name">Project Name</Label>
						<Input
							id="project-name"
							placeholder="My Awesome Project"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>

					{/* Preset Selection */}
					<div className="space-y-2">
						<Label>Starting Size</Label>
						<div className="grid grid-cols-2 gap-2">
							{PRESETS.map((preset) => (
								<button
									key={preset.id}
									type="button"
									onClick={() => setSelectedPreset(preset.id)}
									className={cn(
										"flex flex-col items-start rounded border px-3 py-2 text-left transition-colors",
										selectedPreset === preset.id
											? "border-neutral-900 bg-neutral-50"
											: "border-neutral-200 hover:border-neutral-300",
									)}
								>
									<span className="text-sm font-medium text-neutral-900">{preset.label}</span>
									<span className="text-xs text-neutral-400">
										{preset.dimensions.width} × {preset.dimensions.height}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={!name.trim() || isLoading}>
						{isLoading ? "Creating..." : "Create Project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default NewProjectDialog
