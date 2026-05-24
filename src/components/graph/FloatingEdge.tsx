import { getBezierPath, useInternalNode, EdgeLabelRenderer, BaseEdge, Position, type EdgeProps } from '@xyflow/react';

type XY = { x: number; y: number };
type NodeLike = { internals: { positionAbsolute: XY }; measured: { width?: number; height?: number } };
type ParallelEdgeData = { parallelEdgeIndex?: number; parallelEdgeCount?: number };

function getClosestPoint(source: NodeLike, target: NodeLike): { x: number; y: number; position: Position } {
  const w = source.measured.width ?? 0;
  const h = source.measured.height ?? 0;
  const sx = source.internals.positionAbsolute.x;
  const sy = source.internals.positionAbsolute.y;
  const tx = target.internals.positionAbsolute.x + (target.measured.width ?? 0) / 2;
  const ty = target.internals.positionAbsolute.y + (target.measured.height ?? 0) / 2;

  const cx = sx + w / 2;
  const cy = sy + h / 2;

  const dx = tx - cx;
  const dy = ty - cy;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const scale = absDx / (w / 2) > absDy / (h / 2) ? (w / 2) / absDx : (h / 2) / absDy;

  const x = cx + dx * scale;
  const y = cy + dy * scale;

  let position: Position;
  if (absDx / (w / 2) > absDy / (h / 2)) {
    position = dx > 0 ? Position.Right : Position.Left;
  } else {
    position = dy > 0 ? Position.Bottom : Position.Top;
  }

  return { x, y, position };
}

function offsetParallelEdge(sourcePoint: XY, targetPoint: XY, offset: number): { sourcePoint: XY; targetPoint: XY } {
  if (!offset) {
    return { sourcePoint, targetPoint };
  }

  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    sourcePoint: { x: sourcePoint.x + normalX * offset, y: sourcePoint.y + normalY * offset },
    targetPoint: { x: targetPoint.x + normalX * offset, y: targetPoint.y + normalY * offset },
  };
}

export function FloatingEdge({ id, source, target, data, style, markerEnd, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sp = getClosestPoint(sourceNode as unknown as NodeLike, targetNode as unknown as NodeLike);
  const tp = getClosestPoint(targetNode as unknown as NodeLike, sourceNode as unknown as NodeLike);
  const parallelData = data as ParallelEdgeData | undefined;
  const parallelEdgeCount = parallelData?.parallelEdgeCount ?? 1;
  const parallelEdgeIndex = parallelData?.parallelEdgeIndex ?? 0;
  const lateralOffset = (parallelEdgeIndex - (parallelEdgeCount - 1) / 2) * 18;
  const { sourcePoint, targetPoint } = offsetParallelEdge(
    { x: sp.x, y: sp.y },
    { x: tp.x, y: tp.y },
    lateralOffset
  );

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sourcePoint.x, sourceY: sourcePoint.y, sourcePosition: sp.position,
    targetX: targetPoint.x, targetY: targetPoint.y, targetPosition: tp.position,
    curvature: parallelEdgeCount > 1 ? 0.3 : 0.25,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
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
