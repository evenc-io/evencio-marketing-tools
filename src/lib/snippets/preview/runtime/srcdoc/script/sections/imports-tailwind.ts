export const PREVIEW_SRCDOC_SCRIPT_IMPORTS_TAILWIND = `      const IMPORTS_SELECTORS = {
        root: "[data-snippet-imports-preview]",
        tile: "[data-snippet-imports-tile]",
        viewport: "[data-snippet-imports-viewport]",
        frame: "[data-snippet-imports-frame]",
        content: "[data-snippet-imports-content]",
        remove: "[data-snippet-imports-remove]",
      };

      const importsScaleState = {
        active: false,
        raf: 0,
        observer: null,
      };

      const resetImportsTileScale = () => {
        importsScaleState.active = false;
        if (importsScaleState.raf) {
          window.cancelAnimationFrame(importsScaleState.raf);
          importsScaleState.raf = 0;
        }
        if (importsScaleState.observer) {
          importsScaleState.observer.disconnect();
          importsScaleState.observer = null;
        }
      };

      const clampPositiveNumber = (value) => {
        const next = Number(value);
        return Number.isFinite(next) && next > 0 ? next : 0;
      };

      const getImportsTileDesignSize = (tile) => {
        if (!tile || typeof tile.getAttribute !== "function") return { width: 0, height: 0 };
        return {
          width: clampPositiveNumber(tile.getAttribute("data-snippet-imports-design-width")),
          height: clampPositiveNumber(tile.getAttribute("data-snippet-imports-design-height")),
        };
      };

      const measureUnscaledBox = (element) => {
        if (!element) return { width: 0, height: 0 };
        const prevTransform = element.style.transform;
        element.style.transform = "none";
        const rect = element.getBoundingClientRect();
        const width = Math.max(rect.width, Number(element.scrollWidth) || 0);
        const height = Math.max(rect.height, Number(element.scrollHeight) || 0);
        element.style.transform = prevTransform;
        return {
          width: Number.isFinite(width) ? width : 0,
          height: Number.isFinite(height) ? height : 0,
        };
      };

      const applyImportsTileScale = () => {
        const root = document.querySelector(IMPORTS_SELECTORS.root);
        if (!root) return false;
        const tiles = root.querySelectorAll(IMPORTS_SELECTORS.tile);
        if (!tiles.length) return false;

        tiles.forEach((tile) => {
          const viewport = tile.querySelector(IMPORTS_SELECTORS.viewport);
          const frame = tile.querySelector(IMPORTS_SELECTORS.frame);
          const content = tile.querySelector(IMPORTS_SELECTORS.content);
          if (!viewport || !frame || !content) return;

          const viewportRect = viewport.getBoundingClientRect();
          const availableWidth = viewportRect.width;
          const availableHeight = viewportRect.height;
          if (!availableWidth || !availableHeight) return;

          frame.style.width = "";
          frame.style.height = "";
          content.style.transform = "";
          content.style.transformOrigin = "";

          const contentBox = measureUnscaledBox(content);
          const design = getImportsTileDesignSize(tile);
          const naturalWidth = contentBox.width || design.width;
          const naturalHeight = contentBox.height || design.height;
          if (!naturalWidth || !naturalHeight) return;

          const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
          const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
          const scaledWidth = naturalWidth * safeScale;
          const scaledHeight = naturalHeight * safeScale;

          frame.style.width = scaledWidth + "px";
          frame.style.height = scaledHeight + "px";
          content.style.transformOrigin = "top left";
          content.style.transform = "scale(" + safeScale + ")";
        });

        return true;
      };

      const scheduleImportsTileScale = () => {
        if (!importsScaleState.active) return;
        if (importsScaleState.raf) return;
        importsScaleState.raf = window.requestAnimationFrame(() => {
          importsScaleState.raf = 0;
          applyImportsTileScale();
        });
      };

      const setupImportsTileScale = () => {
        const root = document.querySelector(IMPORTS_SELECTORS.root);
        if (!root) return;
        const tiles = root.querySelectorAll(IMPORTS_SELECTORS.tile);
        if (!tiles.length) return;

        importsScaleState.active = true;
        applyImportsTileScale();

        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(() => {
            scheduleImportsTileScale();
          });
          tiles.forEach((tile) => {
            const viewport = tile.querySelector(IMPORTS_SELECTORS.viewport);
            if (viewport) observer.observe(viewport);
            const content = tile.querySelector(IMPORTS_SELECTORS.content);
            if (content) observer.observe(content);
          });
          importsScaleState.observer = observer;
        }

        const fonts = document.fonts;
        if (fonts && typeof fonts.ready?.then === "function") {
          fonts.ready.then(() => scheduleImportsTileScale()).catch(() => {});
        }
      };

      const handleImportsRemoveClick = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = typeof target.closest === "function" ? target.closest(IMPORTS_SELECTORS.remove) : null;
        if (!button) return;
        const root = document.querySelector(IMPORTS_SELECTORS.root);
        if (!root || !(root instanceof Element) || !root.contains(button)) return;
        const assetId = button.getAttribute("data-snippet-imports-remove");
        if (!assetId) return;
        event.preventDefault();
        event.stopPropagation();
        parent.postMessage({ type: "import-assets-remove", assetId }, "*");
      };

      document.addEventListener("click", handleImportsRemoveClick);

      const tailwindStyle = document.getElementById("snippet-tailwind");
      const setTailwindCss = (css) => {
        if (!tailwindStyle) return;
        tailwindStyle.textContent = typeof css === "string" ? css : "";
        scheduleImportsTileScale();
      };

`
