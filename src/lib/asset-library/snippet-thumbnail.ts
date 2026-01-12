/**
 * Snippet Thumbnail Generator
 *
 * Generates PNG thumbnails for custom snippets by rendering them in a sandboxed iframe
 * and capturing the output using in-iframe canvas capture (sent via postMessage).
 *
 * Security: Uses sandbox="allow-scripts" only (no allow-same-origin) to maintain
 * isolation from the parent document. All capture logic runs inside the iframe.
 *
 * Font Handling: Fonts are embedded as base64 data URLs inside the SVG to ensure
 * correct rendering during capture. This is necessary because SVG foreignObject
 * captures don't have access to external font resources.
 */

import { getSnippetViewportError } from "@/lib/snippets/constraints"
import { PREVIEW_STYLES, UNITLESS_CSS_PROPERTIES } from "@/lib/snippets/preview/runtime/constants"
import {
	PREVIEW_FONT_LINKS,
	PREVIEW_FONT_SRC,
	PREVIEW_STYLE_SRC,
} from "@/lib/snippets/preview/runtime/srcdoc/csp"
import { getEmbeddedFontStyles } from "./thumbnail-fonts"

/** Default thumbnail dimensions */
const DEFAULT_THUMBNAIL_WIDTH = 400
const DEFAULT_THUMBNAIL_HEIGHT = 300

/** Timeout for thumbnail generation (ms) */
const THUMBNAIL_TIMEOUT_MS = 8000

/** Maximum viewport dimensions to prevent expensive rasterization */
const MAX_VIEWPORT_DIMENSION = 4096

export interface SnippetThumbnailInput {
	compiledCode: string
	props: Record<string, unknown>
	tailwindCss?: string | null
	viewport: { width: number; height: number }
}

export interface SnippetThumbnailOptions {
	/** Thumbnail width in pixels. Default: 400 */
	width?: number
	/** Thumbnail height in pixels. Default: 300 */
	height?: number
}

/**
 * Generate a PNG thumbnail for a compiled snippet.
 *
 * Creates a sandboxed iframe, renders the snippet, captures it using in-iframe
 * canvas capture with embedded fonts, and returns the PNG as a data URL via postMessage.
 * Returns null if generation fails (does not throw).
 */
export async function generateSnippetThumbnail(
	input: SnippetThumbnailInput,
	options?: SnippetThumbnailOptions,
): Promise<string | null> {
	// Only run in browser environment
	if (typeof document === "undefined" || typeof window === "undefined") {
		return null
	}

	// Validate viewport before attempting expensive rasterization
	const viewportError = getSnippetViewportError(input.viewport)
	if (viewportError) {
		console.warn("[SnippetThumbnail] Invalid viewport:", viewportError)
		return null
	}

	// Additional safety: clamp to max dimensions
	const viewportWidth = Math.min(input.viewport.width, MAX_VIEWPORT_DIMENSION)
	const viewportHeight = Math.min(input.viewport.height, MAX_VIEWPORT_DIMENSION)

	const thumbnailWidth = options?.width ?? DEFAULT_THUMBNAIL_WIDTH
	const thumbnailHeight = options?.height ?? DEFAULT_THUMBNAIL_HEIGHT

	// Pre-fetch embedded fonts (cached after first call)
	let embeddedFonts: string
	try {
		embeddedFonts = await getEmbeddedFontStyles()
	} catch {
		embeddedFonts = "" // Continue without embedded fonts
	}

	// Generate thumbnail-specific srcdoc with in-iframe capture
	const srcdoc = generateThumbnailSrcdoc(
		input.compiledCode,
		input.props,
		{ width: viewportWidth, height: viewportHeight },
		{ width: thumbnailWidth, height: thumbnailHeight },
		input.tailwindCss ?? undefined,
		embeddedFonts,
	)

	// Create hidden iframe with secure sandbox (allow-scripts only, no allow-same-origin)
	const iframe = document.createElement("iframe")
	iframe.style.position = "fixed"
	iframe.style.left = "-10000px"
	iframe.style.top = "0"
	iframe.style.width = `${viewportWidth}px`
	iframe.style.height = `${viewportHeight}px`
	iframe.style.border = "none"
	iframe.style.pointerEvents = "none"
	// Security: Only allow-scripts, no allow-same-origin (maintains security isolation)
	iframe.setAttribute("sandbox", "allow-scripts")
	iframe.srcdoc = srcdoc

	document.body.appendChild(iframe)

	try {
		// Wait for iframe to capture and send back the thumbnail
		const dataUrl = await waitForThumbnailCapture(iframe)
		return dataUrl
	} catch {
		return null
	} finally {
		iframe.remove()
	}
}

/**
 * Wait for the iframe to capture the thumbnail and send it via postMessage.
 */
function waitForThumbnailCapture(iframe: HTMLIFrameElement): Promise<string | null> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			cleanup()
			reject(new Error("Thumbnail capture timeout"))
		}, THUMBNAIL_TIMEOUT_MS)

		const handleMessage = (event: MessageEvent) => {
			// Only handle messages from our iframe
			if (event.source !== iframe.contentWindow) return

			const message = event.data
			if (message?.type === "thumbnail-capture-success") {
				cleanup()
				resolve(message.dataUrl as string)
			} else if (message?.type === "thumbnail-capture-error") {
				cleanup()
				reject(new Error(message.error ?? "Capture failed"))
			}
		}

		const cleanup = () => {
			clearTimeout(timeoutId)
			window.removeEventListener("message", handleMessage)
		}

		window.addEventListener("message", handleMessage)
	})
}

const safeStringifyProps = (props: Record<string, unknown>) => {
	try {
		return JSON.stringify(props ?? {})
	} catch {
		return "{}"
	}
}

interface ThumbnailDimensions {
	width: number
	height: number
}

/**
 * Generate srcdoc HTML specifically for thumbnail capture.
 *
 * This is separate from the preview srcdoc because it:
 * 1. Includes in-iframe capture logic (no cross-document DOM access needed)
 * 2. Automatically captures after render and font loading
 * 3. Sends the captured image back via postMessage
 * 4. Includes embedded fonts for SVG capture
 * 5. Doesn't include inspect/layout/debug features
 */
function generateThumbnailSrcdoc(
	compiledCode: string,
	props: Record<string, unknown>,
	viewport: ThumbnailDimensions,
	thumbnail: ThumbnailDimensions,
	tailwindCss?: string,
	embeddedFonts?: string,
): string {
	const nonce =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2)
	const propsJson = safeStringifyProps(props)
	const escapedTailwindCss = tailwindCss?.replace(/<\/style/gi, "<\\/style")

	// Escape script content to prevent XSS
	const escapedCode = compiledCode.replace(/<\/script/gi, "<\\/script")
	const escapedProps = propsJson.replace(/<\/script/gi, "<\\/script")
	const unitlessStylesJson = JSON.stringify(Array.from(UNITLESS_CSS_PROPERTIES))

	// Escape embedded fonts for inclusion in script
	const escapedEmbeddedFonts = (embeddedFonts ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/`/g, "\\`")
		.replace(/\$/g, "\\$")

	// Build the thumbnail capture script (runs inside iframe)
	const thumbnailScript = buildThumbnailCaptureScript({
		nonce,
		unitlessStylesJson,
		escapedProps,
		escapedCode,
		thumbnailWidth: thumbnail.width,
		thumbnailHeight: thumbnail.height,
		escapedEmbeddedFonts,
	})

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'; script-src 'nonce-${nonce}'; style-src ${PREVIEW_STYLE_SRC}; img-src data: blob:; font-src ${PREVIEW_FONT_SRC} data:;">
  <title>Snippet Thumbnail</title>
  ${PREVIEW_FONT_LINKS}
  <style>${PREVIEW_STYLES}</style>
  <style id="snippet-tailwind">${escapedTailwindCss ?? ""}</style>
  <style id="embedded-fonts">${embeddedFonts ?? ""}</style>
</head>
<body>
  <div id="root">
    <div id="snippet-container" style="width: ${viewport.width}px; height: ${viewport.height}px;"></div>
  </div>

  <script nonce="${nonce}">
${thumbnailScript}  </script>
</body>
</html>`
}

interface ThumbnailScriptParams {
	nonce: string
	unitlessStylesJson: string
	escapedProps: string
	escapedCode: string
	thumbnailWidth: number
	thumbnailHeight: number
	escapedEmbeddedFonts: string
}

/**
 * Build the JavaScript that runs inside the thumbnail iframe.
 *
 * This includes:
 * 1. Minimal React shim for rendering
 * 2. DOM renderer
 * 3. Canvas-based capture logic with embedded fonts in SVG
 * 4. Font loading wait
 * 5. postMessage to send result back
 */
function buildThumbnailCaptureScript(params: ThumbnailScriptParams): string {
	const {
		unitlessStylesJson,
		escapedProps,
		escapedCode,
		thumbnailWidth,
		thumbnailHeight,
		escapedEmbeddedFonts,
	} = params

	return `
(function() {
  'use strict';

  var UNITLESS_STYLES = new Set(${unitlessStylesJson});
  var THUMBNAIL_WIDTH = ${thumbnailWidth};
  var THUMBNAIL_HEIGHT = ${thumbnailHeight};
  var EMBEDDED_FONTS = \`${escapedEmbeddedFonts}\`;

  // React shim matching preview runtime (uses Symbol.for for Fragment)
  var Fragment = Symbol.for("snippet.fragment");
  var React = {
    createElement: function(type, props) {
      var children = Array.prototype.slice.call(arguments, 2);
      var normalizedProps = props ? Object.assign({}, props) : {};
      if (children.length > 0) {
        normalizedProps.children = children.length === 1 ? children[0] : children;
      }
      return { __snippetElement: true, type: type, props: normalizedProps };
    },
    Fragment: Fragment
  };

  // Make React available globally (compiled code expects this)
  window.React = React;
  window.__SNIPPET_COMPONENT__ = undefined;
  window.__SNIPPET_COMPONENT_ERROR__ = undefined;

  // Render element to DOM (matches preview runtime renderer)
  function renderElement(element, parent) {
    if (element == null || typeof element === 'boolean') return;
    if (typeof element === 'string' || typeof element === 'number') {
      parent.appendChild(document.createTextNode(String(element)));
      return;
    }
    if (Array.isArray(element)) {
      element.forEach(function(child) { renderElement(child, parent); });
      return;
    }
    // Check for snippet element format from createElement
    if (!element.__snippetElement) {
      // Legacy plain object format
      if (element.type === Fragment) {
        var kids = element.children || (element.props && element.props.children) || [];
        if (!Array.isArray(kids)) kids = [kids];
        kids.forEach(function(child) { renderElement(child, parent); });
        return;
      }
    }
    // Handle Fragment
    if (element.type === Fragment) {
      var children = element.props && element.props.children;
      if (children != null) {
        if (Array.isArray(children)) {
          children.forEach(function(child) { renderElement(child, parent); });
        } else {
          renderElement(children, parent);
        }
      }
      return;
    }
    // Handle function components
    if (typeof element.type === 'function') {
      var result = element.type(element.props || {});
      renderElement(result, parent);
      return;
    }
    // Handle DOM elements
    if (typeof element.type !== 'string') return;
    var node = document.createElement(element.type);
    var props = element.props || {};
    Object.keys(props).forEach(function(key) {
      if (key === 'children') return;
      if (key === 'className') {
        node.setAttribute('class', props[key]);
      } else if (key === 'style' && typeof props[key] === 'object') {
        Object.keys(props[key]).forEach(function(styleKey) {
          var value = props[key][styleKey];
          var cssKey = styleKey.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (typeof value === 'number' && value !== 0 && !UNITLESS_STYLES.has(styleKey)) {
            value = value + 'px';
          }
          node.style.setProperty(cssKey, String(value));
        });
      } else if (key.startsWith('on')) {
        // Skip event handlers
      } else if (key === 'dangerouslySetInnerHTML') {
        node.innerHTML = props[key].__html || '';
      } else if (typeof props[key] === 'boolean') {
        if (props[key]) node.setAttribute(key, '');
      } else if (props[key] != null) {
        node.setAttribute(key, String(props[key]));
      }
    });
    // Render children
    var kids = props.children;
    if (kids != null) {
      if (Array.isArray(kids)) {
        kids.forEach(function(child) { renderElement(child, node); });
      } else {
        renderElement(kids, node);
      }
    }
    parent.appendChild(node);
  }

  // Essential CSS properties to copy (reduces overhead and avoids problematic values)
  var ESSENTIAL_PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-width', 'border-style', 'border-color', 'border-radius',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
    'background', 'background-color', 'background-image', 'background-size', 'background-position',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-decoration', 'line-height', 'letter-spacing', 'white-space',
    'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'justify-content', 'align-items', 'align-self', 'gap', 'row-gap', 'column-gap',
    'grid', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'overflow', 'overflow-x', 'overflow-y', 'opacity', 'visibility',
    'transform', 'box-shadow', 'text-shadow', 'z-index', 'box-sizing'
  ];

  // Canvas-based capture with embedded fonts inside SVG
  function captureToCanvas(element, targetWidth, targetHeight) {
    return new Promise(function(resolve, reject) {
      try {
        var rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          reject(new Error('Element has zero dimensions'));
          return;
        }

        var canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }

        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Calculate scaling to fit
        var scaleX = targetWidth / rect.width;
        var scaleY = targetHeight / rect.height;
        var scale = Math.min(scaleX, scaleY);
        var drawWidth = rect.width * scale;
        var drawHeight = rect.height * scale;
        var offsetX = (targetWidth - drawWidth) / 2;
        var offsetY = (targetHeight - drawHeight) / 2;

        // Create SVG with embedded fonts
        var svgNS = 'http://www.w3.org/2000/svg';
        var xhtmlNS = 'http://www.w3.org/1999/xhtml';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', String(rect.width));
        svg.setAttribute('height', String(rect.height));

        // CRITICAL: Include embedded fonts INSIDE the SVG
        // This ensures fonts are available when SVG is rendered as an image
        if (EMBEDDED_FONTS) {
          var defs = document.createElementNS(svgNS, 'defs');
          var styleInSvg = document.createElementNS(svgNS, 'style');
          styleInSvg.textContent = EMBEDDED_FONTS;
          defs.appendChild(styleInSvg);
          svg.appendChild(defs);
        }

        var foreignObject = document.createElementNS(svgNS, 'foreignObject');
        foreignObject.setAttribute('width', '100%');
        foreignObject.setAttribute('height', '100%');

        // Clone the element
        var clone = element.cloneNode(true);
        clone.setAttribute('xmlns', xhtmlNS);

        // Inline essential computed styles on all elements
        var allElements = element.querySelectorAll('*');
        var cloneElements = clone.querySelectorAll('*');
        for (var i = 0; i < allElements.length; i++) {
          inlineEssentialStyles(allElements[i], cloneElements[i]);
        }
        // Also inline styles on the root clone
        inlineEssentialStyles(element, clone);

        foreignObject.appendChild(clone);
        svg.appendChild(foreignObject);

        // Serialize SVG to string and use data URL (not blob URL)
        // Data URLs avoid tainted canvas issues in sandboxed iframes
        var svgString = new XMLSerializer().serializeToString(svg);
        var base64 = btoa(unescape(encodeURIComponent(svgString)));
        var dataUrl = 'data:image/svg+xml;base64,' + base64;

        var img = new Image();
        img.onload = function() {
          try {
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            resolve(canvas.toDataURL('image/png'));
          } catch (drawErr) {
            reject(drawErr);
          }
        };
        img.onerror = function(e) {
          reject(new Error('Failed to load SVG image: ' + (e.message || 'unknown error')));
        };
        img.src = dataUrl;
      } catch (err) {
        reject(err);
      }
    });
  }

  // Inline essential computed styles on an element
  function inlineEssentialStyles(source, target) {
    var computed = window.getComputedStyle(source);
    var cssText = '';
    for (var i = 0; i < ESSENTIAL_PROPS.length; i++) {
      var prop = ESSENTIAL_PROPS[i];
      var value = computed.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
        // Skip url() references that might cause issues
        if (value.indexOf('url(') === -1 || prop === 'background-image') {
          cssText += prop + ':' + value + ';';
        }
      }
    }
    target.style.cssText = cssText;
  }

  // Main execution
  async function main() {
    try {
      var container = document.getElementById('snippet-container');
      if (!container) throw new Error('Container not found');

      // Execute compiled code (same as preview runtime - code sets window.__SNIPPET_COMPONENT__)
      var props = ${escapedProps};
      try {
        ${escapedCode}
      } catch (codeError) {
        window.__SNIPPET_COMPONENT_ERROR__ = codeError && codeError.message ? codeError.message : String(codeError);
      }

      // Check for compile errors
      if (window.__SNIPPET_COMPONENT_ERROR__) {
        throw new Error('Component error: ' + window.__SNIPPET_COMPONENT_ERROR__);
      }

      var Component = window.__SNIPPET_COMPONENT__;
      if (!Component) throw new Error('No component exported (window.__SNIPPET_COMPONENT__ not set)');

      // Render
      var element = React.createElement(Component, props);
      renderElement(element, container);

      // Wait for fonts to load inside the iframe
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise(function(r) { setTimeout(r, 3000); })
        ]);
      }

      // Small delay for paint
      await new Promise(function(r) { setTimeout(r, 200); });

      // Capture
      var dataUrl = await captureToCanvas(container, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

      // Send result back to parent
      window.parent.postMessage({ type: 'thumbnail-capture-success', dataUrl: dataUrl }, '*');
    } catch (err) {
      window.parent.postMessage({ type: 'thumbnail-capture-error', error: err.message || String(err) }, '*');
    }
  }

  main();
})();
`
}
