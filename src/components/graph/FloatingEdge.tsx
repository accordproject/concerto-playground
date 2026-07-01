import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge, Position, type EdgeProps } from '@xyflow/react';

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
}: EdgeProps) {
  const routePoints = Array.isArray((data as RouteData | undefined)?.routePoints)
    ? (data as RouteData).routePoints
    : undefined;
  const labelPointFromData = (data as RouteData | undefined)?.labelPoint;
  const canUseRoutePoints = !!routePoints && routePoints.length >= 2;

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
  const path = canUseRoutePoints ? buildPolylinePath(routePoints) : fallbackPath;
  const labelPoint = labelPointFromData
    ?? (canUseRoutePoints ? getPolylineMidpoint(routePoints) : { x: fallbackLabelX, y: fallbackLabelY });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
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

interface RouteData {
  labelPoint?: { x: number; y: number };
  routePoints?: Array<{ x: number; y: number }>;
}

function buildPolylinePath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function getPolylineMidpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0 };
  }

  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    segmentLengths.push(length);
    totalLength += length;
  }

  const targetLength = totalLength / 2;
  let traversed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = segmentLengths[index - 1];
    if (traversed + segmentLength >= targetLength) {
      const ratio = segmentLength === 0 ? 0 : (targetLength - traversed) / segmentLength;

      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio,
      };
    }
    traversed += segmentLength;
  }

  return points[points.length - 1];
}
