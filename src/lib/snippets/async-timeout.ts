/**
 * Wrap a promise with a timeout. Rejects with a `TimeoutError` when the timeout elapses.
 */
export const withTimeout = <T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> => {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return promise
	}
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			const timeoutError = new Error(message)
			timeoutError.name = "TimeoutError"
			reject(timeoutError)
		}, timeoutMs)
		promise.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error) => {
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}
