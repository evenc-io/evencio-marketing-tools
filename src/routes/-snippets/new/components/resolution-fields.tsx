import { type ChangeEvent, useEffect, useMemo } from "react"
import { useFormContext } from "react-hook-form"
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { clampSnippetViewport, SNIPPET_DIMENSION_LIMITS } from "@/lib/snippets/constraints"
import { DEFAULT_PREVIEW_DIMENSIONS } from "@/lib/snippets/preview-runtime"
import { CollapsibleSection } from "@/routes/-snippets/new/components/collapsible-section"
import { CUSTOM_PRESET_ID, findPreset, RESOLUTION_PRESETS } from "@/routes/-snippets/new/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"

export function ResolutionFields() {
	const form = useFormContext<CustomSnippetValues>()
	const viewportWidth = form.watch("viewportWidth")
	const viewportHeight = form.watch("viewportHeight")
	const viewport = useMemo(
		() => ({
			width: Number.isFinite(viewportWidth) ? viewportWidth : DEFAULT_PREVIEW_DIMENSIONS.width,
			height: Number.isFinite(viewportHeight) ? viewportHeight : DEFAULT_PREVIEW_DIMENSIONS.height,
		}),
		[viewportHeight, viewportWidth],
	)
	const activePreset = findPreset(viewport.width, viewport.height)
	const selectedId = activePreset?.id ?? CUSTOM_PRESET_ID

	useEffect(() => {
		form.setValue("viewportPreset", selectedId, {
			shouldDirty: false,
			shouldValidate: false,
		})
	}, [form, selectedId])

	const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const nextId = event.target.value
		if (nextId === CUSTOM_PRESET_ID) return
		const preset = RESOLUTION_PRESETS.find((item) => item.id === nextId)
		if (!preset) return
		form.setValue("viewportWidth", preset.width, { shouldValidate: true })
		form.setValue("viewportHeight", preset.height, { shouldValidate: true })
	}

	const clampViewport = () => {
		if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return
		const clamped = clampSnippetViewport(viewport)
		if (clamped.width !== viewport.width) {
			form.setValue("viewportWidth", clamped.width, { shouldValidate: true })
		}
		if (clamped.height !== viewport.height) {
			form.setValue("viewportHeight", clamped.height, { shouldValidate: true })
		}
	}

	return (
		<CollapsibleSection title="Resolution">
			<div className="space-y-3">
				<FormField
					control={form.control}
					name="viewportPreset"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Preset</FormLabel>
							<FormControl>
								<select
									{...field}
									value={selectedId}
									onChange={(event) => {
										field.onChange(event)
										handlePresetChange(event)
									}}
									className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
								>
									<option value={CUSTOM_PRESET_ID}>Custom</option>
									{RESOLUTION_PRESETS.map((preset) => (
										<option key={preset.id} value={preset.id}>
											{preset.label} · {preset.width}×{preset.height}
										</option>
									))}
								</select>
							</FormControl>
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="viewportWidth"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-xs text-neutral-500">Width</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={SNIPPET_DIMENSION_LIMITS.min}
										max={SNIPPET_DIMENSION_LIMITS.max}
										step={1}
										inputMode="numeric"
										value={field.value}
										onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
										onBlur={() => {
											field.onBlur()
											clampViewport()
										}}
										className="h-8"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="viewportHeight"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-xs text-neutral-500">Height</FormLabel>
								<FormControl>
									<Input
										type="number"
										min={SNIPPET_DIMENSION_LIMITS.min}
										max={SNIPPET_DIMENSION_LIMITS.max}
										step={1}
										inputMode="numeric"
										value={field.value}
										onChange={(event) => field.onChange(event.currentTarget.valueAsNumber)}
										onBlur={() => {
											field.onBlur()
											clampViewport()
										}}
										className="h-8"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormDescription className="text-[11px] text-neutral-400">
					Limits: {SNIPPET_DIMENSION_LIMITS.min}-{SNIPPET_DIMENSION_LIMITS.max}px per side,{" "}
					{Math.round(SNIPPET_DIMENSION_LIMITS.maxArea / 1_000_000)}MP max
				</FormDescription>
			</div>
		</CollapsibleSection>
	)
}
