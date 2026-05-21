import { create } from 'zustand';
import { AppState, Task, Goal, BOMTreeItem, CategoryType, GoalNode, GoalEdge, AppCategory } from './types';

// Helper to generate IDs
const genId = () => Math.random().toString(36).substring(2, 11);

const LOCAL_STORAGE_KEY = 'lifeprint-blueprints-state-v1';

// Clean initial empty database values (Purged of all preloaded template items)
const EMPTY_TASKS: Record<string, Task> = {};
const EMPTY_GOALS: Record<string, Goal> = {};
const EMPTY_BOM_TREE: BOMTreeItem[] = [];

// Standard category list defaults, fully renameable/deleteable by user
const DEFAULT_CATEGORIES: AppCategory[] = [
  { id: 'career', label: '职业与技术' },
  { id: 'health', label: '健康与活力' },
  { id: 'finance', label: '财富与自由' },
  { id: 'personal', label: '心智与成长' }
];

// Helper to load state from localStorage
const loadSavedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          tasks: parsed.tasks || {},
          goals: parsed.goals || {},
          bomTree: parsed.bomTree || [],
          categories: parsed.categories || DEFAULT_CATEGORIES,
          selectedCategoryId: parsed.selectedCategoryId || 'all',
          selectedGoalId: parsed.selectedGoalId || null,
          isMergedView: parsed.isMergedView || false,
          activeMergedGoalIds: parsed.activeMergedGoalIds || [],
          crossGoalEdges: parsed.crossGoalEdges || [],
          isSidebarCollapsed: parsed.isSidebarCollapsed || false,
          showHelp: typeof parsed.showHelp === 'boolean' ? parsed.showHelp : true
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse saved state:', e);
  }
  return null;
};

const savedState = loadSavedState();

const initialTasks = savedState ? savedState.tasks : EMPTY_TASKS;
const initialGoals = savedState ? savedState.goals : EMPTY_GOALS;
const initialBOMTree = savedState ? savedState.bomTree : EMPTY_BOM_TREE;
const initialCategories = savedState ? savedState.categories : DEFAULT_CATEGORIES;
const initialSelectedCategoryId = savedState ? savedState.selectedCategoryId : 'all';
const initialSelectedGoalId = savedState ? savedState.selectedGoalId : null;
const initialIsMergedView = savedState ? savedState.isMergedView : false;
const initialActiveMergedGoalIds = savedState ? savedState.activeMergedGoalIds : [];
const initialCrossGoalEdges = savedState ? savedState.crossGoalEdges : [];
const initialIsSidebarCollapsed = savedState ? savedState.isSidebarCollapsed : false;
const initialShowHelp = savedState ? savedState.showHelp : true;

export const useAppStore = create<AppState>((set, get) => {
  // A wrapper function that performs the state change and automatically persists it to localStorage
  const persistSet = (nextStateOrFn: any) => {
    set((state) => {
      const next = typeof nextStateOrFn === 'function' ? nextStateOrFn(state) : nextStateOrFn;
      const merged = { ...state, ...next };

      try {
        const toSave = {
          tasks: merged.tasks,
          goals: merged.goals,
          bomTree: merged.bomTree,
          categories: merged.categories,
          selectedCategoryId: merged.selectedCategoryId,
          selectedGoalId: merged.selectedGoalId,
          isMergedView: merged.isMergedView,
          activeMergedGoalIds: merged.activeMergedGoalIds,
          crossGoalEdges: merged.crossGoalEdges,
          isSidebarCollapsed: merged.isSidebarCollapsed,
          showHelp: merged.showHelp
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save state to localStorage:', e);
      }

      return next;
    });
  };

  return {
    tasks: initialTasks,
    goals: initialGoals,
    bomTree: initialBOMTree,
    selectedCategoryId: initialSelectedCategoryId,
    categories: initialCategories,
    selectedGoalId: initialSelectedGoalId,
    isMergedView: initialIsMergedView,
    selectedTaskId: null,
    activeMergedGoalIds: initialActiveMergedGoalIds,
    crossGoalEdges: initialCrossGoalEdges,
    isSidebarCollapsed: initialIsSidebarCollapsed,
    showHelp: initialShowHelp,

    setCategory: (category) => persistSet({ 
      selectedCategoryId: category, 
      selectedGoalId: null, // Reset active goal screen so it displays Goal Cards for this category
      isMergedView: false 
    }),

    addCategory: (label) => persistSet((state: AppState) => {
      const newId = 'cat-' + genId();
      return {
        categories: [...state.categories, { id: newId, label }]
      };
    }),

    renameCategory: (id, newLabel) => persistSet((state: AppState) => ({
      categories: state.categories.map((c) => c.id === id ? { ...c, label: newLabel } : c)
    })),

    deleteCategory: (id) => persistSet((state: AppState) => {
      const nextCategories = state.categories.filter((c) => c.id !== id);
      let nextSelectedCategoryId = state.selectedCategoryId;
      if (state.selectedCategoryId === id) {
        nextSelectedCategoryId = 'all';
      }
      const nextGoals = { ...state.goals };
      Object.keys(nextGoals).forEach((gid) => {
        if (nextGoals[gid].category === id) {
          delete nextGoals[gid];
        }
      });
      const nextSelectedGoalId = state.selectedGoalId && state.goals[state.selectedGoalId]?.category === id
        ? null
        : state.selectedGoalId;
      return {
        categories: nextCategories,
        selectedCategoryId: nextSelectedCategoryId,
        goals: nextGoals,
        selectedGoalId: nextSelectedGoalId
      };
    }),

    selectGoal: (goalId) => persistSet({ 
      selectedGoalId: goalId, 
      isMergedView: false 
    }),

    setMergedView: (val) => persistSet({ 
      isMergedView: val, 
      selectedGoalId: null // Clear normal single goal screen
    }),

    toggleActiveMergedGoalId: (goalId) => persistSet((state: AppState) => {
      const isIncluded = state.activeMergedGoalIds.includes(goalId);
      return {
        activeMergedGoalIds: isIncluded
          ? state.activeMergedGoalIds.filter(id => id !== goalId)
          : [...state.activeMergedGoalIds, goalId]
      };
    }),

    setActiveMergedGoalIds: (goalIds) => persistSet({ activeMergedGoalIds: goalIds }),

    selectTask: (taskId) => persistSet({ selectedTaskId: taskId }),

    // TASK ACTIONS (Normalized changes reflect everywhere instantly!)
    addTask: (task) => persistSet((state: AppState) => ({
      tasks: { ...state.tasks, [task.id]: task }
    })),

    updateTask: (taskId, updates) => persistSet((state: AppState) => {
      const updatedTask = { ...state.tasks[taskId], ...updates };
      return {
        tasks: { ...state.tasks, [taskId]: updatedTask }
      };
    }),

    deleteTask: (taskId) => persistSet((state: AppState) => {
      const nextTasks = { ...state.tasks };
      delete nextTasks[taskId];

      // Also prune from goal nodes if it is removed entirely
      const nextGoals = { ...state.goals };
      Object.keys(nextGoals).forEach((gid) => {
        nextGoals[gid].nodes = nextGoals[gid].nodes.filter(n => n.taskId !== taskId);
      });

      return {
        tasks: nextTasks,
        goals: nextGoals,
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId
      };
    }),

    // GOAL ACTIONS
    addGoal: (goal) => persistSet((state: AppState) => ({
      goals: { ...state.goals, [goal.id]: goal }
    })),

    updateGoalNodes: (goalId, nodes) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      return {
        goals: {
          ...state.goals,
          [goalId]: { ...targetGoal, nodes }
        }
      };
    }),

    updateGoalEdges: (goalId, edges) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      return {
        goals: {
          ...state.goals,
          [goalId]: { ...targetGoal, edges }
        }
      };
    }),

    addNodeToGoal: (goalId, node) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      return {
        goals: {
          ...state.goals,
          [goalId]: {
            ...targetGoal,
            nodes: [...targetGoal.nodes, node]
          }
        }
      };
    }),

    addEdgeToGoal: (goalId, edge) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      return {
        goals: {
          ...state.goals,
          [goalId]: {
            ...targetGoal,
            edges: [...targetGoal.edges, edge]
          }
        }
      };
    }),

    deleteNodeFromGoal: (goalId, nodeId) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      const filteredNodes = targetGoal.nodes.filter(n => n.id !== nodeId);
      // Also sweep downstream edges associated with this node ID
      const filteredEdges = targetGoal.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
      
      // Also prune from crossGoalEdges if any
      const nextCrossEdges = state.crossGoalEdges.filter(e => e.source !== nodeId && e.target !== nodeId);

      return {
        goals: {
          ...state.goals,
          [goalId]: { ...targetGoal, nodes: filteredNodes, edges: filteredEdges }
        },
        crossGoalEdges: nextCrossEdges
      };
    }),

    deleteEdgeFromGoal: (goalId, edgeId) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      return {
        goals: {
          ...state.goals,
          [goalId]: {
            ...targetGoal,
            edges: targetGoal.edges.filter(e => e.id !== edgeId)
          }
        }
      };
    }),

    addCrossGoalEdge: (edge) => persistSet((state: AppState) => ({
      crossGoalEdges: [...state.crossGoalEdges, edge]
    })),

    deleteCrossGoalEdge: (edgeId) => persistSet((state: AppState) => ({
      crossGoalEdges: state.crossGoalEdges.filter(e => e.id !== edgeId)
    })),

    addBOMItem: (parentItemId, item) => persistSet((state: AppState) => {
      const editTree = (items: BOMTreeItem[]): BOMTreeItem[] => {
        return items.map((node) => {
          if (node.id === parentItemId) {
            return {
              ...node,
              children: [...(node.children || []), item]
            };
          } else if (node.children) {
            return {
              ...node,
              children: editTree(node.children)
            };
          }
          return node;
        });
      };

      return {
        bomTree: editTree(state.bomTree)
      };
    }),

    toggleSidebar: () => persistSet((state: AppState) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    toggleHelp: () => persistSet((state: AppState) => ({ showHelp: !state.showHelp }))
  };
});
