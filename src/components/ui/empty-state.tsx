import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
	icon?: ReactNode
	title: string
	description?: string
	action?: ReactNode
	className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center",
				className,
			)}
		>
			{icon && (
				<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-400">
					{icon}
				</div>
			)}
			<div className="space-y-1">
				<h3 className="text-sm font-medium text-neutral-900">{title}</h3>
				{description && <p className="text-sm text-neutral-500">{description}</p>}
			</div>
			{action && <div className="mt-2">{action}</div>}
		</div>
	)
}

export default EmptyState
