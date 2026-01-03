/**
 * Preview Runtime for Custom Snippets
 *
 * Generates sandboxed iframe srcdoc HTML for rendering compiled snippets.
 * Uses strict CSP and sandbox attributes to isolate untrusted code.
 */

import { TRUSTED_FONT_PROVIDERS } from "../../imports"
import { PREVIEW_STYLES, UNITLESS_CSS_PROPERTIES } from "./constants"
import type { PreviewDimensions } from "./types"

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
      const elementTranslateMap = new WeakMap();
      const sourceTranslateMap = new Map();
      const clearLayoutCache = () => {
        sourceTranslateMap.clear();
      };

      const getSourceKey = (source) => {
        if (!source || typeof source !== "object") return null;
        const fileName = source.fileName ?? "";
        const line = source.lineNumber ?? "";
        const column = source.columnNumber ?? "";
        return String(fileName) + ":" + String(line) + ":" + String(column);
      };

      const getStoredSourceTranslate = (source) => {
        const key = getSourceKey(source);
        if (!key) return null;
        return sourceTranslateMap.get(key) ?? null;
      };

      const setStoredSourceTranslate = (source, translate) => {
        const key = getSourceKey(source);
        if (!key || !translate) return;
        sourceTranslateMap.set(key, { x: translate.x ?? 0, y: translate.y ?? 0 });
      };

      const unitlessStyles = new Set(${JSON.stringify(Array.from(UNITLESS_CSS_PROPERTIES))});
      const isUnitlessStyle = (key) => unitlessStyles.has(key);

      const parseTranslateValue = (value) => {
        if (!value || value === "none") return { x: 0, y: 0, partsCount: 0 };
        const text = String(value);
        const matches = text.match(/-?\\d*\\.?\\d+/g);
        if (!matches || matches.length === 0) {
          return { x: 0, y: 0, partsCount: 0 };
        }
        const x = Number.parseFloat(matches[0]);
        const y = Number.parseFloat(matches[1] ?? "0");
        return {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          partsCount: matches.length,
        };
      };

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
              if (styleKey === "translate") {
                const parsedTranslate = parseTranslateValue(styleValue);
                elementTranslateMap.set(element, { x: parsedTranslate.x, y: parsedTranslate.y });
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
      const INSPECT_PARENT = "#00B37E";
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
        const parentBox = createBox(INSPECT_PARENT);
        const parentLabel = createLabel(INSPECT_PARENT);

        parentBox.style.borderStyle = "dashed";
        parentBox.style.borderWidth = "1px";
        parentBox.style.opacity = "0.9";

        overlay.appendChild(parentBox);
        overlay.appendChild(parentLabel.container);
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
          update({ hovered, selected, parent }) {
            updateBox(parentBox, parentLabel, parent, "Parent");
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

      const resolveLayoutParentTarget = () => {
        if (!layoutState.enabled) return null;
        const target = layoutState.active ?? inspectState.selected;
        if (!target) return null;
        const parent = target.parentElement;
        if (!parent) return null;
        const container = document.getElementById("snippet-container");
        if (container && !container.contains(parent)) return null;
        return parent;
      };

      const updateInspectOverlay = () => {
        const showOverlay = inspectState.enabled || layoutState.enabled;
        if (!showOverlay) {
          inspectOverlay.setEnabled(false);
          return;
        }
        inspectOverlay.setEnabled(true);
        inspectOverlay.update({
          hovered: inspectState.enabled ? inspectState.hovered : null,
          selected: inspectState.enabled ? inspectState.selected : null,
          parent: resolveLayoutParentTarget(),
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
        if (layoutState.dragging) return;
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

      const layoutState = {
        enabled: false,
        dragging: false,
        active: null,
        pointerId: null,
        startX: 0,
        startY: 0,
        latestX: 0,
        latestY: 0,
        baseTranslate: { x: 0, y: 0 },
        currentTranslate: { x: 0, y: 0 },
        bounds: null,
        raf: 0,
        bodyUserSelect: "",
        commitPending: false,
        commitTimeout: 0,
      };

      const snapState = {
        enabled: true,
        baseGridSize: 8,      // Base grid in visual pixels
        baseThreshold: 6,     // Base threshold in visual pixels
        altHeld: false,
        scaleForSnap: 1,
        siblingEdges: { xEdges: [], yEdges: [], xCenters: [], yCenters: [] },
      };

      const clampGridSize = (value) => {
        if (!Number.isFinite(value)) return snapState.baseGridSize;
        return Math.min(64, Math.max(2, Math.round(value)));
      };

      const snapGuides = {
        container: null,
        vLine: null,
        hLine: null,
        ensure() {
          if (this.container) return;
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.inset = "0";
          container.style.pointerEvents = "none";
          container.style.zIndex = "99999";
          const vLine = document.createElement("div");
          vLine.style.position = "absolute";
          vLine.style.top = "0";
          vLine.style.bottom = "0";
          vLine.style.width = "1px";
          vLine.style.background = "#00ff00";
          vLine.style.display = "none";
          const hLine = document.createElement("div");
          hLine.style.position = "absolute";
          hLine.style.left = "0";
          hLine.style.right = "0";
          hLine.style.height = "1px";
          hLine.style.background = "#00ff00";
          hLine.style.display = "none";
          container.appendChild(vLine);
          container.appendChild(hLine);
          document.body.appendChild(container);
          this.container = container;
          this.vLine = vLine;
          this.hLine = hLine;
        },
        showVertical(x, thickness = 1) {
          this.ensure();
          if (!this.vLine) return;
          const width = Math.max(1, Math.round(thickness));
          this.vLine.style.display = "block";
          this.vLine.style.width = String(width) + "px";
          this.vLine.style.left = String(Math.round(x - width / 2)) + "px";
        },
        showHorizontal(y, thickness = 1) {
          this.ensure();
          if (!this.hLine) return;
          const height = Math.max(1, Math.round(thickness));
          this.hLine.style.display = "block";
          this.hLine.style.height = String(height) + "px";
          this.hLine.style.top = String(Math.round(y - height / 2)) + "px";
        },
        hide() {
          if (this.vLine) this.vLine.style.display = "none";
          if (this.hLine) this.hLine.style.display = "none";
        },
      };

      const collectSiblingEdges = (element, bounds) => {
        const xEdges = [];
        const yEdges = [];
        const xCenters = [];
        const yCenters = [];
        if (!element || !bounds) return { xEdges, yEdges, xCenters, yCenters };

        if (!bounds.containerRect) {
          return { xEdges, yEdges, xCenters, yCenters };
        }

        const containerRect = bounds.containerRect;
        const parent = element.parentElement;
        if (!parent) return { xEdges, yEdges, xCenters, yCenters };

        const addRectEdges = (rect) => {
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          const left = rect.left - containerRect.left;
          const right = rect.right - containerRect.left;
          const centerX = (left + right) / 2;
          const top = rect.top - containerRect.top;
          const bottom = rect.bottom - containerRect.top;
          const centerY = (top + bottom) / 2;
          xEdges.push(left, right);
          yEdges.push(top, bottom);
          xCenters.push(centerX);
          yCenters.push(centerY);
        };

        const collectFromNode = (node) => {
          if (!node || node === element) return;
          if (!(node instanceof Element)) return;
          if (node.contains(element)) return;
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            addRectEdges(rect);
            return;
          }
          const children = node.children;
          for (let i = 0; i < children.length; i++) {
            collectFromNode(children[i]);
          }
        };

        const siblings = parent.children;
        for (let i = 0; i < siblings.length; i++) {
          collectFromNode(siblings[i]);
        }

        if (bounds.parentRect && bounds.parentRect.width > 0 && bounds.parentRect.height > 0) {
          addRectEdges(bounds.parentRect);
        }

        // Add container boundary edges (edges of the whole preview area)
        xEdges.push(0, containerRect.width);
        yEdges.push(0, containerRect.height);
        xCenters.push(containerRect.width / 2);
        yCenters.push(containerRect.height / 2);

        // Deduplicate edges (remove duplicates within 1px tolerance)
        const dedupe = (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          return sorted.filter((v, i) => i === 0 || Math.abs(v - sorted[i - 1]) > 1);
        };

        return {
          xEdges: dedupe(xEdges),
          yEdges: dedupe(yEdges),
          xCenters: dedupe(xCenters),
          yCenters: dedupe(yCenters),
        };
      };

      const snapToEdges = (value, edges, threshold) => {
        let closest = value;
        let minDist = threshold + 1;
        for (let i = 0; i < edges.length; i++) {
          const dist = Math.abs(value - edges[i]);
          if (dist < minDist) {
            minDist = dist;
            closest = edges[i];
          }
        }
        return { value: closest, dist: minDist };
      };

      const applySnapping = (translate, elementRect, containerRect) => {
        snapGuides.hide();
        if (!snapState.enabled || snapState.altHeld) {
          return translate;
        }
        if (!containerRect) {
          return translate;
        }

        const scaleForSnap = snapState.scaleForSnap > 0 ? snapState.scaleForSnap : 1;
        const grid = snapState.baseGridSize / scaleForSnap;
        const threshold = snapState.baseThreshold / scaleForSnap;
        const siblingEdges = snapState.siblingEdges;
        const baseX = layoutState.baseTranslate.x;
        const baseY = layoutState.baseTranslate.y;
        const deltaX = translate.x - baseX;
        const deltaY = translate.y - baseY;

        // Calculate element position in CONTAINER-relative coordinates
        // This matches the coordinate system used in collectSiblingEdges
        const elemLeft = elementRect.left - containerRect.left + deltaX;
        const elemRight = elemLeft + elementRect.width;
        const elemCenterX = (elemLeft + elemRight) / 2;
        const elemTop = elementRect.top - containerRect.top + deltaY;
        const elemBottom = elemTop + elementRect.height;
        const elemCenterY = (elemTop + elemBottom) / 2;

        let snapDeltaX = deltaX;
        let snapDeltaY = deltaY;
        let snappedX = false;
        let snappedY = false;
        let snapXValue = null;
        let snapYValue = null;
        const xEdges = siblingEdges.xEdges || [];
        const yEdges = siblingEdges.yEdges || [];
        const xCenters = siblingEdges.xCenters || [];
        const yCenters = siblingEdges.yCenters || [];

        // Try to snap to sibling/container edges first
        const leftSnap = snapToEdges(elemLeft, xEdges, threshold);
        const rightSnap = snapToEdges(elemRight, xEdges, threshold);
        const centerXSnap = snapToEdges(elemCenterX, xCenters, threshold);
        const leftDiff = leftSnap.dist;
        const rightDiff = rightSnap.dist;
        const centerXDiff = centerXSnap.dist;

        if (leftDiff <= threshold || rightDiff <= threshold) {
          if (leftDiff <= rightDiff) {
            snapDeltaX = deltaX + (leftSnap.value - elemLeft);
            snappedX = true;
            snapXValue = leftSnap.value;
          } else {
            snapDeltaX = deltaX + (rightSnap.value - elemRight);
            snappedX = true;
            snapXValue = rightSnap.value;
          }
        } else if (centerXDiff <= threshold) {
          snapDeltaX = deltaX + (centerXSnap.value - elemCenterX);
          snappedX = true;
          snapXValue = centerXSnap.value;
        }

        const topSnap = snapToEdges(elemTop, yEdges, threshold);
        const bottomSnap = snapToEdges(elemBottom, yEdges, threshold);
        const centerYSnap = snapToEdges(elemCenterY, yCenters, threshold);
        const topDiff = topSnap.dist;
        const bottomDiff = bottomSnap.dist;
        const centerYDiff = centerYSnap.dist;

        if (topDiff <= threshold || bottomDiff <= threshold) {
          if (topDiff <= bottomDiff) {
            snapDeltaY = deltaY + (topSnap.value - elemTop);
            snappedY = true;
            snapYValue = topSnap.value;
          } else {
            snapDeltaY = deltaY + (bottomSnap.value - elemBottom);
            snappedY = true;
            snapYValue = bottomSnap.value;
          }
        } else if (centerYDiff <= threshold) {
          snapDeltaY = deltaY + (centerYSnap.value - elemCenterY);
          snappedY = true;
          snapYValue = centerYSnap.value;
        }

        // If no edge snap, apply grid snapping
        // Grid snap rounds the element position to nearest grid line
        if (!snappedX) {
          const snappedElemLeft = Math.round(elemLeft / grid) * grid;
          snapDeltaX = deltaX + (snappedElemLeft - elemLeft);
        }
        if (!snappedY) {
          const snappedElemTop = Math.round(elemTop / grid) * grid;
          snapDeltaY = deltaY + (snappedElemTop - elemTop);
        }

        const guideThickness = Math.max(1, Math.round(1 / scaleForSnap));
        if (snappedX && Number.isFinite(snapXValue)) {
          snapGuides.showVertical(containerRect.left + snapXValue, guideThickness);
        }
        if (snappedY && Number.isFinite(snapYValue)) {
          snapGuides.showHorizontal(containerRect.top + snapYValue, guideThickness);
        }

        return {
          x: baseX + snapDeltaX,
          y: baseY + snapDeltaY,
        };
      };

      const layoutDebugState = {
        enabled: false,
        seq: 0,
        lastSentAt: 0,
      };
      let pendingCodeUpdate = null;
      let pendingPropsRender = false;

      const getElementTranslate = (element) => {
        if (!element) return { x: 0, y: 0 };
        const source = elementSourceMap.get(element) ?? null;
        const inlineValue = element.style && element.style.translate ? element.style.translate : "";
        const computedStyle = window.getComputedStyle(element);
        const computedValue = computedStyle.translate || computedStyle.getPropertyValue("translate");
        const inlineParsed = inlineValue ? parseTranslateValue(inlineValue) : null;
        const computedParsed = computedValue ? parseTranslateValue(computedValue) : null;
        const preferredParsed =
          inlineParsed && inlineParsed.partsCount >= 2
            ? inlineParsed
            : computedParsed && computedParsed.partsCount >= 2
              ? computedParsed
              : null;
        if (preferredParsed) {
          elementTranslateMap.set(element, { x: preferredParsed.x, y: preferredParsed.y });
          if (source) {
            setStoredSourceTranslate(source, preferredParsed);
          }
          return { x: preferredParsed.x, y: preferredParsed.y };
        }
        const fallback = source ? getStoredSourceTranslate(source) : null;
        if (fallback) {
          return { x: fallback.x ?? 0, y: fallback.y ?? 0 };
        }
        const stored = elementTranslateMap.get(element);
        if (stored) {
          return { x: stored.x ?? 0, y: stored.y ?? 0 };
        }
        const parsed = parseTranslateValue(computedValue);
        return { x: parsed.x, y: parsed.y };
      };

      const setLayoutCursor = (isDragging) => {
        const container = document.getElementById("snippet-container");
        if (!container) return;
        if (!layoutState.enabled) {
          container.style.cursor = "";
          return;
        }
        container.style.cursor = isDragging ? "grabbing" : "grab";
      };

      const computeDragDelta = () => {
        // Mouse events in iframes ARE scaled by the parent's CSS transform.
        // At scale=0.25, dragging 10 visual pixels reports delta=40 design pixels.
        // No additional scaling needed here - browser handles coordinate mapping.
        return {
          dx: layoutState.latestX - layoutState.startX,
          dy: layoutState.latestY - layoutState.startY,
        };
      };

      const clampValue = (value, min, max) => {
        if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
          return value;
        }
        if (min <= max) {
          return Math.min(Math.max(value, min), max);
        }
        return Math.min(Math.max(value, max), min);
      };

      const snapshotRect = (rect) => {
        if (!rect) return null;
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };

      const buildLayoutBounds = (element) => {
        if (!element || !(element instanceof Element)) return null;
        const parent = element.parentElement;
        if (!parent) return null;
        const container = document.getElementById("snippet-container");
        if (!container) return null;
        const elementRect = snapshotRect(element.getBoundingClientRect());
        const parentRect = snapshotRect(parent.getBoundingClientRect());
        const containerRect = snapshotRect(container.getBoundingClientRect());
        if (!elementRect || !parentRect || !containerRect) return null;
        if (
          !Number.isFinite(elementRect.width) ||
          !Number.isFinite(elementRect.height) ||
          elementRect.width <= 0 ||
          elementRect.height <= 0
        ) {
          return null;
        }
        if (
          !Number.isFinite(parentRect.width) ||
          !Number.isFinite(parentRect.height) ||
          parentRect.width <= 0 ||
          parentRect.height <= 0
        ) {
          return null;
        }
        return { elementRect, parentRect, containerRect };
      };

      const constrainTranslateToParent = (translate) => {
        const bounds = layoutState.bounds;
        if (!bounds) return translate;
        const base = layoutState.baseTranslate;
        const deltaX = translate.x - base.x;
        const deltaY = translate.y - base.y;
        const minX = bounds.parentRect.left - bounds.elementRect.left;
        const maxX = bounds.parentRect.right - bounds.elementRect.right;
        const minY = bounds.parentRect.top - bounds.elementRect.top;
        const maxY = bounds.parentRect.bottom - bounds.elementRect.bottom;
        const clampedDeltaX = clampValue(deltaX, minX, maxX);
        const clampedDeltaY = clampValue(deltaY, minY, maxY);
        return {
          x: base.x + clampedDeltaX,
          y: base.y + clampedDeltaY,
        };
      };

      const parentSupportsAutoMargin = (element) => {
        if (!element || !(element instanceof Element)) return false;
        const parent = element.parentElement;
        if (!parent) return false;
        const display = window.getComputedStyle(parent).display;
        return display.includes("flex") || display.includes("grid");
      };

      const resolveAlignmentX = (translate, bounds) => {
        if (!snapState.enabled || snapState.altHeld || !bounds) return null;
        const parentRect = bounds.parentRect;
        const elementRect = bounds.elementRect;
        if (!parentRect || !elementRect) return null;
        const scaleForSnap = snapState.scaleForSnap > 0 ? snapState.scaleForSnap : 1;
        const threshold = Math.max(1, snapState.baseThreshold / scaleForSnap);
        const deltaX = translate.x - layoutState.baseTranslate.x;
        const elemLeft = elementRect.left + deltaX;
        const elemRight = elemLeft + elementRect.width;
        const elemCenter = elemLeft + elementRect.width / 2;
        const parentLeft = parentRect.left;
        const parentRight = parentRect.right;
        const parentCenter = parentLeft + parentRect.width / 2;
        const widthDiff = Math.abs(parentRect.width - elementRect.width);
        if (widthDiff <= threshold) return null;
        const leftDiff = Math.abs(elemLeft - parentLeft);
        const rightDiff = Math.abs(elemRight - parentRight);
        const centerDiff = Math.abs(elemCenter - parentCenter);
        const minDiff = Math.min(leftDiff, rightDiff, centerDiff);
        if (minDiff > threshold) return null;
        if (minDiff === centerDiff) return "center";
        if (minDiff === leftDiff) return "left";
        return "right";
      };

      const resolveAlignmentY = (translate, bounds, element) => {
        if (!snapState.enabled || snapState.altHeld || !bounds) return null;
        if (!parentSupportsAutoMargin(element)) return null;
        const parentRect = bounds.parentRect;
        const elementRect = bounds.elementRect;
        if (!parentRect || !elementRect) return null;
        const scaleForSnap = snapState.scaleForSnap > 0 ? snapState.scaleForSnap : 1;
        const threshold = Math.max(1, snapState.baseThreshold / scaleForSnap);
        const deltaY = translate.y - layoutState.baseTranslate.y;
        const elemTop = elementRect.top + deltaY;
        const elemBottom = elemTop + elementRect.height;
        const elemCenter = elemTop + elementRect.height / 2;
        const parentTop = parentRect.top;
        const parentBottom = parentRect.bottom;
        const parentCenter = parentTop + parentRect.height / 2;
        const heightDiff = Math.abs(parentRect.height - elementRect.height);
        if (heightDiff <= threshold) return null;
        const topDiff = Math.abs(elemTop - parentTop);
        const bottomDiff = Math.abs(elemBottom - parentBottom);
        const centerDiff = Math.abs(elemCenter - parentCenter);
        const minDiff = Math.min(topDiff, bottomDiff, centerDiff);
        if (minDiff > threshold) return null;
        if (minDiff === centerDiff) return "center";
        if (minDiff === topDiff) return "top";
        return "bottom";
      };

      const buildLayoutDebugEntry = (kind, event, target, extra) => {
        const { dx, dy } = computeDragDelta();
        const rect = target && typeof target.getBoundingClientRect === "function"
          ? target.getBoundingClientRect()
          : null;
        const inlineTranslate = target?.style?.translate ?? null;
        const computedStyle = target ? window.getComputedStyle(target) : null;
        const computedTranslate = computedStyle
          ? computedStyle.translate || computedStyle.getPropertyValue("translate")
          : null;
        const computedTransform = computedStyle ? computedStyle.transform : null;
        const parsedInline = inlineTranslate ? parseTranslateValue(inlineTranslate) : null;
        const parsedComputed = computedTranslate ? parseTranslateValue(computedTranslate) : null;
        const source = target ? (elementSourceMap.get(target) ?? null) : null;
        return {
          seq: ++layoutDebugState.seq,
          time: Date.now(),
          kind,
          pointerId: event?.pointerId ?? layoutState.pointerId ?? null,
          clientX: typeof event?.clientX === "number" ? event.clientX : null,
          clientY: typeof event?.clientY === "number" ? event.clientY : null,
          movementX: typeof event?.movementX === "number" ? event.movementX : null,
          movementY: typeof event?.movementY === "number" ? event.movementY : null,
          startX: layoutState.startX,
          startY: layoutState.startY,
          latestX: layoutState.latestX,
          latestY: layoutState.latestY,
          dx,
          dy,
          baseTranslate: layoutState.baseTranslate,
          currentTranslate: layoutState.currentTranslate,
          tag: target?.tagName ? String(target.tagName).toLowerCase() : null,
          rect: rect
            ? {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              }
            : null,
          source,
          inspectScale,
          inlineTranslate,
          computedTranslate,
          computedTransform,
          parsedInline,
          parsedComputed,
          sourceKey: source ? getSourceKey(source) : null,
          ...extra,
        };
      };

      const sendLayoutDebug = (entry) => {
        if (!layoutDebugState.enabled) return;
        parent.postMessage({ type: "layout-debug", entry }, "*");
      };

      const shouldSendMoveDebug = (rawDx, rawDy) => {
        const now = Date.now();
        const largeJump = Math.abs(rawDx) > 48 || Math.abs(rawDy) > 48;
        if (largeJump) {
          layoutDebugState.lastSentAt = now;
          return true;
        }
        if (now - layoutDebugState.lastSentAt > 140) {
          layoutDebugState.lastSentAt = now;
          return true;
        }
        return false;
      };

      const applyLayoutTranslate = () => {
        if (!layoutState.dragging || !layoutState.active) return;
        const bounds = layoutState.bounds;
        if (!bounds) return;
        const { dx, dy } = computeDragDelta();
        let nextTranslate = constrainTranslateToParent({
          x: layoutState.baseTranslate.x + dx,
          y: layoutState.baseTranslate.y + dy,
        });
        nextTranslate = applySnapping(nextTranslate, bounds.elementRect, bounds.containerRect);
        nextTranslate = constrainTranslateToParent(nextTranslate);
        layoutState.currentTranslate = nextTranslate;
        layoutState.active.style.translate = nextTranslate.x + "px " + nextTranslate.y + "px";
        elementTranslateMap.set(layoutState.active, nextTranslate);
        updateInspectOverlay();
      };

      const scheduleLayoutTranslate = () => {
        if (layoutState.raf) return;
        layoutState.raf = window.requestAnimationFrame(() => {
          layoutState.raf = 0;
          applyLayoutTranslate();
        });
      };

      const stopLayoutDrag = (commit) => {
        if (!layoutState.dragging) return;
        layoutState.dragging = false;
        snapGuides.hide();
        const activeTarget = layoutState.active;
        const activePointerId = layoutState.pointerId;
        if (layoutState.raf) {
          window.cancelAnimationFrame(layoutState.raf);
          layoutState.raf = 0;
        }
        const { dx, dy } = computeDragDelta();
        const moved = Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5;
        const target = layoutState.active;
        const translate = layoutState.currentTranslate;
        const bounds = layoutState.bounds;
        layoutState.active = null;
        layoutState.pointerId = null;
        layoutState.bounds = null;
        document.removeEventListener("pointermove", handleLayoutPointerMove);
        document.removeEventListener("pointerup", handleLayoutPointerUp);
        document.removeEventListener("pointercancel", handleLayoutPointerCancel);
        document.body.style.userSelect = layoutState.bodyUserSelect;
        setLayoutCursor(false);
        updateInspectOverlay();
        if (activeTarget && activePointerId !== null && typeof activeTarget.releasePointerCapture === "function") {
          try {
            activeTarget.releasePointerCapture(activePointerId);
          } catch {
            // Ignore release failures for cross-browser safety.
          }
        }
        const didCommit = Boolean(commit && moved && target);
        if (didCommit) {
          const source = elementSourceMap.get(target) ?? null;
          const alignX = resolveAlignmentX(translate, bounds);
          const alignY = resolveAlignmentY(translate, bounds, target);
          if (source) {
            setStoredSourceTranslate(source, translate);
          }
          layoutState.commitPending = true;
          if (layoutState.commitTimeout) {
            window.clearTimeout(layoutState.commitTimeout);
          }
          layoutState.commitTimeout = window.setTimeout(() => {
            layoutState.commitPending = false;
            layoutState.commitTimeout = 0;
            if (pendingPropsRender) {
              pendingPropsRender = false;
              renderWithProps(latestPropsPayload);
            }
          }, 1200);
          parent.postMessage(
            {
              type: "layout-commit",
              commit: {
                source,
                translate,
                alignX,
                alignY,
              },
            },
            "*",
          );
        }
        if (didCommit && layoutDebugState.enabled) {
          sendLayoutDebug(
            buildLayoutDebugEntry("commit", null, target, {
              translate,
              moved,
            }),
          );
        }
        if (didCommit) {
          pendingCodeUpdate = null;
          return;
        }
        if (pendingCodeUpdate) {
          const next = pendingCodeUpdate;
          pendingCodeUpdate = null;
          pendingPropsRender = false;
          resetInspectState();
          applyCompiledCode(next.code);
          renderWithProps(next.propsPayload);
          return;
        }
        if (pendingPropsRender) {
          pendingPropsRender = false;
          renderWithProps(latestPropsPayload);
        }
      };

      const handleLayoutPointerMove = (event) => {
        if (!layoutState.dragging) return;
        if (layoutState.pointerId !== null && event.pointerId !== layoutState.pointerId) return;
        const rawDx = event.clientX - layoutState.latestX;
        const rawDy = event.clientY - layoutState.latestY;
        layoutState.latestX = event.clientX;
        layoutState.latestY = event.clientY;
        snapState.altHeld = Boolean(event.altKey);
        if (layoutDebugState.enabled && shouldSendMoveDebug(rawDx, rawDy)) {
          sendLayoutDebug(
            buildLayoutDebugEntry("pointermove", event, layoutState.active, {
              note: Math.abs(rawDx) > 48 || Math.abs(rawDy) > 48 ? "jump-delta" : undefined,
            }),
          );
        }
        scheduleLayoutTranslate();
      };

      const handleLayoutPointerUp = (event) => {
        if (layoutState.pointerId !== null && event.pointerId !== layoutState.pointerId) return;
        if (layoutDebugState.enabled) {
          sendLayoutDebug(buildLayoutDebugEntry("pointerup", event, layoutState.active));
        }
        stopLayoutDrag(true);
      };

      const handleLayoutPointerCancel = (event) => {
        if (layoutState.pointerId !== null && event.pointerId !== layoutState.pointerId) return;
        if (layoutDebugState.enabled) {
          sendLayoutDebug(buildLayoutDebugEntry("pointercancel", event, layoutState.active));
        }
        stopLayoutDrag(false);
      };

      const handleLayoutPointerDown = (event) => {
        if (!layoutState.enabled) return;
        if (event.button !== 0) return;
        if (layoutState.dragging) {
          stopLayoutDrag(false);
        }
        const target = resolveInspectableTarget(event.target);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        inspectState.selected = target;
        inspectState.hovered = null;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", target);
        layoutState.active = target;
        layoutState.dragging = true;
        layoutState.startX = event.clientX;
        layoutState.startY = event.clientY;
        layoutState.latestX = event.clientX;
        layoutState.latestY = event.clientY;
        layoutState.baseTranslate = getElementTranslate(target);
        layoutState.currentTranslate = layoutState.baseTranslate;
        layoutState.bounds = buildLayoutBounds(target);
        layoutState.pointerId = event.pointerId;
        snapState.altHeld = Boolean(event.altKey);
        snapState.scaleForSnap = inspectScale > 0 ? inspectScale : 1;
        if (snapState.enabled && layoutState.bounds) {
          snapState.siblingEdges = collectSiblingEdges(target, layoutState.bounds);
        } else {
          snapState.siblingEdges = { xEdges: [], yEdges: [], xCenters: [], yCenters: [] };
        }
        if (layoutDebugState.enabled) {
          sendLayoutDebug(buildLayoutDebugEntry("pointerdown", event, target));
        }
        layoutState.bodyUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        setLayoutCursor(true);
        if (typeof target.setPointerCapture === "function") {
          try {
            target.setPointerCapture(event.pointerId);
          } catch {
            // Ignore capture failures for cross-browser safety.
          }
        }
        document.addEventListener("pointermove", handleLayoutPointerMove);
        document.addEventListener("pointerup", handleLayoutPointerUp);
        document.addEventListener("pointercancel", handleLayoutPointerCancel);
      };

      let layoutListenersAttached = false;
      const attachLayoutListeners = () => {
        if (layoutListenersAttached) return;
        layoutListenersAttached = true;
        document.addEventListener("pointerdown", handleLayoutPointerDown);
      };

      const detachLayoutListeners = () => {
        if (!layoutListenersAttached) return;
        layoutListenersAttached = false;
        document.removeEventListener("pointerdown", handleLayoutPointerDown);
      };

      const setLayoutEnabled = (enabled) => {
        layoutState.enabled = Boolean(enabled);
        if (!layoutState.enabled) {
          detachLayoutListeners();
          stopLayoutDrag(false);
          snapGuides.hide();
          layoutState.commitPending = false;
          layoutState.bounds = null;
          if (layoutState.commitTimeout) {
            window.clearTimeout(layoutState.commitTimeout);
            layoutState.commitTimeout = 0;
          }
          clearLayoutCache();
          setLayoutCursor(false);
          updateInspectOverlay();
          return;
        }
        attachLayoutListeners();
        setLayoutCursor(false);
        updateInspectOverlay();
      };

      const LAYER_SNAPSHOT_LIMIT = 700;
      const layersState = {
        enabled: false,
        raf: 0,
      };

      const parseZIndexValue = (value) => {
        if (!value || value === "auto") return null;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const createsStackingContext = (element, style) => {
        if (!element || !style) return false;
        if (element === document.documentElement) return true;
        if (style.position !== "static" && style.zIndex !== "auto") return true;
        if (style.opacity && style.opacity !== "1") return true;
        if (style.transform && style.transform !== "none") return true;
        if (style.filter && style.filter !== "none") return true;
        if (style.perspective && style.perspective !== "none") return true;
        if (style.isolation === "isolate") return true;
        if (style.mixBlendMode && style.mixBlendMode !== "normal") return true;
        if (style.willChange && /(transform|opacity|filter|perspective)/.test(style.willChange)) {
          return true;
        }
        return false;
      };

      const captureLayerSnapshot = () => {
        try {
          const container = document.getElementById("snippet-container");
          if (!container) return;
          const containerRect = container.getBoundingClientRect();
          const width = Math.max(0, Math.round(containerRect.width));
          const height = Math.max(0, Math.round(containerRect.height));
          if (!width || !height) return;

          const nodes = [];
          let order = 0;
          const rootId = "root";

          nodes.push({
            id: rootId,
            tag: "root",
            rect: { x: 0, y: 0, width, height },
            depth: 0,
            stackDepth: 0,
            zIndex: null,
            opacity: 1,
            order: order++,
            parentId: null,
            source: null,
          });

          const traverse = (element, depth, stackDepth, parentId) => {
            if (!element || nodes.length >= LAYER_SNAPSHOT_LIMIT) return;
            const style = window.getComputedStyle(element);
            if (!style || style.display === "none") return;

            const rect = element.getBoundingClientRect();
            const rectWidth = Math.max(0, rect.width);
            const rectHeight = Math.max(0, rect.height);
            const isVisible = rectWidth > 0 && rectHeight > 0 && style.visibility !== "hidden";

            const zIndex = parseZIndexValue(style.zIndex);
            const opacity = Number.parseFloat(style.opacity);
            const nextStackDepth = createsStackingContext(element, style)
              ? stackDepth + 1
              : stackDepth;

            let nextParentId = parentId;
            if (isVisible && nodes.length < LAYER_SNAPSHOT_LIMIT) {
              const nodeId = "node-" + nodes.length;
              const source = elementSourceMap.get(element) ?? null;
              nodes.push({
                id: nodeId,
                tag: element.tagName ? element.tagName.toLowerCase() : "element",
                rect: {
                  x: rect.left - containerRect.left,
                  y: rect.top - containerRect.top,
                  width: rectWidth,
                  height: rectHeight,
                },
                depth,
                stackDepth: nextStackDepth,
                zIndex,
                opacity: Number.isFinite(opacity) ? opacity : 1,
                order: order++,
                parentId,
                source,
              });
              nextParentId = nodeId;
            }

            const children = element.children;
            for (let index = 0; index < children.length; index += 1) {
              if (nodes.length >= LAYER_SNAPSHOT_LIMIT) break;
              traverse(children[index], depth + 1, nextStackDepth, nextParentId);
            }
          };

          const rootChildren = container.children;
          for (let index = 0; index < rootChildren.length; index += 1) {
            if (nodes.length >= LAYER_SNAPSHOT_LIMIT) break;
            traverse(rootChildren[index], 1, 0, rootId);
          }

          parent.postMessage(
            {
              type: "layers-snapshot",
              snapshot: {
                width,
                height,
                capturedAt: Date.now(),
                nodes,
              },
            },
            "*",
          );
        } catch (error) {
          const message = error && error.message ? error.message : "Layers snapshot failed";
          parent.postMessage({ type: "layers-error", error: message }, "*");
        }
      };

      const scheduleLayerSnapshot = () => {
        if (!layersState.enabled || layersState.raf) return;
        layersState.raf = window.requestAnimationFrame(() => {
          layersState.raf = 0;
          captureLayerSnapshot();
        });
      };

      const setLayersEnabled = (enabled) => {
        layersState.enabled = Boolean(enabled);
        if (!layersState.enabled) {
          if (layersState.raf) {
            window.cancelAnimationFrame(layersState.raf);
            layersState.raf = 0;
          }
          return;
        }
        scheduleLayerSnapshot();
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
        clearLayoutCache();
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
          scheduleLayerSnapshot();
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
          const nextScale = typeof data.scale === "number" ? data.scale : 1;
          setInspectScale(nextScale);
          snapState.scaleForSnap = inspectScale;
          return;
        }
        if (data.type === "layout-toggle") {
          setLayoutEnabled(Boolean(data.enabled));
          return;
        }
        if (data.type === "layout-snap-toggle") {
          snapState.enabled = Boolean(data.enabled);
          return;
        }
        if (data.type === "layout-snap-grid") {
          if (typeof data.grid === "number") {
            snapState.baseGridSize = clampGridSize(data.grid);
          }
          return;
        }
        if (data.type === "layout-debug-toggle") {
          layoutDebugState.enabled = Boolean(data.enabled);
          layoutDebugState.seq = 0;
          layoutDebugState.lastSentAt = 0;
          if (layoutDebugState.enabled) {
            sendLayoutDebug(buildLayoutDebugEntry("debug-toggle", null, layoutState.active, {
              note: "enabled",
            }));
          }
          return;
        }
        if (data.type === "layers-toggle") {
          setLayersEnabled(Boolean(data.enabled));
          return;
        }
        if (data.type === "layers-request") {
          scheduleLayerSnapshot();
          return;
        }
        if (data.type === "code-update") {
          if (typeof data.propsJson === "string" || typeof data.props === "string" || typeof data.props === "object") {
            latestPropsPayload = data.propsJson ?? data.props;
          }
          if (layoutState.commitTimeout) {
            window.clearTimeout(layoutState.commitTimeout);
            layoutState.commitTimeout = 0;
          }
          layoutState.commitPending = false;
          if (layoutState.dragging) {
            pendingCodeUpdate = { code: data.code, propsPayload: latestPropsPayload };
            return;
          }
          resetInspectState();
          applyCompiledCode(data.code);
          renderWithProps(latestPropsPayload);
          pendingPropsRender = false;
          pendingCodeUpdate = null;
          return;
        }
        if (data.type === "tailwind-update") {
          setTailwindCss(data.css);
          return;
        }
        if (data.type === "props-update") {
          latestPropsPayload = data.propsJson ?? data.props;
          if (layoutState.dragging) {
            pendingPropsRender = true;
            return;
          }
          if (layoutState.commitPending) {
            pendingPropsRender = true;
            return;
          }
          renderWithProps(latestPropsPayload);
        }
      });

      window.addEventListener("beforeunload", () => {
        if (layersState.raf) {
          window.cancelAnimationFrame(layersState.raf);
          layersState.raf = 0;
        }
        if (layoutState.raf) {
          window.cancelAnimationFrame(layoutState.raf);
          layoutState.raf = 0;
        }
        if (layoutState.commitTimeout) {
          window.clearTimeout(layoutState.commitTimeout);
          layoutState.commitTimeout = 0;
        }
        layoutState.commitPending = false;
        detachLayoutListeners();
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
