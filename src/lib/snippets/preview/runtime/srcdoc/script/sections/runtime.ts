export const PREVIEW_SRCDOC_SCRIPT_RUNTIME = `      const setLayoutEnabled = (enabled) => {
        layoutState.enabled = Boolean(enabled);
        if (!layoutState.enabled) {
          detachLayoutListeners();
          stopLayoutDrag(false);
          stopResize(false);
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

      let latestPropsPayload = __EVENCIO_SNIPPET_PREVIEW_PROPS_JSON__;

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
          resetImportsTileScale();
          resetImportDndCache();
          resetSourceElementMap();
          container.innerHTML = "";
          const props = normalizeProps(nextProps);
          const output = typeof SnippetComponent === "function"
            ? SnippetComponent(props)
            : SnippetComponent;
          renderNode(output, container);
          applyPendingLayoutVisualOverride();
          setupImportsTileScale();
          restoreLayoutSelectionIfNeeded();
          parent.postMessage({ type: 'render-success' }, '*');
          scheduleLayerSnapshot();
        } catch (error) {
          pendingLayoutSelectionRestore = null;
          showRenderError(error);
        }
      };

      const runInitialCode = () => {
        resetSnippetExports();
        try {
          __EVENCIO_SNIPPET_PREVIEW_COMPILED_CODE__
        } catch (error) {
          window.__SNIPPET_COMPONENT_ERROR__ = error && error.message ? error.message : String(error);
        }
      };

      runInitialCode();

	      window.addEventListener("message", (event) => {
	        if (event.source !== parent) return;
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
        if (data.type === "inspect-select-source") {
          selectElementBySource(data.source ?? null);
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
        if (data.type === "import-dnd-move") {
          handleImportDndMove(data);
          return;
        }
        if (data.type === "import-dnd-end") {
          handleImportDndEnd();
          return;
        }
        if (data.type === "import-dnd-commit") {
          handleImportDndCommit(data);
          return;
        }
        if (data.type === "code-update") {
          if (typeof data.propsJson === "string" || typeof data.props === "string" || typeof data.props === "object") {
            latestPropsPayload = data.propsJson ?? data.props;
          }
          const skipRender = Boolean(data.skipRender);
          if (layoutState.commitTimeout) {
            window.clearTimeout(layoutState.commitTimeout);
            layoutState.commitTimeout = 0;
          }
          layoutState.commitPending = false;
          if (layoutState.dragging || resizeState.resizing) {
            pendingCodeUpdate = { code: data.code, propsPayload: latestPropsPayload, skipRender };
            return;
          }
          if (!skipRender) {
            stashLayoutSelectionForRestore();
            resetInspectState();
          }
          applyCompiledCode(data.code);
          if (skipRender) {
            scheduleLayerSnapshot();
          } else {
            renderWithProps(latestPropsPayload);
          }
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
          const skipRender = Boolean(data.skipRender);
          if (skipRender) {
            scheduleLayerSnapshot();
            return;
          }
          if (layoutState.dragging || resizeState.resizing) {
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
        resetImportsTileScale();
        resetImportDndCache();
        document.removeEventListener("click", handleImportsRemoveClick);
        if (layersState.raf) {
          window.cancelAnimationFrame(layersState.raf);
          layersState.raf = 0;
        }
        if (layoutState.raf) {
          window.cancelAnimationFrame(layoutState.raf);
          layoutState.raf = 0;
        }
        if (resizeState.raf) {
          window.cancelAnimationFrame(resizeState.raf);
          resizeState.raf = 0;
        }
        if (layoutState.commitTimeout) {
          window.clearTimeout(layoutState.commitTimeout);
          layoutState.commitTimeout = 0;
        }
        layoutState.commitPending = false;
        if (resizeState.resizing) {
          stopResize(false);
        }
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
`
