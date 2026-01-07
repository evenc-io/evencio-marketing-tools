export const PREVIEW_SRCDOC_SCRIPT_IMPORT_DND = `      const importDndState = {
        active: false,
        lastSourcesKey: "",
        lastSentAt: 0,
        cachedEdgeTarget: null,
        cachedEdgeWidth: 0,
        cachedEdgeHeight: 0,
        cachedSiblingEdges: null,
      };
      const IMPORT_DND_SEND_INTERVAL_MS = 60;

      const resetImportDndCache = () => {
        importDndState.cachedEdgeTarget = null;
        importDndState.cachedEdgeWidth = 0;
        importDndState.cachedEdgeHeight = 0;
        importDndState.cachedSiblingEdges = null;
      };

      const buildImportDndSourceChain = (element) => {
        const container = document.getElementById("snippet-container");
        if (!container || !element) return [];
        const sources = [];
        const seen = new Set();
        let current = element;
        while (current && current !== container) {
          const source = elementSourceMap.get(current) ?? null;
          if (source) {
            const key = getSourceKey(source);
            if (key && !seen.has(key)) {
              seen.add(key);
              sources.push(source);
            }
          }
          current = current.parentElement;
        }
        return sources;
      };

      const resolveImportDndInsertTarget = (target) => {
        const container = document.getElementById("snippet-container");
        if (!container || !target) return null;
        if (!(target instanceof Element)) return null;
        if (!container.contains(target)) return null;

        let current = target.parentElement;
        while (current && current !== container) {
          if (elementSourceMap.has(current)) return current;
          current = current.parentElement;
        }

        return target;
      };

      const sendImportDndHover = (sources) => {
        parent.postMessage({ type: "import-dnd-hover", sources: sources ?? [] }, "*");
      };

      const buildImportDndEdges = (referenceElement, containerRect) => {
        if (!containerRect) {
          return { xEdges: [], yEdges: [], xCenters: [], yCenters: [] };
        }
        snapState.scaleForSnap = inspectScale > 0 ? inspectScale : 1;
        snapState.altHeld = false;
        if (snapState.enabled && referenceElement) {
          const bounds = buildLayoutBounds(referenceElement);
          if (bounds) {
            return collectSiblingEdges(referenceElement, bounds);
          }
        }
        return {
          xEdges: [0, containerRect.width],
          yEdges: [0, containerRect.height],
          xCenters: [containerRect.width / 2],
          yCenters: [containerRect.height / 2],
        };
      };

      const applyImportDndGuides = (position, ghost, containerRect, siblingEdges) => {
        snapGuides.hide();
        if (!containerRect) {
          snapGuides.showGhost(null);
          return null;
        }
        const ghostWidth = ghost?.width ?? 0;
        const ghostHeight = ghost?.height ?? 0;
        if (!Number.isFinite(ghostWidth) || !Number.isFinite(ghostHeight) || ghostWidth <= 0 || ghostHeight <= 0) {
          snapGuides.showGhost(null);
          return null;
        }
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          snapGuides.showGhost(null);
          return null;
        }

        const scaleForSnap = snapState.scaleForSnap > 0 ? snapState.scaleForSnap : 1;
        const grid = snapState.baseGridSize / scaleForSnap;
        const threshold = snapState.baseThreshold / scaleForSnap;
        const desiredLeft = position.x - ghostWidth / 2;
        const desiredTop = position.y - ghostHeight / 2;

        const elemLeft = desiredLeft;
        const elemRight = elemLeft + ghostWidth;
        const elemCenterX = (elemLeft + elemRight) / 2;
        const elemTop = desiredTop;
        const elemBottom = elemTop + ghostHeight;
        const elemCenterY = (elemTop + elemBottom) / 2;

        let left = desiredLeft;
        let top = desiredTop;
        let snappedX = false;
        let snappedY = false;
        let snapXValue = null;
        let snapYValue = null;
        const xEdges = siblingEdges?.xEdges ?? [];
        const yEdges = siblingEdges?.yEdges ?? [];
        const xCenters = siblingEdges?.xCenters ?? [];
        const yCenters = siblingEdges?.yCenters ?? [];

        const leftSnap = snapToEdges(elemLeft, xEdges, threshold);
        const rightSnap = snapToEdges(elemRight, xEdges, threshold);
        const centerXSnap = snapToEdges(elemCenterX, xCenters, threshold);
        const leftDiff = leftSnap.dist;
        const rightDiff = rightSnap.dist;
        const centerXDiff = centerXSnap.dist;

        if (leftDiff <= threshold || rightDiff <= threshold) {
          if (leftDiff <= rightDiff) {
            left = desiredLeft + (leftSnap.value - elemLeft);
            snappedX = true;
            snapXValue = leftSnap.value;
          } else {
            left = desiredLeft + (rightSnap.value - elemRight);
            snappedX = true;
            snapXValue = rightSnap.value;
          }
        } else if (centerXDiff <= threshold) {
          left = desiredLeft + (centerXSnap.value - elemCenterX);
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
            top = desiredTop + (topSnap.value - elemTop);
            snappedY = true;
            snapYValue = topSnap.value;
          } else {
            top = desiredTop + (bottomSnap.value - elemBottom);
            snappedY = true;
            snapYValue = bottomSnap.value;
          }
        } else if (centerYDiff <= threshold) {
          top = desiredTop + (centerYSnap.value - elemCenterY);
          snappedY = true;
          snapYValue = centerYSnap.value;
        }

        if (!snappedX && Number.isFinite(grid) && grid > 0) {
          left = Math.round(left / grid) * grid;
        }
        if (!snappedY && Number.isFinite(grid) && grid > 0) {
          top = Math.round(top / grid) * grid;
        }

        const guideThickness = Math.max(1, Math.round(1 / scaleForSnap));
        if (snappedX && Number.isFinite(snapXValue)) {
          snapGuides.showVertical(containerRect.left + snapXValue, guideThickness);
        }
        if (snappedY && Number.isFinite(snapYValue)) {
          snapGuides.showHorizontal(containerRect.top + snapYValue, guideThickness);
        }

        snapGuides.showGhost({
          left: containerRect.left + left,
          top: containerRect.top + top,
          width: ghostWidth,
          height: ghostHeight,
        });

        return { left, top, width: ghostWidth, height: ghostHeight };
      };

      const handleImportDndMove = (data) => {
        if (!data) return;
        const container = document.getElementById("snippet-container");
        if (!container) return;
        const x = typeof data.x === "number" ? data.x : NaN;
        const y = typeof data.y === "number" ? data.y : NaN;
        const ghost = data.ghost && typeof data.ghost === "object" ? data.ghost : null;
        const containerRect = container.getBoundingClientRect();
        if (!Number.isFinite(x) || !Number.isFinite(y) || !containerRect) {
          snapGuides.hide();
          snapGuides.showGhost(null);
          dragHighlightState.enabled = false;
          dragHighlightState.hovered = null;
          updateInspectOverlay();
          return;
        }

        importDndState.active = true;

        const hit = document.elementFromPoint(containerRect.left + x, containerRect.top + y);
        const target = resolveInspectableTarget(hit);
        const insertTarget = resolveImportDndInsertTarget(target);
        dragHighlightState.enabled = Boolean(insertTarget);
        dragHighlightState.hovered = insertTarget;
        updateInspectOverlay();
        let siblingEdges = null;
        if (target) {
          const width = containerRect.width;
          const height = containerRect.height;
          const canReuse =
            importDndState.cachedEdgeTarget === target &&
            importDndState.cachedSiblingEdges &&
            importDndState.cachedEdgeWidth === width &&
            importDndState.cachedEdgeHeight === height;
          if (canReuse) {
            siblingEdges = importDndState.cachedSiblingEdges;
          } else {
            siblingEdges = buildImportDndEdges(target, containerRect);
            importDndState.cachedEdgeTarget = target;
            importDndState.cachedEdgeWidth = width;
            importDndState.cachedEdgeHeight = height;
            importDndState.cachedSiblingEdges = siblingEdges;
          }
        } else {
          resetImportDndCache();
          siblingEdges = buildImportDndEdges(null, containerRect);
        }
        applyImportDndGuides({ x, y }, ghost, containerRect, siblingEdges);

        const sources = target ? buildImportDndSourceChain(target) : [];
        const sourcesKey = sources.map((entry) => getSourceKey(entry)).filter(Boolean).join("|");
        const now = Date.now();
        const shouldSend =
          sourcesKey !== importDndState.lastSourcesKey ||
          now - importDndState.lastSentAt >= IMPORT_DND_SEND_INTERVAL_MS;
        if (shouldSend) {
          importDndState.lastSourcesKey = sourcesKey;
          importDndState.lastSentAt = now;
          sendImportDndHover(sources);
        }
      };

      const handleImportDndEnd = () => {
        if (!importDndState.active && !importDndState.lastSourcesKey) return;
        importDndState.active = false;
        importDndState.lastSourcesKey = "";
        importDndState.lastSentAt = 0;
        resetImportDndCache();
        dragHighlightState.enabled = false;
        dragHighlightState.hovered = null;
        updateInspectOverlay();
        snapGuides.hide();
        snapGuides.showGhost(null);
        sendImportDndHover([]);
      };

      const handleImportDndCommit = (data) => {
        if (!data || !data.source) return;
        const x = typeof data.x === "number" ? data.x : NaN;
        const y = typeof data.y === "number" ? data.y : NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const element = resolveElementFromSource(data.source);
        if (!element) return;
        const bounds = buildLayoutBounds(element);
        if (!bounds) return;

        snapState.altHeld = false;
        snapState.scaleForSnap = inspectScale > 0 ? inspectScale : 1;
        if (snapState.enabled) {
          snapState.siblingEdges = collectSiblingEdges(element, bounds);
        } else {
          snapState.siblingEdges = { xEdges: [], yEdges: [], xCenters: [], yCenters: [] };
        }

        const baseTranslate = getElementTranslate(element);
        layoutState.baseTranslate = baseTranslate;
        layoutState.currentTranslate = baseTranslate;
        layoutState.bounds = bounds;

        const elementRect = bounds.elementRect;
        const containerRect = bounds.containerRect;
        const elemCenterX = elementRect.left - containerRect.left + elementRect.width / 2;
        const elemCenterY = elementRect.top - containerRect.top + elementRect.height / 2;
        const desiredTranslate = {
          x: baseTranslate.x + (x - elemCenterX),
          y: baseTranslate.y + (y - elemCenterY),
        };
        const snappedTranslate = applySnapping(desiredTranslate, elementRect, containerRect);
        const alignX = resolveAlignmentX(snappedTranslate, bounds);
        const alignY = resolveAlignmentY(snappedTranslate, bounds, element);

        const source = elementSourceMap.get(element) ?? data.source ?? null;
        if (source) {
          setStoredSourceTranslate(source, snappedTranslate);
        }
        parent.postMessage(
          {
            type: "layout-commit",
            commit: {
              source,
              translate: snappedTranslate,
              alignX,
              alignY,
            },
          },
          "*",
        );
      };

`
