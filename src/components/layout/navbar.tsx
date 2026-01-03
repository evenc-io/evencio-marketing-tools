import { Link } from "@tanstack/react-router"
import { Check, ChevronDown, Download, Plus, Save, Settings } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavbarProps {
	variant: "dashboard" | "editor"
	/** Project name (editor variant only) */
	projectName?: string
	/** Callback when project name changes (editor variant only) */
	onProjectNameChange?: (name: string) => void
	/** Callback when new project button clicked (dashboard variant only) */
	onNewProject?: () => void
	/** Callback when save button clicked (editor variant only) */
	onSave?: () => void
	/** Whether save is pending (editor variant only) */
	isSaving?: boolean
	/** Whether there are unsaved changes (editor variant only) */
	hasUnsavedChanges?: boolean
	/** Callback for export actions (editor variant only) */
	onExport?: (format: "png" | "jpeg" | "pdf") => void
	/** Whether export is in progress (editor variant only) */
	isExporting?: boolean
}

export function Navbar({
	variant,
	projectName,
	onProjectNameChange,
	onNewProject,
	onSave,
	isSaving,
	hasUnsavedChanges,
	onExport,
	isExporting,
}: NavbarProps) {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
			<div className="mx-auto flex h-full max-w-full items-center justify-between px-4">
				{/* Left Section */}
				<div className="flex items-center gap-4">
					{variant === "dashboard" ? (
						<Logo size="sm" href="/" />
					) : (
						<Logo size="sm" href="/" animateOnHover />
					)}
				</div>

				{/* Center Section */}
				{variant === "editor" && projectName && (
					<ProjectNameEditor
						name={projectName}
						onChange={onProjectNameChange}
						hasUnsavedChanges={hasUnsavedChanges}
					/>
				)}

				{/* Right Section */}
				<div className="flex items-center gap-2">
					{variant === "dashboard" ? (
						<>
							<Button variant="ghost" size="sm" asChild>
								<Link to="/docs">Docs</Link>
							</Button>
							<Button variant="ghost" size="icon" className="h-8 w-8" asChild>
								<Link to="/settings">
									<Settings className="h-4 w-4" />
								</Link>
							</Button>
							<Button onClick={onNewProject} size="sm" className="gap-1.5">
								<Plus className="h-4 w-4" />
								<span className="hidden sm:inline">New Project</span>
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" size="sm" asChild>
								<Link to="/docs">Docs</Link>
							</Button>
							{/* Save Button */}
							<Button
								variant="ghost"
								size="sm"
								onClick={onSave}
								disabled={isSaving || !hasUnsavedChanges}
								className="gap-1.5"
							>
								{isSaving ? (
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
								) : hasUnsavedChanges ? (
									<Save className="h-4 w-4" />
								) : (
									<Check className="h-4 w-4 text-emerald-500" />
								)}
								<span className="hidden sm:inline">
									{isSaving ? "Saving..." : hasUnsavedChanges ? "Save" : "Saved"}
								</span>
							</Button>

							{/* Export Dropdown */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" disabled={isExporting} className="gap-1.5">
										<Download className="h-4 w-4" />
										<span className="hidden sm:inline">Export</span>
										<ChevronDown className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => onExport?.("png")}>
										Export as PNG
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onExport?.("jpeg")}>
										Export as JPEG
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => onExport?.("pdf")}>
										Export as PDF
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							{/* Settings */}
							<Button variant="ghost" size="icon" className="h-8 w-8" asChild>
								<Link to="/settings">
									<Settings className="h-4 w-4" />
								</Link>
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	)
}

interface ProjectNameEditorProps {
	name: string
	onChange?: (name: string) => void
	hasUnsavedChanges?: boolean
}

function ProjectNameEditor({ name, onChange, hasUnsavedChanges }: ProjectNameEditorProps) {
	const [isEditing, setIsEditing] = useState(false)
	const [editValue, setEditValue] = useState(name)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleSubmit = () => {
		const trimmed = editValue.trim()
		if (trimmed && trimmed !== name) {
			onChange?.(trimmed)
		} else {
			setEditValue(name)
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSubmit()
		} else if (e.key === "Escape") {
			setEditValue(name)
			setIsEditing(false)
		}
	}

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleSubmit}
				onKeyDown={handleKeyDown}
				className="h-8 w-48 rounded border border-neutral-200 bg-white px-2 text-center text-sm font-medium text-neutral-900 outline-none focus:border-neutral-400"
			/>
		)
	}

	return (
		<button
			type="button"
			onClick={() => setIsEditing(true)}
			className="flex items-center gap-2 rounded px-2 py-1 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
		>
			<span className="max-w-48 truncate">{name}</span>
			{hasUnsavedChanges && (
				<span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />
			)}
		</button>
	)
}

export default Navbar
