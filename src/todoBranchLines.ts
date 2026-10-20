import type { TodoEdge, TodoItem } from './types';

export interface BranchLineHead {
  id: string;     // head item id (an isHandle node)
  label: string;  // head's text (fallback '未命名分线')
}

/** Adjacency (source -> targets) + indegree over the WHOLE todoEdges graph, skipping stale endpoints. */
export const buildTodoGraph = (items: TodoItem[], edges: TodoEdge[]) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  items.forEach((i) => { outgoing.set(i.id, []); indegree.set(i.id, 0); });
  for (const edge of edges) {
    if (!byId.has(edge.sourceItemId) || !byId.has(edge.targetItemId)) continue; // skip dangling
    outgoing.get(edge.sourceItemId)!.push(edge.targetItemId);
    indegree.set(edge.targetItemId, (indegree.get(edge.targetItemId) || 0) + 1);
  }
  return { byId, outgoing, indegree };
};

/**
 * Heads = HANDLE (分线头) items only, sorted by item.order then id for a stable display order.
 * The second parameter is unused (heads no longer depend on edges) but the arity is kept because
 * callers (App.tsx sidebar) pass todoEdges positionally.
 */
export const computeBranchLineHeads = (items: TodoItem[], _edges: TodoEdge[]): BranchLineHead[] => {
  return items
    .filter((i) => i.isHandle === true)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, label: i.text?.trim() || '未命名分线' }));
};

/** Forward BFS from one head; returns reachable id set (includes the head). Cycle-safe via `seen`. */
export const reachableFrom = (headId: string, outgoing: Map<string, string[]>): Set<string> => {
  const seen = new Set<string>([headId]);
  const queue = [headId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of outgoing.get(cur) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return seen;
};

/**
 * Visible node set given the filter selection (filter entries are HANDLE head ids).
 *  - filter === null          => return null  (select-all / default => every node visible; callers skip filtering)
 *  - filter === []            => background-only: every node that belongs to NO branch-line is always shown
 *  - filter === [h1, h2, ...] => union of reachableFrom(h) for each selected handle that STILL exists & is still a handle,
 *                                 PLUS the always-shown background (nodes reachable from no handle at all)
 *
 * Background rule (NEW): a node that is reachable from NO handle has no branch-line, so it is ALWAYS visible
 * regardless of the filter. Only handle-rooted nodes are hidden by deselecting their handle.
 */
export const computeVisibleItemIds = (
  items: TodoItem[],
  edges: TodoEdge[],
  filter: string[] | null,
): Set<string> | null => {
  if (filter === null) return null;
  const { byId, outgoing } = buildTodoGraph(items, edges);

  // Every node reachable from ANY handle belongs to some branch-line.
  const inSomeBranchLine = new Set<string>();
  for (const item of items) {
    if (item.isHandle !== true) continue;
    for (const id of reachableFrom(item.id, outgoing)) inSomeBranchLine.add(id);
  }

  // Seed with the always-shown background: nodes that belong to no branch-line.
  const visible = new Set<string>();
  for (const item of items) if (!inSomeBranchLine.has(item.id)) visible.add(item.id);

  // Add the reachable set of each selected, still-valid handle.
  for (const headId of filter) {
    const head = byId.get(headId);
    if (!head || head.isHandle !== true) continue; // stale / demoted filter id => ignored
    for (const id of reachableFrom(headId, outgoing)) visible.add(id);
  }
  return visible;
};
