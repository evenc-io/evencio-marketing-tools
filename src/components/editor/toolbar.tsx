import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	CircleIcon,
	Eye,
	Group as GroupIcon,
	Scan,
	Square,
	Trash2,
	TriangleIcon,
	Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	addCircleToCanvas,
	addRectToCanvas,
	addTextToCanvas,
	addTriangleToCanvas,
} from "@/lib/canvas/add-objects"
import { deleteSelection, groupSelection } from "@/lib/canvas/selection-actions"
import { useEditorStore } from "@/stores/editor-store"

export function EditorToolbar() {
	const canvas = useEditorStore((s) => s.canvas)
	const selectedObjects = useEditorStore((s) => s.selectedObjects)
	const inspectMode = useEditorStore((s) => s.inspectMode)
	const toggleInspectMode = useEditorStore((s) => s.toggleInspectMode)
	const previewMode = useEditorStore((s) => s.previewMode)
	const togglePreviewMode = useEditorStore((s) => s.togglePreviewMode)

	const addText = () => {
		if (!canvas) return
		addTextToCanvas(canvas)
	}

	const addRect = () => {
		if (!canvas) return
		addRectToCanvas(canvas)
	}

	const addCircle = () => {
		if (!canvas) return
		addCircleToCanvas(canvas)
	}

	const addTriangle = () => {
		if (!canvas) return
		addTriangleToCanvas(canvas)
	}

	const deleteSelected = () => {
		if (!canvas) return
		deleteSelection(canvas)
	}

	const bringForward = () => {
		if (!canvas) return
		const active = canvas.getActiveObject()
		if (active) {
			canvas.bringObjectForward(active)
			canvas.renderAll()
		}
	}

	const sendBackward = () => {
		if (!canvas) return
		const active = canvas.getActiveObject()
		if (active) {
			canvas.sendObjectBackwards(active)
			canvas.renderAll()
		}
	}

	const handleGroupSelection = () => {
		if (!canvas) return
		groupSelection(canvas)
	}

	return (
		<div className="flex items-center justify-center gap-1">
			{/* Text Tool */}
			<Button variant="ghost" size="sm" onClick={addText} disabled={!canvas} className="gap-1.5">
				<Type className="h-4 w-4" />
				<span className="hidden sm:inline">Text</span>
			</Button>

			{/* Shapes Dropdown */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="sm" disabled={!canvas} className="gap-1.5">
						<Square className="h-4 w-4" />
						<span className="hidden sm:inline">Shapes</span>
						<ChevronDown className="h-3 w-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onClick={addRect}>
						<Square className="mr-2 h-4 w-4" />
						Rectangle
					</DropdownMenuItem>
					<DropdownMenuItem onClick={addCircle}>
						<CircleIcon className="mr-2 h-4 w-4" />
						Circle
					</DropdownMenuItem>
					<DropdownMenuItem onClick={addTriangle}>
						<TriangleIcon className="mr-2 h-4 w-4" />
						Triangle
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Separator */}
			<div className="mx-1 h-5 w-px bg-neutral-200" />

			{/* Layer Controls */}
			<Button
				variant="ghost"
				size="icon"
				onClick={bringForward}
				disabled={!canvas || selectedObjects.length === 0}
				className="h-8 w-8"
				title="Bring Forward"
			>
				<ArrowUp className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onClick={sendBackward}
				disabled={!canvas || selectedObjects.length === 0}
				className="h-8 w-8"
				title="Send Backward"
			>
				<ArrowDown className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onClick={handleGroupSelection}
				disabled={!canvas}
				className="h-8 w-8"
				title="Group Selection"
			>
				<GroupIcon className="h-4 w-4" />
			</Button>

			{/* Separator */}
			<div className="mx-1 h-5 w-px bg-neutral-200" />

			{/* Delete */}
			<Button
				variant="ghost"
				size="icon"
				onClick={deleteSelected}
				disabled={!canvas || selectedObjects.length === 0}
				className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
				title="Delete"
			>
				<Trash2 className="h-4 w-4" />
			</Button>

			{/* Separator */}
			<div className="mx-1 h-5 w-px bg-neutral-200" />

			{/* Inspect Mode Toggle */}
			<Button
				variant={inspectMode ? "secondary" : "ghost"}
				size="sm"
				onClick={toggleInspectMode}
				disabled={!canvas}
				className={`gap-1.5 ${inspectMode ? "bg-pink-100 text-pink-700 hover:bg-pink-200" : ""}`}
				title="Inspect Mode (I)"
			>
				<Scan className="h-4 w-4" />
				<span className="hidden sm:inline">Inspect</span>
			</Button>

			{/* Preview Mode Toggle */}
			<Button
				variant={previewMode ? "secondary" : "ghost"}
				size="sm"
				onClick={togglePreviewMode}
				disabled={!canvas}
				className={`gap-1.5 ${previewMode ? "bg-neutral-900 text-white hover:bg-neutral-800" : ""}`}
				title="Preview Mode (P)"
			>
				<Eye className="h-4 w-4" />
				<span className="hidden sm:inline">Preview</span>
			</Button>
		</div>
	)
}
