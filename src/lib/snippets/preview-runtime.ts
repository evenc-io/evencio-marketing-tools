/**
 * Preview Runtime for Custom Snippets
 *
 * Generates sandboxed iframe srcdoc HTML for rendering compiled snippets.
 * Uses strict CSP and sandbox attributes to isolate untrusted code.
 */

import { TRUSTED_FONT_PROVIDERS } from "./imports"

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

export interface PreviewSourceLocation {
	fileName?: string
	lineNumber?: number
	columnNumber?: number
}

export type PreviewMessage =
	| { type: "ready" }
	| { type: "render-success" }
	| { type: "render-error"; error?: string; stack?: string }
	| { type: "inspect-hover"; source: PreviewSourceLocation | null }
	| { type: "inspect-select"; source: PreviewSourceLocation | null }
	| { type: "inspect-context"; source: PreviewSourceLocation | null; x: number; y: number }
	| { type: "inspect-escape" }

/**
 * Minimal CSS reset and container styles for the preview iframe.
 */
const PREVIEW_STYLES = `
html, body {
  margin: 0;
  padding: 0;
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

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const PREVIEW_FONT_LINKS = TRUSTED_FONT_PROVIDERS.map(
	(provider) => `<link rel="stylesheet" href="${provider.cssUrl}">`,
).join("\n")

const PREVIEW_STYLE_SRC = uniqueValues([
	"'unsafe-inline'",
	...TRUSTED_FONT_PROVIDERS.map((provider) => provider.styleSrc),
]).join(" ")

const PREVIEW_FONT_SRC = uniqueValues([
	"data:",
	...TRUSTED_FONT_PROVIDERS.map((provider) => provider.fontSrc),
]).join(" ")

const safeStringifyProps = (props: Record<string, unknown>) => {
	try {
		return JSON.stringify(props ?? {})
	} catch {
		return "{}"
	}
}

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
	tailwindCss?: string,
	propsJsonOverride?: string,
): string {
	const nonce =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2)
	const propsJson =
		typeof propsJsonOverride === "string" ? propsJsonOverride : safeStringifyProps(props)
	const escapedTailwindCss = tailwindCss?.replace(/<\/style/gi, "<\\/style")

	// Escape script content to prevent XSS via props
	const escapedCode = compiledCode.replace(/<\/script/gi, "<\\/script")
	const escapedProps = propsJson.replace(/<\/script/gi, "<\\/script")

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'; script-src 'nonce-${nonce}'; style-src ${PREVIEW_STYLE_SRC}; img-src data: blob:; font-src ${PREVIEW_FONT_SRC};">
  <title>Snippet Preview</title>
  ${PREVIEW_FONT_LINKS}
  <style>${PREVIEW_STYLES}</style>
  <style id="snippet-tailwind">${escapedTailwindCss ?? ""}</style>
</head>
<body>
  <div id="root">
    <div id="snippet-container" style="width: ${dimensions.width}px; height: ${dimensions.height}px;"></div>
  </div>

  <script nonce="${nonce}">
    // Signal that iframe is ready
    parent.postMessage({ type: 'ready' }, '*');

    const SCRIPT_NONCE = "${nonce}";

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

      const elementSourceMap = new WeakMap();

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
          if (key.startsWith("__")) continue;
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

      const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

      const renderNode = (node, parent, isSvgParent = false) => {
        if (node === null || node === undefined || node === false) return;
        if (typeof node === "string" || typeof node === "number") {
          parent.appendChild(document.createTextNode(String(node)));
          return;
        }
        if (Array.isArray(node)) {
          node.forEach((child) => renderNode(child, parent, isSvgParent));
          return;
        }
        if (!node || typeof node !== "object" || !node.__snippetElement) {
          throw new Error("Unsupported element output. Ensure your component returns JSX.");
        }

        const { type, props } = node;
        const sourceInfo = props && typeof props === "object" ? props.__source : null;
        if (type === React.Fragment) {
          normalizeChildren(props?.children).forEach((child) => renderNode(child, parent, isSvgParent));
          return;
        }
        if (typeof type === "function") {
          const rendered = type(props ?? {});
          renderNode(rendered, parent, isSvgParent);
          return;
        }
        if (typeof type !== "string") {
          throw new Error("Unsupported element type in snippet preview");
        }

        const isSvgNode = isSvgParent || type === "svg";
        const element = isSvgNode
          ? document.createElementNS(SVG_NAMESPACE, type)
          : document.createElement(type);
        applyProps(element, props);
        if (sourceInfo && typeof sourceInfo === "object") {
          elementSourceMap.set(element, sourceInfo);
        }
        normalizeChildren(props?.children).forEach((child) => renderNode(child, element, isSvgNode));
        parent.appendChild(element);
      };

      window.React = React;

      const tailwindStyle = document.getElementById("snippet-tailwind");
      const setTailwindCss = (css) => {
        if (!tailwindStyle) return;
        tailwindStyle.textContent = typeof css === "string" ? css : "";
      };

      const INSPECT_HOVER = "#FF0066";
      const INSPECT_SELECTED = "#0066FF";
      const INSPECT_LABEL_BG = "#FFFFFF";
      const INSPECT_LABEL_TEXT = "#1E1E1E";
      const resolveInspectableTarget = (target) => {
        const container = document.getElementById("snippet-container");
        if (!container) return null;
        if (!(target instanceof Element)) return null;
        if (!container.contains(target)) return null;

        let current = target;
        while (current && current !== container) {
          if (elementSourceMap.has(current)) return current;
          current = current.parentElement;
        }

        return null;
      };

      let inspectScale = 1;
      const setInspectScale = (nextScale) => {
        if (typeof nextScale !== "number" || !Number.isFinite(nextScale)) {
          return;
        }
        inspectScale = Math.max(0.01, nextScale);
        updateInspectOverlay();
      };

      const createInspectOverlay = () => {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "9999";
        overlay.style.display = "none";

        const createBox = (color) => {
          const box = document.createElement("div");
          box.style.position = "fixed";
          box.style.border = "2px solid " + color;
          box.style.boxSizing = "border-box";
          box.style.pointerEvents = "none";
          box.style.display = "none";
          return box;
        };

        const createLabel = (color) => {
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.display = "none";
          container.style.pointerEvents = "none";
          container.style.whiteSpace = "nowrap";
          container.style.fontFamily =
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          container.style.fontSize = "10px";
          container.style.fontWeight = "600";
          container.style.lineHeight = "1.2";
          container.style.letterSpacing = "0.01em";
          container.style.alignItems = "center";
          container.style.flexDirection = "row";
          container.style.gap = "6px";
          container.style.transformOrigin = "top left";

          const prefix = document.createElement("span");
          prefix.style.display = "none";
          prefix.style.alignItems = "center";
          prefix.style.justifyContent = "center";
          prefix.style.padding = "2px 5px";
          prefix.style.borderRadius = "3px";
          prefix.style.background = color;
          prefix.style.color = "#FFFFFF";
          prefix.style.fontSize = "9px";
          prefix.style.fontWeight = "700";

          const info = document.createElement("span");
          info.style.display = "inline-flex";
          info.style.alignItems = "center";
          info.style.justifyContent = "center";
          info.style.padding = "2px 7px";
          info.style.borderRadius = "3px";
          info.style.background = INSPECT_LABEL_BG;
          info.style.color = INSPECT_LABEL_TEXT;
          info.style.border = "1px solid " + color;

          container.appendChild(prefix);
          container.appendChild(info);

          return { container, prefix, info, baseHeight: 0 };
        };

        const hoverBox = createBox(INSPECT_HOVER);
        const hoverLabel = createLabel(INSPECT_HOVER);
        const selectedBox = createBox(INSPECT_SELECTED);
        const selectedLabel = createLabel(INSPECT_SELECTED);

        overlay.appendChild(selectedBox);
        overlay.appendChild(selectedLabel.container);
        overlay.appendChild(hoverBox);
        overlay.appendChild(hoverLabel.container);
        document.body.appendChild(overlay);

        const measureLabelHeight = (label) => {
          if (label.baseHeight) return;
          const prevDisplay = label.container.style.display;
          const prevVisibility = label.container.style.visibility;
          const prevLeft = label.container.style.left;
          const prevTop = label.container.style.top;
          const prevTransform = label.container.style.transform;
          const prevGap = label.container.style.gap;
          const prevPrefixDisplay = label.prefix.style.display;
          const prevPrefixText = label.prefix.textContent;

          label.prefix.textContent = "Selected";
          label.prefix.style.display = "inline-flex";
          label.container.style.gap = "6px";
          label.container.style.display = "flex";
          label.container.style.visibility = "hidden";
          label.container.style.left = "-9999px";
          label.container.style.top = "0px";
          label.container.style.transform = "scale(1)";
          label.baseHeight = Math.max(
            0,
            Math.round(label.container.getBoundingClientRect().height),
          );

          label.container.style.display = prevDisplay;
          label.container.style.visibility = prevVisibility;
          label.container.style.left = prevLeft;
          label.container.style.top = prevTop;
          label.container.style.transform = prevTransform;
          label.container.style.gap = prevGap;
          label.prefix.style.display = prevPrefixDisplay;
          label.prefix.textContent = prevPrefixText;

          if (!label.baseHeight) {
            label.baseHeight = 16;
          }
        };

        const updateBox = (box, label, target, prefix) => {
          if (!target) {
            box.style.display = "none";
            label.container.style.display = "none";
            return;
          }
          const rect = target.getBoundingClientRect();
          const width = Math.max(0, Math.round(rect.width));
          const height = Math.max(0, Math.round(rect.height));
          const tag = target.tagName ? target.tagName.toLowerCase() : "element";
          const prefixText = prefix ? prefix : "";

          box.style.display = "block";
          box.style.left = rect.left + "px";
          box.style.top = rect.top + "px";
          box.style.width = rect.width + "px";
          box.style.height = rect.height + "px";

          label.info.textContent = tag + " - " + width + " x " + height;
          if (prefixText) {
            label.prefix.textContent = prefixText;
            label.prefix.style.display = "inline-flex";
            label.container.style.gap = "6px";
          } else {
            label.prefix.style.display = "none";
            label.container.style.gap = "0px";
          }

          label.container.style.display = "flex";
          label.container.style.left = rect.left + "px";
          label.container.style.top = "0px";
          const labelScale = inspectScale > 0 ? 1 / inspectScale : 1;
          label.container.style.transform = "scale(" + labelScale + ")";
          measureLabelHeight(label);
          const labelHeight = Math.round(label.baseHeight * labelScale);
          const labelOffset = 6;
          const labelTop = rect.top - labelHeight - labelOffset < 4
            ? rect.bottom + labelOffset
            : rect.top - labelHeight - labelOffset;
          label.container.style.top = labelTop + "px";
        };

        return {
          setEnabled(enabled) {
            overlay.style.display = enabled ? "block" : "none";
          },
          update({ hovered, selected }) {
            updateBox(selectedBox, selectedLabel, selected, "Selected");
            const hoverTarget = hovered && hovered !== selected ? hovered : null;
            updateBox(hoverBox, hoverLabel, hoverTarget, "");
          },
        };
      };

      const inspectOverlay = createInspectOverlay();
      const inspectState = {
        enabled: false,
        hovered: null,
        selected: null,
      };

      let inspectListenersAttached = false;
      const attachInspectListeners = () => {
        if (inspectListenersAttached) return;
        inspectListenersAttached = true;
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("click", handleClick);
        document.addEventListener("contextmenu", handleContextMenu);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", updateInspectOverlay);
      };

      const detachInspectListeners = () => {
        if (!inspectListenersAttached) return;
        inspectListenersAttached = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("click", handleClick);
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("resize", updateInspectOverlay);
      };

      const sendInspectMessage = (type, element, payload) => {
        const source = element ? elementSourceMap.get(element) : null;
        parent.postMessage({ type, source: source ?? null, ...(payload ?? {}) }, "*");
      };

      const updateInspectOverlay = () => {
        if (!inspectState.enabled) {
          inspectOverlay.setEnabled(false);
          return;
        }
        inspectOverlay.setEnabled(true);
        inspectOverlay.update({
          hovered: inspectState.hovered,
          selected: inspectState.selected,
        });
      };

      const resetInspectState = () => {
        inspectState.hovered = null;
        inspectState.selected = null;
        updateInspectOverlay();
      };

      const setInspectEnabled = (enabled) => {
        if (enabled === inspectState.enabled) {
          updateInspectOverlay();
          return;
        }
        inspectState.enabled = enabled;
        if (!enabled) {
          inspectState.hovered = null;
          inspectState.selected = null;
          sendInspectMessage("inspect-hover", null);
          sendInspectMessage("inspect-select", null);
          detachInspectListeners();
        } else {
          attachInspectListeners();
        }
        updateInspectOverlay();
      };

      const handleMouseMove = (event) => {
        if (!inspectState.enabled) return;
        const target = resolveInspectableTarget(event.target);
        if (target === inspectState.hovered) return;
        inspectState.hovered = target;
        updateInspectOverlay();
        const hoverTarget = target && target !== inspectState.selected ? target : null;
        sendInspectMessage("inspect-hover", hoverTarget);
      };

      const handleClick = (event) => {
        if (!inspectState.enabled) return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const target = resolveInspectableTarget(event.target);
        inspectState.selected = target;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", target);
      };

      const handleContextMenu = (event) => {
        if (!inspectState.enabled) return;
        const target = resolveInspectableTarget(event.target);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        inspectState.selected = target;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", target);
        sendInspectMessage("inspect-context", target, { x: event.clientX, y: event.clientY });
      };

      const handleKeyDown = (event) => {
        if (!inspectState.enabled) return;
        if (event.key !== "Escape") return;
        inspectState.selected = null;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", null);
        sendInspectMessage("inspect-escape", null);
      };

      const showRenderError = (error) => {
        const message = error && error.message ? error.message : "Unknown error";
        parent.postMessage({
          type: 'render-error',
          error: message,
          stack: error && error.stack ? error.stack : undefined
        }, '*');

        const container = document.getElementById('snippet-container');
        if (!container) return;
        container.innerHTML = '<div class="error-display"><strong>Execution Error</strong><pre>' +
          message + '</pre></div>';
      };

      const resetSnippetExports = () => {
        window.__SNIPPET_COMPONENT__ = undefined;
        window.__SNIPPET_COMPONENT_ERROR__ = undefined;
      };

      const applyCompiledCode = (code) => {
        resetSnippetExports();
        if (typeof code !== "string" || !code.trim()) {
          window.__SNIPPET_COMPONENT_ERROR__ = "No compiled code provided.";
          return;
        }
        const wrappedCode =
          "try {\\n" +
          code +
          "\\n} catch (error) {\\n" +
          "  window.__SNIPPET_COMPONENT_ERROR__ = error && error.message ? error.message : String(error);\\n" +
          "}";
        const script = document.createElement("script");
        script.setAttribute("nonce", SCRIPT_NONCE);
        script.textContent = wrappedCode;
        document.body.appendChild(script);
        script.remove();
      };

      const normalizeProps = (value) => {
        if (value && typeof value === "object") return value;
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object") return parsed;
          } catch {
            return {};
          }
        }
        return {};
      };

      let latestPropsPayload = ${escapedProps};

      const renderWithProps = (nextProps) => {
        try {
          const exportError = window.__SNIPPET_COMPONENT_ERROR__;
          const SnippetComponent = window.__SNIPPET_COMPONENT__;
          if (exportError) {
            throw new Error(exportError);
          }
          if (!SnippetComponent) {
            throw new Error('No export found. Snippet must export a React component.');
          }
          const container = document.getElementById('snippet-container');
          if (!container) return;
          container.innerHTML = "";
          const props = normalizeProps(nextProps);
          const output = typeof SnippetComponent === "function"
            ? SnippetComponent(props)
            : SnippetComponent;
          renderNode(output, container);
          parent.postMessage({ type: 'render-success' }, '*');
        } catch (error) {
          showRenderError(error);
        }
      };

      const runInitialCode = () => {
        resetSnippetExports();
        try {
          ${escapedCode}
        } catch (error) {
          window.__SNIPPET_COMPONENT_ERROR__ = error && error.message ? error.message : String(error);
        }
      };

      runInitialCode();

      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || typeof data.type !== "string") return;
        if (data.type === "inspect-toggle") {
          setInspectEnabled(Boolean(data.enabled));
          return;
        }
        if (data.type === "inspect-scale") {
          setInspectScale(typeof data.scale === "number" ? data.scale : 1);
          return;
        }
        if (data.type === "code-update") {
          if (typeof data.propsJson === "string" || typeof data.props === "string" || typeof data.props === "object") {
            latestPropsPayload = data.propsJson ?? data.props;
          }
          resetInspectState();
          applyCompiledCode(data.code);
          renderWithProps(latestPropsPayload);
          return;
        }
        if (data.type === "tailwind-update") {
          setTailwindCss(data.css);
          return;
        }
        if (data.type === "props-update") {
          latestPropsPayload = data.propsJson ?? data.props;
          renderWithProps(latestPropsPayload);
        }
      });

      // Initial render with props from parent
      renderWithProps(latestPropsPayload);
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
