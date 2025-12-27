import { DEFAULT_LICENSE } from "@/routes/-snippets/new/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"
import { slugify } from "@/routes/-snippets/new/schema"
import type { AssetLicense } from "@/types/asset-library"

export const buildSnippetLicense = (values: CustomSnippetValues): AssetLicense => {
	const licenseName = values.licenseName?.trim() || DEFAULT_LICENSE.name
	const licenseId = values.licenseId?.trim() || slugify(licenseName) || DEFAULT_LICENSE.id
	return {
		id: licenseId,
		name: licenseName,
		url: values.licenseUrl,
		attributionRequired: values.attributionRequired,
	}
}

export const buildSnippetAttribution = (values: CustomSnippetValues) => {
	if (!values.attributionRequired) return null
	const text = values.attributionText?.trim()
	if (!text) return null
	return {
		text,
		url: values.attributionUrl,
	}
}
