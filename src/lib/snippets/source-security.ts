import type { CompileError } from "./compiler"
import { expandSnippetSource } from "./source-files"

let parserPromise: Promise<typeof import("@babel/parser")> | null = null

const loadParser = async () => {
	if (!parserPromise) {
		parserPromise = import("@babel/parser")
	}
	return parserPromise
}

export interface SourceSecurityIssue {
	message: string
	line: number
	column: number
	endLine?: number
	endColumn?: number
}

const ALLOWED_IMPORTS = new Set(["react", "react/jsx-runtime"])
const BANNED_IMPORT_PREFIXES = [
	"node:",
	"fs",
	"path",
	"child_process",
	"worker_threads",
	"os",
	"net",
	"tls",
	"http",
	"https",
	"dns",
	"bun",
	"process",
]

const BANNED_CALLEES = new Set(["fetch", "eval", "Function", "setTimeout", "setInterval"])
const BANNED_MEMBER_CALLEES = new Set(["fetch", "sendBeacon", "postMessage"])
const BANNED_NEW = new Set([
	"Function",
	"WebSocket",
	"XMLHttpRequest",
	"EventSource",
	"Worker",
	"SharedWorker",
	"BroadcastChannel",
	"MessageChannel",
])
const BANNED_GLOBALS = new Set(["process", "Bun"])
const BANNED_GLOBAL_OBJECTS = new Set([
	"window",
	"globalThis",
	"self",
	"parent",
	"top",
	"document",
	"navigator",
	"location",
	"history",
	"localStorage",
	"sessionStorage",
	"indexedDB",
	"caches",
	"cookieStore",
	...BANNED_GLOBALS,
])
const BANNED_PROPERTY_ACCESS = new Set(["cookie"])

const isNodeType = (node: unknown, type: string) =>
	Boolean(node && typeof node === "object" && (node as { type?: string }).type === type)

const getIdentifierName = (node: unknown): string | null => {
	if (isNodeType(node, "Identifier")) return (node as { name: string }).name
	return null
}

const getNodeLoc = (node: unknown) => {
	if (!node || typeof node !== "object") return null
	const loc = (
		node as {
			loc?: { start: { line: number; column: number }; end: { line: number; column: number } }
		}
	).loc
	if (!loc) return null
	return {
		line: loc.start.line,
		column: loc.start.column + 1,
		endLine: loc.end.line,
		endColumn: loc.end.column + 1,
	}
}

const toIssue = (node: unknown, message: string): SourceSecurityIssue => {
	const loc = getNodeLoc(node)
	return {
		message,
		line: loc?.line ?? 1,
		column: loc?.column ?? 1,
		endLine: loc?.endLine,
		endColumn: loc?.endColumn,
	}
}

const isImportAllowed = (value: string) => {
	if (ALLOWED_IMPORTS.has(value)) return true
	return false
}

const isBannedImport = (value: string) =>
	BANNED_IMPORT_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))

const isMemberExpression = (
	node: unknown,
): node is { object: unknown; property: unknown; computed?: boolean } =>
	isNodeType(node, "MemberExpression")

const isCallExpression = (node: unknown): node is { callee: unknown; arguments: unknown[] } =>
	isNodeType(node, "CallExpression")

const isNewExpression = (node: unknown): node is { callee: unknown; arguments: unknown[] } =>
	isNodeType(node, "NewExpression")

const isImportExpression = (node: unknown) => isNodeType(node, "ImportExpression")
const isImportCallee = (node: unknown) => isNodeType(node, "Import")

const isStringLiteral = (node: unknown): node is { value: string } =>
	isNodeType(node, "StringLiteral")

const getMemberPropertyName = (node: unknown): string | null => {
	if (!isMemberExpression(node)) return null
	if (node.computed && isStringLiteral(node.property)) return node.property.value
	if (!node.computed) return getIdentifierName(node.property)
	return null
}

const getRootObjectName = (node: unknown): string | null => {
	let current: unknown = node
	while (isMemberExpression(current)) {
		current = current.object
	}
	return getIdentifierName(current)
}

export const analyzeSnippetSource = async (source: string): Promise<SourceSecurityIssue[]> => {
	const issues: SourceSecurityIssue[] = []

	try {
		const normalizedSource = expandSnippetSource(source)
		const parser = await loadParser()
		const ast = parser.parse(normalizedSource, {
			sourceType: "module",
			plugins: ["typescript", "jsx"],
		})

		const visit = (node: unknown) => {
			if (!node || typeof node !== "object") return
			if (Array.isArray(node)) {
				for (const child of node) visit(child)
				return
			}

			if (isNodeType(node, "ImportDeclaration")) {
				const sourceValue = (node as { source?: { value?: string } }).source?.value
				if (sourceValue) {
					if (isBannedImport(sourceValue)) {
						issues.push(toIssue(node, `Disallowed import: ${sourceValue}`))
					} else if (!isImportAllowed(sourceValue)) {
						issues.push(toIssue(node, `Only React imports are allowed. Found: ${sourceValue}`))
					}
				}
			}

			if (isImportExpression(node)) {
				issues.push(toIssue(node, "Dynamic import() is not allowed in snippets"))
			}

			if (isCallExpression(node)) {
				const calleeName = getIdentifierName(node.callee)
				if (calleeName && BANNED_CALLEES.has(calleeName)) {
					issues.push(toIssue(node, `Disallowed call: ${calleeName}()`))
				}
				if (isImportCallee(node.callee)) {
					issues.push(toIssue(node, "Dynamic import() is not allowed in snippets"))
				}
				if (calleeName === "require") {
					const arg = node.arguments[0]
					if (!isStringLiteral(arg) || !ALLOWED_IMPORTS.has(arg.value)) {
						issues.push(toIssue(node, "Only React require() calls are allowed"))
					}
				}

				if (isMemberExpression(node.callee)) {
					const propertyName = getMemberPropertyName(node.callee)
					if (propertyName && BANNED_MEMBER_CALLEES.has(propertyName)) {
						issues.push(toIssue(node, `Disallowed call: ${propertyName}()`))
					}
				}
			}

			if (isNewExpression(node)) {
				const calleeName = getIdentifierName(node.callee)
				if (calleeName && BANNED_NEW.has(calleeName)) {
					issues.push(toIssue(node, `Disallowed constructor: new ${calleeName}()`))
				}
				if (isMemberExpression(node.callee)) {
					const propertyName = getMemberPropertyName(node.callee)
					if (propertyName && BANNED_NEW.has(propertyName)) {
						issues.push(toIssue(node, `Disallowed constructor: new ${propertyName}()`))
					}
				}
			}

			if (isMemberExpression(node)) {
				const rootName = getRootObjectName(node)
				const propertyName = getMemberPropertyName(node)

				if (rootName && BANNED_GLOBAL_OBJECTS.has(rootName)) {
					issues.push(toIssue(node, `Disallowed global access: ${rootName}`))
				}

				if (propertyName && BANNED_PROPERTY_ACCESS.has(propertyName)) {
					issues.push(toIssue(node, `Disallowed property access: ${propertyName}`))
				}
			}

			for (const [key, value] of Object.entries(node)) {
				if (
					key === "loc" ||
					key === "comments" ||
					key === "leadingComments" ||
					key === "trailingComments"
				) {
					continue
				}
				if (key === "parent") continue
				if (key === "type" && typeof value === "string") continue
				visit(value)
			}
		}

		visit(ast)
	} catch {
		return []
	}

	return issues
}

export const securityIssuesToCompileErrors = (issues: SourceSecurityIssue[]): CompileError[] =>
	issues.map((issue) => ({
		message: issue.message,
		line: issue.line,
		column: issue.column - 1,
		endLine: issue.endLine,
		endColumn: issue.endColumn ? issue.endColumn - 1 : undefined,
		severity: "error",
	}))
