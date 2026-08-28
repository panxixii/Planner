import type { Goal, GoalEdge, GoalNode, Task, WorkspaceComponent } from './types';

export interface WorkspaceGraph {
  nodeTaskIds: Map<string, string>;
  nodePositions: Map<string, { x: number; y: number }>;
  edges: GoalEdge[];
}

export const getWorkspaceGraph = (
  goals: Record<string, Goal>,
  workspaceNodes: GoalNode[],
  mergedEdges: GoalEdge[],
  positionOverrides: Record<string, { x: number; y: number }> = {},
): WorkspaceGraph => {
  const nodeTaskIds = new Map<string, string>();
  const nodePositions = new Map<string, { x: number; y: number }>();
  Object.values(goals).forEach((goal) => goal.nodes.forEach((node) => {
    nodeTaskIds.set(node.id, node.taskId);
    nodePositions.set(node.id, positionOverrides[node.id] || node.position);
  }));
  workspaceNodes.forEach((node) => {
    nodeTaskIds.set(node.id, node.taskId);
    nodePositions.set(node.id, positionOverrides[node.id] || node.position);
  });

  return {
    nodeTaskIds,
    nodePositions,
    edges: [...Object.values(goals).flatMap((goal) => goal.edges), ...mergedEdges],
  };
};

export const getDescendantTaskIds = (graph: WorkspaceGraph, rootTaskId: string): Set<string> => {
  const childNodeIds = new Map<string, Set<string>>();
  graph.edges.forEach((edge) => {
    const sourcePosition = graph.nodePositions.get(edge.source);
    const targetPosition = graph.nodePositions.get(edge.target);
    if (!sourcePosition || !targetPosition) return;
    const parentId = sourcePosition.x <= targetPosition.x ? edge.source : edge.target;
    const childId = parentId === edge.source ? edge.target : edge.source;
    const children = childNodeIds.get(parentId) || new Set<string>();
    children.add(childId);
    childNodeIds.set(parentId, children);
  });

  const rootNodeIds = Array.from(graph.nodeTaskIds.entries())
    .filter(([, taskId]) => taskId === rootTaskId)
    .map(([nodeId]) => nodeId);
  const visited = new Set(rootNodeIds);
  const queue = [...rootNodeIds];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    childNodeIds.get(nodeId)?.forEach((childId) => {
      if (visited.has(childId)) return;
      visited.add(childId);
      queue.push(childId);
    });
  }

  return new Set(Array.from(visited).map((nodeId) => graph.nodeTaskIds.get(nodeId)).filter(Boolean) as string[]);
};

export const getTaskComponentIds = (task: Task): string[] => task.componentIds || [];

export const getComponentLabel = (component: WorkspaceComponent, index: number) => (
  component.name.trim() || `未命名联通块 ${index + 1}`
);

export const getComponentMemberTaskIds = (componentId: string, tasks: Record<string, Task>) => new Set(
  Object.values(tasks)
    .filter((task) => task.componentIds?.includes(componentId))
    .map((task) => task.id),
);
