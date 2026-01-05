import { defineConfig, devices } from "playwright/test"

const PORT = 3010
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 90_000,
	expect: {
		timeout: 15_000,
	},
	reporter: [["list"], ["html", { open: "never" }]],
	webServer: {
		command: "bun run dev -- --host 127.0.0.1 --strictPort",
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	use: {
		baseURL,
		viewport: { width: 1440, height: 900 },
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
})
