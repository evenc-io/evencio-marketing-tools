export const PREVIEW_SRCDOC_SCRIPT_LAYOUT_STATE = `      const layoutState = {
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

      const resizeState = {
        resizing: false,
        handle: null,
        active: null,
        captureTarget: null,
        pointerId: null,
        startX: 0,
        startY: 0,
        latestX: 0,
        latestY: 0,
        baseTranslate: { x: 0, y: 0 },
        currentTranslate: { x: 0, y: 0 },
        baseRect: null,
        baseWidth: 0,
        baseHeight: 0,
        currentWidth: 0,
        currentHeight: 0,
        bounds: null,
        raf: 0,
        bodyUserSelect: "",
        bodyCursor: "",
        lockAspect: false,
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
        ghost: null,
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
          const ghost = document.createElement("div");
          ghost.style.position = "absolute";
          ghost.style.border = "1px dashed rgba(0, 255, 0, 0.75)";
          ghost.style.background = "rgba(0, 255, 0, 0.06)";
          ghost.style.display = "none";
          container.appendChild(vLine);
          container.appendChild(hLine);
          container.appendChild(ghost);
          document.body.appendChild(container);
          this.container = container;
          this.vLine = vLine;
          this.hLine = hLine;
          this.ghost = ghost;
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
        showGhost(rect) {
          this.ensure();
          if (!this.ghost) return;
          if (!rect) {
            this.ghost.style.display = "none";
            return;
          }
          this.ghost.style.display = "block";
          this.ghost.style.left = String(Math.round(rect.left)) + "px";
          this.ghost.style.top = String(Math.round(rect.top)) + "px";
          this.ghost.style.width = String(Math.max(0, Math.round(rect.width))) + "px";
          this.ghost.style.height = String(Math.max(0, Math.round(rect.height))) + "px";
        },
        hide() {
          if (this.vLine) this.vLine.style.display = "none";
          if (this.hLine) this.hLine.style.display = "none";
          if (this.ghost) this.ghost.style.display = "none";
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
`
