import type { CSSProperties } from "react"

interface LaunchHeroProps {
	headline?: string
	accent?: string
}

const baseStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	justifyContent: "space-between",
	width: "100%",
	height: "100%",
	padding: "64px",
	background: "#F8F8F8",
	color: "#111111",
	boxSizing: "border-box",
}

const accentStyle = (accent: string): CSSProperties => ({
	background: accent,
	height: "8px",
	width: "72px",
})

const headlineStyle: CSSProperties = {
	fontFamily: '"Lexend Exa", "Inter", sans-serif',
	fontSize: "56px",
	lineHeight: "1.05",
	letterSpacing: "-0.02em",
	maxWidth: "820px",
}

const metaStyle: CSSProperties = {
	fontFamily: '"Inter", sans-serif',
	fontSize: "18px",
	textTransform: "uppercase",
	letterSpacing: "0.24em",
	color: "#4B5563",
}

export default function LaunchHero({ headline, accent }: LaunchHeroProps) {
	const safeAccent = accent && accent.trim().length > 0 ? accent : "#111111"
	const safeHeadline = headline && headline.trim().length > 0 ? headline : "Evencio Launch Night"

	return (
		<div style={baseStyle}>
			<div style={metaStyle}>Event highlight</div>
			<div style={headlineStyle}>{safeHeadline}</div>
			<div style={accentStyle(safeAccent)} />
		</div>
	)
}
