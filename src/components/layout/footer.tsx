import { cn } from "@/lib/utils"

interface FooterProps {
	className?: string
}

export function Footer({ className }: FooterProps) {
	return (
		<footer className={cn("border-t border-neutral-200 bg-white", className)}>
			<div className="mx-auto flex max-w-7xl items-center justify-center px-6 py-6">
				<p className="text-xs text-neutral-500">
					Created by{" "}
					<a
						href="https://mskiy.dev"
						target="_blank"
						rel="noreferrer"
						className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-700"
					>
						Yan Malinovskiy
					</a>
				</p>
			</div>
		</footer>
	)
}

export default Footer
