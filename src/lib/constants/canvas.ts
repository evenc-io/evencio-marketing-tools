/** Padding around the artboard to allow objects to overflow visually */
export const CANVAS_PADDING = 500

/** Print defaults (assumes 300 DPI poster sizes) */
export const DEFAULT_DPI = 300
export const DEFAULT_BLEED_MM = 3
export const DEFAULT_BLEED_PX = Math.round((DEFAULT_BLEED_MM / 25.4) * DEFAULT_DPI)
