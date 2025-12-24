import fs from "node:fs/promises"
import path from "node:path"

const CSS_URL =
	"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend+Exa:wght@700&family=Unbounded:wght@400&display=swap"
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const rootDir = process.cwd()
const fontDir = path.join(rootDir, "server/assets/fonts")
const outputFile = path.join(rootDir, "server/lib/snippet-fonts.ts")

const toFileSafe = (value) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")

const fetchCss = async () => {
	const res = await fetch(CSS_URL, {
		headers: {
			"User-Agent": USER_AGENT,
		},
	})
	if (!res.ok) {
		throw new Error(`Failed to fetch font CSS: ${res.status}`)
	}
	return res.text()
}

const parseBlocks = (css) => {
	const blocks = []
	const lines = css.split(/\r?\n/)
	let pendingComment = null
	let current = null

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
			pendingComment = trimmed
			continue
		}
		if (trimmed.startsWith("@font-face")) {
			current = { comment: pendingComment, lines: [line] }
			pendingComment = null
			continue
		}
		if (current) {
			current.lines.push(line)
			if (trimmed.endsWith("}")) {
				blocks.push(current)
				current = null
			}
		}
	}

	return blocks
}

const parseFontMeta = (block) => {
	const joined = block.lines.join("\n")
	const familyMatch = joined.match(/font-family:\s*'([^']+)'/)
	const weightMatch = joined.match(/font-weight:\s*([0-9]+)/)
	const styleMatch = joined.match(/font-style:\s*([^;]+);/)
	const urlMatch = joined.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)

	return {
		family: familyMatch?.[1] ?? "unknown",
		weight: weightMatch?.[1] ?? "400",
		style: styleMatch?.[1] ?? "normal",
		url: urlMatch?.[1] ?? null,
		subset: block.comment ? block.comment.replace(/\//g, "").replace(/\*/g, "").trim() : "",
	}
}

const downloadFont = async (url, filename) => {
	const target = path.join(fontDir, filename)
	try {
		await fs.access(target)
		return target
	} catch {
		// continue
	}
	const res = await fetch(url, {
		headers: {
			"User-Agent": USER_AGENT,
		},
	})
	if (!res.ok) {
		throw new Error(`Failed to download font: ${url}`)
	}
	const buffer = Buffer.from(await res.arrayBuffer())
	await fs.writeFile(target, buffer)
	return target
}

const embedFont = async (block) => {
	const meta = parseFontMeta(block)
	if (!meta.url) {
		return block
	}

	const subsetSlug = meta.subset ? toFileSafe(meta.subset) : "default"
	const familySlug = toFileSafe(meta.family)
	const fileName = `${familySlug}-${meta.weight}-${toFileSafe(meta.style)}-${subsetSlug}.woff2`

	const fontPath = await downloadFont(meta.url, fileName)
	const fontData = await fs.readFile(fontPath)
	const base64 = fontData.toString("base64")
	const dataUrl = `data:font/woff2;base64,${base64}`

	const replaced = block.lines
		.join("\n")
		.replace(/src:\s*url\([^)]+\)\s*format\('woff2'\);/, `src: url(${dataUrl}) format('woff2');`)

	return {
		comment: block.comment,
		lines: replaced.split("\n"),
	}
}

const buildCss = async (blocks) => {
	const embedded = []
	for (const block of blocks) {
		embedded.push(await embedFont(block))
	}

	return embedded
		.map((block) => {
			const comment = block.comment ? `${block.comment}\n` : ""
			return `${comment}${block.lines.join("\n")}`
		})
		.join("\n")
}

const writeOutput = async (css) => {
	const escaped = css.replace(/`/g, "\\`")
	const content = [
		"export const SNIPPET_FONT_CSS = `",
		escaped,
		"`",
		"",
		"export const injectSnippetFonts = (html: string) =>",
		'\thtml.replace("</head>", `<style>${SNIPPET_FONT_CSS}</style></head>`)',
		"",
	].join("\n")
	await fs.writeFile(outputFile, content)
}

await fs.mkdir(fontDir, { recursive: true })
const css = await fetchCss()
const blocks = parseBlocks(css)
const embeddedCss = await buildCss(blocks)
await writeOutput(embeddedCss)
