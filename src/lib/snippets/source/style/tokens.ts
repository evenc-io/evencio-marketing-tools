export const splitVariants = (value: string) => {
	let bracketDepth = 0
	let lastColon = -1
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index]
		if (char === "[") bracketDepth += 1
		if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1)
		if (char === ":" && bracketDepth === 0) lastColon = index
	}
	return lastColon >= 0 ? value.slice(lastColon + 1) : value
}

export const isBaseToken = (token: string) => splitVariants(token) === token

export const stripImportantPrefix = (value: string) => {
	let next = value
	while (next.startsWith("!")) {
		next = next.slice(1)
	}
	return next
}

export const getUtility = (token: string) => stripImportantPrefix(splitVariants(token))
