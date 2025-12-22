import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DEFAULT_BLEED_MM, DEFAULT_BLEED_PX } from "@/lib/constants/canvas"
import { downloadBlob, exportCanvas, getFilename } from "@/lib/export"
import { useEditorStore } from "@/stores/editor-store"
import type { ExportFormat } from "@/types/editor"

export function ExportPanel() {
	const { canvas, contentType, dimensions, isExporting, setIsExporting } = useEditorStore()
	const [scale, setScale] = useState(1)
	const [includeBleed, setIncludeBleed] = useState(false)

	const isPoster = contentType === "poster"
	const bleedEnabled = isPoster && includeBleed
	const bleedPx = bleedEnabled ? DEFAULT_BLEED_PX : 0
	const exportWidth = dimensions.width + bleedPx * 2
	const exportHeight = dimensions.height + bleedPx * 2

	const handleExport = async (format: ExportFormat) => {
		if (!canvas) return

		setIsExporting(true)

		try {
			const blob = await exportCanvas(canvas, dimensions, {
				format,
				quality: 0.92,
				scale,
				includeBleed: bleedEnabled,
			})

			const filename = getFilename(bleedEnabled ? "evencio-design-bleed" : "evencio-design", format)
			downloadBlob(blob, filename)
		} catch (error) {
			console.error("Export failed:", error)
		} finally {
			setIsExporting(false)
		}
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label className="text-xs text-neutral-500">Resolution Scale</Label>
				<Tabs defaultValue="1" onValueChange={(v) => setScale(Number.parseFloat(v))}>
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="1">1x</TabsTrigger>
						<TabsTrigger value="2">2x</TabsTrigger>
						<TabsTrigger value="3">3x</TabsTrigger>
					</TabsList>
				</Tabs>
				<p className="text-xs text-neutral-400">
					{exportWidth * scale} × {exportHeight * scale} px
				</p>
			</div>

			{isPoster && (
				<div className="space-y-2">
					<Label className="text-xs text-neutral-500">Bleed</Label>
					<Tabs
						onValueChange={(value) => setIncludeBleed(value === "bleed")}
						value={bleedEnabled ? "bleed" : "trim"}
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="trim">Trim</TabsTrigger>
							<TabsTrigger value="bleed">+ {DEFAULT_BLEED_MM}mm</TabsTrigger>
						</TabsList>
					</Tabs>
					<p className="text-xs text-neutral-400">Default export trims to the artboard.</p>
				</div>
			)}

			<div className="space-y-2">
				<Label className="text-xs text-neutral-500">Format</Label>
				<div className="grid grid-cols-3 gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleExport("png")}
						disabled={!canvas || isExporting}
					>
						PNG
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleExport("jpeg")}
						disabled={!canvas || isExporting}
					>
						JPEG
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleExport("pdf")}
						disabled={!canvas || isExporting}
					>
						PDF
					</Button>
				</div>
			</div>
		</div>
	)
}
