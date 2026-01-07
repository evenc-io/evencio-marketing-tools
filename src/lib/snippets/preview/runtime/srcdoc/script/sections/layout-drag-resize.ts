export const PREVIEW_SRCDOC_SCRIPT_LAYOUT_DRAG_RESIZE = `      const getElementTranslate = (element) => {
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

      const getResizeCursor = (handle) => {
        if (handle === "n" || handle === "s") return "ns-resize";
        if (handle === "e" || handle === "w") return "ew-resize";
        if (handle === "ne" || handle === "sw") return "nesw-resize";
        return "nwse-resize";
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

      const computeResizeDelta = () => {
        return {
          dx: resizeState.latestX - resizeState.startX,
          dy: resizeState.latestY - resizeState.startY,
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

      const normalizeResizeRect = (left, top, right, bottom) => {
        return {
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        };
      };

      const clampResizeSize = (value, min, max) => {
        if (Number.isFinite(max)) {
          return clampValue(value, min, max);
        }
        return Math.max(min, value);
      };

      const clampResizeRect = (rect, handle, bounds) => {
        if (!rect) return rect;
        const moveLeft = handle && handle.includes("w");
        const moveRight = handle && handle.includes("e");
        const moveTop = handle && handle.includes("n");
        const moveBottom = handle && handle.includes("s");
        let { left, right, top, bottom } = rect;

        if (moveLeft || moveRight) {
          const rawWidth = right - left;
          const maxWidth = bounds?.parentRect
            ? (moveLeft ? right - bounds.parentRect.left : bounds.parentRect.right - left)
            : Infinity;
          const safeMaxWidth = Number.isFinite(maxWidth) ? Math.max(0, maxWidth) : Infinity;
          const minWidth = Number.isFinite(safeMaxWidth)
            ? Math.min(RESIZE_MIN_SIZE, safeMaxWidth)
            : RESIZE_MIN_SIZE;
          const nextWidth = clampResizeSize(rawWidth, minWidth, safeMaxWidth);
          if (moveLeft && !moveRight) {
            left = right - nextWidth;
          } else if (moveRight && !moveLeft) {
            right = left + nextWidth;
          }
        }

        if (moveTop || moveBottom) {
          const rawHeight = bottom - top;
          const maxHeight = bounds?.parentRect
            ? (moveTop ? bottom - bounds.parentRect.top : bounds.parentRect.bottom - top)
            : Infinity;
          const safeMaxHeight = Number.isFinite(maxHeight) ? Math.max(0, maxHeight) : Infinity;
          const minHeight = Number.isFinite(safeMaxHeight)
            ? Math.min(RESIZE_MIN_SIZE, safeMaxHeight)
            : RESIZE_MIN_SIZE;
          const nextHeight = clampResizeSize(rawHeight, minHeight, safeMaxHeight);
          if (moveTop && !moveBottom) {
            top = bottom - nextHeight;
          } else if (moveBottom && !moveTop) {
            bottom = top + nextHeight;
          }
        }

        return normalizeResizeRect(left, top, right, bottom);
      };

      const applyResizeAspectRatio = (rect, handle, baseRect, dx, dy, lockAspect) => {
        if (!lockAspect || !rect || !baseRect) return rect;
        const moveLeft = handle && handle.includes("w");
        const moveRight = handle && handle.includes("e");
        const moveTop = handle && handle.includes("n");
        const moveBottom = handle && handle.includes("s");
        if (!(moveLeft || moveRight) || !(moveTop || moveBottom)) return rect;
        const ratio = baseRect.height ? baseRect.width / baseRect.height : 0;
        if (!Number.isFinite(ratio) || ratio <= 0) return rect;
        const useWidth = Math.abs(dx) >= Math.abs(dy);
        let { left, right, top, bottom } = rect;
        if (useWidth) {
          const nextWidth = Math.max(RESIZE_MIN_SIZE, Math.abs(right - left));
          const nextHeight = nextWidth / ratio;
          if (moveTop && !moveBottom) {
            top = bottom - nextHeight;
          } else {
            bottom = top + nextHeight;
          }
        } else {
          const nextHeight = Math.max(RESIZE_MIN_SIZE, Math.abs(bottom - top));
          const nextWidth = nextHeight * ratio;
          if (moveLeft && !moveRight) {
            left = right - nextWidth;
          } else {
            right = left + nextWidth;
          }
        }
        return normalizeResizeRect(left, top, right, bottom);
      };

      const applyResizeSnapping = (rect, handle, bounds) => {
        snapGuides.hide();
        if (!rect || !bounds || !snapState.enabled || snapState.altHeld) {
          return rect;
        }
        const containerRect = bounds.containerRect;
        if (!containerRect) return rect;
        const scaleForSnap = snapState.scaleForSnap > 0 ? snapState.scaleForSnap : 1;
        const grid = snapState.baseGridSize / scaleForSnap;
        const threshold = snapState.baseThreshold / scaleForSnap;
        const moveLeft = handle && handle.includes("w");
        const moveRight = handle && handle.includes("e");
        const moveTop = handle && handle.includes("n");
        const moveBottom = handle && handle.includes("s");

        let left = rect.left - containerRect.left;
        let right = rect.right - containerRect.left;
        let top = rect.top - containerRect.top;
        let bottom = rect.bottom - containerRect.top;

        let snappedX = false;
        let snappedY = false;
        let snapXValue = null;
        let snapYValue = null;

        if (moveLeft) {
          const leftSnap = snapToEdges(left, snapState.siblingEdges.xEdges || [], threshold);
          if (leftSnap.dist <= threshold) {
            left = leftSnap.value;
            snappedX = true;
            snapXValue = leftSnap.value;
          } else if (Number.isFinite(grid) && grid > 0) {
            left = Math.round(left / grid) * grid;
          }
        } else if (moveRight) {
          const rightSnap = snapToEdges(right, snapState.siblingEdges.xEdges || [], threshold);
          if (rightSnap.dist <= threshold) {
            right = rightSnap.value;
            snappedX = true;
            snapXValue = rightSnap.value;
          } else if (Number.isFinite(grid) && grid > 0) {
            right = Math.round(right / grid) * grid;
          }
        }

        if (moveTop) {
          const topSnap = snapToEdges(top, snapState.siblingEdges.yEdges || [], threshold);
          if (topSnap.dist <= threshold) {
            top = topSnap.value;
            snappedY = true;
            snapYValue = topSnap.value;
          } else if (Number.isFinite(grid) && grid > 0) {
            top = Math.round(top / grid) * grid;
          }
        } else if (moveBottom) {
          const bottomSnap = snapToEdges(bottom, snapState.siblingEdges.yEdges || [], threshold);
          if (bottomSnap.dist <= threshold) {
            bottom = bottomSnap.value;
            snappedY = true;
            snapYValue = bottomSnap.value;
          } else if (Number.isFinite(grid) && grid > 0) {
            bottom = Math.round(bottom / grid) * grid;
          }
        }

        const guideThickness = Math.max(1, Math.round(1 / scaleForSnap));
        if (snappedX && Number.isFinite(snapXValue)) {
          snapGuides.showVertical(containerRect.left + snapXValue, guideThickness);
        }
        if (snappedY && Number.isFinite(snapYValue)) {
          snapGuides.showHorizontal(containerRect.top + snapYValue, guideThickness);
        }

        return normalizeResizeRect(
          left + containerRect.left,
          top + containerRect.top,
          right + containerRect.left,
          bottom + containerRect.top,
        );
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

      const applyResize = () => {
        if (!resizeState.resizing || !resizeState.active || !resizeState.baseRect) return;
        const bounds = resizeState.bounds;
        const baseRect = resizeState.baseRect;
        const handle = resizeState.handle;
        const { dx, dy } = computeResizeDelta();
        let rect = normalizeResizeRect(
          baseRect.left + (handle && handle.includes("w") ? dx : 0),
          baseRect.top + (handle && handle.includes("n") ? dy : 0),
          baseRect.right + (handle && handle.includes("e") ? dx : 0),
          baseRect.bottom + (handle && handle.includes("s") ? dy : 0),
        );
        rect = applyResizeAspectRatio(rect, handle, baseRect, dx, dy, resizeState.lockAspect);
        rect = clampResizeRect(rect, handle, bounds);
        rect = applyResizeSnapping(rect, handle, bounds);
        rect = clampResizeRect(rect, handle, bounds);
        if (!rect) return;
        const width = Math.max(0, rect.right - rect.left);
        const height = Math.max(0, rect.bottom - rect.top);
        const nextTranslate = {
          x: resizeState.baseTranslate.x + (rect.left - baseRect.left),
          y: resizeState.baseTranslate.y + (rect.top - baseRect.top),
        };
        resizeState.currentTranslate = nextTranslate;
        resizeState.currentWidth = width;
        resizeState.currentHeight = height;
        resizeState.active.style.width = width + "px";
        resizeState.active.style.height = height + "px";
        resizeState.active.style.translate = nextTranslate.x + "px " + nextTranslate.y + "px";
        elementTranslateMap.set(resizeState.active, nextTranslate);
        updateInspectOverlay();
      };

      const scheduleResize = () => {
        if (resizeState.raf) return;
        resizeState.raf = window.requestAnimationFrame(() => {
          resizeState.raf = 0;
          applyResize();
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
        if (moved) {
          queueInspectClickSuppression();
        }
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
          stashLayoutVisualOverride(target, { translate });
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
          if (!next.skipRender) {
            stashLayoutSelectionForRestore();
            resetInspectState();
          }
          applyCompiledCode(next.code);
          if (next.skipRender) {
            scheduleLayerSnapshot();
          } else {
            renderWithProps(next.propsPayload);
          }
          return;
        }
        if (pendingPropsRender) {
          pendingPropsRender = false;
          renderWithProps(latestPropsPayload);
        }
      };

`
