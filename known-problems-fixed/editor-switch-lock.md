# Editor locks after project switch + thumbnail errors

## Problem
Switching between projects without a full page reload would leave the editor view locked. The canvas initially appeared interactive for a split moment, then snapped back to a non-interactive state where only scrolling was possible. Leaving the editor also produced noisy errors during autosave thumbnail generation.

## Symptoms
- After navigating from one project to another via the logo/dashboard, the editor would lock.
- Console errors reported:
  - `[EditorStore] Failed to load slide: TypeError: Cannot read properties of undefined (reading 'clearRect')`
  - `Uncaught (in promise) aborted`
  - `[Thumbnail] Failed to generate thumbnail: TypeError: Cannot set properties of undefined (setting 'ctx')`

## Root cause
Two related race conditions were happening during navigation:
1. **Canvas disposal during slide load**
   - When switching projects, the editor updated slide dimensions and triggered a Fabric canvas re-init while `loadFromJSON` was still running. This meant slide loading sometimes ran on a disposed canvas, causing `clearRect` to be called on an undefined context. That left the canvas in a broken state where pointer events no longer worked correctly.
2. **Thumbnail generation on disposed canvas**
   - Autosave could still attempt to generate a thumbnail after the editor had begun disposing the canvas. Fabric no longer had a valid render context, which caused the `ctx` error inside thumbnail generation.

## Fix
### 1) Make slide loading safe across navigation
- Tie the active canvas to the currently active project (`canvasProjectId`).
- Skip slide loading when the canvas does not belong to the active project, or when the canvas is already disposed/destroyed.
- Add a post-`await` guard so that if the canvas reference changes during `loadFromJSON`, the load is abandoned safely.
- Reorder slide load logic so dimensions are set first; only load JSON when the canvas is already initialized at the correct size.
- Ensure `dispose()` promise rejections are ignored to prevent uncaught errors.

### 2) Make thumbnail generation resilient
- Guard thumbnail generation by checking that the Fabric canvas still has a valid context and canvas element before calling `toDataURL`.
- Bail out early if the canvas has been disposed/destroyed.

## Files changed
- `src/routes/project/$projectId/slide/$slideId.tsx`
  - Load JSON only after dimensions match the slide, preventing re-init mid-load.
- `src/stores/editor-store.ts`
  - Track `canvasProjectId` and skip load if canvas is stale/disposed.
  - Guard against post-`await` stale canvas usage.
- `src/components/editor/canvas.tsx`
  - Associate canvas with project ID on init; ignore dispose rejections.
- `src/types/editor.ts`
  - Added `canvasProjectId` to editor state.
- `src/lib/storage/thumbnail.ts`
  - Bail early if the canvas is disposed or missing a rendering context.

## How to verify
1. Open Project A, then navigate back to the dashboard and open Project B.
2. Confirm the editor is interactive immediately (no lock).
3. Leave the editor view and ensure the console is clean of thumbnail errors.

## Notes
These changes prevent stale/disposed Fabric canvases from being mutated, which was the core cause of both the lock-up and the thumbnail error.
