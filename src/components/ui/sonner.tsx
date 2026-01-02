import type * as React from "react"
import { Toaster as Sonner } from "sonner"

import { cn } from "@/lib/utils"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ className, ...props }: ToasterProps) {
	return (
		<Sonner
			className={cn("toaster group", className)}
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:rounded-md group-[.toaster]:border group-[.toaster]:border-neutral-200 group-[.toaster]:bg-white group-[.toaster]:text-neutral-900",
					title: "group-[.toast]:text-sm group-[.toast]:font-medium",
					description: "group-[.toast]:text-xs group-[.toast]:text-neutral-500",
					actionButton:
						"group-[.toast]:bg-neutral-900 group-[.toast]:text-white group-[.toast]:hover:bg-neutral-800 group-[.toast]:hover:text-white",
					cancelButton:
						"group-[.toast]:bg-neutral-100 group-[.toast]:text-neutral-700 group-[.toast]:hover:bg-neutral-200",
					closeButton: "group-[.toast]:text-neutral-400 group-[.toast]:hover:text-neutral-700",
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
