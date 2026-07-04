import type { Edge, Node } from '@xyflow/react';
import type { Declaration } from './types';
import {
  getNodeWidth,
  getSourceHandleTop,
  getTargetHandleTop,
  type GraphTargetHandle,
} from './nodeLayout';

interface GraphNodeData {
  declaration: Declaration;
  incomingHandles?: GraphTargetHandle[];
}

interface RoutePoint {
  x: number;
  y: number;
}

interface RoutedEdgeData {
  labelPoint?: RoutePoint;
  routePoints?: RoutePoint[];
}

const LANE_MIN_START_OFFSET = 120;
const LANE_TARGET_PADDING = 40;
const LANE_SPACING = 34;

export function routeGraphEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const laneGroups = groupLaneEdges(nodes, edges);

  return edges.map((edge) => {
    const laneGroup = laneGroups.get(edge.target);
    if (!laneGroup || !edge.sourceHandle?.startsWith('prop:') || !edge.targetHandle?.startsWith('in:')) {
      return edge;
    }

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return edge;

    const sourceData = getGraphNodeData(sourceNode);
    const targetData = getGraphNodeData(targetNode);
    const sourceTop = getSourceHandleTop(sourceData.declaration, edge.sourceHandle);
    const targetTop = getTargetHandleTop(
      targetData.declaration,
      edge.targetHandle,
      targetData.incomingHandles,
    );
    if (sourceTop == null || targetTop == null) return edge;

    const sourceX = sourceNode.position.x + getRenderedNodeWidth(sourceNode, sourceData.declaration);
    const sourceY = sourceNode.position.y + sourceTop;
    const targetX = targetNode.position.x;
    const targetY = targetNode.position.y + targetTop;

    const laneIndex = laneGroup.handleOrder.indexOf(edge.targetHandle);
    if (laneIndex === -1) return edge;

    const laneX = getLaneX({
      sourceX,
      targetX,
      laneCount: laneGroup.handleOrder.length,
      laneIndex,
    });
    const routePoints = dedupePoints([
      { x: sourceX, y: sourceY },
      { x: laneX, y: sourceY },
      { x: laneX, y: targetY },
      { x: targetX, y: targetY },
    ]);

    return {
      ...edge,
      data: {
        ...(edge.data as object | undefined),
        labelPoint: getLaneLabelPoint(routePoints),
        routePoints,
      } satisfies RoutedEdgeData,
    };
  });
}

function groupLaneEdges(nodes: Node[], edges: Edge[]): Map<string, { handleOrder: string[] }> {
  const edgesByTarget = new Map<string, Edge[]>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edges) {
    if (!edge.sourceHandle?.startsWith('prop:') || !edge.targetHandle?.startsWith('in:')) continue;

    const targetEdges = edgesByTarget.get(edge.target) ?? [];
    targetEdges.push(edge);
    edgesByTarget.set(edge.target, targetEdges);
  }

  const groups = new Map<string, { handleOrder: string[] }>();
  for (const [target, targetEdges] of edgesByTarget) {
    const targetNode = nodeById.get(target);
    const handleOrder = (targetNode ? getGraphNodeData(targetNode).incomingHandles ?? [] : [])
      .map((handle) => handle.id);

    groups.set(target, {
      handleOrder: handleOrder.length > 0
        ? handleOrder
        : targetEdges.map((edge) => edge.targetHandle!),
    });
  }

  return groups;
}

function getGraphNodeData(node: Node): GraphNodeData {
  return node.data as unknown as GraphNodeData;
}

function getRenderedNodeWidth(node: Node, declaration: Declaration): number {
  return node.measured?.width ?? node.width ?? getNodeWidth(declaration);
}

function getLaneX({
  sourceX,
  targetX,
  laneCount,
  laneIndex,
}: {
  sourceX: number;
  targetX: number;
  laneCount: number;
  laneIndex: number;
}): number {
  const maxLaneSpread = Math.max(LANE_SPACING * Math.max(laneCount - 1, 1), LANE_SPACING * 2);
  const preferredLaneStart = targetX - LANE_TARGET_PADDING - maxLaneSpread;
  const minimumLaneStart = sourceX + LANE_MIN_START_OFFSET;
  const laneStart = Math.max(minimumLaneStart, preferredLaneStart);

  return laneStart + laneIndex * LANE_SPACING;
}

function getLaneLabelPoint(routePoints: RoutePoint[]): RoutePoint {
  if (routePoints.length < 2) {
    return routePoints[0] ?? { x: 0, y: 0 };
  }

  const source = routePoints[0];
  const laneEntry = routePoints[1];
  const horizontalLength = laneEntry.x - source.x;
  const labelX = source.x + Math.min(140, Math.max(70, horizontalLength * 0.45));

  return { x: labelX, y: source.y - 10 };
}

function dedupePoints(points: RoutePoint[]): RoutePoint[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}
