import * as ts from "typescript"

type CheckResult = {
	filePath: string
	line: number
	column: number
	exportName: string
	kind: "function" | "const"
}

type CliOptions = {
	failOnMissing: boolean
	patterns: string[]
}

const DEFAULT_PATTERNS = [
	"src/lib/**/*.ts",
	"src/lib/**/*.tsx",
	"server/**/*.ts",
	"server/**/*.tsx",
]

const IGNORE_SUBSTRINGS = [
	"/node_modules/",
	"/.output/",
	"/dist/",
	"/build/",
	"/.tanstack/",
	"/__tests__/",
]

const IGNORE_SUFFIXES = [".d.ts", ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]

function parseArgs(argv: string[]): CliOptions {
	const options: CliOptions = { failOnMissing: true, patterns: [...DEFAULT_PATTERNS] }

	for (const arg of argv) {
		if (arg === "--warn") {
			options.failOnMissing = false
			continue
		}
		if (arg === "--fail") {
			options.failOnMissing = true
			continue
		}
		if (arg.startsWith("--patterns=")) {
			const raw = arg.slice("--patterns=".length)
			options.patterns = raw
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)
		}
	}

	return options
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
	return (modifiers ?? []).some((m) => m.kind === kind)
}

function isIgnoredPath(filePath: string): boolean {
	for (const needle of IGNORE_SUBSTRINGS) {
		if (filePath.includes(needle)) return true
	}
	for (const suffix of IGNORE_SUFFIXES) {
		if (filePath.endsWith(suffix)) return true
	}
	return false
}

function hasJsDoc(text: string, node: ts.Node): boolean {
	const jsDocNodes = ts.getJSDocCommentsAndTags(node).filter((n) => n.kind === ts.SyntaxKind.JSDoc)
	if (jsDocNodes.length > 0) return true

	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []
	return ranges.some((range) => text.slice(range.pos, range.pos + 3) === "/**")
}

function getLineAndColumn(
	sourceFile: ts.SourceFile,
	node: ts.Node,
): { line: number; column: number } {
	const pos = node.getStart(sourceFile, false)
	const lc = sourceFile.getLineAndCharacterOfPosition(pos)
	return { line: lc.line + 1, column: lc.character + 1 }
}

async function collectFiles(patterns: string[]): Promise<string[]> {
	const seen = new Set<string>()
	for (const pattern of patterns) {
		const glob = new Bun.Glob(pattern)
		for await (const match of glob.scan({ onlyFiles: true })) {
			if (isIgnoredPath(match)) continue
			seen.add(match)
		}
	}
	return Array.from(seen).sort()
}

function collectMissingJsDoc(filePath: string, text: string): CheckResult[] {
	const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true, scriptKind)
	const results: CheckResult[] = []

	for (const statement of sourceFile.statements) {
		if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue

		if (ts.isFunctionDeclaration(statement)) {
			const exportName = statement.name?.text ?? "default"
			const documented = hasJsDoc(text, statement)
			if (!documented) {
				const { line, column } = getLineAndColumn(sourceFile, statement)
				results.push({ filePath, line, column, exportName, kind: "function" })
			}
			continue
		}

		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (!declaration.initializer) continue
				if (!ts.isIdentifier(declaration.name)) continue
				if (
					!ts.isArrowFunction(declaration.initializer) &&
					!ts.isFunctionExpression(declaration.initializer)
				) {
					continue
				}

				const exportName = declaration.name.text
				const documented =
					hasJsDoc(text, statement) ||
					hasJsDoc(text, declaration) ||
					hasJsDoc(text, declaration.initializer)
				if (!documented) {
					const { line, column } = getLineAndColumn(sourceFile, declaration)
					results.push({ filePath, line, column, exportName, kind: "const" })
				}
			}
		}
	}

	return results
}

async function main(): Promise<void> {
	const options = parseArgs(Bun.argv.slice(2))
	const files = await collectFiles(options.patterns)

	const missing: CheckResult[] = []

	for (const filePath of files) {
		const text = await Bun.file(filePath).text()
		missing.push(...collectMissingJsDoc(filePath, text))
	}

	if (missing.length === 0) {
		console.log("check-jsdoc: OK (all exported functions are documented)")
		return
	}

	console.log(`check-jsdoc: Missing JSDoc on ${missing.length} exported functions:`)
	for (const item of missing) {
		console.log(`${item.filePath}:${item.line}:${item.column} - ${item.exportName} (${item.kind})`)
	}

	if (options.failOnMissing) {
		process.exitCode = 1
	}
}

await main()
