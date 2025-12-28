import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nitroPreset =
	process.env.NITRO_PRESET ?? process.env.SERVER_PRESET ?? (process.env.VERCEL ? "vercel" : "bun")

const config = defineConfig({
	server: {
		port: 3000,
	},
	build: {
		chunkSizeWarningLimit: 700,
	},
	resolve: {
		alias: {
			"@/": `${path.resolve(__dirname, "src")}/`,
		},
	},
	plugins: [nitro({ preset: nitroPreset }), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
