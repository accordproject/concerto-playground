import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge, Position, type EdgeProps } from '@xyflow/react';

const EDGE_CORNER_RADIUS = 18;
// Below this vertical delta the two endpoints are visually level, and a lane
// would render as a distracting few-pixel jog; draw those edges straight.
const LANE_STRAIGHT_SNAP = 8;

interface RouteData {
  laneX?: number;
}

export function FloatingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
  selected,
}: EdgeProps) {
  // Lane-routed edges get their vertical column from the router; the path
  // itself is built from the live endpoint coordinates, so the line always
  // starts and ends exactly on its connection dots. The lane is re-validated
  // against those live coordinates and dropped when it no longer fits
  // between the nodes (mid-drag, overlapping nodes).
  const laneX = (data as RouteData | undefined)?.laneX;
  const laneUsable = typeof laneX === 'number' && laneX > sourceX + 2 && laneX < targetX - 2;

  let path: string;
  let labelPoint: { x: number; y: number };
  if (laneUsable) {
    const points = Math.abs(targetY - sourceY) <= LANE_STRAIGHT_SNAP
      ? [
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY },
        ]
      : [
          { x: sourceX, y: sourceY },
          { x: laneX, y: sourceY },
          { x: laneX, y: targetY },
          { x: targetX, y: targetY },
        ];
    path = buildRoundedPolylinePath(points, EDGE_CORNER_RADIUS);
    labelPoint = {
      x: sourceX + Math.min(140, Math.max(70, (laneX - sourceX) * 0.45)),
      y: sourceY - 10,
    };
  } else {
    const [fallbackPath, fallbackLabelX, fallbackLabelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 18,
      offset: 24,
    });
    path = fallbackPath;
    labelPoint = { x: fallbackLabelX, y: fallbackLabelY };
  }

  // The selected edge turns fully white with a layered white-hot glow, so the
  // clicked connection is unmissable across the whole canvas.
  const stroke = (style?.stroke as string | undefined) ?? '#63b3ed';
  const strokeWidth = Number(style?.strokeWidth ?? 2);
  const edgeStyle = selected
    ? {
        ...style,
        stroke: '#ffffff',
        strokeWidth: strokeWidth + 2,
        filter: `drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 8px #ffffff) drop-shadow(0 0 14px ${stroke})`,
      }
    : style;

  return (
    <>
      <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
              pointerEvents: 'none',
              padding: Array.isArray(labelBgPadding) ? `${labelBgPadding[1]}px ${labelBgPadding[0]}px` : '3px 6px',
              borderRadius: labelBgBorderRadius ?? 4,
              background: (labelBgStyle as any)?.fill ?? '#1a202c',
              opacity: (labelBgStyle as any)?.fillOpacity ?? 0.8,
              color: (labelStyle as any)?.fill ?? '#fff',
              fontSize: (labelStyle as any)?.fontSize ?? 10,
              fontWeight: (labelStyle as any)?.fontWeight ?? 500,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function buildRoundedPolylinePath(points: Array<{ x: number; y: number }>, radius: number): string {
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    // Shrink the arc on short segments so consecutive corners never overlap.
    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);

    if (cornerRadius < 0.5) {
      path += ` L ${corner.x} ${corner.y}`;
      continue;
    }

    const arcStartX = corner.x - ((corner.x - previous.x) / inLength) * cornerRadius;
    const arcStartY = corner.y - ((corner.y - previous.y) / inLength) * cornerRadius;
    const arcEndX = corner.x + ((next.x - corner.x) / outLength) * cornerRadius;
    const arcEndY = corner.y + ((next.y - corner.y) / outLength) * cornerRadius;
    path += ` L ${arcStartX} ${arcStartY} Q ${corner.x} ${corner.y} ${arcEndX} ${arcEndY}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}
