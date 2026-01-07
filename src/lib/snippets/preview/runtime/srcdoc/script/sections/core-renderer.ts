export const PREVIEW_SRCDOC_SCRIPT_CORE_RENDERER = `    // Signal that iframe is ready
    parent.postMessage({ type: 'ready' }, '*');

    const SCRIPT_NONCE = "__EVENCIO_SNIPPET_PREVIEW_NONCE__";

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
      const sourceElementMap = new Map();
      const sourceElementMapByLine = new Map();
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

      const getSourceLineKey = (source) => {
        if (!source || typeof source !== "object") return null;
        const fileName = source.fileName ?? "";
        const line = source.lineNumber ?? "";
        return String(fileName) + ":" + String(line);
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

      const resetSourceElementMap = () => {
        sourceElementMap.clear();
        sourceElementMapByLine.clear();
      };

      const registerSourceElement = (element, source) => {
        const key = getSourceKey(source);
        if (!key) return;
        const existing = sourceElementMap.get(key);
        if (existing) {
          existing.push(element);
        } else {
          sourceElementMap.set(key, [element]);
        }
        const lineKey = getSourceLineKey(source);
        if (!lineKey) return;
        const byLine = sourceElementMapByLine.get(lineKey);
        if (byLine) {
          byLine.push(element);
        } else {
          sourceElementMapByLine.set(lineKey, [element]);
        }
      };

      const pickSourceCandidate = (candidates) => {
        if (!candidates || candidates.length === 0) return null;
        const container = document.getElementById("snippet-container");
        if (!container) return candidates[0] ?? null;
        for (const element of candidates) {
          if (element && container.contains(element)) return element;
        }
        return candidates[0] ?? null;
      };

      const resolveElementFromSource = (source) => {
        const key = getSourceKey(source);
        if (key) {
          const direct = pickSourceCandidate(sourceElementMap.get(key));
          if (direct) return direct;
        }
        if (source && typeof source === "object") {
          const column = source.columnNumber;
          if (typeof column === "number") {
            const prevKey = getSourceKey({ ...source, columnNumber: column - 1 });
            const prevMatch = pickSourceCandidate(prevKey ? sourceElementMap.get(prevKey) : null);
            if (prevMatch) return prevMatch;
            const nextKey = getSourceKey({ ...source, columnNumber: column + 1 });
            const nextMatch = pickSourceCandidate(nextKey ? sourceElementMap.get(nextKey) : null);
            if (nextMatch) return nextMatch;
          }
          const lineKey = getSourceLineKey(source);
          const lineMatch = pickSourceCandidate(
            lineKey ? sourceElementMapByLine.get(lineKey) : null,
          );
          if (lineMatch) return lineMatch;
        }
        return null;
      };

      const unitlessStyles = new Set(__EVENCIO_SNIPPET_PREVIEW_UNITLESS_STYLES__);
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
          registerSourceElement(element, sourceInfo);
        }
        normalizeChildren(props?.children).forEach((child) => renderNode(child, element, isSvgNode));
        parent.appendChild(element);
      };

      window.React = React;

`
