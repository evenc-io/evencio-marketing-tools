import type { AnalyzeTsxRequest, AnalyzeTsxResponse } from "@/lib/engine/protocol"
import {
	buildSnippetInspectIndexWasm,
	scanSnippetSecurityIssuesWasm,
	stripAutoImportBlockWasmSync,
} from "@/lib/wasm/snippet-wasm"
import { loadBabelParser } from "./babel-parser"
import { buildSnippetInspectIndex, type SnippetInspectIndex } from "./inspect-index"
import { analyzeSnippetProgram } from "./source/derived"
import { scanSnippetFilesInWasm } from "./source/files-wasm"
import { hashSnippetSource } from "./source/hash"
import { analyzeSnippetAst } from "./source/security"
import {
	buildSnippetTailwindCssFromCandidates,
	extractTailwindCandidatesFromAst,
	extractTailwindCandidatesFromSourceWasm,
} from "./tailwind"

const emptySchema = () => ({ version: 1 as const, props: [] })

const stripSnippetFileDirectivesFallback = (source: string) =>
	source
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^(\s*\/\/\s*@snippet-file(\s|$))/.test(line) &&
				!/^(\s*\/\/\s*@snippet-file-end\s*)$/.test(line),
		)
		.join("\n")

const stripAutoImportBlockFallback = (source: string) => {
	const lines = stripSnippetFileDirectivesFallback(source).split(/\r?\n/)
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

/**
 * Analyze a snippet TSX source string: parse/derive exports + props, scan security, and optionally build Tailwind + inspect data.
 */
export const analyzeSnippetTsx = async ({
	source,
	includeTailwind = true,
	includeInspect = true,
}: AnalyzeTsxRequest): Promise<AnalyzeTsxResponse> => {
	const trimmed = source?.trim() ?? ""
	if (!trimmed) {
		return {
			exports: [],
			propsSchema: emptySchema(),
			defaultProps: {},
			duplicateKeys: [],
			propsSchemaJson: JSON.stringify(emptySchema(), null, 2),
			defaultPropsJson: JSON.stringify({}, null, 2),
			securityIssues: [],
			tailwindCss: null,
			tailwindError: null,
			sourceHash: 0,
			inspectIndexByFile: includeInspect ? { source: { version: 1, elements: [] } } : undefined,
			lineMapSegments: includeInspect ? [] : undefined,
		}
	}

	const scan = await scanSnippetFilesInWasm(source)
	const normalizedSource = scan.expandedSource
	const parser = await loadBabelParser()
	const ast = parser.parse(normalizedSource, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	})
	const program = ast.program as { body: unknown[] }
	const derived = analyzeSnippetProgram(program)
	const isBrowser = typeof window !== "undefined" || typeof self !== "undefined"
	let securityIssues: ReturnType<typeof analyzeSnippetAst>
	if (isBrowser) {
		const wasmIssues = await scanSnippetSecurityIssuesWasm(normalizedSource, { expanded: true })
		securityIssues = wasmIssues ?? analyzeSnippetAst(ast)
	} else {
		securityIssues = analyzeSnippetAst(ast)
	}
	const sourceHash = await hashSnippetSource(normalizedSource, { expanded: true })

	let tailwindCss: string | null = null
	let tailwindError: string | null = null

	if (includeTailwind) {
		try {
			let candidates: string[] = []
			if (isBrowser) {
				const wasmCandidates = await extractTailwindCandidatesFromSourceWasm(normalizedSource, {
					expanded: true,
				})
				if (wasmCandidates !== null) {
					candidates = wasmCandidates
				} else {
					candidates = extractTailwindCandidatesFromAst(ast)
				}
			} else {
				candidates = extractTailwindCandidatesFromAst(ast)
			}
			tailwindCss = await buildSnippetTailwindCssFromCandidates(candidates)
		} catch (err) {
			tailwindCss = null
			tailwindError = err instanceof Error ? err.message : "Failed to build Tailwind CSS"
		}
	}

	let inspectIndexByFile: AnalyzeTsxResponse["inspectIndexByFile"]
	let lineMapSegments: AnalyzeTsxResponse["lineMapSegments"]
	if (includeInspect) {
		const cleanedMain = isBrowser
			? (stripAutoImportBlockWasmSync(scan.mainSource) ??
				stripAutoImportBlockFallback(scan.mainSource))
			: stripAutoImportBlockFallback(scan.mainSource)
		if (isBrowser) {
			const nextIndexByFile: Record<string, SnippetInspectIndex | null> = {}
			const mainIndex = await buildSnippetInspectIndexWasm(cleanedMain, { expanded: true })
			nextIndexByFile.source = mainIndex ?? buildSnippetInspectIndex(cleanedMain)
			for (const [fileName, fileSource] of Object.entries(scan.files)) {
				const fileIndex = await buildSnippetInspectIndexWasm(fileSource, { expanded: true })
				nextIndexByFile[fileName] = fileIndex ?? buildSnippetInspectIndex(fileSource)
			}
			inspectIndexByFile = nextIndexByFile
			lineMapSegments = scan.lineMapSegments
		} else {
			inspectIndexByFile = {
				source: buildSnippetInspectIndex(cleanedMain),
			}
			for (const [fileName, fileSource] of Object.entries(scan.files)) {
				inspectIndexByFile[fileName] = buildSnippetInspectIndex(fileSource)
			}
			lineMapSegments = scan.lineMapSegments
		}
	}

	const propsSchema = derived.propsSchema
	const defaultProps = derived.defaultProps

	return {
		exports: derived.exports,
		propsSchema,
		defaultProps,
		duplicateKeys: derived.duplicateKeys,
		propsSchemaJson: JSON.stringify(propsSchema, null, 2),
		defaultPropsJson: JSON.stringify(defaultProps, null, 2),
		securityIssues,
		tailwindCss,
		tailwindError,
		sourceHash,
		inspectIndexByFile,
		lineMapSegments,
	}
}
