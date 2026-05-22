export interface Task {
  id: string;
  title: string;
  description: string;
  duration: number; // in hours/days
  isDone: boolean;
  startTime?: string; // YYYY-MM-DD
  endTime?: string; // YYYY-MM-DD
  color?: string; // e.g. 'emerald', 'sky', 'rose', 'violet', 'amber'
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
}

export type CategoryType = string;

export interface AppState {
  tasks: Record<string, Task>;
  goals: Record<string, Goal>;
  bomTree: BOMTreeItem[];
  selectedCategoryId: CategoryType;
  categories: AppCategory[];
  selectedGoalId: string | null; // null means Category Overview or Merged View
  isMergedView: boolean;
  selectedTaskId: string | null; // active task for Right Side Drawer
  activeMergedGoalIds: string[]; // Goals pulled into the consolidated merged workspace (initially empty)
  
  // Actions
  setCategory: (category: CategoryType) => void;
  addCategory: (label: string) => void;
  renameCategory: (id: string, newLabel: string) => void;
  deleteCategory: (id: string) => void;
  selectGoal: (goalId: string | null) => void;
  setMergedView: (val: boolean) => void;
  toggleActiveMergedGoalId: (goalId: string) => void;
  setActiveMergedGoalIds: (goalIds: string[]) => void;
  selectTask: (taskId: string | null) => void;
  
  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  
  // Goal Actions
  addGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
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
}
