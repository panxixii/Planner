export interface Task {
  id: string;
  title: string;
  description: string;
  duration: number; // estimated hours, decimals supported
  isDone: boolean;
  statusId?: string; // References a configurable task status.
  categoryIds?: string[]; // Legacy plan-category data, kept for saved-data compatibility.
  componentIds?: string[]; // Explicit connected blocks that reuse this node.
  startTime?: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  endTime?: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  color?: string; // e.g. 'emerald', 'sky', 'rose', 'violet', 'amber'
}

export interface TaskStatus {
  id: string;
  label: string;
  isCompleted?: boolean;
  isSystem?: boolean;
}

export interface GoalNode {
  id: string; // unique react-flow node ID
  taskId: string; // references task in tasks map
  position: { x: number; y: number };
}

export interface GoalEdge {
  id: string; // react-flow edge ID
  source: string; // React flow node id
  target: string; // React flow node id
  categoryIds?: string[]; // Workspaces that currently include this shared edge.
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string; // 'career' | 'health' | 'finance' | 'personal'
  nodes: GoalNode[];
  edges: GoalEdge[];
  color: string; // hex or theme color (e.g., 'indigo')
}

export interface BOMTreeItem {
  id: string;
  title: string;
  type: 'category' | 'task';
  taskId?: string; // References global tasks pool if it is a task
  children?: BOMTreeItem[];
}

export interface AppCategory {
  id: string;
  label: string;
  parentId?: string;
}

export type CategoryType = string;

export type WorkspaceEdgeShape = 'bezier' | 'smoothstep' | 'straight';

export interface WorkspaceComponent {
  id: string;
  name: string;
  color: string;
  nodeColor: string;
  edgeColor: string;
  edgeShape: WorkspaceEdgeShape;
  handlePosition: { x: number; y: number };
}

export interface TodoLane {
  id: string;
  name: string;
}

export interface TodoItem {
  taskId: string;
  laneId: string;
  parentTaskId: string | null;
  order: number;
}

export interface TimeTemplateBlock {
  id: string;
  startMinute: number; // Minutes since the start of this repeating cycle.
  endMinute: number;
  label: string;
  color: string;
}

export interface TimeTemplate {
  id: string;
  name: string;
  type: 'daily' | 'weekly';
  blocks: TimeTemplateBlock[];
}

export interface DraftStrokePoint {
  x: number;
  y: number;
}

export interface DraftStroke {
  id: string;
  color: string;
  width: number;
  points: DraftStrokePoint[];
}

export interface DraftBoard {
  id: string;
  name: string;
  nodes: GoalNode[];
  edges: GoalEdge[];
  strokes: DraftStroke[];
}

export interface AppState {
  tasks: Record<string, Task>;
  taskStatuses: TaskStatus[];
  goals: Record<string, Goal>;
  bomTree: BOMTreeItem[];
  selectedCategoryId: CategoryType;
  categories: AppCategory[];
  selectedGoalId: string | null; // null means Category Overview or Merged View
  isMergedView: boolean;
  selectedTaskId: string | null; // active task for Right Side Drawer
  activeNodeActionsId: string | null; // transient node action popover owner
  activeMergedGoalIds: string[]; // Goals pulled into the consolidated merged workspace (initially empty)
  workspaceComponentFilter: string[] | null; // null means the complete workspace
  workspaceComponents: WorkspaceComponent[];
  activeComponentDetailsId: string | null;
  todoLanes: TodoLane[];
  todoItems: TodoItem[];
  timeTemplates: TimeTemplate[];
  activeTimeTemplateIds: { daily: string | null; weekly: string | null };
  favoriteColors: string[];
  drafts: DraftBoard[];
  
  // Actions
  setCategory: (category: CategoryType) => void;
  addCategory: (label: string, parentId?: string) => void;
  renameCategory: (id: string, newLabel: string, parentId?: string) => void;
  deleteCategory: (id: string) => void;
  moveCategory: (draggedId: string, targetId: string | 'all', position: 'before' | 'after' | 'inside') => void;
  selectGoal: (goalId: string | null) => void;
  setMergedView: (val: boolean) => void;
  toggleActiveMergedGoalId: (goalId: string) => void;
  setActiveMergedGoalIds: (goalIds: string[]) => void;
  setWorkspaceComponentFilter: (componentIds: string[] | null) => void;
  addWorkspaceComponent: (name: string) => string;
  updateWorkspaceComponent: (id: string, updates: Partial<Omit<WorkspaceComponent, 'id'>>) => void;
  deleteWorkspaceComponent: (id: string) => void;
  openComponentDetails: (componentId: string | null) => void;
  selectTask: (taskId: string | null) => void;
  setActiveNodeActionsId: (nodeId: string | null) => void;

  // Todo execution graph
  addTaskToTodo: (taskId: string) => boolean;
  addTodoLane: (name?: string) => string;
  renameTodoLane: (laneId: string, name: string) => void;
  deleteTodoLane: (laneId: string) => void;
  moveTodoItem: (taskId: string, laneId: string, parentTaskId: string | null, beforeTaskId?: string) => void;
  removeTaskFromTodo: (taskId: string) => void;

  // Reusable weekly time backgrounds
  addTimeTemplate: (type: TimeTemplate['type'], name?: string) => string;
  renameTimeTemplate: (id: string, name: string) => void;
  deleteTimeTemplate: (id: string) => void;
  setActiveTimeTemplate: (type: TimeTemplate['type'], id: string | null) => void;
  addTimeTemplateBlock: (templateId: string, block: Omit<TimeTemplateBlock, 'id'>) => string;
  updateTimeTemplateBlock: (templateId: string, blockId: string, updates: Partial<Omit<TimeTemplateBlock, 'id'>>) => void;
  deleteTimeTemplateBlock: (templateId: string, blockId: string) => void;
  addFavoriteColor: (color: string) => void;
  removeFavoriteColor: (color: string) => void;

  // Freeform draft canvases
  addDraft: (name?: string) => string;
  renameDraft: (id: string, name: string) => void;
  deleteDraft: (id: string) => void;
  addDraftNode: (draftId: string, node: GoalNode) => void;
  updateDraftNodes: (draftId: string, nodes: GoalNode[]) => void;
  removeDraftNode: (draftId: string, nodeId: string) => void;
  addDraftEdge: (draftId: string, edge: GoalEdge) => void;
  removeDraftEdge: (draftId: string, edgeId: string) => void;
  addDraftStroke: (draftId: string, stroke: DraftStroke) => void;
  replaceDraftStrokes: (draftId: string, strokes: DraftStroke[]) => void;
  undoDraftStroke: (draftId: string) => void;
  clearDraftStrokes: (draftId: string) => void;
  
  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setTaskComponentIds: (taskId: string, componentIds: string[]) => void;
  removeTaskFromWorkspace: (taskId: string, componentIds: string[] | null) => void;
  addTaskStatus: (label: string) => string | null;
  renameTaskStatus: (statusId: string, label: string) => void;
  deleteTaskStatus: (statusId: string) => void;
  
  // Goal Actions
  addGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  updateGoalNodes: (goalId: string, nodes: GoalNode[]) => void;
  updateGoalEdges: (goalId: string, edges: GoalEdge[]) => void;
  addNodeToGoal: (goalId: string, node: GoalNode) => void;
  addEdgeToGoal: (goalId: string, edge: GoalEdge) => void;
  deleteNodeFromGoal: (goalId: string, nodeId: string) => void;
  deleteEdgeFromGoal: (goalId: string, edgeId: string) => void;
  
  // Cross-Goal links for Merged View
  crossGoalEdges: GoalEdge[];
  addCrossGoalEdge: (edge: GoalEdge) => void;
  deleteCrossGoalEdge: (edgeId: string) => void;
  
  // BOM Actions
  addBOMItem: (parentItemId: string, item: BOMTreeItem) => void;

  // Sidebar collapse and Help banners toggle states
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  showHelp: boolean;
  toggleHelp: () => void;
  clearWorkspace: () => void;
  
  // Custom task sorting for Gantt timeline
  timelineTaskOrder: string[];
  setTimelineTaskOrder: (order: string[]) => void;

  // Timeline collapse state
  isTimelineCollapsed: boolean;
  toggleTimeline: () => void;

  // Independent Merged View state
  mergedNodePositions: Record<string, { x: number; y: number }>;
  workspaceNodes: GoalNode[];
  mergedEdges: GoalEdge[];
  mergedNodeIds: string[];
  updateMergedNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
  addWorkspaceNode: (node: GoalNode) => void;
  addMergedEdge: (edge: GoalEdge) => void;
  deleteMergedEdge: (edgeId: string) => void;
  removeEdgeFromWorkspace: (edgeId: string, componentIds: string[] | null) => void;
  addMergedNodeId: (nodeId: string) => void;
  deleteMergedNodeId: (nodeId: string) => void;
  clearMergedNodeIds: () => void;
}
