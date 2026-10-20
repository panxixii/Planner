import type { TodoEdge, TodoItem } from './types';

export interface BranchLineHead {
  id: string;     // head item id (indegree 0)
  label: string;  // head's text (fallback '未命名' / '未命名目录')
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

/** Heads = indegree-0 items, sorted by item.order then id for a stable display order. */
export const computeBranchLineHeads = (items: TodoItem[], edges: TodoEdge[]): BranchLineHead[] => {
  const { indegree } = buildTodoGraph(items, edges);
  return items
    .filter((i) => (indegree.get(i.id) || 0) === 0)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, label: i.text?.trim() || (i.isDirectory ? '未命名目录' : '未命名') }));
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
 * Visible node set given the filter selection (filter entries are HEAD ids).
 *  - filter === null          => return null  (select-all / default => every node visible; callers skip filtering)
 *  - filter === []            => return empty Set  (select-none => blank board)
 *  - filter === [h1, h2, ...] => union of reachableFrom(h) for each selected head that STILL exists & is still indegree 0
 */
export const computeVisibleItemIds = (
  items: TodoItem[],
  edges: TodoEdge[],
  filter: string[] | null,
): Set<string> | null => {
  if (filter === null) return null;
  const { outgoing, indegree } = buildTodoGraph(items, edges);
  const visible = new Set<string>();
  for (const headId of filter) {
    if (!indegree.has(headId)) continue;             // id not in current items => ignored
    if ((indegree.get(headId) || 0) !== 0) continue; // no longer a head (gained an incoming edge) => ignored
    for (const id of reachableFrom(headId, outgoing)) visible.add(id);
  }
  return visible; // possibly empty
};
