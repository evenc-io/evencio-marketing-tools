import { PREVIEW_SRCDOC_SCRIPT_CORE_RENDERER } from "./sections/core-renderer"
import { PREVIEW_SRCDOC_SCRIPT_IMPORT_DND } from "./sections/import-dnd"
import { PREVIEW_SRCDOC_SCRIPT_IMPORTS_TAILWIND } from "./sections/imports-tailwind"
import { PREVIEW_SRCDOC_SCRIPT_INSPECT } from "./sections/inspect"
import { PREVIEW_SRCDOC_SCRIPT_LAYOUT_DRAG_RESIZE } from "./sections/layout-drag-resize"
import { PREVIEW_SRCDOC_SCRIPT_LAYOUT_POINTER_HANDLERS } from "./sections/layout-pointer-handlers"
import { PREVIEW_SRCDOC_SCRIPT_LAYOUT_STATE } from "./sections/layout-state"
import { PREVIEW_SRCDOC_SCRIPT_RUNTIME } from "./sections/runtime"

const NONCE_PLACEHOLDER = "__EVENCIO_SNIPPET_PREVIEW_NONCE__"
const UNITLESS_STYLES_PLACEHOLDER = "__EVENCIO_SNIPPET_PREVIEW_UNITLESS_STYLES__"
const PROPS_JSON_PLACEHOLDER = "__EVENCIO_SNIPPET_PREVIEW_PROPS_JSON__"
const COMPILED_CODE_PLACEHOLDER = "__EVENCIO_SNIPPET_PREVIEW_COMPILED_CODE__"

const replaceAll = (value: string, search: string, replacement: string) =>
	value.split(search).join(replacement)

/**
 * Assemble the full snippet preview runtime script by concatenating section templates and replacing placeholders.
 */
export function buildPreviewRuntimeScript(options: {
	nonce: string
	unitlessStylesJson: string
	escapedProps: string
	escapedCode: string
}): string {
	const coreRenderer = replaceAll(
		replaceAll(PREVIEW_SRCDOC_SCRIPT_CORE_RENDERER, NONCE_PLACEHOLDER, options.nonce),
		UNITLESS_STYLES_PLACEHOLDER,
		options.unitlessStylesJson,
	)

	const runtime = replaceAll(
		replaceAll(PREVIEW_SRCDOC_SCRIPT_RUNTIME, PROPS_JSON_PLACEHOLDER, options.escapedProps),
		COMPILED_CODE_PLACEHOLDER,
		options.escapedCode,
	)

	return (
		coreRenderer +
		PREVIEW_SRCDOC_SCRIPT_IMPORTS_TAILWIND +
		PREVIEW_SRCDOC_SCRIPT_INSPECT +
		PREVIEW_SRCDOC_SCRIPT_LAYOUT_STATE +
		PREVIEW_SRCDOC_SCRIPT_IMPORT_DND +
		PREVIEW_SRCDOC_SCRIPT_LAYOUT_DRAG_RESIZE +
		PREVIEW_SRCDOC_SCRIPT_LAYOUT_POINTER_HANDLERS +
		runtime
	)
}
