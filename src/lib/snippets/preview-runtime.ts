/**
 * Preview Runtime for Custom Snippets
 *
 * Generates sandboxed iframe srcdoc HTML for rendering compiled snippets.
 * Uses strict CSP and sandbox attributes to isolate untrusted code.
 */

const UNITLESS_CSS_PROPERTIES = new Set([
	"opacity",
	"zIndex",
	"fontWeight",
	"lineHeight",
	"flex",
	"flexGrow",
	"flexShrink",
	"order",
])

export interface PreviewDimensions {
	width: number
	height: number
}

export interface PreviewMessage {
	type: "render-success" | "render-error" | "ready"
	error?: string
	stack?: string
}

/**
 * Minimal CSS reset and container styles for the preview iframe.
 */
const PREVIEW_STYLES = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  overflow: hidden;
}

#root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

#snippet-container {
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.error-display {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  max-width: 100%;
  overflow: auto;
}

.error-display pre {
  margin-top: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #7f1d1d;
}
`

/**
 * Generate the srcdoc HTML for the preview iframe.
 *
 * @param compiledCode - The compiled JavaScript code from the compiler
 * @param props - Props to pass to the snippet component
 * @param dimensions - Viewport dimensions for the snippet
 * @returns Complete HTML document string for srcdoc
 */
export function generatePreviewSrcdoc(
	compiledCode: string,
	props: Record<string, unknown>,
	dimensions: PreviewDimensions,
): string {
	const nonce =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2)
	const propsJson = JSON.stringify(props)

	// Escape script content to prevent XSS via props
	const escapedCode = compiledCode.replace(/<\/script/gi, "<\\/script")
	const escapedProps = propsJson.replace(/<\/script/gi, "<\\/script")

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;">
  <title>Snippet Preview</title>
  <style>${PREVIEW_STYLES}</style>
</head>
<body>
  <div id="root">
    <div id="snippet-container" style="width: ${dimensions.width}px; height: ${dimensions.height}px;"></div>
  </div>

  <script nonce="${nonce}">
    // Signal that iframe is ready
    parent.postMessage({ type: 'ready' }, '*');

    try {
      const React = (() => {
        const Fragment = Symbol.for("snippet.fragment");
        const createElement = (type, props, ...children) => {
          const normalizedProps = props ? { ...props } : {};
          if (children.length > 0) {
            normalizedProps.children = children.length === 1 ? children[0] : children;
          }
          return { __snippetElement: true, type, props: normalizedProps };
        };

        const makeHookError = (name) => () => {
          throw new Error(name + " is not supported in snippet previews. Use static props instead.");
        };

        return {
          Fragment,
          createElement,
          useState: makeHookError("useState"),
          useEffect: makeHookError("useEffect"),
          useLayoutEffect: makeHookError("useLayoutEffect"),
          useMemo: makeHookError("useMemo"),
          useCallback: makeHookError("useCallback"),
          useRef: makeHookError("useRef"),
          useReducer: makeHookError("useReducer"),
        };
      })();

      const unitlessStyles = new Set(${JSON.stringify(Array.from(UNITLESS_CSS_PROPERTIES))});
      const isUnitlessStyle = (key) => unitlessStyles.has(key);

      const normalizeChildren = (children) => {
        if (children === undefined) return [];
        if (Array.isArray(children)) return children.flat();
        return [children];
      };

      const applyProps = (element, props) => {
        if (!props) return;
        for (const [key, value] of Object.entries(props)) {
          if (key === "children" || value === null || value === undefined) continue;
          if (key === "className") {
            element.setAttribute("class", String(value));
            continue;
          }
          if (key === "style" && typeof value === "object") {
            for (const [styleKey, styleValue] of Object.entries(value)) {
              if (styleValue === null || styleValue === undefined) continue;
              if (typeof styleValue === "number" && !isUnitlessStyle(styleKey)) {
                element.style[styleKey] = String(styleValue) + "px";
              } else {
                element.style[styleKey] = String(styleValue);
              }
            }
            continue;
          }
          if (key === "dangerouslySetInnerHTML") {
            throw new Error("dangerouslySetInnerHTML is not allowed in snippet previews");
          }
          if (key.startsWith("on") && typeof value === "function") {
            continue;
          }
          if (typeof value === "boolean") {
            if (value) element.setAttribute(key, "");
            continue;
          }
          element.setAttribute(key, String(value));
        }
      };

      const renderNode = (node, parent) => {
        if (node === null || node === undefined || node === false) return;
        if (typeof node === "string" || typeof node === "number") {
          parent.appendChild(document.createTextNode(String(node)));
          return;
        }
        if (Array.isArray(node)) {
          node.forEach((child) => renderNode(child, parent));
          return;
        }
        if (!node || typeof node !== "object" || !node.__snippetElement) {
          throw new Error("Unsupported element output. Ensure your component returns JSX.");
        }

        const { type, props } = node;
        if (type === React.Fragment) {
          normalizeChildren(props?.children).forEach((child) => renderNode(child, parent));
          return;
        }
        if (typeof type === "function") {
          const rendered = type(props ?? {});
          renderNode(rendered, parent);
          return;
        }
        if (typeof type !== "string") {
          throw new Error("Unsupported element type in snippet preview");
        }

        const element = document.createElement(type);
        applyProps(element, props);
        normalizeChildren(props?.children).forEach((child) => renderNode(child, element));
        parent.appendChild(element);
      };

      window.React = React;

      // Execute compiled snippet code
      ${escapedCode}

      // Get the exported component
      const SnippetComponent = window.__SNIPPET_COMPONENT__;

      if (!SnippetComponent) {
        throw new Error('No default export found. Snippet must export a default React component.');
      }

      // Props from parent
      const props = ${escapedProps};

      // Mount using the lightweight renderer
      const container = document.getElementById('snippet-container');
      container.innerHTML = "";
      const output = typeof SnippetComponent === "function" ? SnippetComponent(props) : SnippetComponent;
      renderNode(output, container);

      parent.postMessage({ type: 'render-success' }, '*');
    } catch (error) {
      // Handle execution errors
      parent.postMessage({
        type: 'render-error',
        error: error.message,
        stack: error.stack
      }, '*');

      // Show error in iframe
      const container = document.getElementById('snippet-container');
      container.innerHTML = '<div class="error-display"><strong>Execution Error</strong><pre>' +
        (error.message || 'Unknown error') + '</pre></div>';
    }
  </script>
</body>
</html>`
}

/**
 * Default dimensions matching the snippet render determinism config.
 */
export const DEFAULT_PREVIEW_DIMENSIONS: PreviewDimensions = {
	width: 1200,
	height: 630,
}
