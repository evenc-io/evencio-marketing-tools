export const nextSelectionToken = (tokenRef: { current: number }) => {
	const token = tokenRef.current + 1
	tokenRef.current = token
	return {
		token,
		isStale: () => tokenRef.current !== token,
	}
}

export const invalidateSelectionToken = (tokenRef: { current: number }) => {
	tokenRef.current += 1
}
