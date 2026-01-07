export const PREVIEW_SRCDOC_SCRIPT_LAYOUT_POINTER_HANDLERS = `      const stopResize = (commit) => {
        if (!resizeState.resizing) return;
        resizeState.resizing = false;
        snapGuides.hide();
        const activeTarget = resizeState.active;
        const activePointerId = resizeState.pointerId;
        const captureTarget = resizeState.captureTarget;
        if (resizeState.raf) {
          window.cancelAnimationFrame(resizeState.raf);
          resizeState.raf = 0;
        }
        const target = resizeState.active;
        const translate = resizeState.currentTranslate;
        const width = resizeState.currentWidth;
        const height = resizeState.currentHeight;
        const moved =
          Math.abs(width - resizeState.baseWidth) >= 0.5 ||
          Math.abs(height - resizeState.baseHeight) >= 0.5 ||
          Math.abs(translate.x - resizeState.baseTranslate.x) >= 0.5 ||
          Math.abs(translate.y - resizeState.baseTranslate.y) >= 0.5;
        if (moved) {
          queueInspectClickSuppression();
        }

        resizeState.active = null;
        resizeState.handle = null;
        resizeState.pointerId = null;
        resizeState.bounds = null;
        resizeState.baseRect = null;
        resizeState.captureTarget = null;
        document.removeEventListener("pointermove", handleResizePointerMove);
        document.removeEventListener("pointerup", handleResizePointerUp);
        document.removeEventListener("pointercancel", handleResizePointerCancel);
        document.body.style.userSelect = resizeState.bodyUserSelect;
        document.body.style.cursor = resizeState.bodyCursor;
        updateInspectOverlay();
        if (captureTarget && activePointerId !== null && typeof captureTarget.releasePointerCapture === "function") {
          try {
            captureTarget.releasePointerCapture(activePointerId);
          } catch {
            // Ignore release failures for cross-browser safety.
          }
        }

        const didCommit = Boolean(commit && moved && target);
        if (didCommit) {
          const source = elementSourceMap.get(target) ?? null;
          if (source) {
            setStoredSourceTranslate(source, translate);
          }
          stashLayoutVisualOverride(target, { translate, width, height });
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
                alignX: null,
                alignY: null,
                width,
                height,
              },
            },
            "*",
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

      const handleResizePointerMove = (event) => {
        if (!resizeState.resizing) return;
        if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
        resizeState.latestX = event.clientX;
        resizeState.latestY = event.clientY;
        resizeState.lockAspect = Boolean(event.shiftKey);
        snapState.altHeld = Boolean(event.altKey);
        scheduleResize();
      };

      const handleResizePointerUp = (event) => {
        if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
        stopResize(true);
      };

      const handleResizePointerCancel = (event) => {
        if (resizeState.pointerId !== null && event.pointerId !== resizeState.pointerId) return;
        stopResize(false);
      };

      function handleResizePointerDown(event, handle) {
        if (!layoutState.enabled) return;
        if (!handle) return;
        if (event.button !== 0) return;
        const target = layoutState.active ?? inspectState.selected;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();

        if (resizeState.resizing) {
          stopResize(false);
        }
        if (layoutState.dragging) {
          stopLayoutDrag(false);
        }

        inspectState.selected = target;
        inspectState.hovered = null;
        updateInspectOverlay();
        sendInspectMessage("inspect-select", target);

        resizeState.resizing = true;
        resizeState.handle = handle;
        resizeState.active = target;
        resizeState.captureTarget = event.target instanceof Element ? event.target : null;
        resizeState.pointerId = event.pointerId;
        resizeState.startX = event.clientX;
        resizeState.startY = event.clientY;
        resizeState.latestX = event.clientX;
        resizeState.latestY = event.clientY;
        resizeState.baseTranslate = getElementTranslate(target);
        resizeState.currentTranslate = resizeState.baseTranslate;
        resizeState.baseRect = snapshotRect(target.getBoundingClientRect());
        if (!resizeState.baseRect) {
          resizeState.resizing = false;
          resizeState.active = null;
          resizeState.handle = null;
          return;
        }
        resizeState.baseWidth = resizeState.baseRect.width;
        resizeState.baseHeight = resizeState.baseRect.height;
        resizeState.currentWidth = resizeState.baseWidth;
        resizeState.currentHeight = resizeState.baseHeight;
        resizeState.bounds = buildLayoutBounds(target);
        resizeState.lockAspect = Boolean(event.shiftKey);
        snapState.altHeld = Boolean(event.altKey);
        snapState.scaleForSnap = inspectScale > 0 ? inspectScale : 1;
        if (snapState.enabled && resizeState.bounds) {
          snapState.siblingEdges = collectSiblingEdges(target, resizeState.bounds);
        } else {
          snapState.siblingEdges = { xEdges: [], yEdges: [], xCenters: [], yCenters: [] };
        }
        resizeState.bodyUserSelect = document.body.style.userSelect;
        resizeState.bodyCursor = document.body.style.cursor;
        document.body.style.userSelect = "none";
        document.body.style.cursor = getResizeCursor(handle);
        if (resizeState.captureTarget && typeof resizeState.captureTarget.setPointerCapture === "function") {
          try {
            resizeState.captureTarget.setPointerCapture(event.pointerId);
          } catch {
            // Ignore capture failures for cross-browser safety.
          }
        }
        document.addEventListener("pointermove", handleResizePointerMove);
        document.addEventListener("pointerup", handleResizePointerUp);
        document.addEventListener("pointercancel", handleResizePointerCancel);
        scheduleResize();
      }

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

`
