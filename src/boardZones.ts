import type { Node } from '@xyflow/react';
import type { TodoZone } from './types';

/** Padding (px) applied on all four sides when deriving a zone rect from selected nodes. */
export const ZONE_SELECTION_PAD = 24;

/** A rectangle in flow coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Resolve a node's rendered size, preferring React Flow's measured dims and falling back to the
 * declared n.width / n.height. Returns null when neither yields a finite width AND height
 * (an unmeasured node has no footprint — callers must exclude it). NO 176x96 default here.
 */
export const nodeSize = (n: Pick<Node, 'measured' | 'width' | 'height'>): { width: number; height: number } | null => {
  const w = n.measured?.width ?? n.width;
  const h = n.measured?.height ?? n.height;
  if (!isFiniteNumber(w) || !isFiniteNumber(h)) return null;
  return { width: w, height: h };
};

/**
 * Full rectangle-containment: true only when the node's entire footprint lies within zone Z.
 * An unmeasured node (nodeSize === null) is never a member.
 */
export const inside = (n: Pick<Node, 'position' | 'measured' | 'width' | 'height'>, Z: TodoZone): boolean => {
  const size = nodeSize(n);
  if (!size) return false;
  const { x, y } = n.position;
  return (
    x >= Z.x &&
    y >= Z.y &&
    x + size.width <= Z.x + Z.width &&
    y + size.height <= Z.y + Z.height
  );
};

/**
 * Selection rectangle from the measured nodes, padded by ZONE_SELECTION_PAD on every side.
 * Nodes without a resolvable size are ignored. Returns null when no node contributes a footprint.
 */
export const selectionBounds = (nodes: Array<Pick<Node, 'position' | 'measured' | 'width' | 'height'>>): Rect | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const n of nodes) {
    const size = nodeSize(n);
    if (!size) continue;
    any = true;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + size.width);
    maxY = Math.max(maxY, n.position.y + size.height);
  }
  if (!any) return null;
  return {
    x: minX - ZONE_SELECTION_PAD,
    y: minY - ZONE_SELECTION_PAD,
    width: (maxX - minX) + ZONE_SELECTION_PAD * 2,
    height: (maxY - minY) + ZONE_SELECTION_PAD * 2,
  };
};

type MoveNode = Pick<Node, 'id' | 'position' | 'measured' | 'width' | 'height'> & {
  data?: { isHandle?: boolean } & Record<string, unknown>;
};

/**
 * The set of node ids that move with a zone drag. Base = every node fully inside the zone rect.
 * For each base node that is a handle, union in its branch-line members (membersByHead.get(id)),
 * which may include nodes lying OUTSIDE the zone rect. Deduped by Set. Empty zone => empty set.
 */
export const computeZoneMoveSet = (
  zone: TodoZone,
  nodes: MoveNode[],
  membersByHead: Map<string, Set<string>>,
): Set<string> => {
  const result = new Set<string>();
  for (const n of nodes) {
    if (!inside(n, zone)) continue;
    result.add(n.id);
    if (n.data?.isHandle === true) {
      const members = membersByHead.get(n.id);
      if (members) for (const id of members) result.add(id);
    }
  }
  return result;
};
