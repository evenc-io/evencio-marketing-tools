import { TRUSTED_FONT_PROVIDERS } from "../../../imports"

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

export const PREVIEW_FONT_LINKS = TRUSTED_FONT_PROVIDERS.map(
	(provider) => `<link rel="stylesheet" href="${provider.cssUrl}">`,
).join("\n")

export const PREVIEW_STYLE_SRC = uniqueValues([
	"'unsafe-inline'",
	...TRUSTED_FONT_PROVIDERS.map((provider) => provider.styleSrc),
]).join(" ")

export const PREVIEW_FONT_SRC = uniqueValues([
	"data:",
	...TRUSTED_FONT_PROVIDERS.map((provider) => provider.fontSrc),
]).join(" ")
