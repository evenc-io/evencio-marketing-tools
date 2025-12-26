import "fake-indexeddb/auto"
import { afterEach, expect } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()

const [{ cleanup }, matchers] = await Promise.all([
	import("@testing-library/react"),
	import("@testing-library/jest-dom/matchers"),
])

const jestDomMatchers = "default" in matchers ? matchers.default : matchers
expect.extend(jestDomMatchers as Parameters<typeof expect.extend>[0])

afterEach(() => {
	cleanup()
})
