import type { AppCategory, Goal, GoalEdge, GoalNode, Task, WorkspaceComponent, WorkspaceDirectory } from './types';

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

export const getDirectoryDescendantTaskIds = (
  directoryId: string,
  directories: WorkspaceDirectory[],
  graph: WorkspaceGraph,
): Set<string> => {
  const directoryPositions = new Map(directories.map((directory) => [
    directory.id,
    graph.nodePositions.get(directory.id) || directory.position,
  ]));
  const nodePositions = new Map([...graph.nodePositions, ...directoryPositions]);
  const childrenByNodeId = new Map<string, Set<string>>();
  graph.edges.forEach((edge) => {
    const sourcePosition = nodePositions.get(edge.source);
    const targetPosition = nodePositions.get(edge.target);
    if (!sourcePosition || !targetPosition) return;
    const parentId = sourcePosition.x <= targetPosition.x ? edge.source : edge.target;
    const childId = parentId === edge.source ? edge.target : edge.source;
    const children = childrenByNodeId.get(parentId) || new Set<string>();
    children.add(childId);
    childrenByNodeId.set(parentId, children);
  });

  const taskIds = new Set<string>();
  const visited = new Set([directoryId]);
  const queue = [directoryId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    childrenByNodeId.get(nodeId)?.forEach((childId) => {
      if (visited.has(childId)) return;
      visited.add(childId);
      const taskId = graph.nodeTaskIds.get(childId);
      if (taskId) taskIds.add(taskId);
      queue.push(childId);
    });
  }
  return taskIds;
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

interface TaskOwnershipContext {
  taskId: string;
  tasks: Record<string, Task>;
  categories: AppCategory[];
  goals: Record<string, Goal>;
  workspaceNodes: GoalNode[];
  directories: WorkspaceDirectory[];
  mergedEdges: GoalEdge[];
  mergedNodePositions: Record<string, { x: number; y: number }>;
}

export const getTaskOwnershipPaths = ({
  taskId,
  tasks,
  categories,
  goals,
  workspaceNodes,
  directories,
  mergedEdges,
  mergedNodePositions,
}: TaskOwnershipContext): string[] => {
  const task = tasks[taskId];
  if (!task) return [];
  const graph = getWorkspaceGraph(goals, workspaceNodes, mergedEdges, {
    ...mergedNodePositions,
    ...Object.fromEntries(directories.map((directory) => [directory.id, mergedNodePositions[directory.id] || directory.position])),
  });
  const nodePositions = new Map(graph.nodePositions);
  directories.forEach((directory) => nodePositions.set(directory.id, mergedNodePositions[directory.id] || directory.position));
  const directoryById = new Map(directories.map((directory) => [directory.id, directory]));
  const goalByNodeId = new Map<string, Goal>();
  Object.values(goals).forEach((goal) => goal.nodes.forEach((node) => goalByNodeId.set(node.id, goal)));
  const parentCandidates = new Map<string, Array<{ id: string; distance: number }>>();
  graph.edges.forEach((edge) => {
    const sourcePosition = nodePositions.get(edge.source);
    const targetPosition = nodePositions.get(edge.target);
    if (!sourcePosition || !targetPosition) return;
    const sourceIsParent = sourcePosition.x <= targetPosition.x;
    const parentId = sourceIsParent ? edge.source : edge.target;
    const childId = sourceIsParent ? edge.target : edge.source;
    if (!graph.nodeTaskIds.has(parentId) && !directoryById.has(parentId)) return;
    if (!graph.nodeTaskIds.has(childId) && !directoryById.has(childId)) return;
    const candidates = parentCandidates.get(childId) || [];
    candidates.push({ id: parentId, distance: Math.abs(targetPosition.x - sourcePosition.x) });
    parentCandidates.set(childId, candidates);
  });
  const parentByNodeId = new Map<string, string>();
  parentCandidates.forEach((candidates, childId) => {
    candidates.sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
    if (candidates[0]) parentByNodeId.set(childId, candidates[0].id);
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const getCategoryPath = (categoryId: string) => {
    const labels: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = categoryId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const category = categoryById.get(currentId);
      if (!category) break;
      labels.unshift(category.label);
      currentId = category.parentId;
    }
    return labels;
  };
  const getAncestorLabels = (nodeId: string) => {
    const labels: string[] = [];
    const visited = new Set([nodeId]);
    let parentId = parentByNodeId.get(nodeId);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const directory = directoryById.get(parentId);
      const parentTaskId = graph.nodeTaskIds.get(parentId);
      const label = directory?.name || (parentTaskId ? tasks[parentTaskId]?.title : '');
      if (label) labels.unshift(label);
      parentId = parentByNodeId.get(parentId);
    }
    return labels;
  };
  const taskNodeIds = Array.from(graph.nodeTaskIds.entries())
    .filter(([, nodeTaskId]) => nodeTaskId === taskId)
    .map(([nodeId]) => nodeId);
  const fallbackGoals = Object.values(goals).filter((goal) => goal.nodes.some((node) => node.taskId === taskId));
  const pathSet = new Set<string>();
  const appendPath = (nodeId?: string, goal?: Goal, categoryId?: string) => {
    const segments = [
      ...(categoryId ? getCategoryPath(categoryId) : ['未分类']),
      ...(goal?.title ? [goal.title] : []),
      ...(nodeId ? getAncestorLabels(nodeId) : []),
      task.title || '未命名任务',
    ].filter((segment, index, values) => segment && segment !== values[index - 1]);
    pathSet.add(segments.join('/'));
  };
  taskNodeIds.forEach((nodeId) => {
    const goal = goalByNodeId.get(nodeId);
    const categoryIds = goal ? [goal.category] : (task.categoryIds || []);
    if (categoryIds.length === 0) appendPath(nodeId, undefined, undefined);
    else categoryIds.forEach((categoryId) => appendPath(nodeId, goal, categoryId));
  });
  if (taskNodeIds.length === 0) {
    if (fallbackGoals.length > 0) fallbackGoals.forEach((goal) => appendPath(undefined, goal, goal.category));
    else if (task.categoryIds?.length) task.categoryIds.forEach((categoryId) => appendPath(undefined, undefined, categoryId));
    else appendPath();
  }
  return Array.from(pathSet).sort((left, right) => left.localeCompare(right));
};
