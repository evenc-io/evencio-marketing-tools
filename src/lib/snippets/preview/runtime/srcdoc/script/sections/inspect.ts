export const PREVIEW_SRCDOC_SCRIPT_INSPECT = `      const INSPECT_HOVER = "#FF0066";
      const INSPECT_SELECTED = "#0066FF";
      const INSPECT_PARENT = "#00B37E";
      const INSPECT_LABEL_BG = "#FFFFFF";
      const INSPECT_LABEL_TEXT = "#1E1E1E";
      const RESIZE_HANDLE_SIZE = 8;
      const RESIZE_HANDLE_BG = "#FFFFFF";
      const RESIZE_HANDLE_BORDER = INSPECT_SELECTED;
      const RESIZE_MIN_SIZE = 8;
      const resolveInspectableTarget = (target) => {
        const container = document.getElementById("snippet-container");
        if (!container) return null;
        const elementTarget = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
        if (!elementTarget) return null;
        if (!container.contains(elementTarget)) return null;

        const importWrapper = typeof elementTarget.closest === "function"
          ? elementTarget.closest("[data-snippet-asset]")
          : null;
        if (
          importWrapper &&
          importWrapper instanceof Element &&
          importWrapper !== container &&
          container.contains(importWrapper) &&
          elementSourceMap.has(importWrapper)
        ) {
          return importWrapper;
        }

        let current = elementTarget;
        while (current && current !== container) {
          if (current.getAttribute && current.getAttribute("data-snippet-inspect") === "ignore") {
            current = current.parentElement;
            continue;
          }
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

      const createInspectOverlay = (onResizeHandlePointerDown) => {
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

        const createHandle = (cursor) => {
          const handle = document.createElement("div");
          handle.style.position = "fixed";
          handle.style.width = RESIZE_HANDLE_SIZE + "px";
          handle.style.height = RESIZE_HANDLE_SIZE + "px";
          handle.style.border = "1px solid " + RESIZE_HANDLE_BORDER;
          handle.style.background = RESIZE_HANDLE_BG;
          handle.style.boxSizing = "border-box";
          handle.style.borderRadius = "2px";
          handle.style.pointerEvents = "auto";
          handle.style.cursor = cursor;
          handle.style.display = "none";
          handle.style.transform = "translate(-50%, -50%)";
          handle.style.zIndex = "10001";
          handle.style.touchAction = "none";
          return handle;
        };

        const handles = {
          nw: createHandle("nwse-resize"),
          n: createHandle("ns-resize"),
          ne: createHandle("nesw-resize"),
          e: createHandle("ew-resize"),
          se: createHandle("nwse-resize"),
          s: createHandle("ns-resize"),
          sw: createHandle("nesw-resize"),
          w: createHandle("ew-resize"),
        };

        const attachHandleListener = (handle, name) => {
          handle.setAttribute("data-snippet-resize-handle", name);
          handle.addEventListener("pointerdown", (event) => {
            if (typeof onResizeHandlePointerDown !== "function") return;
            onResizeHandlePointerDown(event, name);
          });
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
        for (const [name, handle] of Object.entries(handles)) {
          attachHandleListener(handle, name);
          overlay.appendChild(handle);
        }
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

        const setHandlePosition = (handle, x, y) => {
          handle.style.left = Math.round(x) + "px";
          handle.style.top = Math.round(y) + "px";
        };

        let handlesVisible = false;
        let handlesScale = 1;

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
          updateHandles({ target, enabled }) {
            const show = Boolean(enabled && target);
            if (show !== handlesVisible) {
              handlesVisible = show;
              for (const handle of Object.values(handles)) {
                handle.style.display = show ? "block" : "none";
              }
            }
            if (!show || !target) return;

            const handleScale = inspectScale > 0 ? 1 / inspectScale : 1;
            if (handleScale !== handlesScale) {
              handlesScale = handleScale;
              for (const handle of Object.values(handles)) {
                handle.style.transform = "translate(-50%, -50%) scale(" + handleScale + ")";
              }
            }
            const handleRadius = Math.max(0, (RESIZE_HANDLE_SIZE * handleScale) / 2);
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const clampPos = (value, min, max) => {
              if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
                return value;
              }
              if (min <= max) {
                return Math.min(Math.max(value, min), max);
              }
              return Math.min(Math.max(value, max), min);
            };
            const clampX = (x) => clampPos(x, handleRadius, viewportWidth - handleRadius);
            const clampY = (y) => clampPos(y, handleRadius, viewportHeight - handleRadius);

            const rect = target.getBoundingClientRect();
            const left = rect.left;
            const right = rect.right;
            const top = rect.top;
            const bottom = rect.bottom;
            const midX = left + rect.width / 2;
            const midY = top + rect.height / 2;
            setHandlePosition(handles.nw, clampX(left), clampY(top));
            setHandlePosition(handles.n, clampX(midX), clampY(top));
            setHandlePosition(handles.ne, clampX(right), clampY(top));
            setHandlePosition(handles.e, clampX(right), clampY(midY));
            setHandlePosition(handles.se, clampX(right), clampY(bottom));
            setHandlePosition(handles.s, clampX(midX), clampY(bottom));
            setHandlePosition(handles.sw, clampX(left), clampY(bottom));
            setHandlePosition(handles.w, clampX(left), clampY(midY));
          },
        };
      };

      const inspectOverlay = createInspectOverlay(handleResizePointerDown);
      const inspectState = {
        enabled: false,
        hovered: null,
        selected: null,
      };
      let pendingLayoutSelectionRestore = null;
      let pendingLayoutVisualOverride = null;
      const dragHighlightState = {
        enabled: false,
        hovered: null,
      };
      const INSPECT_CLICK_SUPPRESS_MS = 200;
      let inspectClickSuppressedUntil = 0;
      let suppressNextInspectClick = false;
      const queueInspectClickSuppression = () => {
        suppressNextInspectClick = true;
        inspectClickSuppressedUntil = Date.now() + INSPECT_CLICK_SUPPRESS_MS;
      };
      const consumeInspectClickSuppression = () => {
        if (!suppressNextInspectClick) return false;
        if (Date.now() > inspectClickSuppressedUntil) {
          suppressNextInspectClick = false;
          return false;
        }
        suppressNextInspectClick = false;
        inspectClickSuppressedUntil = 0;
        return true;
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

      const buildLayoutSelectionPath = (element) => {
        if (!element || !(element instanceof Element)) return null;
        const container = document.getElementById("snippet-container");
        if (!container || !(container instanceof Element)) return null;
        if (!container.contains(element)) return null;

        const path = [];
        let current = element;
        while (current && current !== container) {
          const parent = current.parentElement;
          if (!parent) return null;
          const index = Array.prototype.indexOf.call(parent.children, current);
          if (!Number.isFinite(index) || index < 0) return null;
          path.push(index);
          current = parent;
        }

        path.reverse();
        return path;
      };

      const resolveElementFromLayoutPath = (path) => {
        if (!path || !Array.isArray(path) || path.length === 0) return null;
        const container = document.getElementById("snippet-container");
        if (!container || !(container instanceof Element)) return null;

        let current = container;
        for (const index of path) {
          if (typeof index !== "number") return null;
          const next = current.children.item(index);
          if (!next || !(next instanceof Element)) return null;
          current = next;
        }

        return current;
      };

      const stashLayoutVisualOverride = (element, snapshot) => {
        if (!element || !(element instanceof Element)) return;
        const path = buildLayoutSelectionPath(element);
        if (!path) return;
        pendingLayoutVisualOverride = {
          tagName: element.tagName,
          path,
          translate: snapshot && snapshot.translate ? snapshot.translate : null,
          width: snapshot && typeof snapshot.width === "number" ? snapshot.width : null,
          height: snapshot && typeof snapshot.height === "number" ? snapshot.height : null,
        };
      };

      const applyPendingLayoutVisualOverride = () => {
        if (!pendingLayoutVisualOverride) return;
        const snapshot = pendingLayoutVisualOverride;
        pendingLayoutVisualOverride = null;

        const target = resolveElementFromLayoutPath(snapshot.path);
        if (!target || !(target instanceof Element)) return;
        if (snapshot.tagName && target.tagName !== snapshot.tagName) return;

        if (
          snapshot.translate &&
          typeof snapshot.translate.x === "number" &&
          typeof snapshot.translate.y === "number"
        ) {
          target.style.translate = snapshot.translate.x + "px " + snapshot.translate.y + "px";
          elementTranslateMap.set(target, { x: snapshot.translate.x, y: snapshot.translate.y });
        }
        if (typeof snapshot.width === "number") {
          target.style.width = snapshot.width + "px";
        }
        if (typeof snapshot.height === "number") {
          target.style.height = snapshot.height + "px";
        }
      };

      const stashLayoutSelectionForRestore = () => {
        if (!layoutState.enabled) return;
        const selected = inspectState.selected;
        if (!selected) return;
        const source = elementSourceMap.get(selected) ?? null;
        if (!source) return;
        pendingLayoutSelectionRestore = {
          source,
          tagName: selected.tagName,
          path: buildLayoutSelectionPath(selected),
        };
      };

      const restoreLayoutSelectionIfNeeded = () => {
        if (!pendingLayoutSelectionRestore) return;
        const { source, tagName, path } = pendingLayoutSelectionRestore;
        pendingLayoutSelectionRestore = null;
        if (!layoutState.enabled) return;

        const applySelection = (target) => {
          inspectState.selected = target;
          inspectState.hovered = null;
          updateInspectOverlay();
          sendInspectMessage("inspect-select", target);
        };

        const pickCandidate = (candidate) => {
          if (!candidate || !(candidate instanceof Element)) return null;
          if (tagName && candidate.tagName !== tagName) return null;
          if (!elementSourceMap.has(candidate)) return null;
          return candidate;
        };

        const key = getSourceKey(source);
        if (key) {
          const direct = pickCandidate(pickSourceCandidate(sourceElementMap.get(key)));
          if (direct) return applySelection(direct);
        }

        const pathCandidate = pickCandidate(resolveElementFromLayoutPath(path));
        if (pathCandidate) return applySelection(pathCandidate);

        if (source && typeof source === "object") {
          const column = source.columnNumber;
          if (typeof column === "number") {
            for (const offset of [-1, 1]) {
              const neighborKey = getSourceKey({ ...source, columnNumber: column + offset });
              const neighborMatch = pickCandidate(
                pickSourceCandidate(neighborKey ? sourceElementMap.get(neighborKey) : null),
              );
              if (neighborMatch) return applySelection(neighborMatch);
            }
          }
        }

        if (source && typeof source === "object") {
          const lineKey = getSourceLineKey(source);
          const lineCandidates = lineKey ? sourceElementMapByLine.get(lineKey) : null;
          if (lineCandidates && lineCandidates.length) {
            const container = document.getElementById("snippet-container");
            const inContainer = container
              ? lineCandidates.filter((element) => element && container.contains(element))
              : lineCandidates.filter(Boolean);
            const tagMatches = tagName ? inContainer.filter((element) => element.tagName === tagName) : [];
            const uniqueCandidate =
              tagMatches.length === 1 ? tagMatches[0] : inContainer.length === 1 ? inContainer[0] : null;
            const selectedCandidate = pickCandidate(uniqueCandidate);
            if (selectedCandidate) return applySelection(selectedCandidate);
          }
        }

        inspectState.selected = null;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", null);
      };

      const resolveLayoutTarget = () => {
        if (!layoutState.enabled) return null;
        return resizeState.active ?? layoutState.active ?? inspectState.selected;
      };

      const resolveLayoutParentTarget = () => {
        const target = resolveLayoutTarget();
        if (!target) return null;
        const parent = target.parentElement;
        if (!parent) return null;
        const container = document.getElementById("snippet-container");
        if (container && !container.contains(parent)) return null;
        return parent;
      };

      const updateInspectOverlay = () => {
        const showOverlay = inspectState.enabled || layoutState.enabled || dragHighlightState.enabled;
        if (!showOverlay) {
          inspectOverlay.setEnabled(false);
          return;
        }
        inspectOverlay.setEnabled(true);
        const layoutTarget = resolveLayoutTarget();
        const externalHover = dragHighlightState.enabled ? dragHighlightState.hovered : null;
        inspectOverlay.update({
          hovered: inspectState.enabled ? inspectState.hovered : externalHover,
          selected: inspectState.enabled ? inspectState.selected : null,
          parent: resolveLayoutParentTarget(),
        });
        inspectOverlay.updateHandles({
          target: layoutTarget,
          enabled: layoutState.enabled,
        });
      };

      const resetInspectState = () => {
        inspectState.hovered = null;
        inspectState.selected = null;
        updateInspectOverlay();
      };

      const selectElementBySource = (source) => {
        if (!source) {
          inspectState.selected = null;
          updateInspectOverlay();
          sendInspectMessage("inspect-select", null);
          return;
        }
        const target = resolveElementFromSource(source);
        if (!target) return;
        inspectState.selected = target;
        inspectState.hovered = null;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", target);
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
        if (layoutState.dragging || resizeState.resizing) return;
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
        if (consumeInspectClickSuppression()) return;
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

`
