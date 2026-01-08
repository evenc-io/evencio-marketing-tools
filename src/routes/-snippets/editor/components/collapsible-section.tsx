import { ChevronDown } from "lucide-react"
import { type ReactNode, useState } from "react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
	title: string
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
	children: ReactNode
}

export function CollapsibleSection({
	title,
	defaultOpen = false,
	open,
	onOpenChange,
	children,
}: CollapsibleSectionProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
	const isControlled = typeof open === "boolean"
	const isOpen = isControlled ? open : uncontrolledOpen

	return (
		<div className="border-b border-neutral-200">
			<button
				type="button"
				onClick={() => {
					const next = !isOpen
					if (!isControlled) {
						setUncontrolledOpen(next)
					}
					onOpenChange?.(next)
				}}
				className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-neutral-100"
			>
				<span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
					{title}
				</span>
				<ChevronDown
					className={cn("h-4 w-4 text-neutral-400 transition-transform", isOpen && "rotate-180")}
				/>
			</button>
			{isOpen && <div className="px-4 pb-4 pt-2">{children}</div>}
		</div>
	)
}
