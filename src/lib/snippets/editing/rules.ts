import type { SnippetIntrinsicTagRule } from "./types"

const STYLE_CAP_ALL = {
	background: true,
	border: true,
	radius: true,
	spacing: true,
	typography: true,
} as const

const STYLE_CAP_MEDIA = {
	background: true,
	border: true,
	radius: true,
	spacing: true,
	typography: false,
} as const

const INTRINSIC_RULES: SnippetIntrinsicTagRule[] = [
	{ tag: "div", label: "<div>", capabilities: STYLE_CAP_ALL },
	{ tag: "span", label: "<span>", capabilities: STYLE_CAP_ALL },
	{ tag: "p", label: "<p>", capabilities: STYLE_CAP_ALL },
	{ tag: "h1", label: "<h1>", capabilities: STYLE_CAP_ALL },
	{ tag: "h2", label: "<h2>", capabilities: STYLE_CAP_ALL },
	{ tag: "h3", label: "<h3>", capabilities: STYLE_CAP_ALL },
	{ tag: "h4", label: "<h4>", capabilities: STYLE_CAP_ALL },
	{ tag: "h5", label: "<h5>", capabilities: STYLE_CAP_ALL },
	{ tag: "h6", label: "<h6>", capabilities: STYLE_CAP_ALL },
	{ tag: "ul", label: "<ul>", capabilities: STYLE_CAP_ALL },
	{ tag: "ol", label: "<ol>", capabilities: STYLE_CAP_ALL },
	{ tag: "li", label: "<li>", capabilities: STYLE_CAP_ALL },
	{ tag: "img", label: "<img>", capabilities: STYLE_CAP_MEDIA },
]

const RULES_BY_TAG = new Map(INTRINSIC_RULES.map((rule) => [rule.tag, rule]))

export const getSnippetIntrinsicTagRule = (tag: string): SnippetIntrinsicTagRule | null =>
	RULES_BY_TAG.get(tag) ?? null

export const isSnippetIntrinsicTag = (elementName: string | null | undefined): boolean => {
	if (!elementName) return false
	if (elementName.toLowerCase() !== elementName) return false
	return RULES_BY_TAG.has(elementName)
}
