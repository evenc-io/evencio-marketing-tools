import type { Canvas } from "fabric"
import { CANVAS_PADDING } from "@/lib/constants/canvas"
import type { CanvasDimensions } from "@/types/editor"
import {
	type ArtboardScreenRect,
	calculateObjectGap,
	type ObjectInfo,
	useCanvasInspect,
} from "./useCanvasInspect"

// Figma-style colors
const FIGMA_RED = "#FF0066"
const FIGMA_BLUE = "#0066FF"
const FIGMA_LABEL_BG = "#FFFFFF"
const FIGMA_LABEL_TEXT = "#1E1E1E"

interface InspectOverlayProps {
	canvas: Canvas | null
	dimensions: CanvasDimensions
	enabled: boolean
}

/**
 * Figma-style inspect overlay for Fabric.js canvas.
 * Shows object dimensions and distances on hover.
 * Click an object to select it, then hover another to see the gap between them.
 */
export function InspectOverlay({ canvas, dimensions, enabled }: InspectOverlayProps) {
	const { hoveredInfo, selectedInfo, artboardScreenRect } = useCanvasInspect({
		canvas,
		enabled,
		artboardWidth: dimensions.width,
		artboardHeight: dimensions.height,
		canvasPadding: CANVAS_PADDING,
	})

	if (!enabled) {
		return null
	}

	const showHoveredToEdge = hoveredInfo && !selectedInfo
	const showGapMode = selectedInfo && hoveredInfo

	return (
		<div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
			{/* Selected object bounding box (blue) */}
			{selectedInfo && (
				<>
					<BoundingBox info={selectedInfo} color={FIGMA_BLUE} />
					<SelectionLabel info={selectedInfo} />
				</>
			)}

			{/* Hovered object bounding box (pink) */}
			{hoveredInfo && (
				<>
					<BoundingBox info={hoveredInfo} color={FIGMA_RED} />
					<DimensionsLabel info={hoveredInfo} selectedInfo={selectedInfo} />
				</>
			)}

			{/* Gap measurement lines between selected and hovered objects */}
			{showGapMode && <GapDistanceLines selected={selectedInfo} hovered={hoveredInfo} />}

			{/* Distance lines to artboard edges (only when no selection) */}
			{showHoveredToEdge && artboardScreenRect && (
				<EdgeDistanceLines info={hoveredInfo} artboardScreenRect={artboardScreenRect} />
			)}

			{/* Artboard dimension indicator */}
			<div className="absolute" style={{ right: 16, top: 16 }}>
				<div
					className="whitespace-nowrap rounded-sm font-mono shadow-sm"
					style={{
						backgroundColor: FIGMA_LABEL_BG,
						color: FIGMA_LABEL_TEXT,
						border: `2px solid ${selectedInfo ? FIGMA_BLUE : FIGMA_RED}`,
						padding: "4px 8px",
						fontSize: 12,
					}}
				>
					{dimensions.width} × {dimensions.height}
				</div>
			</div>

			{/* Instructions hint */}
			{!selectedInfo && !hoveredInfo && (
				<div className="absolute" style={{ left: 16, bottom: 16 }}>
					<div
						className="whitespace-nowrap rounded-sm font-mono shadow-sm"
						style={{
							backgroundColor: FIGMA_LABEL_BG,
							color: FIGMA_LABEL_TEXT,
							border: "2px solid #E5E5E5",
							padding: "4px 8px",
							fontSize: 11,
						}}
					>
						Hover to inspect • Click to select • ESC to deselect
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Renders a bounding box outline around an object
 */
function BoundingBox({ info, color }: { info: ObjectInfo; color: string }) {
	const { screenRect } = info

	return (
		<div
			className="absolute"
			style={{
				top: screenRect.top,
				left: screenRect.left,
				width: screenRect.width,
				height: screenRect.height,
				border: `2px solid ${color}`,
				pointerEvents: "none",
			}}
		/>
	)
}

/**
 * Renders a "Selected" label for the selected object
 */
function SelectionLabel({ info }: { info: ObjectInfo }) {
	const { screenRect, layerName, width, height } = info

	return (
		<div
			className="absolute flex items-center gap-1"
			style={{
				top: Math.max(4, screenRect.top - 28),
				left: screenRect.left,
			}}
		>
			<div
				className="whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-xs font-medium shadow-sm"
				style={{
					backgroundColor: FIGMA_BLUE,
					color: "#FFFFFF",
				}}
			>
				Selected
			</div>
			<div
				className="whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-xs shadow-sm"
				style={{
					backgroundColor: FIGMA_LABEL_BG,
					color: FIGMA_LABEL_TEXT,
					border: `1px solid ${FIGMA_BLUE}`,
				}}
			>
				{width} × {height}
			</div>
			{layerName && (
				<div
					className="whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-xs shadow-sm"
					style={{
						backgroundColor: FIGMA_LABEL_BG,
						color: FIGMA_LABEL_TEXT,
						border: `1px solid ${FIGMA_BLUE}`,
					}}
				>
					{layerName}
				</div>
			)}
		</div>
	)
}

/**
 * Renders the object dimensions label (width × height)
 */
function DimensionsLabel({
	info,
	selectedInfo,
}: {
	info: ObjectInfo
	selectedInfo: ObjectInfo | null
}) {
	const { width, height, screenRect, layerName } = info

	// Position label below by default, above if selected object is below
	let positionAbove = false
	if (selectedInfo) {
		const selectedTop = selectedInfo.screenRect.top
		const hoveredBottom = screenRect.top + screenRect.height
		if (selectedTop > screenRect.top && selectedTop < hoveredBottom + 60) {
			positionAbove = true
		}
	}

	const topPosition = positionAbove ? screenRect.top - 28 : screenRect.top + screenRect.height + 4

	return (
		<div
			className="absolute flex items-center gap-1"
			style={{
				top: topPosition,
				left: screenRect.left,
			}}
		>
			<div
				className="whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-xs font-medium shadow-sm"
				style={{
					backgroundColor: FIGMA_RED,
					color: "#FFFFFF",
				}}
			>
				{width} × {height}
			</div>
			{layerName && (
				<div
					className="whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-xs shadow-sm"
					style={{
						backgroundColor: FIGMA_LABEL_BG,
						color: FIGMA_LABEL_TEXT,
						border: "1px solid #E5E5E5",
					}}
				>
					{layerName}
				</div>
			)}
		</div>
	)
}

/**
 * Renders gap distance lines between selected and hovered objects
 */
function GapDistanceLines({ selected, hovered }: { selected: ObjectInfo; hovered: ObjectInfo }) {
	const gap = calculateObjectGap(
		selected.designRect,
		hovered.designRect,
		selected.screenRect,
		hovered.screenRect,
	)

	if (gap.isDiagonal && gap.horizontalLine && gap.verticalLine) {
		return (
			<LShapeConnector
				horizontalLine={gap.horizontalLine}
				verticalLine={gap.verticalLine}
				horizontalGap={gap.horizontalGap}
				verticalGap={gap.verticalGap}
			/>
		)
	}

	return (
		<>
			{gap.horizontalLine && gap.horizontalGap > 0 && (
				<HorizontalDistanceLine
					y={gap.horizontalLine.y}
					x1={gap.horizontalLine.x1}
					x2={gap.horizontalLine.x2}
					value={gap.horizontalGap}
				/>
			)}
			{gap.verticalLine && gap.verticalGap > 0 && (
				<VerticalDistanceLine
					x={gap.verticalLine.x}
					y1={gap.verticalLine.y1}
					y2={gap.verticalLine.y2}
					value={gap.verticalGap}
				/>
			)}
		</>
	)
}

/**
 * Renders an L-shape connector for diagonal gaps
 */
function LShapeConnector({
	horizontalLine,
	verticalLine,
	horizontalGap,
	verticalGap,
}: {
	horizontalLine: { x1: number; x2: number; y: number }
	verticalLine: { y1: number; y2: number; x: number }
	horizontalGap: number
	verticalGap: number
}) {
	const hWidth = Math.abs(horizontalLine.x2 - horizontalLine.x1)
	const vHeight = Math.abs(verticalLine.y2 - verticalLine.y1)
	const cornerY = horizontalLine.y
	const cornerX = verticalLine.x
	const hLeft = Math.min(horizontalLine.x1, horizontalLine.x2)
	const vTop = Math.min(verticalLine.y1, verticalLine.y2)
	const cornerIsRightEnd = horizontalLine.x2 === cornerX
	const cornerIsTopEnd = verticalLine.y1 === cornerY || vTop === cornerY

	return (
		<>
			{hWidth >= 8 && (
				<div
					className="absolute flex items-center"
					style={{
						left: hLeft,
						top: cornerY,
						width: hWidth,
						transform: "translateY(-50%)",
					}}
				>
					{cornerIsRightEnd && (
						<div
							style={{
								height: 10,
								width: 2,
								backgroundColor: FIGMA_RED,
								flexShrink: 0,
							}}
						/>
					)}
					<div className="relative flex flex-1 items-center">
						<div style={{ height: 2, flex: 1, backgroundColor: FIGMA_RED }} />
						<div
							className="z-10 flex-shrink-0 whitespace-nowrap rounded-sm font-mono font-medium shadow-sm"
							style={{
								backgroundColor: FIGMA_LABEL_BG,
								color: FIGMA_LABEL_TEXT,
								border: `1px solid ${FIGMA_RED}`,
								padding: "2px 6px",
								fontSize: 11,
							}}
						>
							{horizontalGap}
						</div>
						<div style={{ height: 2, flex: 1, backgroundColor: FIGMA_RED }} />
					</div>
					{!cornerIsRightEnd && (
						<div
							style={{
								height: 10,
								width: 2,
								backgroundColor: FIGMA_RED,
								flexShrink: 0,
							}}
						/>
					)}
				</div>
			)}
			{vHeight >= 8 && (
				<div
					className="absolute flex flex-col items-center"
					style={{
						left: cornerX,
						top: vTop,
						height: vHeight,
						transform: "translateX(-50%)",
					}}
				>
					{!cornerIsTopEnd && (
						<div
							style={{
								height: 2,
								width: 10,
								backgroundColor: FIGMA_RED,
								flexShrink: 0,
							}}
						/>
					)}
					<div className="relative flex flex-1 flex-col items-center">
						<div style={{ width: 2, flex: 1, backgroundColor: FIGMA_RED }} />
						<div
							className="z-10 flex-shrink-0 whitespace-nowrap rounded-sm font-mono font-medium shadow-sm"
							style={{
								backgroundColor: FIGMA_LABEL_BG,
								color: FIGMA_LABEL_TEXT,
								border: `1px solid ${FIGMA_RED}`,
								padding: "2px 6px",
								fontSize: 11,
							}}
						>
							{verticalGap}
						</div>
						<div style={{ width: 2, flex: 1, backgroundColor: FIGMA_RED }} />
					</div>
					{cornerIsTopEnd && (
						<div
							style={{
								height: 2,
								width: 10,
								backgroundColor: FIGMA_RED,
								flexShrink: 0,
							}}
						/>
					)}
				</div>
			)}
		</>
	)
}

/**
 * Renders distance lines from object edges to artboard edges.
 * Uses artboard screen coordinates for correct positioning at any zoom level.
 */
function EdgeDistanceLines({
	info,
	artboardScreenRect,
}: {
	info: ObjectInfo
	artboardScreenRect: ArtboardScreenRect
}) {
	const { distanceTop, distanceRight, distanceBottom, distanceLeft, screenRect } = info

	// Object center for line positioning
	const elemCenterX = screenRect.left + screenRect.width / 2
	const elemCenterY = screenRect.top + screenRect.height / 2

	// Artboard edges in screen space
	const artboardTop = artboardScreenRect.top
	const artboardLeft = artboardScreenRect.left
	const artboardRight = artboardScreenRect.left + artboardScreenRect.width
	const artboardBottom = artboardScreenRect.top + artboardScreenRect.height

	return (
		<>
			{distanceTop > 10 && (
				<VerticalDistanceLine
					x={elemCenterX}
					y1={artboardTop}
					y2={screenRect.top}
					value={distanceTop}
				/>
			)}
			{distanceBottom > 10 && (
				<VerticalDistanceLine
					x={elemCenterX}
					y1={screenRect.top + screenRect.height}
					y2={artboardBottom}
					value={distanceBottom}
				/>
			)}
			{distanceLeft > 10 && (
				<HorizontalDistanceLine
					y={elemCenterY}
					x1={artboardLeft}
					x2={screenRect.left}
					value={distanceLeft}
				/>
			)}
			{distanceRight > 10 && (
				<HorizontalDistanceLine
					y={elemCenterY}
					x1={screenRect.left + screenRect.width}
					x2={artboardRight}
					value={distanceRight}
				/>
			)}
		</>
	)
}

interface VerticalDistanceLineProps {
	x: number
	y1: number
	y2: number
	value: number
}

function VerticalDistanceLine({ x, y1, y2, value }: VerticalDistanceLineProps) {
	const height = Math.abs(y2 - y1)
	const top = Math.min(y1, y2)

	if (height < 8) return null

	return (
		<div
			className="absolute flex flex-col items-center"
			style={{
				left: x,
				top: top,
				height: height,
				transform: "translateX(-50%)",
			}}
		>
			<div
				style={{
					height: 2,
					width: 10,
					backgroundColor: FIGMA_RED,
					flexShrink: 0,
				}}
			/>
			<div className="relative flex flex-1 flex-col items-center">
				<div style={{ width: 2, flex: 1, backgroundColor: FIGMA_RED }} />
				<div
					className="z-10 flex-shrink-0 whitespace-nowrap rounded-sm font-mono font-medium shadow-sm"
					style={{
						backgroundColor: FIGMA_LABEL_BG,
						color: FIGMA_LABEL_TEXT,
						border: `1px solid ${FIGMA_RED}`,
						padding: "2px 6px",
						fontSize: 11,
					}}
				>
					{value}
				</div>
				<div style={{ width: 2, flex: 1, backgroundColor: FIGMA_RED }} />
			</div>
			<div
				style={{
					height: 2,
					width: 10,
					backgroundColor: FIGMA_RED,
					flexShrink: 0,
				}}
			/>
		</div>
	)
}

interface HorizontalDistanceLineProps {
	y: number
	x1: number
	x2: number
	value: number
}

function HorizontalDistanceLine({ y, x1, x2, value }: HorizontalDistanceLineProps) {
	const width = Math.abs(x2 - x1)
	const left = Math.min(x1, x2)

	if (width < 8) return null

	return (
		<div
			className="absolute flex items-center"
			style={{
				left: left,
				top: y,
				width: width,
				transform: "translateY(-50%)",
			}}
		>
			<div
				style={{
					height: 10,
					width: 2,
					backgroundColor: FIGMA_RED,
					flexShrink: 0,
				}}
			/>
			<div className="relative flex flex-1 items-center">
				<div style={{ height: 2, flex: 1, backgroundColor: FIGMA_RED }} />
				<div
					className="z-10 flex-shrink-0 whitespace-nowrap rounded-sm font-mono font-medium shadow-sm"
					style={{
						backgroundColor: FIGMA_LABEL_BG,
						color: FIGMA_LABEL_TEXT,
						border: `1px solid ${FIGMA_RED}`,
						padding: "2px 6px",
						fontSize: 11,
					}}
				>
					{value}
				</div>
				<div style={{ height: 2, flex: 1, backgroundColor: FIGMA_RED }} />
			</div>
			<div
				style={{
					height: 10,
					width: 2,
					backgroundColor: FIGMA_RED,
					flexShrink: 0,
				}}
			/>
		</div>
	)
}
