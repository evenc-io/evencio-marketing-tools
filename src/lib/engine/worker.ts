import type { EngineRequest, EngineResponse } from "@/lib/engine/protocol"
import { analyzeSnippetTsx } from "@/lib/snippets/analyze-tsx"
import { compileSnippet } from "@/lib/snippets/compiler"
import {
	buildComponentTreeFromSource,
	buildSnippetComponentTree,
} from "@/lib/snippets/component-tree"
import { insertSnippetChild } from "@/lib/snippets/source/insert-child"
import { applySnippetTranslate } from "@/lib/snippets/source/layout"
import { applySnippetStyleUpdate } from "@/lib/snippets/source/style"
import { readSnippetStyleState } from "@/lib/snippets/source/style-read"

const send = (message: EngineResponse) => {
	postMessage(message)
}

const toError = (id: string, err: unknown): EngineResponse => {
	if (err instanceof Error) {
		return { id, type: "error", error: err.message, stack: err.stack }
	}
	return { id, type: "error", error: "Unknown engine error" }
}

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
	const data = event.data
	if (!data || typeof data.type !== "string") return

	try {
		if (data.type === "analyze") {
			const result = await analyzeSnippetTsx(data.payload)
			send({ id: data.id, type: "analyze", payload: result })
			return
		}

		if (data.type === "compile") {
			const { source, entryExport } = data.payload
			const result = await compileSnippet(source, entryExport)
			send({ id: data.id, type: "compile", payload: result })
			return
		}

		if (data.type === "component-tree") {
			const result = await buildSnippetComponentTree(data.payload)
			send({ id: data.id, type: "component-tree", payload: result })
			return
		}

		if (data.type === "component-tree-js") {
			const { source, entryExport } = data.payload
			const result = buildComponentTreeFromSource(source, entryExport)
			send({ id: data.id, type: "component-tree-js", payload: result })
			return
		}

		if (data.type === "layout-translate") {
			const result = await applySnippetTranslate(data.payload)
			send({ id: data.id, type: "layout-translate", payload: result })
			return
		}

		if (data.type === "insert-child") {
			const result = await insertSnippetChild(data.payload)
			send({ id: data.id, type: "insert-child", payload: result })
			return
		}

		if (data.type === "style-update") {
			const result = await applySnippetStyleUpdate(data.payload)
			send({ id: data.id, type: "style-update", payload: result })
			return
		}

		if (data.type === "style-read") {
			const result = await readSnippetStyleState(data.payload)
			send({ id: data.id, type: "style-read", payload: result })
			return
		}
	} catch (err) {
		send(toError(data.id, err))
	}
}
