import { create } from 'zustand';
import { AppState, Task, Goal, BOMTreeItem, CategoryType, GoalNode, GoalEdge, AppCategory } from './types';

// Helper to generate IDs
const genId = () => Math.random().toString(36).substring(2, 11);

const LOCAL_STORAGE_KEY = 'lifeprint-blueprints-state-v1';

// Preconfigured showcase database values (to populate with rich blueprints & timelines on first load)
const DEMO_TASKS: Record<string, Task> = {
  // SaaS plan tasks
  't-tech-1': { id: 't-tech-1', title: '独立微架构技术选型与原型设计', description: '评估微服务栈，编写技术路线可行性分析报告，跑跑本地MVP Demo。', duration: 4, isDone: true, color: 'sky', startTime: '2026-05-20', endTime: '2026-05-21' },
  't-tech-2': { id: 't-tech-2', title: '高内聚关系型数据库 schema 库表设计', description: '进行领域模型、关系型外键范式、以及依赖流转和状态机索引声明。', duration: 3, isDone: false, color: 'sky', startTime: '2026-05-22', endTime: '2026-05-23' },
  't-tech-3': { id: 't-tech-3', title: '前后端微服务及 Gateway 核心逻辑实现', description: '编写网关路由策略，完成JWT安全令牌验证中间件，并接通RPC。', duration: 8, isDone: false, color: 'violet', startTime: '2026-05-24', endTime: '2026-05-28' },
  't-tech-4': { id: 't-tech-4', title: '一键容器化构建、安全部署与发布上云', description: '打包镜像制作，配置CI/CD pipeline，完成生产环境安全鉴权校验。', duration: 5, isDone: false, color: 'emerald', startTime: '2026-05-29', endTime: '2026-06-01' },

  // Marathon plan tasks
  't-health-1': { id: 't-health-1', title: '购置专业缓震跑鞋与阻氧心率手环', description: '到装备专柜试穿合适的越野竞速跑鞋，同步运动心率与睡眠监测计。', duration: 2, isDone: true, color: 'rose', startTime: '2026-05-20', endTime: '2026-05-20' },
  't-health-2': { id: 't-health-2', title: '5公里体能跑及MAF180运动心率评估', description: '测试当前有氧心率配速底峰，建立个人训练里程跟进行动基准。', duration: 3, isDone: true, color: 'emerald', startTime: '2026-05-21', endTime: '2026-05-21' },
  't-health-3': { id: 't-health-3', title: '长距离 L.S.D 轻松跑体能心肺储备跑', description: '保持中低强度（心率控制在有氧区间），单次跑够 40 分钟进行阻氧扩容。', duration: 4, isDone: false, color: 'emerald', startTime: '2026-05-22', endTime: '2026-05-24' },
  't-health-4': { id: 't-health-4', title: 'Q2 城市马拉松5公里顺利跑进25分大关', description: '进行能量补给测试，在5月末完成终极赛道极限测试。', duration: 6, isDone: false, color: 'emerald', startTime: '2026-05-28', endTime: '2026-05-29' },

  // Grow/Read book plan tasks
  't-grow-1': { id: 't-grow-1', title: '拟定Q2书单并整理出10本神级必读书目', description: '结合生产力、管理决策以及系统性思维领域，制定本季度硬核读书方向。', duration: 1, isDone: true, color: 'amber', startTime: '2026-05-20', endTime: '2026-05-20' },
  't-grow-2': { id: 't-grow-2', title: '硬核阅读《系统之美》与《原子习惯》', description: '标记书中精华理论，整理出思维导图，深度提炼阻碍行为习惯的正反馈闭环。', duration: 6, isDone: false, color: 'amber', startTime: '2026-05-21', endTime: '2026-05-25' },
  't-grow-3': { id: 't-grow-3', title: '形成个人结构化精髓卡片知识盒归集', description: '按照卢曼卡片盒体系将提炼的见解、思考和推导转录，撰写深度分析报告。', duration: 3, isDone: false, color: 'amber', startTime: '2026-05-26', endTime: '2026-05-28' },

  // BOM template default task backings
  't-bom-ds': { id: 't-bom-ds', title: '核心多数据源配置', description: '配置分布式读写分离，处理数据库冗余及分布式事务。', duration: 4, isDone: false, color: 'sky' },
  't-bom-rd': { id: 't-bom-rd', title: 'Redis多级路由缓存层', description: '整合Redis高可用集群，拦截热点 key 穿透，实施限流降级。', duration: 3, isDone: false, color: 'sky' },
  't-bom-auth': { id: 't-bom-auth', title: '统一安全鉴权拦截插件', description: '结合 OAuth 与 JWT，实现细粒度的接口权限级别拦截服务。', duration: 5, isDone: false, color: 'sky' },
  't-bom-stretch': { id: 't-bom-stretch', title: '30分钟核心力量拉伸', description: '强化下背及腹内斜肌群力量。', duration: 1, isDone: false, color: 'emerald' },
  't-bom-cardio': { id: 't-bom-cardio', title: '深蹲与心肺有氧强化训练', description: '负重自重交叉锻炼。', duration: 2, isDone: false, color: 'emerald' },
  't-bom-feynman': { id: 't-bom-feynman', title: '费曼技巧周度输出提纲', description: '教授他人，归纳盲区并查漏补缺。', duration: 3, isDone: false, color: 'amber' }
};

const DEMO_GOALS: Record<string, Goal> = {
  'goal-tech-saas': {
    id: 'goal-tech-saas',
    title: '独立 SaaS 系统微架构规划',
    description: '设计并落地一款具备 OAuth 单点登录与高并发网关的微型独立服务，跑通全链路集成。',
    category: 'career',
    color: 'sky',
    nodes: [
      { id: 'node-saas-1', taskId: 't-tech-1', position: { x: 50, y: 100 } },
      { id: 'node-saas-2', taskId: 't-tech-2', position: { x: 300, y: 100 } },
      { id: 'node-saas-3', taskId: 't-tech-3', position: { x: 550, y: 50 } },
      { id: 'node-saas-4', taskId: 't-tech-4', position: { x: 550, y: 180 } }
    ],
    edges: [
      { id: 'edge-saas-1', source: 'node-saas-1', target: 'node-saas-2' },
      { id: 'edge-saas-2', source: 'node-saas-2', target: 'node-saas-3' },
      { id: 'edge-saas-3', source: 'node-saas-2', target: 'node-saas-4' }
    ]
  },
  'goal-health-marathon': {
    id: 'goal-health-marathon',
    title: '5公里马拉松体能破刻计划',
    description: '通过渐进式有氧心率区间的周训练、间歇跑与排程体能充沛计划，在5月底前顺利安全达成记录。',
    category: 'health',
    color: 'emerald',
    nodes: [
      { id: 'node-marathon-1', taskId: 't-health-1', position: { x: 50, y: 100 } },
      { id: 'node-marathon-2', taskId: 't-health-2', position: { x: 280, y: 100 } },
      { id: 'node-marathon-3', taskId: 't-health-3', position: { x: 520, y: 100 } },
      { id: 'node-marathon-4', taskId: 't-health-4', position: { x: 760, y: 100 } }
    ],
    edges: [
      { id: 'edge-mara-1', source: 'node-marathon-1', target: 'node-marathon-2' },
      { id: 'edge-mara-2', source: 'node-marathon-2', target: 'node-marathon-3' },
      { id: 'edge-mara-3', source: 'node-marathon-3', target: 'node-marathon-4' }
    ]
  },
  'goal-personal-book': {
    id: 'goal-personal-book',
    title: '深度心智读书与知识沉淀',
    description: '通读经典书籍并搭建个人结构化卡片盒知识体系，产出行动力复盘报告。',
    category: 'personal',
    color: 'amber',
    nodes: [
      { id: 'node-book-1', taskId: 't-grow-1', position: { x: 50, y: 100 } },
      { id: 'node-book-2', taskId: 't-grow-2', position: { x: 280, y: 100 } },
      { id: 'node-book-3', taskId: 't-grow-3', position: { x: 520, y: 100 } }
    ],
    edges: [
      { id: 'edge-bk-1', source: 'node-book-1', target: 'node-book-2' },
      { id: 'edge-bk-2', source: 'node-book-2', target: 'node-book-3' }
    ]
  }
};

const DEMO_BOM_TREE: BOMTreeItem[] = [];

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

// Helper to load state from localStorage with robust schema verification & fallback migration
const loadSavedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        // Safe category array validation
        const safeCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : DEFAULT_CATEGORIES;

        // Re-construct and validate loaded goals to prevent malformed properties
        const loadedGoals = parsed.goals || {};
        const validatedGoals: Record<string, Goal> = {};
        Object.entries(loadedGoals).forEach(([gid, goal]: [string, any]) => {
          // Skip built-in showcase demonstration plans to satisfy user request of purging them completely
          if (gid === 'goal-tech-saas' || gid === 'goal-health-marathon' || gid === 'goal-personal-book') {
            return;
          }
          if (goal && typeof goal === 'object') {
            validatedGoals[gid] = {
              id: goal.id || gid,
              title: goal.title || '未命名目标计划',
              description: goal.description || '无详细内容。',
              category: goal.category || 'career',
              color: goal.color || 'indigo',
              nodes: Array.isArray(goal.nodes) ? goal.nodes : [],
              edges: Array.isArray(goal.edges) ? goal.edges : []
            };
          }
        });

        const loadedTasks = parsed.tasks || {};
        const validatedTasks: Record<string, Task> = {};
        Object.entries(loadedTasks).forEach(([tid, task]: [string, any]) => {
          // Skip default preloaded plan tasks
          const isDemoTask = ['t-tech-1', 't-tech-2', 't-tech-3', 't-tech-4', 't-health-1', 't-health-2', 't-health-3', 't-health-4', 't-grow-1', 't-grow-2', 't-grow-3'].includes(tid);
          if (isDemoTask) return;
          // Skip legacy demo BOM tasks to ensure clean starting slate
          const isLegacyBOMDemo = ['t-bom-ds', 't-bom-rd', 't-bom-auth', 't-bom-stretch', 't-bom-cardio', 't-bom-feynman'].includes(tid);
          if (isLegacyBOMDemo) return;

          if (task && typeof task === 'object') {
            validatedTasks[tid] = task;
          }
        });

        const filterBOMTree = (items: any[]): any[] => {
          if (!Array.isArray(items)) return [];
          const demoTaskIds = ['t-bom-ds', 't-bom-rd', 't-bom-auth', 't-bom-stretch', 't-bom-cardio', 't-bom-feynman'];
          const demoNodeIds = ['bom-node-tech-1', 'bom-node-tech-2', 'bom-node-tech-3', 'bom-node-hea-1', 'bom-node-hea-2', 'bom-node-grow-1'];
          return items
            .map((item) => {
              if (item.children) {
                return {
                  ...item,
                  children: filterBOMTree(item.children)
                };
              }
              return item;
            })
            .filter((item) => {
              if (item.taskId && demoTaskIds.includes(item.taskId)) return false;
              if (demoNodeIds.includes(item.id)) return false;
              if (['bom-tech-pack', 'bom-health-routines', 'bom-growth-blueprints'].includes(item.id)) return false;
              return true;
            });
        };

        const cleanedBOMTree = filterBOMTree(parsed.bomTree || []);
        const finalBOMTree = cleanedBOMTree.length > 0 ? cleanedBOMTree : EMPTY_BOM_TREE;

        return {
          tasks: validatedTasks,
          goals: validatedGoals,
          bomTree: finalBOMTree,
          categories: safeCategories,
          selectedCategoryId: parsed.selectedCategoryId || 'all',
          selectedGoalId: parsed.selectedGoalId || null,
          isMergedView: parsed.isMergedView || false,
          activeMergedGoalIds: Array.isArray(parsed.activeMergedGoalIds) ? parsed.activeMergedGoalIds : [],
          crossGoalEdges: Array.isArray(parsed.crossGoalEdges) ? parsed.crossGoalEdges : [],
          isSidebarCollapsed: !!parsed.isSidebarCollapsed,
          showHelp: typeof parsed.showHelp === 'boolean' ? parsed.showHelp : true,
          timelineTaskOrder: Array.isArray(parsed.timelineTaskOrder) ? parsed.timelineTaskOrder : [],
          isTimelineCollapsed: !!parsed.isTimelineCollapsed,
          mergedNodePositions: parsed.mergedNodePositions || {},
          mergedEdges: Array.isArray(parsed.mergedEdges) ? parsed.mergedEdges : null
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
const initialTimelineTaskOrder = savedState ? (savedState.timelineTaskOrder || []) : [];
const initialIsTimelineCollapsed = savedState ? savedState.isTimelineCollapsed : false;
const initialMergedNodePositions = (savedState && savedState.mergedNodePositions) ? savedState.mergedNodePositions : {};

let initialMergedEdges: GoalEdge[] = [];
if (savedState && Array.isArray(savedState.mergedEdges)) {
  initialMergedEdges = savedState.mergedEdges;
} else {
  const combinedEdges: GoalEdge[] = [];
  Object.values(initialGoals).forEach((g) => {
    if (g.edges) {
      combinedEdges.push(...g.edges);
    }
  });
  if (initialCrossGoalEdges.length > 0) {
    combinedEdges.push(...initialCrossGoalEdges);
  }
  initialMergedEdges = combinedEdges;
}

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
          showHelp: merged.showHelp,
          timelineTaskOrder: merged.timelineTaskOrder || [],
          isTimelineCollapsed: merged.isTimelineCollapsed,
          mergedNodePositions: merged.mergedNodePositions,
          mergedEdges: merged.mergedEdges
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
    timelineTaskOrder: initialTimelineTaskOrder,
    isTimelineCollapsed: initialIsTimelineCollapsed,
    mergedNodePositions: initialMergedNodePositions,
    mergedEdges: initialMergedEdges,

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
    addGoal: (goal) => persistSet((state: AppState) => {
      const folderId = `bom-folder-${goal.id}`;
      const nextBomTree = [
        ...state.bomTree,
        {
          id: folderId,
          title: goal.title,
          type: 'category',
          children: []
        }
      ];
      return {
        goals: { ...state.goals, [goal.id]: goal },
        bomTree: nextBomTree
      };
    }),

    deleteGoal: (goalId) => persistSet((state: AppState) => {
      const nextGoals = { ...state.goals };
      delete nextGoals[goalId];
      
      const nextActiveMerged = state.activeMergedGoalIds.filter(id => id !== goalId);
      const nextSelectedGoalId = state.selectedGoalId === goalId ? null : state.selectedGoalId;
      
      const folderId = `bom-folder-${goalId}`;
      const nextBomTree = state.bomTree.filter(item => item.id !== folderId);

      return {
        goals: nextGoals,
        activeMergedGoalIds: nextActiveMerged,
        selectedGoalId: nextSelectedGoalId,
        bomTree: nextBomTree
      };
    }),

    updateGoal: (goalId, updates) => persistSet((state: AppState) => {
      const targetGoal = state.goals[goalId];
      if (!targetGoal) return {};
      
      // If title is changing, also update any static category folder title in the legacy bomTree structure
      let nextBomTree = state.bomTree;
      if (updates.title !== undefined) {
        const folderId = `bom-folder-${goalId}`;
        nextBomTree = state.bomTree.map(item => {
          if (item.id === folderId) {
            return { ...item, title: updates.title! };
          }
          return item;
        });
      }

      return {
        goals: {
          ...state.goals,
          [goalId]: { ...targetGoal, ...updates }
        },
        bomTree: nextBomTree
      };
    }),

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

      // Auto add to BOM sidebar if not already present
      let nextBomTree = [...state.bomTree];
      const task = state.tasks[node.taskId];
      
      if (task) {
        const hasTask = (items: BOMTreeItem[], tid: string): boolean => {
          for (const item of items) {
            if (item.type === 'task' && item.taskId === tid) return true;
            if (item.children && hasTask(item.children, tid)) return true;
          }
          return false;
        };

        if (!hasTask(nextBomTree, task.id)) {
          const targetFolderId = `bom-folder-${goalId}`;
          const hasFolder = nextBomTree.some(item => item.id === targetFolderId);
          if (!hasFolder) {
            nextBomTree.push({
              id: targetFolderId,
              title: targetGoal.title,
              type: 'category',
              children: []
            });
          }

          // Recursive helper to update category folders in BOM tree
          const addLeafToFolder = (items: BOMTreeItem[]): BOMTreeItem[] => {
            return items.map((subNode) => {
              if (subNode.id === targetFolderId && subNode.type === 'category') {
                const newLeaf: BOMTreeItem = {
                  id: `bom-node-${Math.random().toString(36).substring(2, 9)}`,
                  title: task.title,
                  type: 'task',
                  taskId: task.id
                };
                return {
                  ...subNode,
                  children: [...(subNode.children || []), newLeaf]
                };
              } else if (subNode.children) {
                return {
                  ...subNode,
                  children: addLeafToFolder(subNode.children)
                };
              }
              return subNode;
            });
          };

          nextBomTree = addLeafToFolder(nextBomTree);
        }
      }

      return {
        goals: {
          ...state.goals,
          [goalId]: {
            ...targetGoal,
            nodes: [...targetGoal.nodes, node]
          }
        },
        bomTree: nextBomTree
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

      // Sweep from independent mergedEdges as well
      const nextMergedEdges = state.mergedEdges.filter(e => e.source !== nodeId && e.target !== nodeId);

      return {
        goals: {
          ...state.goals,
          [goalId]: { ...targetGoal, nodes: filteredNodes, edges: filteredEdges }
        },
        crossGoalEdges: nextCrossEdges,
        mergedEdges: nextMergedEdges
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
    toggleHelp: () => persistSet((state: AppState) => ({ showHelp: !state.showHelp })),
    toggleTimeline: () => persistSet((state: AppState) => ({ isTimelineCollapsed: !state.isTimelineCollapsed })),
    setTimelineTaskOrder: (order) => persistSet({ timelineTaskOrder: order }),

    updateMergedNodePositions: (positions) => persistSet((state: AppState) => ({
      mergedNodePositions: { ...state.mergedNodePositions, ...positions }
    })),

    addMergedEdge: (edge) => persistSet((state: AppState) => ({
      mergedEdges: [...state.mergedEdges, edge]
    })),

    deleteMergedEdge: (edgeId) => persistSet((state: AppState) => ({
      mergedEdges: state.mergedEdges.filter((e) => e.id !== edgeId)
    })),

    clearWorkspace: () => persistSet({
      tasks: EMPTY_TASKS,
      goals: {},
      selectedGoalId: null,
      selectedTaskId: null,
      isMergedView: false,
      activeMergedGoalIds: [],
      crossGoalEdges: [],
      bomTree: EMPTY_BOM_TREE,
      timelineTaskOrder: [],
      isTimelineCollapsed: false,
      mergedNodePositions: {},
      mergedEdges: []
    })
  };
});
