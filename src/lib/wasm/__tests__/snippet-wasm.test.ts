import { describe, expect, test } from "bun:test"
import { analyzeSnippetInEngine } from "@/lib/engine/client"
import { formatSample, measure } from "@/lib/perf"
import { SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import { buildSnippetInspectIndex } from "@/lib/snippets/inspect-index"
import { scanSnippetFilesSync } from "@/lib/snippets/source-files"
import { analyzeSnippetSource } from "@/lib/snippets/source-security"
import { extractTailwindCandidatesFromSource } from "@/lib/snippets/tailwind"
import { SNIPPET_TEMPLATES } from "@/lib/snippets/templates"
import {
	buildSnippetInspectIndexWasm,
	hashSourceWasm,
	scanAutoImportOffsetWasmSync,
	scanExportNamesWasmSync,
	scanPrimaryExportNameWasmSync,
	scanSnippetFilesWasm,
	scanSnippetSecurityIssuesWasm,
	scanTailwindCandidatesWasm,
	stripAutoImportBlockWasmSync,
	stripSnippetFileDirectivesWasmSync,
	warmSnippetWasm,
} from "@/lib/wasm/snippet-wasm"

const normalize = (value: string[]) => value.slice().sort()

const stripSnippetFileDirectivesJs = (source: string) =>
	source
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^(\s*\/\/\s*@snippet-file(\s|$))/.test(line) &&
				!/^(\s*\/\/\s*@snippet-file-end\s*)$/.test(line),
		)
		.join("\n")

const stripAutoImportBlockJs = (source: string) => {
	const lines = stripSnippetFileDirectivesJs(source).split(/\r?\n/)
	let index = 0
	let sawImport = false
	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}
	return lines.slice(index).join("\n")
}

const scanPrimaryExportNameJs = (source: string) => {
	const match = source.match(/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/m)
	return match?.[1] ?? null
}

const scanExportNamesJs = (source: string) => {
	const matches = source.matchAll(
		/^\s*export\s+(?:const|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
	)
	const names = new Set<string>()
	for (const match of matches) {
		const name = match[1]
		if (name) names.add(name)
	}
	return [...names]
}

const scanAutoImportOffsetJs = (source: string) => {
	const lines = source.split(/\r?\n/)
	let index = 0
	let sawImport = false
	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}
	return index
}

describe("snippet wasm tailwind scanner", () => {
	test("extracts class candidates from static JSX", async () => {
		const source = `
      export default function Demo() {
        return (
          <div className="p-4 text-center">
            <span className={'bg-blue-500 text-white'} />
            <section className={"flex " + "items-center"} />
            <p className={\`mt-2 mb-4\`}>Hello</p>
            <div class="grid gap-2" />
            <div className={condition ? "skip" : "me"} />
          </div>
        )
      }
    `

		const result = await scanTailwindCandidatesWasm(source)
		expect(result).not.toBeNull()
		const candidates = normalize(result ?? [])
		expect(candidates).toEqual(
			normalize([
				"p-4",
				"text-center",
				"bg-blue-500",
				"text-white",
				"flex",
				"items-center",
				"mt-2",
				"mb-4",
				"grid",
				"gap-2",
			]),
		)
	})

	test("dedupes candidates", async () => {
		const source = `<div className="p-4 p-4 text-center" />`
		const result = await scanTailwindCandidatesWasm(source)
		expect(result).not.toBeNull()
		const candidates = normalize(result ?? [])
		expect(candidates).toEqual(normalize(["p-4", "text-center"]))
	})

	test("perf scan (optional)", async () => {
		if (!process.env.PERF_WASM) return
		const source = `<div className="p-4 text-center bg-blue-500 border border-neutral-200" />`
		const sample = await measure("scanTailwindCandidatesWasm", 200, async () => {
			await scanTailwindCandidatesWasm(source)
		})
		// eslint-disable-next-line no-console
		console.info(formatSample(sample))
		expect(sample.durationMs).toBeGreaterThan(0)
	})
})

const normalizeIssues = (issues: Awaited<ReturnType<typeof analyzeSnippetSource>>) =>
	issues
		.map((issue) => ({
			message: issue.message,
			line: issue.line,
			column: issue.column,
		}))
		.sort((a, b) => {
			if (a.message !== b.message) return a.message.localeCompare(b.message)
			if (a.line !== b.line) return a.line - b.line
			return a.column - b.column
		})

describe("snippet wasm security scanner", () => {
	test("matches JS scanner for common patterns", async () => {
		const source = `
      import React from "react"
      import fs from "fs"

      export const Demo = () => {
        fetch("/api")
        window.fetch("/bad")
        require("react-dom")
        new Worker("x")
        return <div>Hello</div>
      }
    `

		const jsIssues = await analyzeSnippetSource(source)
		const wasmIssues = await scanSnippetSecurityIssuesWasm(source)
		expect(wasmIssues).not.toBeNull()
		expect(normalizeIssues(wasmIssues ?? [])).toEqual(normalizeIssues(jsIssues))
	})
})

type InspectIndex = NonNullable<ReturnType<typeof buildSnippetInspectIndex>>

const normalizeElementNames = (elements: InspectIndex["elements"]) =>
	elements
		.map((entry) => `${entry.elementType}:${entry.elementName ?? ""}`)
		.sort((a, b) => a.localeCompare(b))

describe("snippet wasm inspect index", () => {
	test("builds element index for JSX", async () => {
		const source = `
      export default function Demo() {
        return (
          <section>
            <h1>Hello</h1>
            <div>{"World"}</div>
            <>
              <span>Inner</span>
            </>
          </section>
        )
      }
    `

		const jsIndex = buildSnippetInspectIndex(source)
		const wasmIndex = await buildSnippetInspectIndexWasm(source)
		expect(wasmIndex).not.toBeNull()
		expect(jsIndex).not.toBeNull()
		expect(normalizeElementNames(wasmIndex?.elements ?? [])).toEqual(
			normalizeElementNames(jsIndex?.elements ?? []),
		)
	})
})

describe("snippet wasm file scanner", () => {
	test("matches JS scanner for snippet-file blocks", async () => {
		const source = SNIPPET_TEMPLATES.multi.source
		const jsResult = scanSnippetFilesSync(source)
		const wasmResult = await scanSnippetFilesWasm(source)
		expect(wasmResult).not.toBeNull()
		if (!wasmResult) {
			throw new Error("Snippet file WASM result missing.")
		}

		expect(wasmResult.mainSource).toBe(jsResult.mainSource)
		expect(wasmResult.files).toEqual(jsResult.files)
		expect(wasmResult.fileOrder).toEqual(jsResult.fileOrder)
		expect(wasmResult.expandedSource).toBe(jsResult.expandedSource)
		expect(wasmResult.lineMapSegments).toEqual(jsResult.lineMapSegments)
		expect(wasmResult.hasFileBlocks).toBe(true)
	})
})

describe("snippet wasm header scanners", () => {
	test("matches JS helpers for import blocks and exports", async () => {
		await warmSnippetWasm()
		const source = `// Auto-managed imports (do not edit).
// @import Button.tsx

export const Alpha = () => null
export function Beta() {
  return null
}
export class Gamma {}
export default function Delta() {
  return null
}

// @snippet-file Button.tsx
export const Button = () => <button />
// @snippet-file-end
`

		const wasmStripDirectives = stripSnippetFileDirectivesWasmSync(source)
		if (wasmStripDirectives === undefined) {
			throw new Error("Snippet WASM strip directives unavailable.")
		}
		expect(wasmStripDirectives).toBe(stripSnippetFileDirectivesJs(source))

		const wasmStripImports = stripAutoImportBlockWasmSync(source)
		if (wasmStripImports === undefined) {
			throw new Error("Snippet WASM strip imports unavailable.")
		}
		expect(wasmStripImports).toBe(stripAutoImportBlockJs(source))

		const wasmPrimary = scanPrimaryExportNameWasmSync(source)
		if (wasmPrimary === undefined) {
			throw new Error("Snippet WASM primary export unavailable.")
		}
		expect(wasmPrimary).toBe(scanPrimaryExportNameJs(source))

		const wasmNames = scanExportNamesWasmSync(source)
		if (wasmNames === undefined) {
			throw new Error("Snippet WASM export names unavailable.")
		}
		expect(wasmNames).toEqual(scanExportNamesJs(source))

		const wasmOffset = scanAutoImportOffsetWasmSync(source)
		if (wasmOffset === undefined) {
			throw new Error("Snippet WASM auto import offset unavailable.")
		}
		expect(wasmOffset).toBe(scanAutoImportOffsetJs(source))
	})
})

const repeat = (value: string, count: number) =>
	Array.from({ length: count }, () => value).join("\n")

const baseChunk = `
  <div className="p-4 text-center bg-blue-500 border border-neutral-200">
    <span className={'text-sm font-medium'} />
    <section className={"flex " + "items-center justify-between"} />
    <p className={\`mt-2 mb-4\`}>Hello</p>
    <div class="grid gap-2" />
    <div className={condition ? "skip" : "me"} />
  </div>
`

const buildSource = (chunk: string, count: number) => `
export default function Demo() {
  return (
    <section>
${repeat(chunk, count)}
    </section>
  )
}
`

const mediumSource = buildSource(baseChunk, 40)
const heavySource = buildSource(baseChunk, 120)

const autoImportHeader = `// Auto-managed imports (do not edit).
// @import Button.tsx
// @import Card.tsx

`

const buildExportBlock = (count: number) =>
	Array.from({ length: count }, (_, index) => `export const Widget${index} = () => <div />`).join(
		"\n",
	)

const buildHeaderSource = (exportCount: number, chunkRepeats: number) => {
	const exports = buildExportBlock(exportCount)
	const repeated = repeat(baseChunk, chunkRepeats)
	const fileBlock = `// @snippet-file Widget.tsx
export const Widget = () => <div />
// @snippet-file-end`
	return `${autoImportHeader}${exports}\n${repeated}\n${fileBlock}\n`
}

const mediumHeaderSource = buildHeaderSource(24, 30)
const heavyHeaderSource = buildHeaderSource(120, 90)

const templateSources = Object.values(SNIPPET_TEMPLATES).map((template) => template.source)
const exampleSources = SNIPPET_EXAMPLES.map((example) => example.source)
const realSnippetSources = [...templateSources, ...exampleSources].filter(
	(source) => source.trim().length > 0,
)

const pickSnippetSources = (count: number) => {
	if (realSnippetSources.length === 0) return [""]
	return Array.from(
		{ length: count },
		(_, index) => realSnippetSources[index % realSnippetSources.length],
	)
}

const buildLargeSnippetSources = (sources: string[], repeats: number, variants: number) => {
	const normalized = sources.map((source) => source.trim()).filter(Boolean)
	if (normalized.length === 0) return [""]
	const combined = Array.from(
		{ length: repeats },
		(_, index) => normalized[index % normalized.length],
	).join("\n\n")
	return Array.from({ length: variants }, (_, index) => `${combined}\n// seed:${index}`)
}

const mediumFileSources = pickSnippetSources(6)
const heavyFileSources = buildLargeSnippetSources(pickSnippetSources(6), 2, 6)
const largeFileSources = buildLargeSnippetSources(pickSnippetSources(8), 4, 4)

const hashSourceJs = (value: string) => {
	let hash = 0x811c9dc5
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

const requireWasm = <T>(value: T | undefined, label: string): T => {
	if (value === undefined) {
		throw new Error(`Snippet WASM ${label} unavailable.`)
	}
	return value
}

const benchPair = async (
	label: string,
	iterations: number,
	wasmFn: () => Promise<void>,
	jsFn: () => Promise<void>,
) => {
	const wasmSample = await measure(`${label}: wasm`, iterations, wasmFn)
	const jsSample = await measure(`${label}: js`, iterations, jsFn)
	const ratio = jsSample.durationMs / Math.max(0.01, wasmSample.durationMs)
	// eslint-disable-next-line no-console
	console.info(
		`[bench] ${label}: wasm ${wasmSample.durationMs.toFixed(2)}ms vs js ${jsSample.durationMs.toFixed(
			2,
		)}ms (${ratio.toFixed(2)}x)`,
	)
	return { wasmSample, jsSample, ratio }
}

const createSourceCycler = (sources: string[]) => {
	let index = 0
	return () => {
		const source = sources[index % sources.length]
		index += 1
		return source
	}
}

const benchSnippetFiles = async (label: string, iterations: number, sources: string[]) => {
	const wasmNext = createSourceCycler(sources)
	const jsNext = createSourceCycler(sources)

	return benchPair(
		label,
		iterations,
		async () => {
			const source = wasmNext()
			const result = await scanSnippetFilesWasm(source)
			if (!result) throw new Error("Snippet file WASM result missing.")
		},
		async () => {
			const source = jsNext()
			scanSnippetFilesSync(source)
		},
	)
}

const benchWorkerRoundtrip = async (label: string, iterations: number, source: string) => {
	await analyzeSnippetInEngine(source, {
		includeInspect: false,
		includeTailwind: false,
		key: `bench-warm-${label}`,
	})
	const start = performance.now()
	for (let i = 0; i < iterations; i += 1) {
		await analyzeSnippetInEngine(source, {
			includeInspect: false,
			includeTailwind: false,
			key: `bench-${label}-${i}`,
		})
	}
	const duration = performance.now() - start
	// eslint-disable-next-line no-console
	console.info(
		`[bench] ${label} worker roundtrip: ${duration.toFixed(2)}ms for ${iterations} iters (${(
			duration / iterations
		).toFixed(2)}ms/iter)`,
	)
	return duration
}

describe("snippet wasm benchmarks", () => {
	test("benchmarks zig vs ts (logs timings)", async () => {
		if (!process.env.PERF_WASM) return
		await warmSnippetWasm()

		const wasmScan = async (source: string) => {
			const result = await scanTailwindCandidatesWasm(source)
			expect(result).not.toBeNull()
		}

		const jsScan = async (source: string) => {
			await extractTailwindCandidatesFromSource(source)
		}

		const wasmHash = async (source: string) => {
			const result = await hashSourceWasm(source)
			expect(result).not.toBeNull()
		}

		const jsHash = async (source: string) => {
			hashSourceJs(source)
		}

		const wasmSecurity = async (source: string) => {
			const result = await scanSnippetSecurityIssuesWasm(source)
			expect(result).not.toBeNull()
		}

		const jsSecurity = async (source: string) => {
			await analyzeSnippetSource(source)
		}

		const wasmInspect = async (source: string) => {
			const result = await buildSnippetInspectIndexWasm(source)
			expect(result).not.toBeNull()
		}

		const jsInspect = async (source: string) => {
			buildSnippetInspectIndex(source)
		}

		const wasmStripDirectives = async (source: string) => {
			requireWasm(stripSnippetFileDirectivesWasmSync(source), "strip directives")
		}

		const jsStripDirectives = async (source: string) => {
			stripSnippetFileDirectivesJs(source)
		}

		const wasmStripImports = async (source: string) => {
			requireWasm(stripAutoImportBlockWasmSync(source), "strip auto imports")
		}

		const jsStripImports = async (source: string) => {
			stripAutoImportBlockJs(source)
		}

		const wasmPrimaryExport = async (source: string) => {
			requireWasm(scanPrimaryExportNameWasmSync(source), "primary export")
		}

		const jsPrimaryExport = async (source: string) => {
			scanPrimaryExportNameJs(source)
		}

		const wasmExportNames = async (source: string) => {
			requireWasm(scanExportNamesWasmSync(source), "export names")
		}

		const jsExportNames = async (source: string) => {
			scanExportNamesJs(source)
		}

		const wasmAutoImportOffset = async (source: string) => {
			requireWasm(scanAutoImportOffsetWasmSync(source), "auto import offset")
		}

		const jsAutoImportOffset = async (source: string) => {
			scanAutoImportOffsetJs(source)
		}

		const mediumScan = await benchPair(
			"medium scan",
			20,
			() => wasmScan(mediumSource),
			() => jsScan(mediumSource),
		)
		expect(mediumScan.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumHash = await benchPair(
			"medium hash",
			200,
			() => wasmHash(mediumSource),
			() => jsHash(mediumSource),
		)
		expect(mediumHash.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumCombined = await benchPair(
			"medium combined",
			10,
			async () => {
				await wasmScan(mediumSource)
				await wasmHash(mediumSource)
			},
			async () => {
				await jsScan(mediumSource)
				await jsHash(mediumSource)
			},
		)
		expect(mediumCombined.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumSecurity = await benchPair(
			"medium security scan",
			12,
			() => wasmSecurity(mediumSource),
			() => jsSecurity(mediumSource),
		)
		expect(mediumSecurity.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumInspect = await benchPair(
			"medium inspect index",
			12,
			() => wasmInspect(mediumSource),
			() => jsInspect(mediumSource),
		)
		expect(mediumInspect.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumFiles = await benchSnippetFiles("medium snippet files", 10, mediumFileSources)
		expect(mediumFiles.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumStripDirectives = await benchPair(
			"medium strip directives",
			40,
			() => wasmStripDirectives(mediumHeaderSource),
			() => jsStripDirectives(mediumHeaderSource),
		)
		expect(mediumStripDirectives.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumStripImports = await benchPair(
			"medium strip auto imports",
			40,
			() => wasmStripImports(mediumHeaderSource),
			() => jsStripImports(mediumHeaderSource),
		)
		expect(mediumStripImports.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumExportNames = await benchPair(
			"medium export names",
			60,
			() => wasmExportNames(mediumHeaderSource),
			() => jsExportNames(mediumHeaderSource),
		)
		expect(mediumExportNames.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumPrimaryExport = await benchPair(
			"medium primary export",
			120,
			() => wasmPrimaryExport(mediumHeaderSource),
			() => jsPrimaryExport(mediumHeaderSource),
		)
		expect(mediumPrimaryExport.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumImportOffset = await benchPair(
			"medium import offset",
			240,
			() => wasmAutoImportOffset(mediumHeaderSource),
			() => jsAutoImportOffset(mediumHeaderSource),
		)
		expect(mediumImportOffset.wasmSample.durationMs).toBeGreaterThan(0)

		await benchWorkerRoundtrip("medium", 20, mediumSource)

		const heavyScan = await benchPair(
			"heavy scan",
			10,
			() => wasmScan(heavySource),
			() => jsScan(heavySource),
		)
		expect(heavyScan.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyHash = await benchPair(
			"heavy hash",
			120,
			() => wasmHash(heavySource),
			() => jsHash(heavySource),
		)
		expect(heavyHash.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyCombined = await benchPair(
			"heavy combined",
			6,
			async () => {
				await wasmScan(heavySource)
				await wasmHash(heavySource)
			},
			async () => {
				await jsScan(heavySource)
				await jsHash(heavySource)
			},
		)
		expect(heavyCombined.wasmSample.durationMs).toBeGreaterThan(0)

		const heavySecurity = await benchPair(
			"heavy security scan",
			6,
			() => wasmSecurity(heavySource),
			() => jsSecurity(heavySource),
		)
		expect(heavySecurity.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyInspect = await benchPair(
			"heavy inspect index",
			6,
			() => wasmInspect(heavySource),
			() => jsInspect(heavySource),
		)
		expect(heavyInspect.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyFiles = await benchSnippetFiles("heavy snippet files", 6, heavyFileSources)
		expect(heavyFiles.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyStripDirectives = await benchPair(
			"heavy strip directives",
			20,
			() => wasmStripDirectives(heavyHeaderSource),
			() => jsStripDirectives(heavyHeaderSource),
		)
		expect(heavyStripDirectives.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyStripImports = await benchPair(
			"heavy strip auto imports",
			20,
			() => wasmStripImports(heavyHeaderSource),
			() => jsStripImports(heavyHeaderSource),
		)
		expect(heavyStripImports.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyExportNames = await benchPair(
			"heavy export names",
			24,
			() => wasmExportNames(heavyHeaderSource),
			() => jsExportNames(heavyHeaderSource),
		)
		expect(heavyExportNames.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyPrimaryExport = await benchPair(
			"heavy primary export",
			60,
			() => wasmPrimaryExport(heavyHeaderSource),
			() => jsPrimaryExport(heavyHeaderSource),
		)
		expect(heavyPrimaryExport.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyImportOffset = await benchPair(
			"heavy import offset",
			120,
			() => wasmAutoImportOffset(heavyHeaderSource),
			() => jsAutoImportOffset(heavyHeaderSource),
		)
		expect(heavyImportOffset.wasmSample.durationMs).toBeGreaterThan(0)

		const largeFiles = await benchSnippetFiles("large snippet files", 4, largeFileSources)
		expect(largeFiles.wasmSample.durationMs).toBeGreaterThan(0)

		await benchWorkerRoundtrip("heavy", 6, heavySource)
	})
})
