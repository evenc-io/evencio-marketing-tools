import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { generateThumbnailFromJSON } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"
import { selectSlideById, useProjectsStore } from "@/stores/projects-store"
import type { CanvasDimensions } from "@/types/editor"
import { POSTER_DIMENSIONS, SOCIAL_DIMENSIONS } from "@/types/editor"

const MIN_DIMENSION_PX = 100
const MAX_DIMENSION_PX = 6000
const MAX_AREA_PX = 36_000_000
const CUSTOM_LABEL = "Custom"

const customDimensionsSchema = z
	.object({
		width: z
			.number()
			.int("Width must be a whole number")
			.min(MIN_DIMENSION_PX, `Min ${MIN_DIMENSION_PX}px`)
			.max(MAX_DIMENSION_PX, `Max ${MAX_DIMENSION_PX}px`),
		height: z
			.number()
			.int("Height must be a whole number")
			.min(MIN_DIMENSION_PX, `Min ${MIN_DIMENSION_PX}px`)
			.max(MAX_DIMENSION_PX, `Max ${MAX_DIMENSION_PX}px`),
	})
	.refine((data) => data.width * data.height <= MAX_AREA_PX, {
		message: `Max ${Math.round(MAX_AREA_PX / 1_000_000)}MP total area`,
		path: ["width"],
	})

type CustomDimensionsValues = z.infer<typeof customDimensionsSchema>

export function DimensionsPanel() {
	const contentType = useEditorStore((s) => s.contentType)
	const dimensions = useEditorStore((s) => s.dimensions)
	const slideId = useEditorStore((s) => s.slideId)
	const getCanvasJSON = useEditorStore((s) => s.getCanvasJSON)
	const setDimensions = useEditorStore((s) => s.setDimensions)
	const setIsDirty = useEditorStore((s) => s.setIsDirty)

	const updateSlide = useProjectsStore((s) => s.updateSlide)
	const markDirty = useProjectsStore((s) => s.markDirty)
	const currentSlide = useProjectsStore((s) => (slideId ? selectSlideById(s, slideId) : null))

	const presetEntries = useMemo(() => {
		if (contentType === "social-image") {
			return Object.entries(SOCIAL_DIMENSIONS)
		}
		return Object.entries(POSTER_DIMENSIONS).filter(([key]) => key !== "custom")
	}, [contentType])

	const isPresetMatch = useMemo(
		() =>
			presetEntries.some(
				([, dim]) => dim.width === dimensions.width && dim.height === dimensions.height,
			),
		[dimensions.height, dimensions.width, presetEntries],
	)

	const form = useForm<CustomDimensionsValues>({
		resolver: zodResolver(customDimensionsSchema),
		mode: "onChange",
		defaultValues: {
			width: dimensions.width,
			height: dimensions.height,
		},
	})

	useEffect(() => {
		form.reset({ width: dimensions.width, height: dimensions.height })
	}, [dimensions.height, dimensions.width, form])

	const handleSelect = useCallback(
		(dim: CanvasDimensions) => {
			if (dimensions.width === dim.width && dimensions.height === dim.height) return

			const fabricJSON = getCanvasJSON() ?? currentSlide?.fabricJSON ?? null

			if (slideId) {
				void updateSlide(slideId, {
					dimensions: dim,
					...(fabricJSON ? { fabricJSON } : {}),
				})
			}

			if (slideId && fabricJSON) {
				void (async () => {
					const thumbnail = await generateThumbnailFromJSON(fabricJSON, dim.width, dim.height)
					if (!thumbnail) return
					await updateSlide(slideId, { thumbnailDataUrl: thumbnail })
				})()
			}

			setIsDirty(true)
			markDirty()
			setDimensions(dim)
		},
		[
			currentSlide?.fabricJSON,
			dimensions.height,
			dimensions.width,
			getCanvasJSON,
			markDirty,
			setDimensions,
			setIsDirty,
			slideId,
			updateSlide,
		],
	)

	const handleCustomSubmit = useCallback(
		(values: CustomDimensionsValues) => {
			handleSelect({
				width: values.width,
				height: values.height,
				label: CUSTOM_LABEL,
			})
		},
		[handleSelect],
	)

	return (
		<div className="space-y-3">
			{presetEntries.map(([key, dim]) => (
				<button
					key={key}
					type="button"
					onClick={() => handleSelect(dim)}
					className={cn(
						"flex w-full flex-col items-start rounded border px-3 py-2 text-left transition-colors",
						dimensions.width === dim.width && dimensions.height === dim.height
							? "border-neutral-900 bg-neutral-50"
							: "border-neutral-200 hover:border-neutral-300",
					)}
				>
					<span className="text-sm font-medium text-neutral-900">{dim.label}</span>
					<span className="text-xs text-neutral-400">
						{dim.width} × {dim.height}
					</span>
				</button>
			))}

			<form
				onSubmit={form.handleSubmit(handleCustomSubmit)}
				className={cn(
					"rounded border px-3 py-2",
					isPresetMatch ? "border-neutral-200" : "border-neutral-900 bg-neutral-50",
				)}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm font-medium text-neutral-900">{CUSTOM_LABEL}</div>
					<Button type="submit" size="sm" variant="outline" disabled={!form.formState.isValid}>
						Apply
					</Button>
				</div>

				<div className="mt-2 grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<Label
							htmlFor="custom-width"
							className="text-[10px] uppercase tracking-widest text-neutral-400"
						>
							Width (px)
						</Label>
						<Input
							id="custom-width"
							type="number"
							min={MIN_DIMENSION_PX}
							max={MAX_DIMENSION_PX}
							step={1}
							inputMode="numeric"
							className="h-8 text-sm"
							{...form.register("width", { valueAsNumber: true })}
						/>
						{form.formState.errors.width?.message ? (
							<p className="text-[10px] text-red-500">{form.formState.errors.width.message}</p>
						) : null}
					</div>
					<div className="space-y-1">
						<Label
							htmlFor="custom-height"
							className="text-[10px] uppercase tracking-widest text-neutral-400"
						>
							Height (px)
						</Label>
						<Input
							id="custom-height"
							type="number"
							min={MIN_DIMENSION_PX}
							max={MAX_DIMENSION_PX}
							step={1}
							inputMode="numeric"
							className="h-8 text-sm"
							{...form.register("height", { valueAsNumber: true })}
						/>
						{form.formState.errors.height?.message ? (
							<p className="text-[10px] text-red-500">{form.formState.errors.height.message}</p>
						) : null}
					</div>
				</div>

				<p className="mt-2 text-[10px] text-neutral-400">
					Soft lock: max {MAX_DIMENSION_PX}px per side, {Math.round(MAX_AREA_PX / 1_000_000)}
					<span> MP total</span>
				</p>
			</form>
		</div>
	)
}
