import type { Edge, Node } from '@xyflow/react';
import type { Declaration } from './types';
import { HANDLE_SIZE, getNodeWidth, type GraphTargetHandle } from './nodeLayout';

interface GraphNodeData {
  declaration: Declaration;
  incomingHandles?: GraphTargetHandle[];
}

interface RoutedEdgeData {
  laneX?: number;
}

const LANE_MIN_START_OFFSET = 120;
const LANE_TARGET_PADDING = 40;
const LANE_SPACING = 34;

/**
 * Assigns each property fan-in edge its own vertical lane between the two
 * nodes, so edges entering the same target stay separated instead of drawing
 * on top of each other. Only the lane's x coordinate is decided here; the
 * edge renderer builds the actual path from the live handle positions, so
 * edges always start and end exactly at their connection dots, at any zoom
 * level and for collapsed nodes too.
 */
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

    const sourceX = sourceNode.position.x
      + getRenderedNodeWidth(sourceNode, getGraphNodeData(sourceNode).declaration);
    const targetX = targetNode.position.x;

    const laneIndex = laneGroup.handleOrder.indexOf(edge.targetHandle);
    if (laneIndex === -1) return edge;

    const laneX = getLaneX({
      sourceX,
      targetX,
      laneCount: laneGroup.handleOrder.length,
      laneIndex,
    });
    if (laneX == null) return edge;

    return {
      ...edge,
      data: {
        ...(edge.data as object | undefined),
        laneX,
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

// Places the vertical lane for one edge inside the corridor between the two
// nodes. Lanes prefer their usual stand-off from the source and spacing, but
// compress into tight corridors instead of being drawn across the target
// node. Returns null when there is no corridor at all (overlapping nodes or a
// backwards edge); such edges fall back to a smooth step path.
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
}): number | null {
  const corridorStart = sourceX + HANDLE_SIZE;
  const corridorEnd = targetX - HANDLE_SIZE;
  const corridor = corridorEnd - corridorStart;
  if (corridor < HANDLE_SIZE) return null;

  const spacing = Math.min(LANE_SPACING, corridor / Math.max(laneCount - 1, 1));
  const laneSpread = spacing * Math.max(laneCount - 1, 0);
  const preferredLaneStart = targetX - LANE_TARGET_PADDING - laneSpread;
  const idealLaneStart = Math.min(sourceX + LANE_MIN_START_OFFSET, preferredLaneStart);
  const laneStart = Math.max(Math.min(idealLaneStart, corridorEnd - laneSpread), corridorStart);

  return laneStart + laneIndex * spacing;
}
