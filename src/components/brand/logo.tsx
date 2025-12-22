import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

type LogoSize = "xs" | "sm" | "md" | "lg"
type LogoVariant = "dark" | "light"

interface LogoProps {
	size?: LogoSize
	variant?: LogoVariant
	showWordmark?: boolean
	href?: string
	className?: string
}

const sizeConfig: Record<LogoSize, { icon: number; fontSize: string; gap: string }> = {
	xs: { icon: 20, fontSize: "text-base", gap: "gap-1.5" },
	sm: { icon: 24, fontSize: "text-lg", gap: "gap-2" },
	md: { icon: 28, fontSize: "text-xl", gap: "gap-2.5" },
	lg: { icon: 36, fontSize: "text-2xl", gap: "gap-3" },
}

function LogoContent({
	size = "sm",
	variant = "dark",
	showWordmark = true,
	className,
}: Omit<LogoProps, "href">) {
	const config = sizeConfig[size]
	const isLight = variant === "light"

	return (
		<span className={cn("inline-flex items-baseline", config.gap, className)}>
			{/* SVG Logo Mark - The Evencio "E" with Dynamic Key */}
			<svg
				viewBox="0 0 100 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				width={config.icon}
				height={config.icon}
				aria-hidden="true"
				className="shrink-0 self-center"
			>
				{/* The Spine (bracket-shaped E frame) - Platform structure */}
				<path
					d="M15 10H85V35H40V65H85V90H15V10Z"
					className={isLight ? "fill-white" : "fill-neutral-950"}
				/>
				{/* The Dynamic Key (blue square) - Event indicator */}
				<rect x="65" y="40" width="20" height="20" fill="#0044FF" />
			</svg>

			{/* Wordmark - Unbounded font */}
			{showWordmark && (
				<span
					className={cn(
						"font-unbounded font-normal tracking-[-0.02em] uppercase",
						config.fontSize,
						isLight ? "text-white" : "text-neutral-950",
					)}
				>
					EVENCIO
				</span>
			)}
		</span>
	)
}

export function Logo({ href, ...props }: LogoProps) {
	if (href) {
		return (
			<Link to={href} className="transition-opacity hover:opacity-80">
				<LogoContent {...props} />
			</Link>
		)
	}

	return <LogoContent {...props} />
}

export default Logo
