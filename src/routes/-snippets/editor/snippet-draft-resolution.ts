export const normalizeSnippetSourceForComparison = (value: string) =>
	value.replaceAll("\r\n", "\n").trim()

export const isDraftNewerThanAsset = (draftUpdatedAt: string, assetUpdatedAt: string) =>
	new Date(draftUpdatedAt).getTime() > new Date(assetUpdatedAt).getTime()

export const shouldIgnoreDraftForAsset = (options: {
	draftSource: string
	assetSource: string
	starterSource: string
}) => {
	const starter = normalizeSnippetSourceForComparison(options.starterSource)
	const draft = normalizeSnippetSourceForComparison(options.draftSource)
	if (draft !== starter) return false
	const asset = normalizeSnippetSourceForComparison(options.assetSource)
	return asset !== starter
}

export const shouldRestoreDraftForAsset = (options: {
	draftUpdatedAt: string
	assetUpdatedAt: string
	draftSource: string
	assetSource: string
	starterSource: string
}) => {
	if (!isDraftNewerThanAsset(options.draftUpdatedAt, options.assetUpdatedAt)) return false
	return !shouldIgnoreDraftForAsset(options)
}
