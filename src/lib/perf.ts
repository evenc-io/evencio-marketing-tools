export type PerfSample = {
	label: string
	iterations: number
	durationMs: number
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())

/**
 * Measure how long it takes to run `fn` N times (awaiting each iteration).
 */
export const measure = async (
	label: string,
	iterations: number,
	fn: () => void | Promise<void>,
): Promise<PerfSample> => {
	const start = now()
	for (let i = 0; i < iterations; i += 1) {
		await fn()
	}
	const end = now()
	return { label, iterations, durationMs: end - start }
}

/**
 * Format a perf sample as a single human-readable line.
 */
export const formatSample = (sample: PerfSample) =>
	`${sample.label}: ${sample.durationMs.toFixed(2)}ms (${sample.iterations} runs)`
