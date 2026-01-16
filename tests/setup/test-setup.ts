import "fake-indexeddb/auto"
import { afterEach, expect } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()

// @testing-library/react tries to integrate with Jest fake timers when a global
// `jest` object exists. Bun's test runner can expose a Jest-compatible global,
// but we use `vi` and real timers here; leaving `jest` defined can make
// Testing Library call `jest.advanceTimersByTime(0)` and crash.
//
// Bun's environment can expose a `jest` global, and Happy DOM's timer shim
// includes a `setTimeout.clock` property (from fake-timers). @testing-library/react
// interprets that as "Jest fake timers are enabled" and then calls
// `jest.advanceTimersByTime(0)`, which Bun throws on unless fake timers were
// explicitly activated.
//
// Fix: keep real timers by removing the `clock` marker used by fake timers.
// This makes Testing Library skip the Jest timers path.
if (Object.hasOwn(globalThis.setTimeout, "clock")) {
	try {
		delete (globalThis.setTimeout as unknown as { clock?: unknown }).clock
	} catch {
		;(globalThis.setTimeout as unknown as { clock?: unknown }).clock = undefined
	}
}

const [{ cleanup, configure }, matchers] = await Promise.all([
	import("@testing-library/react"),
	import("@testing-library/jest-dom/matchers"),
])

const drainMicrotasks = async (): Promise<void> => {
	await new Promise<void>((resolve) => {
		if (typeof queueMicrotask === "function") {
			queueMicrotask(resolve)
			return
		}
		Promise.resolve().then(resolve)
	})
}

// @testing-library/react's default `asyncWrapper` attempts to integrate with
// Jest fake timers if it detects them, but in Bun + Happy DOM that detection
// can be triggered even when fake timers are not active. Overriding the wrapper
// avoids calling `jest.advanceTimersByTime(0)` while preserving the microtask
// drain behavior relied on by `waitFor`.
configure({
	asyncWrapper: async (cb) => {
		const result = await cb()
		await drainMicrotasks()
		await drainMicrotasks()
		return result
	},
})

const jestDomMatchers = "default" in matchers ? matchers.default : matchers
expect.extend(jestDomMatchers as Parameters<typeof expect.extend>[0])

afterEach(() => {
	cleanup()
})
