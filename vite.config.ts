import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nitroPreset =
	process.env.NITRO_PRESET ?? process.env.SERVER_PRESET ?? (process.env.VERCEL ? "vercel" : "bun")

const vendorChunks = (id: string) => {
	if (!id.includes("node_modules")) return undefined
	if (id.includes("node_modules/monaco-editor/")) return "monaco"
	if (id.includes("esbuild-wasm")) return "esbuild"
	if (id.includes("html2canvas")) return "html2canvas"
	if (id.includes("jspdf")) return "jspdf"
	if (id.includes("sortablejs")) return "sortable"
	if (id.includes("dompurify")) return "dompurify"
	if (id.includes("@babel/parser")) return "babel"
	return undefined
}

type ZodFunctionSchemaLike = {
	output?: (schema: unknown) => unknown
	returns?: (schema: unknown) => unknown
}

const ensureZodFunctionReturns = async () => {
	const zodModule = await import("zod")
	const z =
		(zodModule as { z?: unknown }).z ?? (zodModule as { default?: unknown }).default ?? zodModule
	const ZodFunction = (z as { ZodFunction?: { prototype?: ZodFunctionSchemaLike } }).ZodFunction
	if (!ZodFunction?.prototype) return
	if (typeof ZodFunction.prototype.returns === "function") return

	// Patch zod v4 to expose v3-style .returns for tanstack router generator.
	Object.defineProperty(ZodFunction.prototype, "returns", {
		value(schema: unknown) {
			const instance = this as ZodFunctionSchemaLike
			if (typeof instance.output === "function") {
				return instance.output(schema)
			}
			return this
		},
	})
}

await ensureZodFunctionReturns()
const { tanstackStart } = await import("@tanstack/react-start/plugin/vite")

const config = defineConfig({
	server: {
		port: 3000,
	},
	build: {
		chunkSizeWarningLimit: 700,
		rollupOptions: {
			output: {
				manualChunks: vendorChunks,
			},
		},
	},
	worker: {
		format: "es",
	},
	resolve: {
		alias: {
			"@/": `${path.resolve(__dirname, "src")}/`,
		},
	},
	plugins: [nitro({ preset: nitroPreset }), tailwindcss(), ...tanstackStart(), viteReact()],
})

export default config
