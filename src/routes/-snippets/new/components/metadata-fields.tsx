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
import { CollapsibleSection } from "@/routes/-snippets/new/components/collapsible-section"
import { scopeOptions } from "@/routes/-snippets/new/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"

export function MetadataFields({ tagHints }: { tagHints: string[] }) {
	const form = useFormContext<CustomSnippetValues>()
	const attributionRequired = form.watch("attributionRequired")
	const tagHintText = tagHints.length > 0 ? `Existing: ${tagHints.slice(0, 3).join(", ")}` : null

	return (
		<div className="flex flex-col">
			{/* Section 1: Basics - Open by default */}
			<CollapsibleSection title="Basics" defaultOpen>
				<div className="space-y-3">
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Title</FormLabel>
								<FormControl>
									<Input placeholder="Hero Banner" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-neutral-500">Description</FormLabel>
								<FormControl>
									<Input placeholder="Short summary" {...field} />
								</FormControl>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="tags"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Tags</FormLabel>
								<FormControl>
									<Input placeholder="banner, hero, social" {...field} />
								</FormControl>
								<FormDescription className="text-xs">{tagHintText}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</CollapsibleSection>

			{/* Section 2: Visibility - Collapsed by default */}
			<CollapsibleSection title="Visibility">
				<FormField
					control={form.control}
					name="scope"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Scope</FormLabel>
							<FormControl>
								<select
									{...field}
									className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
								>
									{scopeOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</FormControl>
							<FormDescription className="text-xs">
								{scopeOptions.find((option) => option.value === field.value)?.description}
							</FormDescription>
						</FormItem>
					)}
				/>
			</CollapsibleSection>

			{/* Section 3: License - Collapsed by default */}
			<CollapsibleSection title="License">
				<div className="space-y-3">
					<div className="grid gap-2 grid-cols-2">
						<FormField
							control={form.control}
							name="licenseName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="CC BY 4.0" className="h-8" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="licenseId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>ID</FormLabel>
									<FormControl>
										<Input placeholder="cc-by-4" className="h-8" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name="licenseUrl"
						render={({ field }) => (
							<FormItem>
								<FormLabel>URL</FormLabel>
								<FormControl>
									<Input placeholder="https://..." className="h-8" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="attributionRequired"
						render={({ field }) => (
							<FormItem className="flex items-center gap-2 pt-1">
								<FormControl>
									<input
										type="checkbox"
										checked={field.value}
										onChange={(event) => field.onChange(event.target.checked)}
										className="h-4 w-4 rounded border-neutral-300"
									/>
								</FormControl>
								<FormLabel className="text-sm text-neutral-600">Requires attribution</FormLabel>
							</FormItem>
						)}
					/>

					{attributionRequired && (
						<div className="ml-5 space-y-2 border-l-2 border-neutral-200 pl-3">
							<FormField
								control={form.control}
								name="attributionText"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Credit</FormLabel>
										<FormControl>
											<Input placeholder="Author name" className="h-8" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="attributionUrl"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-neutral-500">Credit URL</FormLabel>
										<FormControl>
											<Input placeholder="https://..." className="h-8" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
