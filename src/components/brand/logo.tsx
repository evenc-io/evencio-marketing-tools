import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

type LogoSize = "xs" | "sm" | "md" | "lg"
type LogoVariant = "dark" | "light"

interface LogoProps {
	size?: LogoSize
	variant?: LogoVariant
	showWordmark?: boolean
	animateOnHover?: boolean
	href?: string
	className?: string
}

const sizeConfig: Record<
	LogoSize,
	{ icon: number; fontSize: string; gap: string; wordmarkWidth: number }
> = {
	xs: { icon: 20, fontSize: "text-base", gap: "gap-1.5", wordmarkWidth: 80 },
	sm: { icon: 24, fontSize: "text-lg", gap: "gap-2", wordmarkWidth: 96 },
	md: { icon: 28, fontSize: "text-xl", gap: "gap-2.5", wordmarkWidth: 115 },
	lg: { icon: 36, fontSize: "text-2xl", gap: "gap-3", wordmarkWidth: 145 },
}

const WORDMARK = "EVENCIO"
const WORDMARK_CHARS = WORDMARK.split("").map((char, index) => ({
	char,
	id: `wordmark-${index}`,
}))

function LogoContent({
	size = "sm",
	variant = "dark",
	showWordmark = true,
	animateOnHover = false,
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
			{showWordmark && !animateOnHover && (
				<span
					className={cn(
						"font-unbounded font-normal tracking-[-0.02em] uppercase whitespace-nowrap",
						config.fontSize,
						isLight ? "text-white" : "text-neutral-950",
					)}
				>
					{WORDMARK}
				</span>
			)}

			{/* Animated Wordmark - smooth expand effect */}
			{showWordmark && animateOnHover && (
				<span
					className="relative flex items-baseline overflow-hidden w-0 group-hover/logo:w-[var(--wordmark-w)] transition-[width] duration-300 ease-out"
					style={{ "--wordmark-w": `${config.wordmarkWidth}px` } as React.CSSProperties}
				>
					<span className="sr-only">{WORDMARK}</span>
					<span
						className={cn(
							"font-unbounded font-normal tracking-[-0.02em] uppercase whitespace-nowrap flex",
							config.fontSize,
							isLight ? "text-white" : "text-neutral-950",
						)}
						aria-hidden="true"
					>
						{WORDMARK_CHARS.map(({ char, id }, index) => (
							<span
								key={id}
								className={cn(
									"inline-block transition-all duration-100 ease-out",
									"opacity-0 group-hover/logo:opacity-100",
								)}
								style={{
									transitionDelay: `${50 + index * 30}ms`,
								}}
								aria-hidden="true"
							>
								{char}
							</span>
						))}
					</span>
				</span>
			)}
		</span>
	)
}

export function Logo({ href, animateOnHover, ...props }: LogoProps) {
	if (href) {
		return (
			<Link to={href} className={cn(animateOnHover && "group/logo")}>
				<LogoContent {...props} animateOnHover={animateOnHover} />
			</Link>
		)
	}

	return (
		<span className={animateOnHover ? "group/logo" : undefined}>
			<LogoContent {...props} animateOnHover={animateOnHover} />
		</span>
	)
}

export default Logo
