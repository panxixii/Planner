import { create } from 'zustand';
import { AppState, Task, Goal, BOMTreeItem, CategoryType, DraftBoard, DraftStroke, GoalNode, GoalEdge, AppCategory, TaskStatus, TimeTemplate, TimeTemplateBlock, TodoItem, TodoLane, WorkspaceComponent, WorkspaceDirectory } from './types';
import { getDescendantTaskIds, getDirectoryDescendantTaskIds, getWorkspaceGraph } from './workspaceComponents';
import { getTaskTimeBlocks, normalizeTaskTimeBlocks } from './taskTimeBlocks';

// Helper to generate IDs
const genId = () => Math.random().toString(36).substring(2, 11);

export const PLANNER_STORAGE_KEY = 'lifeprint-blueprints-state-v1';

const getNodeCategoryIds = (state: AppState, nodeId: string): string[] => {
  const categoryIds = new Set<string>();
  const workspaceNode = state.workspaceNodes.find((node) => node.id === nodeId);
  const workspaceTask = workspaceNode ? state.tasks[workspaceNode.taskId] : undefined;
  workspaceTask?.categoryIds?.forEach((categoryId) => categoryIds.add(categoryId));

  Object.values(state.goals).forEach((goal) => {
    if (goal.nodes.some((node) => node.id === nodeId)) {
      categoryIds.add(goal.category);
    }
  });

  return Array.from(categoryIds);
};

const getEdgeCategoryIds = (state: AppState, edge: GoalEdge): string[] => {
  if (edge.categoryIds) return edge.categoryIds;

  const sourceCategoryIds = getNodeCategoryIds(state, edge.source);
  const targetCategoryIds = getNodeCategoryIds(state, edge.target);
  const targetCategorySet = new Set(targetCategoryIds);
  const sharedCategoryIds = sourceCategoryIds.filter((categoryId) => targetCategorySet.has(categoryId));

  return sharedCategoryIds.length > 0
    ? sharedCategoryIds
    : Array.from(new Set([...sourceCategoryIds, ...targetCategoryIds]));
};

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

const DEFAULT_TASK_STATUSES: TaskStatus[] = [
  { id: 'status-breakdown', label: '待拆解', isSystem: true },
  { id: 'status-scheduling', label: '待排期', isSystem: true },
  { id: 'status-not-started', label: '未开始', isSystem: true },
  { id: 'status-in-progress', label: '进行中', isSystem: true },
  { id: 'status-completed', label: '已完成', isCompleted: true, isSystem: true },
];

const DEFAULT_TODO_LANES: TodoLane[] = [{ id: 'todo-main', name: '主线', type: 'main' }];
const DEFAULT_TIME_TEMPLATES: TimeTemplate[] = [];

const TASK_COLOR_HEX: Record<string, string> = {
  emerald: '#67c8bd',
  rose: '#d78fb5',
  sky: '#79bfd5',
  amber: '#d9b958',
  violet: '#9b8ae4',
  indigo: '#9387d1',
};

const normalizeTodoItems = (
  value: unknown,
  tasks?: Record<string, Task>,
  lanes?: TodoLane[],
): TodoItem[] => {
  if (!Array.isArray(value)) return [];

  const normalLaneIds = lanes
    ? new Set(lanes.filter((lane) => lane.type !== 'category-sync').map((lane) => lane.id))
    : null;
  const validItems = value.filter((item): item is Record<string, unknown> => (
    Boolean(item)
    && typeof item === 'object'
    && typeof (item as Record<string, unknown>).taskId === 'string'
    && typeof (item as Record<string, unknown>).laneId === 'string'
    && typeof (item as Record<string, unknown>).order === 'number'
    && (!normalLaneIds || normalLaneIds.has((item as Record<string, unknown>).laneId as string))
    && (!tasks || Boolean(tasks[(item as Record<string, unknown>).taskId as string]))
  ));
  const usedItemIds = new Set<string>();
  const itemIds = validItems.map((item) => {
    let itemId = typeof item.id === 'string' && !usedItemIds.has(item.id) ? item.id : `todo-item-${genId()}`;
    while (usedItemIds.has(itemId)) itemId = `todo-item-${genId()}`;
    usedItemIds.add(itemId);
    return itemId;
  });
  const legacyItemIdByLaneAndTask = new Map<string, string>();
  validItems.forEach((item, index) => {
    legacyItemIdByLaneAndTask.set(`${item.laneId}:${item.taskId}`, itemIds[index]);
  });

  const normalizedItems = validItems.map((item, index) => {
    const legacyParentTaskId = typeof item.parentTaskId === 'string' ? item.parentTaskId : null;
    const requestedParentItemId = typeof item.parentItemId === 'string'
      ? item.parentItemId
      : (legacyParentTaskId ? legacyItemIdByLaneAndTask.get(`${item.laneId}:${legacyParentTaskId}`) || null : null);
    return {
      id: itemIds[index],
      taskId: item.taskId as string,
      laneId: item.laneId as string,
      parentItemId: requestedParentItemId && usedItemIds.has(requestedParentItemId) ? requestedParentItemId : null,
      order: item.order as number,
      isDone: typeof item.isDone === 'boolean'
        ? item.isDone
        : Boolean(tasks?.[item.taskId as string]?.isDone),
    };
  });
  const itemById = new Map(normalizedItems.map((item) => [item.id, item]));
  return normalizedItems.map((item) => {
    let parentItemId = item.parentItemId;
    if (parentItemId && itemById.get(parentItemId)?.laneId !== item.laneId) parentItemId = null;
    const visited = new Set([item.id]);
    let ancestorId = parentItemId;
    while (ancestorId) {
      if (visited.has(ancestorId)) {
        parentItemId = null;
        break;
      }
      visited.add(ancestorId);
      ancestorId = itemById.get(ancestorId)?.parentItemId || null;
    }
    return parentItemId === item.parentItemId ? item : { ...item, parentItemId };
  });
};

const normalizeTodoLanes = (value: unknown, categories: AppCategory[]): TodoLane[] => {
  const loadedLanes: TodoLane[] = Array.isArray(value)
    ? value.flatMap((lane: unknown): TodoLane[] => {
        if (!lane || typeof lane !== 'object') return [];
        const candidate = lane as Partial<TodoLane>;
        if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
        const type = candidate.id === 'todo-main'
          ? 'main'
          : candidate.type === 'category-sync' ? 'category-sync' : 'custom';
        return [{ id: candidate.id, name: candidate.name, type, categoryId: candidate.categoryId, directoryId: candidate.directoryId || null }];
      })
    : [];
  const main = loadedLanes.find((lane) => lane.id === 'todo-main');
  const syncByCategoryId = new Map<string, TodoLane>();
  loadedLanes.forEach((lane) => {
    if (lane.type === 'category-sync' && lane.categoryId && !syncByCategoryId.has(lane.categoryId)) {
      syncByCategoryId.set(lane.categoryId, lane);
    }
  });
  const reservedIds = new Set(['todo-main', ...categories.map((category) => `todo-category-${category.id}`)]);
  const usedCustomIds = new Set<string>();
  const customLanes = loadedLanes.filter((lane) => {
    if (lane.type !== 'custom' || reservedIds.has(lane.id) || usedCustomIds.has(lane.id)) return false;
    usedCustomIds.add(lane.id);
    return true;
  });
  const syncLanes = categories.map((category): TodoLane => {
    const loaded = syncByCategoryId.get(category.id);
    return {
      id: `todo-category-${category.id}`,
      name: category.label,
      type: 'category-sync',
      categoryId: category.id,
      directoryId: loaded?.directoryId || null,
    };
  });
  return [{ ...(main || DEFAULT_TODO_LANES[0]), id: 'todo-main', name: '主线', type: 'main' }, ...syncLanes, ...customLanes];
};

const removeTodoTaskInstances = (items: TodoItem[], taskId: string): TodoItem[] => {
  const removedItems = new Map(items.filter((item) => item.taskId === taskId).map((item) => [item.id, item]));
  return items
    .filter((item) => item.taskId !== taskId)
    .map((item) => {
      let parentItemId = item.parentItemId;
      while (parentItemId && removedItems.has(parentItemId)) {
        parentItemId = removedItems.get(parentItemId)?.parentItemId || null;
      }
      return parentItemId !== item.parentItemId ? { ...item, parentItemId } : item;
    });
};

const buildTodoItemsForTasks = (
  state: AppState,
  requestedTaskIds: Set<string>,
  laneId: string,
  rootOrderStart = 0,
  forcedRootTaskIds: Set<string> = new Set(),
): TodoItem[] => {
  const existingTaskIds = new Set(
    state.todoItems.filter((item) => item.laneId === laneId).map((item) => item.taskId),
  );
  const taskIds = new Set(
    Array.from(requestedTaskIds).filter((taskId) => state.tasks[taskId] && !existingTaskIds.has(taskId)),
  );
  if (taskIds.size === 0) return [];

  const graph = getWorkspaceGraph(state.goals, state.workspaceNodes, state.mergedEdges, state.mergedNodePositions);
  const positionByTaskId = new Map<string, { x: number; y: number }>();
  graph.nodeTaskIds.forEach((taskId, nodeId) => {
    if (!taskIds.has(taskId)) return;
    const position = graph.nodePositions.get(nodeId);
    if (!position) return;
    const current = positionByTaskId.get(taskId);
    if (!current || position.x < current.x || (position.x === current.x && position.y < current.y)) {
      positionByTaskId.set(taskId, position);
    }
  });

  const parentCandidates = new Map<string, Array<{ taskId: string; distance: number }>>();
  graph.edges.forEach((edge) => {
    const sourceTaskId = graph.nodeTaskIds.get(edge.source);
    const targetTaskId = graph.nodeTaskIds.get(edge.target);
    const sourcePosition = graph.nodePositions.get(edge.source);
    const targetPosition = graph.nodePositions.get(edge.target);
    if (
      !sourceTaskId
      || !targetTaskId
      || sourceTaskId === targetTaskId
      || !sourcePosition
      || !targetPosition
      || !taskIds.has(sourceTaskId)
      || !taskIds.has(targetTaskId)
    ) return;

    const sourceIsParent = sourcePosition.x <= targetPosition.x;
    const parentTaskId = sourceIsParent ? sourceTaskId : targetTaskId;
    const childTaskId = sourceIsParent ? targetTaskId : sourceTaskId;
    if (forcedRootTaskIds.has(childTaskId)) return;
    const candidates = parentCandidates.get(childTaskId) || [];
    candidates.push({ taskId: parentTaskId, distance: Math.abs(targetPosition.x - sourcePosition.x) });
    parentCandidates.set(childTaskId, candidates);
  });

  const parentByTaskId = new Map<string, string>();
  const orderedTaskIds = Array.from(taskIds).sort((leftId, rightId) => {
    const left = positionByTaskId.get(leftId) || { x: 0, y: 0 };
    const right = positionByTaskId.get(rightId) || { x: 0, y: 0 };
    return left.x - right.x || left.y - right.y || leftId.localeCompare(rightId);
  });
  orderedTaskIds.forEach((childTaskId) => {
    if (forcedRootTaskIds.has(childTaskId)) return;
    const candidates = (parentCandidates.get(childTaskId) || []).sort((left, right) => (
      left.distance - right.distance || left.taskId.localeCompare(right.taskId)
    ));
    const candidate = candidates.find(({ taskId: parentTaskId }) => {
      let ancestorId: string | undefined = parentTaskId;
      while (ancestorId) {
        if (ancestorId === childTaskId) return false;
        ancestorId = parentByTaskId.get(ancestorId);
      }
      return true;
    });
    if (candidate) parentByTaskId.set(childTaskId, candidate.taskId);
  });

  const compareByPosition = (leftId: string, rightId: string) => {
    const left = positionByTaskId.get(leftId) || { x: 0, y: 0 };
    const right = positionByTaskId.get(rightId) || { x: 0, y: 0 };
    return left.y - right.y || left.x - right.x || leftId.localeCompare(rightId);
  };
  const childrenByTaskId = new Map<string | null, string[]>();
  taskIds.forEach((taskId) => {
    const parentTaskId = parentByTaskId.get(taskId) || null;
    const children = childrenByTaskId.get(parentTaskId) || [];
    children.push(taskId);
    childrenByTaskId.set(parentTaskId, children);
  });
  childrenByTaskId.forEach((children) => children.sort(compareByPosition));

  const items: TodoItem[] = [];
  const itemIdByTaskId = new Map(Array.from(taskIds).map((taskId) => [taskId, `todo-item-${genId()}`]));
  const visited = new Set<string>();
  const appendTask = (taskId: string, parentItemId: string | null, order: number) => {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    const itemId = itemIdByTaskId.get(taskId)!;
    items.push({ id: itemId, taskId, laneId, parentItemId, order, isDone: state.tasks[taskId].isDone });
    (childrenByTaskId.get(taskId) || []).forEach((childTaskId, childOrder) => {
      appendTask(childTaskId, itemId, childOrder);
    });
  };
  (childrenByTaskId.get(null) || []).forEach((taskId, index) => {
    appendTask(taskId, null, rootOrderStart + index);
  });
  orderedTaskIds.forEach((taskId) => {
    if (!visited.has(taskId)) {
      const rootCount = items.filter((item) => item.parentItemId === null).length;
      appendTask(taskId, null, rootOrderStart + rootCount);
    }
  });
  return items;
};

// Helper to load state from localStorage with robust schema verification & fallback migration
const loadSavedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        // Safe category array validation
        const safeCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : DEFAULT_CATEGORIES;
        const loadedTaskStatuses: TaskStatus[] = Array.isArray(parsed.taskStatuses)
          ? parsed.taskStatuses.filter((status: unknown): status is TaskStatus => {
              if (!status || typeof status !== 'object') return false;
              const candidate = status as TaskStatus;
              return typeof candidate.id === 'string'
                && typeof candidate.label === 'string'
                && candidate.label.trim().length > 0;
            })
          : [];
        const loadedStatusById = new Map(loadedTaskStatuses.map((status) => [status.id, status]));
        const systemStatusIds = new Set(DEFAULT_TASK_STATUSES.map((status) => status.id));
        const safeTaskStatuses: TaskStatus[] = [
          ...DEFAULT_TASK_STATUSES.map((defaultStatus) => ({
            ...defaultStatus,
            label: loadedStatusById.get(defaultStatus.id)?.label.trim() || defaultStatus.label,
          })),
          ...loadedTaskStatuses
            .filter((status) => !systemStatusIds.has(status.id))
            .map((status) => ({ id: status.id, label: status.label.trim() })),
        ];
        const safeTaskStatusIds = new Set(safeTaskStatuses.map((status) => status.id));

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
            validatedTasks[tid] = {
              ...task,
              statusId: typeof task.statusId === 'string' && safeTaskStatusIds.has(task.statusId)
                ? task.statusId
                : (task.isDone ? 'status-completed' : 'status-not-started'),
              categoryIds: Array.isArray(task.categoryIds)
                ? task.categoryIds.filter((id: unknown) => typeof id === 'string' && safeCategories.some((category: AppCategory) => category.id === id))
                : undefined,
              componentIds: Array.isArray(task.componentIds)
                ? task.componentIds.filter((id: unknown) => typeof id === 'string')
                : [],
            };
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

        const normalizedTodoLanes = normalizeTodoLanes(parsed.todoLanes, safeCategories);
        return {
          tasks: validatedTasks,
          goals: validatedGoals,
          bomTree: finalBOMTree,
          categories: safeCategories,
          taskStatuses: safeTaskStatuses,
          selectedCategoryId: parsed.selectedCategoryId || 'all',
          selectedGoalId: parsed.selectedGoalId || null,
          isMergedView: parsed.isMergedView || false,
          activeMergedGoalIds: Array.isArray(parsed.activeMergedGoalIds) ? parsed.activeMergedGoalIds : [],
          workspaceComponentFilter: Array.isArray(parsed.workspaceComponentFilter) && Array.isArray(parsed.workspaceComponents)
            ? parsed.workspaceComponentFilter.filter((id: unknown) => (
                typeof id === 'string'
                && parsed.workspaceComponents.some((component: unknown) => (
                  Boolean(component)
                  && typeof component === 'object'
                  && (component as WorkspaceComponent).id === id
                ))
              ))
            : null,
          workspaceComponents: Array.isArray(parsed.workspaceComponents)
            ? parsed.workspaceComponents.filter((component: unknown): component is WorkspaceComponent => (
                Boolean(component)
                && typeof component === 'object'
                && typeof (component as WorkspaceComponent).id === 'string'
              )).map((component: WorkspaceComponent) => ({
                id: component.id,
                name: typeof component.name === 'string' ? component.name : '',
                color: component.color || '#8d78d5',
                nodeColor: component.nodeColor || 'indigo',
                edgeColor: component.edgeColor || '#8d78d5',
                edgeShape: component.edgeShape || 'bezier',
                handlePosition: component.handlePosition || { x: 80, y: 40 },
              }))
            : [],
          workspaceDirectories: Array.isArray(parsed.workspaceDirectories)
            ? parsed.workspaceDirectories.filter((directory: unknown): directory is WorkspaceDirectory => (
                Boolean(directory)
                && typeof directory === 'object'
                && typeof (directory as WorkspaceDirectory).id === 'string'
                && typeof (directory as WorkspaceDirectory).name === 'string'
                && Boolean((directory as WorkspaceDirectory).position)
              )).map((directory) => ({
                ...directory,
                color: typeof directory.color === 'string' ? directory.color : '#9387d1',
                componentIds: Array.isArray(directory.componentIds) ? directory.componentIds : [],
                isCollapsed: Boolean(directory.isCollapsed),
              }))
            : [],
          todoLanes: normalizedTodoLanes,
          todoItems: normalizeTodoItems(parsed.todoItems, validatedTasks, normalizedTodoLanes),
          timeTemplates: Array.isArray(parsed.timeTemplates)
            ? parsed.timeTemplates.filter((template: unknown): template is TimeTemplate => (
                Boolean(template)
                && typeof template === 'object'
                && typeof (template as TimeTemplate).id === 'string'
                && typeof (template as TimeTemplate).name === 'string'
                && Array.isArray((template as TimeTemplate).blocks)
              )).map((template: TimeTemplate) => ({
                id: template.id,
                name: template.name,
                type: template.type === 'daily' ? 'daily' : 'weekly',
                blocks: template.blocks.flatMap((block: TimeTemplateBlock & { weekday?: number }) => {
                  if (!block || typeof block !== 'object'
                    || typeof block.id !== 'string'
                    || typeof block.startMinute !== 'number'
                    || typeof block.endMinute !== 'number'
                    || block.endMinute <= block.startMinute
                    || typeof block.label !== 'string'
                    || typeof block.color !== 'string') return [];
                  const isLegacyWeeklyGrid = template.type === undefined && Number.isInteger(block.weekday);
                  return [{
                    id: block.id,
                    startMinute: isLegacyWeeklyGrid ? (block.weekday || 0) * 1440 + block.startMinute : block.startMinute,
                    endMinute: isLegacyWeeklyGrid ? (block.weekday || 0) * 1440 + block.endMinute : block.endMinute,
                    label: block.label,
                    color: block.color,
                  }];
                }),
              }))
            : DEFAULT_TIME_TEMPLATES,
          activeTimeTemplateIds: {
            daily: typeof parsed.activeTimeTemplateIds?.daily === 'string'
              ? parsed.activeTimeTemplateIds.daily
              : null,
            weekly: typeof parsed.activeTimeTemplateIds?.weekly === 'string'
              ? parsed.activeTimeTemplateIds.weekly
              : (typeof parsed.activeTimeTemplateId === 'string' ? parsed.activeTimeTemplateId : null),
          },
          favoriteColors: Array.isArray(parsed.favoriteColors)
            ? parsed.favoriteColors.filter((color: unknown): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)).slice(0, 24)
            : [],
          drafts: Array.isArray(parsed.drafts)
            ? parsed.drafts.filter((draft: unknown): draft is DraftBoard => (
                Boolean(draft)
                && typeof draft === 'object'
                && typeof (draft as DraftBoard).id === 'string'
                && typeof (draft as DraftBoard).name === 'string'
              )).map((draft: DraftBoard) => ({
                id: draft.id,
                name: draft.name,
                nodes: Array.isArray(draft.nodes) ? draft.nodes : [],
                edges: Array.isArray(draft.edges) ? draft.edges : [],
                strokes: Array.isArray(draft.strokes) ? draft.strokes : [],
              }))
            : [],
          crossGoalEdges: Array.isArray(parsed.crossGoalEdges) ? parsed.crossGoalEdges : [],
          isSidebarCollapsed: !!parsed.isSidebarCollapsed,
          showHelp: typeof parsed.showHelp === 'boolean' ? parsed.showHelp : true,
          timelineTaskOrder: Array.isArray(parsed.timelineTaskOrder) ? parsed.timelineTaskOrder : [],
          isTimelineCollapsed: !!parsed.isTimelineCollapsed,
          mergedNodePositions: parsed.mergedNodePositions || {},
          workspaceNodes: Array.isArray(parsed.workspaceNodes)
            ? parsed.workspaceNodes.filter((node: unknown) => {
                if (!node || typeof node !== 'object') return false;
                const candidate = node as GoalNode;
                return typeof candidate.id === 'string'
                  && typeof candidate.taskId === 'string'
                  && candidate.position
                  && typeof candidate.position.x === 'number'
                  && typeof candidate.position.y === 'number';
              })
            : [],
          mergedEdges: Array.isArray(parsed.mergedEdges) ? parsed.mergedEdges : null,
          mergedNodeIds: Array.isArray(parsed.mergedNodeIds) ? parsed.mergedNodeIds : [],
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
const initialTaskStatuses = savedState ? savedState.taskStatuses : DEFAULT_TASK_STATUSES;
const initialSelectedCategoryId = savedState ? savedState.selectedCategoryId : 'all';
const initialSelectedGoalId = savedState ? savedState.selectedGoalId : null;
const initialIsMergedView = savedState ? savedState.isMergedView : false;
const initialActiveMergedGoalIds = savedState ? savedState.activeMergedGoalIds : [];
const initialWorkspaceComponentFilter = savedState ? savedState.workspaceComponentFilter : null;
const initialWorkspaceComponents = savedState ? savedState.workspaceComponents : [];
const initialWorkspaceDirectories = savedState ? savedState.workspaceDirectories : [];
const initialTodoLanes = normalizeTodoLanes(savedState?.todoLanes, initialCategories);
const initialTodoItems = savedState ? savedState.todoItems : [];
const initialTimeTemplates = savedState ? savedState.timeTemplates : DEFAULT_TIME_TEMPLATES;
const initialActiveTimeTemplateIds = savedState ? savedState.activeTimeTemplateIds : { daily: null, weekly: null };
const initialFavoriteColors = savedState ? savedState.favoriteColors : [];
const initialDrafts = savedState ? savedState.drafts : [];
const initialCrossGoalEdges = savedState ? savedState.crossGoalEdges : [];
const initialIsSidebarCollapsed = savedState ? savedState.isSidebarCollapsed : false;
const initialShowHelp = savedState ? savedState.showHelp : true;
const initialTimelineTaskOrder = savedState ? (savedState.timelineTaskOrder || []) : [];
const initialIsTimelineCollapsed = savedState ? savedState.isTimelineCollapsed : false;
const initialMergedNodePositions = (savedState && savedState.mergedNodePositions) ? savedState.mergedNodePositions : {};
const initialWorkspaceNodes = (savedState && Array.isArray(savedState.workspaceNodes)) ? savedState.workspaceNodes : [];
const initialMergedNodeIds = (savedState && Array.isArray(savedState.mergedNodeIds)) ? savedState.mergedNodeIds : [];

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

type HistorySnapshot = Pick<AppState,
  | 'tasks'
  | 'taskStatuses'
  | 'goals'
  | 'bomTree'
  | 'categories'
  | 'workspaceComponents'
  | 'workspaceDirectories'
  | 'todoLanes'
  | 'todoItems'
  | 'timeTemplates'
  | 'activeTimeTemplateIds'
  | 'favoriteColors'
  | 'drafts'
  | 'crossGoalEdges'
  | 'timelineTaskOrder'
  | 'mergedNodePositions'
  | 'workspaceNodes'
  | 'mergedEdges'
  | 'mergedNodeIds'
>;

const HISTORY_LIMIT = 100;
const HISTORY_KEYS = new Set<keyof HistorySnapshot>([
  'tasks', 'taskStatuses', 'goals', 'bomTree', 'categories', 'workspaceComponents', 'workspaceDirectories',
  'todoLanes', 'todoItems', 'timeTemplates', 'activeTimeTemplateIds', 'favoriteColors',
  'drafts', 'crossGoalEdges', 'timelineTaskOrder', 'mergedNodePositions', 'workspaceNodes',
  'mergedEdges', 'mergedNodeIds',
]);

const cloneHistorySnapshot = (snapshot: HistorySnapshot): HistorySnapshot => JSON.parse(JSON.stringify(snapshot));

const captureHistorySnapshot = (state: AppState): HistorySnapshot => cloneHistorySnapshot({
  tasks: state.tasks,
  taskStatuses: state.taskStatuses,
  goals: state.goals,
  bomTree: state.bomTree,
  categories: state.categories,
  workspaceComponents: state.workspaceComponents,
  workspaceDirectories: state.workspaceDirectories,
  todoLanes: state.todoLanes,
  todoItems: state.todoItems,
  timeTemplates: state.timeTemplates,
  activeTimeTemplateIds: state.activeTimeTemplateIds,
  favoriteColors: state.favoriteColors,
  drafts: state.drafts,
  crossGoalEdges: state.crossGoalEdges,
  timelineTaskOrder: state.timelineTaskOrder,
  mergedNodePositions: state.mergedNodePositions,
  workspaceNodes: state.workspaceNodes,
  mergedEdges: state.mergedEdges,
  mergedNodeIds: state.mergedNodeIds,
});

const historySnapshotsEqual = (left: HistorySnapshot, right: HistorySnapshot) => JSON.stringify(left) === JSON.stringify(right);

export const useAppStore = create<AppState>((set, get) => {
  const undoStack: HistorySnapshot[] = [];
  const redoStack: HistorySnapshot[] = [];
  let historyGroupDepth = 0;
  let historyGroupStart: HistorySnapshot | null = null;

  const persistState = (state: AppState) => {
    try {
      const toSave = {
        tasks: state.tasks,
        goals: state.goals,
        bomTree: state.bomTree,
        categories: state.categories,
        taskStatuses: state.taskStatuses,
        selectedCategoryId: state.selectedCategoryId,
        selectedGoalId: state.selectedGoalId,
        isMergedView: state.isMergedView,
        activeMergedGoalIds: state.activeMergedGoalIds,
        workspaceComponentFilter: state.workspaceComponentFilter,
        workspaceComponents: state.workspaceComponents,
        workspaceDirectories: state.workspaceDirectories,
        todoLanes: state.todoLanes,
        todoItems: state.todoItems,
        timeTemplates: state.timeTemplates,
        activeTimeTemplateIds: state.activeTimeTemplateIds,
        favoriteColors: state.favoriteColors,
        drafts: state.drafts,
        crossGoalEdges: state.crossGoalEdges,
        isSidebarCollapsed: state.isSidebarCollapsed,
        showHelp: state.showHelp,
        timelineTaskOrder: state.timelineTaskOrder || [],
        isTimelineCollapsed: state.isTimelineCollapsed,
        mergedNodePositions: state.mergedNodePositions,
        workspaceNodes: state.workspaceNodes,
        mergedEdges: state.mergedEdges,
        mergedNodeIds: state.mergedNodeIds,
      };
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  };

  const pushUndoSnapshot = (snapshot: HistorySnapshot) => {
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
  };

  // A wrapper function that performs the state change and automatically persists it to localStorage
  const persistSet = (nextStateOrFn: any) => {
    set((state) => {
      const beforeUpdate = historyGroupStart || captureHistorySnapshot(state);
      const next = typeof nextStateOrFn === 'function' ? nextStateOrFn(state) : nextStateOrFn;
      const merged = { ...state, ...next };

      const touchesHistory = Object.keys(next).some((key) => HISTORY_KEYS.has(key as keyof HistorySnapshot));
      if (touchesHistory) {
        const after = captureHistorySnapshot(merged);
        if (!historySnapshotsEqual(beforeUpdate, after)) {
          if (historyGroupDepth > 0) {
            historyGroupStart ||= beforeUpdate;
          } else {
            pushUndoSnapshot(beforeUpdate);
          }
          next.canUndo = historyGroupDepth > 0 ? undoStack.length > 0 : true;
          next.canRedo = false;
        }
      }

      persistState(merged);

      return next;
    });
  };

  return {
    tasks: initialTasks,
    goals: initialGoals,
    bomTree: initialBOMTree,
    selectedCategoryId: initialSelectedCategoryId,
    categories: initialCategories,
    taskStatuses: initialTaskStatuses,
    selectedGoalId: initialSelectedGoalId,
    isMergedView: initialIsMergedView,
    selectedTaskId: null,
    activeNodeActionsId: null,
    activeMergedGoalIds: initialActiveMergedGoalIds,
    workspaceComponentFilter: initialWorkspaceComponentFilter,
    workspaceComponents: initialWorkspaceComponents,
    workspaceDirectories: initialWorkspaceDirectories,
    activeComponentDetailsId: null,
    todoLanes: initialTodoLanes,
    todoItems: initialTodoItems,
    timeTemplates: initialTimeTemplates,
    activeTimeTemplateIds: initialActiveTimeTemplateIds,
    favoriteColors: initialFavoriteColors,
    drafts: initialDrafts,
    canUndo: false,
    canRedo: false,
    crossGoalEdges: initialCrossGoalEdges,
    isSidebarCollapsed: initialIsSidebarCollapsed,
    showHelp: initialShowHelp,
    timelineTaskOrder: initialTimelineTaskOrder,
    isTimelineCollapsed: initialIsTimelineCollapsed,
    mergedNodePositions: initialMergedNodePositions,
    workspaceNodes: initialWorkspaceNodes,
    mergedEdges: initialMergedEdges,
    mergedNodeIds: initialMergedNodeIds,

    setCategory: (category) => persistSet({ 
      selectedCategoryId: category, 
      selectedGoalId: null, // Reset active goal screen so it displays Goal Cards for this category
      isMergedView: false 
    }),

    addCategory: (label, parentId) => persistSet((state: AppState) => {
      const newId = 'cat-' + genId();
      const categories = [...state.categories, { id: newId, label, parentId: parentId || undefined }];
      return {
        categories,
        todoLanes: normalizeTodoLanes(state.todoLanes, categories),
      };
    }),

    renameCategory: (id, newLabel, parentId) => persistSet((state: AppState) => ({
      categories: state.categories.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            label: newLabel,
            parentId: parentId === 'none' ? undefined : (parentId !== undefined ? parentId : c.parentId)
          };
        }
        return c;
      }),
      todoLanes: state.todoLanes.map((lane) => lane.type === 'category-sync' && lane.categoryId === id ? { ...lane, name: newLabel } : lane),
    })),

    deleteCategory: (id) => persistSet((state: AppState) => {
      const nextCategories = state.categories
        .filter((c) => c.id !== id)
        .map((c) => c.parentId === id ? { ...c, parentId: undefined } : c);
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
      const removedLaneIds = new Set(state.todoLanes
        .filter((lane) => lane.type === 'category-sync' && lane.categoryId === id)
        .map((lane) => lane.id));
      return {
        categories: nextCategories,
        todoLanes: normalizeTodoLanes(state.todoLanes, nextCategories),
        todoItems: state.todoItems.filter((item) => !removedLaneIds.has(item.laneId)),
        selectedCategoryId: nextSelectedCategoryId,
        goals: nextGoals,
        tasks: Object.fromEntries(Object.entries(state.tasks).map(([taskId, task]) => [
          taskId,
          task.categoryIds ? { ...task, categoryIds: task.categoryIds.filter((categoryId) => categoryId !== id) } : task
        ])),
        mergedEdges: state.mergedEdges.flatMap((edge) => {
          const remainingCategoryIds = getEdgeCategoryIds(state, edge).filter((categoryId) => categoryId !== id);
          return remainingCategoryIds.length > 0 ? [{ ...edge, categoryIds: remainingCategoryIds }] : [];
        }),
        crossGoalEdges: state.crossGoalEdges.flatMap((edge) => {
          const remainingCategoryIds = getEdgeCategoryIds(state, edge).filter((categoryId) => categoryId !== id);
          return remainingCategoryIds.length > 0 ? [{ ...edge, categoryIds: remainingCategoryIds }] : [];
        }),
        selectedGoalId: nextSelectedGoalId,
      };
    }),

    moveCategory: (draggedId, targetId, position) => persistSet((state: AppState) => {
      const isDescendantOf = (parent: string, child: string): boolean => {
        let curr = state.categories.find(c => c.id === child);
        while (curr && curr.parentId) {
          if (curr.parentId === parent) return true;
          curr = state.categories.find(c => c.id === curr.parentId);
        }
        return false;
      };

      if (draggedId === targetId || (targetId !== 'all' && isDescendantOf(draggedId, targetId))) {
        return {};
      }

      const draggedCategory = state.categories.find(c => c.id === draggedId);
      if (!draggedCategory) return {};

      let nextCategories = [...state.categories];

      if (position === 'inside') {
        const newParentId = targetId === 'all' ? undefined : targetId;
        nextCategories = nextCategories.map(c => 
          c.id === draggedId ? { ...c, parentId: newParentId } : c
        );
      } else {
        const targetCategory = state.categories.find(c => c.id === targetId);
        if (!targetCategory) return {};

        const targetParentId = targetCategory.parentId;

        nextCategories = nextCategories.filter(c => c.id !== draggedId);

        const updatedCategory = { ...draggedCategory, parentId: targetParentId };

        const targetIdx = nextCategories.findIndex(c => c.id === targetId);
        if (targetIdx !== -1) {
          const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
          nextCategories.splice(insertIdx, 0, updatedCategory);
        } else {
          nextCategories.push(updatedCategory);
        }
      }

      return { categories: nextCategories };
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

    setWorkspaceComponentFilter: (componentIds) => persistSet({ workspaceComponentFilter: componentIds }),
    addWorkspaceComponent: (name) => {
      const id = `component-${genId()}`;
      persistSet((state: AppState) => ({
        workspaceComponents: [...state.workspaceComponents, {
          id,
          name,
          color: '#8d78d5',
          nodeColor: 'indigo',
          edgeColor: '#8d78d5',
          edgeShape: 'bezier',
          handlePosition: { x: 80 + state.workspaceComponents.length * 28, y: 40 + state.workspaceComponents.length * 24 },
        }],
        workspaceComponentFilter: [id],
      }));
      return id;
    },
    updateWorkspaceComponent: (id, updates) => persistSet((state: AppState) => ({
      workspaceComponents: state.workspaceComponents.map((component) => (
        component.id === id ? { ...component, ...updates } : component
      )),
      ...(updates.nodeColor !== undefined ? {
        tasks: Object.fromEntries(Object.entries(state.tasks).map(([taskId, task]) => [
          taskId,
          task.componentIds?.includes(id) ? { ...task, color: updates.nodeColor } : task,
        ])),
      } : {}),
    })),
    deleteWorkspaceComponent: (id) => persistSet((state: AppState) => ({
      workspaceComponents: state.workspaceComponents.filter((component) => component.id !== id),
      workspaceDirectories: state.workspaceDirectories.map((directory) => ({
        ...directory,
        componentIds: directory.componentIds.filter((componentId) => componentId !== id),
      })),
      tasks: Object.fromEntries(Object.entries(state.tasks).map(([taskId, task]) => [
        taskId,
        {
          ...task,
          componentIds: (task.componentIds || []).filter((componentId) => componentId !== id),
        },
      ])),
      workspaceComponentFilter: state.workspaceComponentFilter === null
        ? null
        : state.workspaceComponentFilter.filter((componentId) => componentId !== id),
      activeComponentDetailsId: state.activeComponentDetailsId === id
        ? null
        : state.activeComponentDetailsId,
    })),
    openComponentDetails: (componentId) => set({ activeComponentDetailsId: componentId }),

    selectTask: (taskId) => persistSet({ selectedTaskId: taskId }),
    setActiveNodeActionsId: (nodeId) => set({ activeNodeActionsId: nodeId }),
    beginHistoryGroup: () => {
      if (historyGroupDepth === 0) historyGroupStart = captureHistorySnapshot(get());
      historyGroupDepth += 1;
    },
    endHistoryGroup: () => {
      if (historyGroupDepth === 0) return;
      historyGroupDepth -= 1;
      if (historyGroupDepth > 0) return;
      const start = historyGroupStart;
      historyGroupStart = null;
      if (!start || historySnapshotsEqual(start, captureHistorySnapshot(get()))) return;
      pushUndoSnapshot(start);
      set({ canUndo: true, canRedo: false });
    },
    undo: () => {
      if (historyGroupDepth > 0) {
        historyGroupDepth = 0;
        const start = historyGroupStart;
        historyGroupStart = null;
        if (start && !historySnapshotsEqual(start, captureHistorySnapshot(get()))) pushUndoSnapshot(start);
      }
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      redoStack.push(captureHistorySnapshot(get()));
      const next = { ...snapshot, canUndo: undoStack.length > 0, canRedo: true };
      set(next);
      persistState({ ...get(), ...next });
    },
    redo: () => {
      const snapshot = redoStack.pop();
      if (!snapshot) return;
      undoStack.push(captureHistorySnapshot(get()));
      const next = { ...snapshot, canUndo: true, canRedo: redoStack.length > 0 };
      set(next);
      persistState({ ...get(), ...next });
    },
    restoreFromBackup: (data) => persistSet((state: AppState) => {
      const nextTasks = data.tasks && typeof data.tasks === 'object' && !Array.isArray(data.tasks) ? data.tasks as Record<string, Task> : state.tasks;
      const nextCategories = Array.isArray(data.categories) ? data.categories as AppCategory[] : state.categories;
      const nextTodoLanes = normalizeTodoLanes(data.todoLanes, nextCategories);
      return {
        tasks: nextTasks,
        taskStatuses: Array.isArray(data.taskStatuses) ? data.taskStatuses as TaskStatus[] : state.taskStatuses,
        goals: data.goals && typeof data.goals === 'object' && !Array.isArray(data.goals) ? data.goals as Record<string, Goal> : state.goals,
        bomTree: Array.isArray(data.bomTree) ? data.bomTree as BOMTreeItem[] : state.bomTree,
        categories: nextCategories,
        workspaceComponents: Array.isArray(data.workspaceComponents) ? data.workspaceComponents as WorkspaceComponent[] : state.workspaceComponents,
        workspaceDirectories: Array.isArray(data.workspaceDirectories) ? data.workspaceDirectories as WorkspaceDirectory[] : state.workspaceDirectories,
        todoLanes: nextTodoLanes,
        todoItems: normalizeTodoItems(data.todoItems, nextTasks, nextTodoLanes),
        timeTemplates: Array.isArray(data.timeTemplates) ? data.timeTemplates as TimeTemplate[] : [],
        activeTimeTemplateIds: data.activeTimeTemplateIds && typeof data.activeTimeTemplateIds === 'object'
          ? data.activeTimeTemplateIds as AppState['activeTimeTemplateIds']
          : { daily: null, weekly: null },
        favoriteColors: Array.isArray(data.favoriteColors) ? data.favoriteColors as string[] : [],
        drafts: Array.isArray(data.drafts) ? (data.drafts as DraftBoard[]).map((draft) => ({
          ...draft,
          strokes: state.drafts.find((currentDraft) => currentDraft.id === draft.id)?.strokes || [],
        })) : [],
        crossGoalEdges: Array.isArray(data.crossGoalEdges) ? data.crossGoalEdges as GoalEdge[] : [],
        timelineTaskOrder: Array.isArray(data.timelineTaskOrder) ? data.timelineTaskOrder as string[] : [],
        mergedNodePositions: data.mergedNodePositions && typeof data.mergedNodePositions === 'object'
          ? data.mergedNodePositions as AppState['mergedNodePositions']
          : {},
        workspaceNodes: Array.isArray(data.workspaceNodes) ? data.workspaceNodes as GoalNode[] : [],
        mergedEdges: Array.isArray(data.mergedEdges) ? data.mergedEdges as GoalEdge[] : [],
        mergedNodeIds: Array.isArray(data.mergedNodeIds) ? data.mergedNodeIds as string[] : [],
      };
    }),

    addTaskToTodo: (taskId) => {
      const state = get();
      if (!state.tasks[taskId]) return false;
      const mainLaneId = state.todoLanes.find((lane) => lane.id === 'todo-main')?.id || state.todoLanes[0]?.id || 'todo-main';
      const nextOrder = state.todoItems
        .filter((item) => item.laneId === mainLaneId && item.parentItemId === null)
        .reduce((max, item) => Math.max(max, item.order), -1) + 1;
      const graph = getWorkspaceGraph(state.goals, state.workspaceNodes, state.mergedEdges, state.mergedNodePositions);
      const taskIds = getDescendantTaskIds(graph, taskId);
      taskIds.add(taskId);
      const nextItems = buildTodoItemsForTasks(state, taskIds, mainLaneId, nextOrder, new Set([taskId]));
      if (nextItems.length === 0) return false;
      persistSet((current: AppState) => ({
        todoLanes: current.todoLanes.length > 0 ? current.todoLanes : DEFAULT_TODO_LANES,
        todoItems: [...current.todoItems, ...nextItems],
      }));
      return true;
    },
    addComponentToTodo: (componentId) => {
      const state = get();
      const componentIndex = state.workspaceComponents.findIndex((component) => component.id === componentId);
      const component = state.workspaceComponents[componentIndex];
      if (!component) return null;
      const taskIds = new Set(
        Object.values(state.tasks)
          .filter((task) => task.componentIds?.includes(componentId))
          .map((task) => task.id),
      );
      const laneId = `todo-lane-${genId()}`;
      const nextItems = buildTodoItemsForTasks(state, taskIds, laneId);
      if (nextItems.length === 0) return null;
      const laneName = component.name.trim() || `未命名联通块 ${componentIndex + 1}`;
      persistSet((current: AppState) => ({
        todoLanes: [...current.todoLanes, { id: laneId, name: laneName, type: 'custom' }],
        todoItems: [...current.todoItems, ...nextItems],
      }));
      return laneId;
    },
    addDirectoryToTodo: (directoryId) => {
      const state = get();
      const directory = state.workspaceDirectories.find((candidate) => candidate.id === directoryId);
      if (!directory) return null;
      const graph = getWorkspaceGraph(state.goals, state.workspaceNodes, state.mergedEdges, {
        ...state.mergedNodePositions,
        ...Object.fromEntries(state.workspaceDirectories.map((item) => [item.id, state.mergedNodePositions[item.id] || item.position])),
      });
      const taskIds = getDirectoryDescendantTaskIds(directoryId, state.workspaceDirectories, graph);
      const laneId = `todo-lane-${genId()}`;
      const stateWithTemporaryLane = { ...state, todoLanes: [...state.todoLanes, { id: laneId, name: directory.name, type: 'custom' as const }] };
      const nextItems = buildTodoItemsForTasks(stateWithTemporaryLane, taskIds, laneId);
      if (nextItems.length === 0) return null;
      persistSet((current: AppState) => ({
        todoLanes: [...current.todoLanes, { id: laneId, name: directory.name.trim() || '未命名目录', type: 'custom' }],
        todoItems: [...current.todoItems, ...nextItems],
      }));
      return laneId;
    },
    createTodoTask: (laneId) => {
      const state = get();
      const lane = state.todoLanes.find((candidate) => candidate.id === laneId);
      if (!lane || lane.type === 'category-sync') return null;
      const taskId = `t-todo-${genId()}`;
      const itemId = `todo-item-${genId()}`;
      const nextOrder = state.todoItems
        .filter((item) => item.laneId === laneId && item.parentItemId === null)
        .reduce((max, item) => Math.max(max, item.order), -1) + 1;
      const task: Task = {
        id: taskId,
        title: '',
        description: '',
        duration: 0,
        isDone: false,
        statusId: 'status-not-started',
        categoryIds: [],
        componentIds: [],
        color: 'indigo',
      };
      persistSet((current: AppState) => ({
        tasks: { ...current.tasks, [taskId]: task },
        todoItems: [...current.todoItems, { id: itemId, taskId, laneId, parentItemId: null, order: nextOrder, isDone: false }],
      }));
      return taskId;
    },
    toggleTodoTaskComponent: (taskId, componentId) => persistSet((state: AppState) => {
      const task = state.tasks[taskId];
      if (!task || !state.workspaceComponents.some((component) => component.id === componentId)) return {};
      const currentComponentIds = task.componentIds || [];
      const componentIds = currentComponentIds.includes(componentId)
        ? currentComponentIds.filter((id) => id !== componentId)
        : [...currentComponentIds, componentId];
      const alreadyInWorkspace = state.workspaceNodes.some((node) => node.taskId === taskId)
        || Object.values(state.goals).some((goal) => goal.nodes.some((node) => node.taskId === taskId));
      const workspaceIndex = state.workspaceNodes.length;
      return {
        tasks: { ...state.tasks, [taskId]: { ...task, componentIds } },
        ...(!alreadyInWorkspace && componentIds.length > 0 ? {
          workspaceNodes: [
            ...state.workspaceNodes,
            {
              id: `node-todo-${genId()}`,
              taskId,
              position: {
                x: 60 + (workspaceIndex % 5) * 180,
                y: 60 + Math.floor(workspaceIndex / 5) * 100,
              },
            },
          ],
        } : {}),
      };
    }),
    addTodoLane: (name) => {
      const id = `todo-lane-${genId()}`;
      persistSet((state: AppState) => ({
        todoLanes: [...state.todoLanes, { id, name: name?.trim() || `分线-${state.todoLanes.filter((lane) => lane.type === 'custom').length + 1}`, type: 'custom' }],
      }));
      return id;
    },
    moveTodoLane: (laneId, beforeLaneId) => persistSet((state: AppState) => {
      const fromIndex = state.todoLanes.findIndex((lane) => lane.id === laneId);
      if (fromIndex < 0 || laneId === beforeLaneId) return {};
      const movedLane = state.todoLanes[fromIndex];
      const targetLane = beforeLaneId ? state.todoLanes.find((lane) => lane.id === beforeLaneId) : undefined;
      if (movedLane.type !== 'custom' || (targetLane && targetLane.type !== 'custom')) return {};
      const nextLanes = [...state.todoLanes];
      nextLanes.splice(fromIndex, 1);
      const targetIndex = beforeLaneId ? nextLanes.findIndex((lane) => lane.id === beforeLaneId) : -1;
      nextLanes.splice(targetIndex >= 0 ? targetIndex : nextLanes.length, 0, movedLane);
      return { todoLanes: nextLanes };
    }),
    setTodoLaneDirectory: (laneId, directoryId) => persistSet((state: AppState) => ({
      todoLanes: state.todoLanes.map((lane) => lane.id === laneId && lane.type === 'category-sync'
        ? { ...lane, directoryId: directoryId && state.workspaceDirectories.some((directory) => directory.id === directoryId) ? directoryId : null }
        : lane),
    })),
    renameTodoLane: (laneId, name) => persistSet((state: AppState) => ({
      todoLanes: state.todoLanes.map((lane) => lane.id === laneId && lane.type === 'custom' ? { ...lane, name } : lane),
    })),
    deleteTodoLane: (laneId) => persistSet((state: AppState) => {
      const lane = state.todoLanes.find((candidate) => candidate.id === laneId);
      if (!lane || lane.type !== 'custom') return {};
      const mainLaneId = state.todoLanes.find((lane) => lane.id === 'todo-main')?.id || state.todoLanes[0]?.id || 'todo-main';
      const deletedLaneItemIds = new Set(state.todoItems.filter((item) => item.laneId === laneId).map((item) => item.id));
      const mainTail = state.todoItems
        .filter((item) => item.laneId === mainLaneId && item.parentItemId === null)
        .reduce((max, item) => Math.max(max, item.order), -1) + 1;
      let offset = 0;
      return {
        todoLanes: state.todoLanes.filter((lane) => lane.id !== laneId),
        todoItems: state.todoItems.map((item) => {
          if (item.laneId !== laneId) return item;
          const parentItemId = item.parentItemId && deletedLaneItemIds.has(item.parentItemId) ? item.parentItemId : null;
          return { ...item, laneId: mainLaneId, parentItemId, order: parentItemId === null ? mainTail + offset++ : item.order };
        }),
      };
    }),
    moveTodoItem: (itemId, laneId, parentItemId, beforeItemId) => persistSet((state: AppState) => {
      const movedItem = state.todoItems.find((item) => item.id === itemId);
      const targetLane = state.todoLanes.find((candidate) => candidate.id === laneId);
      if (!movedItem || !targetLane || targetLane.type === 'category-sync' || itemId === parentItemId) return {};
      const byParent = new Map(state.todoItems.map((item) => [item.id, item.parentItemId]));
      let ancestorId = parentItemId;
      while (ancestorId) {
        if (ancestorId === itemId) return {};
        ancestorId = byParent.get(ancestorId) || null;
      }

      const withoutMoved = state.todoItems.filter((item) => item.id !== itemId);
      const siblings = withoutMoved
        .filter((item) => item.laneId === laneId && item.parentItemId === parentItemId)
        .sort((a, b) => a.order - b.order);
      const beforeIndex = beforeItemId ? siblings.findIndex((item) => item.id === beforeItemId) : -1;
      const insertIndex = beforeIndex >= 0 ? beforeIndex : siblings.length;
      const orderedItemIds = [...siblings.map((item) => item.id)];
      orderedItemIds.splice(insertIndex, 0, itemId);
      const orderByItemId = new Map(orderedItemIds.map((id, index) => [id, index]));
      const descendantIds = new Set<string>();
      const queue = [itemId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;
        state.todoItems.forEach((item) => {
          if (item.parentItemId === currentId && !descendantIds.has(item.id)) {
            descendantIds.add(item.id);
            queue.push(item.id);
          }
        });
      }

      return {
        todoItems: [
          ...withoutMoved.map((item) => {
            if (orderByItemId.has(item.id)) return { ...item, order: orderByItemId.get(item.id)! };
            if (descendantIds.has(item.id)) return { ...item, laneId };
            return item;
          }),
          { ...movedItem, laneId, parentItemId, order: orderByItemId.get(itemId) || 0 },
        ],
      };
    }),
    duplicateTodoItem: (itemId, laneId) => {
      const state = get();
      const source = state.todoItems.find((item) => item.id === itemId);
      if (!source) return false;
      return get().copyTaskToTodoLane(source.taskId, laneId, null, undefined, source.isDone);
    },
    copyTaskToTodoLane: (taskId, laneId, parentItemId = null, beforeItemId, isDone) => {
      const state = get();
      const targetLane = state.todoLanes.find((lane) => lane.id === laneId);
      if (!state.tasks[taskId] || !targetLane || targetLane.type === 'category-sync') return false;
      const siblings = state.todoItems
        .filter((item) => item.laneId === laneId && item.parentItemId === parentItemId)
        .sort((left, right) => left.order - right.order);
      const beforeIndex = beforeItemId ? siblings.findIndex((item) => item.id === beforeItemId) : -1;
      const insertIndex = beforeIndex >= 0 ? beforeIndex : siblings.length;
      const newItemId = `todo-item-${genId()}`;
      const orderedItemIds = siblings.map((item) => item.id);
      orderedItemIds.splice(insertIndex, 0, newItemId);
      const orderByItemId = new Map(orderedItemIds.map((id, index) => [id, index]));
      persistSet((current: AppState) => ({
        todoItems: [
          ...current.todoItems.map((item) => orderByItemId.has(item.id) ? { ...item, order: orderByItemId.get(item.id)! } : item),
          { id: newItemId, taskId, laneId, parentItemId, order: insertIndex, isDone: isDone ?? state.tasks[taskId].isDone },
        ],
      }));
      return true;
    },
    toggleTodoItemDone: (itemId) => persistSet((state: AppState) => ({
      todoItems: state.todoItems.map((item) => item.id === itemId ? { ...item, isDone: !item.isDone } : item),
    })),
    removeTodoItem: (itemId) => persistSet((state: AppState) => {
      const removedItem = state.todoItems.find((item) => item.id === itemId);
      if (!removedItem) return {};
      return {
        todoItems: state.todoItems
          .filter((item) => item.id !== itemId)
          .map((item) => item.parentItemId === itemId
            ? { ...item, parentItemId: removedItem.parentItemId }
            : item),
      };
    }),
    removeTaskFromTodo: (taskId) => persistSet((state: AppState) => {
      return { todoItems: removeTodoTaskInstances(state.todoItems, taskId) };
    }),

    addTimeTemplate: (type, name) => {
      const id = `time-template-${genId()}`;
      persistSet((state: AppState) => ({
        timeTemplates: [
          ...state.timeTemplates,
          {
            id,
            type,
            name: name?.trim() || `${type === 'daily' ? '24 小时' : '周'}模版 ${state.timeTemplates.filter((template) => template.type === type).length + 1}`,
            blocks: [],
          },
        ],
      }));
      return id;
    },
    duplicateTimeTemplate: (id) => {
      const source = get().timeTemplates.find((template) => template.id === id);
      if (!source) return null;

      const copyId = `time-template-${genId()}`;
      const existingNames = new Set(get().timeTemplates.map((template) => template.name));
      const baseName = `${source.name || (source.type === 'daily' ? '24 小时模版' : '周模版')} 副本`;
      let copyName = baseName;
      let copyNumber = 2;
      while (existingNames.has(copyName)) {
        copyName = `${baseName} ${copyNumber}`;
        copyNumber += 1;
      }

      const copy: TimeTemplate = {
        ...source,
        id: copyId,
        name: copyName,
        blocks: source.blocks.map((block) => ({ ...block, id: `time-block-${genId()}` })),
      };
      persistSet((state: AppState) => {
        const sourceIndex = state.timeTemplates.findIndex((template) => template.id === id);
        const insertionIndex = sourceIndex >= 0 ? sourceIndex + 1 : state.timeTemplates.length;
        const nextTemplates = [...state.timeTemplates];
        nextTemplates.splice(insertionIndex, 0, copy);
        return { timeTemplates: nextTemplates };
      });
      return copyId;
    },
    renameTimeTemplate: (id, name) => persistSet((state: AppState) => ({
      timeTemplates: state.timeTemplates.map((template) => (
        template.id === id ? { ...template, name } : template
      )),
    })),
    deleteTimeTemplate: (id) => persistSet((state: AppState) => ({
      timeTemplates: state.timeTemplates.filter((template) => template.id !== id),
      activeTimeTemplateIds: {
        daily: state.activeTimeTemplateIds.daily === id ? null : state.activeTimeTemplateIds.daily,
        weekly: state.activeTimeTemplateIds.weekly === id ? null : state.activeTimeTemplateIds.weekly,
      },
    })),
    setActiveTimeTemplate: (type, id) => persistSet((state: AppState) => ({
      activeTimeTemplateIds: {
        ...state.activeTimeTemplateIds,
        [type]: id && state.timeTemplates.some((template) => template.id === id && template.type === type) ? id : null,
      },
    })),
    addTimeTemplateBlock: (templateId, block) => {
      const id = `time-block-${genId()}`;
      persistSet((state: AppState) => ({
        timeTemplates: state.timeTemplates.map((template) => (
          template.id === templateId
            ? { ...template, blocks: [...template.blocks, { ...block, id }] }
            : template
        )),
      }));
      return id;
    },
    updateTimeTemplateBlock: (templateId, blockId, updates) => persistSet((state: AppState) => ({
      timeTemplates: state.timeTemplates.map((template) => (
        template.id === templateId
          ? {
              ...template,
              blocks: template.blocks.map((block) => (
                block.id === blockId ? { ...block, ...updates } : block
              )),
            }
          : template
      )),
    })),
    deleteTimeTemplateBlock: (templateId, blockId) => persistSet((state: AppState) => ({
      timeTemplates: state.timeTemplates.map((template) => (
        template.id === templateId
          ? { ...template, blocks: template.blocks.filter((block) => block.id !== blockId) }
          : template
      )),
    })),
    addFavoriteColor: (color) => persistSet((state: AppState) => ({
      favoriteColors: /^#[0-9a-f]{6}$/i.test(color) && !state.favoriteColors.includes(color.toUpperCase())
        ? [...state.favoriteColors, color.toUpperCase()].slice(-24)
        : state.favoriteColors,
    })),
    removeFavoriteColor: (color) => persistSet((state: AppState) => ({
      favoriteColors: state.favoriteColors.filter((favorite) => favorite !== color),
    })),
    addDraft: (name) => {
      const id = `draft-${genId()}`;
      persistSet((state: AppState) => ({ drafts: [...state.drafts, { id, name: name?.trim() || `草稿 ${state.drafts.length + 1}`, nodes: [], edges: [], strokes: [] }] }));
      return id;
    },
    renameDraft: (id, name) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === id ? { ...draft, name } : draft) })),
    deleteDraft: (id) => persistSet((state: AppState) => ({ drafts: state.drafts.filter((draft) => draft.id !== id) })),
    addDraftNode: (draftId, node) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, nodes: [...draft.nodes, node] } : draft) })),
    updateDraftNodes: (draftId, nodes) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, nodes } : draft) })),
    removeDraftNode: (draftId, nodeId) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, nodes: draft.nodes.filter((node) => node.id !== nodeId), edges: draft.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) } : draft) })),
    addDraftEdge: (draftId, edge) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, edges: [...draft.edges, edge] } : draft) })),
    removeDraftEdge: (draftId, edgeId) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, edges: draft.edges.filter((edge) => edge.id !== edgeId) } : draft) })),
    addDraftStroke: (draftId, stroke: DraftStroke) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, strokes: [...draft.strokes, stroke] } : draft) })),
    replaceDraftStrokes: (draftId, strokes) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, strokes } : draft) })),
    clearDraftStrokes: (draftId) => persistSet((state: AppState) => ({ drafts: state.drafts.map((draft) => draft.id === draftId ? { ...draft, strokes: [] } : draft) })),

    // TASK ACTIONS (Normalized changes reflect everywhere instantly!)
    addTask: (task) => persistSet((state: AppState) => {
      const requestedStatus = state.taskStatuses.find((status) => status.id === task.statusId);
      const statusId = requestedStatus?.id || (task.isDone ? 'status-completed' : 'status-not-started');
      const status = state.taskStatuses.find((candidate) => candidate.id === statusId);
      return {
        tasks: {
          ...state.tasks,
          [task.id]: { ...task, statusId, isDone: Boolean(status?.isCompleted) },
        },
      };
    }),

    updateTask: (taskId, updates) => persistSet((state: AppState) => {
      const currentTask = state.tasks[taskId];
      if (!currentTask) return {};

      const normalizedUpdates = { ...updates };
      if (updates.statusId !== undefined) {
        const status = state.taskStatuses.find((candidate) => candidate.id === updates.statusId);
        normalizedUpdates.statusId = status?.id || 'status-not-started';
        normalizedUpdates.isDone = Boolean(status?.isCompleted);
      } else if (updates.isDone !== undefined) {
        normalizedUpdates.statusId = updates.isDone ? 'status-completed' : 'status-not-started';
      }

      if (
        updates.timeBlocks === undefined
        && (updates.startTime !== undefined || updates.endTime !== undefined)
        && currentTask.timeBlocks?.length
      ) {
        const [firstBlock, ...remainingBlocks] = currentTask.timeBlocks;
        normalizedUpdates.timeBlocks = [{
          ...firstBlock,
          ...(updates.startTime !== undefined ? { startTime: updates.startTime || '' } : {}),
          ...(updates.endTime !== undefined ? { endTime: updates.endTime || '' } : {}),
        }, ...remainingBlocks].filter((block) => block.startTime && block.endTime);
      }

      const updatedTask = { ...currentTask, ...normalizedUpdates };
      return {
        tasks: { ...state.tasks, [taskId]: updatedTask }
      };
    }),

    addTaskTimeBlock: (taskId, block) => {
      const currentTask = get().tasks[taskId];
      if (!currentTask || !block.startTime || !block.endTime) return null;
      const id = `task-time-${genId()}`;
      persistSet((state: AppState) => {
        const task = state.tasks[taskId];
        if (!task) return {};
        const existingBlocks = getTaskTimeBlocks(task).map((currentBlock) => (
          currentBlock.id.startsWith('legacy-') ? { ...currentBlock, id: `task-time-${genId()}` } : currentBlock
        ));
        const nextBlocks = [...existingBlocks, { ...block, id }];
        return { tasks: { ...state.tasks, [taskId]: { ...task, ...normalizeTaskTimeBlocks(task, nextBlocks) } } };
      });
      return id;
    },
    updateTaskTimeBlock: (taskId, blockId, updates) => persistSet((state: AppState) => {
      const task = state.tasks[taskId];
      if (!task) return {};
      const blocks = getTaskTimeBlocks(task);
      const nextBlocks = blocks.map((block) => (
        block.id === blockId || (blockId.startsWith('legacy-') && block.id.startsWith('legacy-'))
          ? { ...block, ...updates, id: block.id.startsWith('legacy-') ? `task-time-${genId()}` : block.id }
          : block
      ));
      return { tasks: { ...state.tasks, [taskId]: { ...task, ...normalizeTaskTimeBlocks(task, nextBlocks) } } };
    }),
    deleteTaskTimeBlock: (taskId, blockId) => persistSet((state: AppState) => {
      const task = state.tasks[taskId];
      if (!task) return {};
      const nextBlocks = getTaskTimeBlocks(task).filter((block) => (
        block.id !== blockId && !(blockId.startsWith('legacy-') && block.id.startsWith('legacy-'))
      ));
      return { tasks: { ...state.tasks, [taskId]: { ...task, ...normalizeTaskTimeBlocks(task, nextBlocks) } } };
    }),

    setTaskComponentIds: (taskId, componentIds) => persistSet((state: AppState) => {
      const task = state.tasks[taskId];
      if (!task) return {};
      const selectedIds = new Set(componentIds);
      const previousIds = new Set(task.componentIds || []);
      const removedIds = new Set(Array.from(previousIds).filter((id) => !selectedIds.has(id)));
      const descendantTaskIds = getDescendantTaskIds(
        getWorkspaceGraph(state.goals, state.workspaceNodes, state.mergedEdges, state.mergedNodePositions),
        taskId,
      );

      return {
        tasks: Object.fromEntries(Object.entries(state.tasks).map(([id, candidate]) => {
          if (!descendantTaskIds.has(id)) return [id, candidate];
          const inheritedIds = new Set(candidate.componentIds || []);
          selectedIds.forEach((componentId) => inheritedIds.add(componentId));
          removedIds.forEach((componentId) => inheritedIds.delete(componentId));
          if (id === taskId) {
            state.workspaceComponents.forEach((component) => {
              if (!selectedIds.has(component.id)) inheritedIds.delete(component.id);
            });
          }
          return [id, { ...candidate, componentIds: Array.from(inheritedIds) }];
        })),
      };
    }),

    addTaskStatus: (label) => {
      const normalizedLabel = label.trim();
      if (!normalizedLabel || get().taskStatuses.some((status) => status.label === normalizedLabel)) return null;
      const statusId = `status-${genId()}`;
      persistSet((state: AppState) => ({
        taskStatuses: [...state.taskStatuses, { id: statusId, label: normalizedLabel }],
      }));
      return statusId;
    },

    renameTaskStatus: (statusId, label) => persistSet((state: AppState) => {
      const normalizedLabel = label.trim();
      if (!normalizedLabel || state.taskStatuses.some((status) => status.id !== statusId && status.label === normalizedLabel)) {
        return {};
      }
      return {
        taskStatuses: state.taskStatuses.map((status) => (
          status.id === statusId ? { ...status, label: normalizedLabel } : status
        )),
      };
    }),

    deleteTaskStatus: (statusId) => persistSet((state: AppState) => {
      const targetStatus = state.taskStatuses.find((status) => status.id === statusId);
      if (!targetStatus || targetStatus.isSystem) return {};
      return {
        taskStatuses: state.taskStatuses.filter((status) => status.id !== statusId),
        tasks: Object.fromEntries(Object.entries(state.tasks).map(([taskId, task]) => [
          taskId,
          task.statusId === statusId
            ? { ...task, statusId: 'status-not-started', isDone: false }
            : task,
        ])),
      };
    }),

    deleteTask: (taskId) => persistSet((state: AppState) => {
      const nextTasks = { ...state.tasks };
      delete nextTasks[taskId];

      const removedWorkspaceNodeIds = new Set(
        state.workspaceNodes.filter((node) => node.taskId === taskId).map((node) => node.id)
      );

      // Also prune from goal nodes if it is removed entirely
      const nextGoals = { ...state.goals };
      Object.keys(nextGoals).forEach((gid) => {
        nextGoals[gid].nodes = nextGoals[gid].nodes.filter(n => n.taskId !== taskId);
      });

      return {
        tasks: nextTasks,
        goals: nextGoals,
        drafts: state.drafts.map((draft) => {
          const removedNodeIds = new Set(draft.nodes.filter((node) => node.taskId === taskId).map((node) => node.id));
          return {
            ...draft,
            nodes: draft.nodes.filter((node) => node.taskId !== taskId),
            edges: draft.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
          };
        }),
        workspaceNodes: state.workspaceNodes.filter((node) => node.taskId !== taskId),
        mergedEdges: state.mergedEdges.filter(
          (edge) => !removedWorkspaceNodeIds.has(edge.source) && !removedWorkspaceNodeIds.has(edge.target)
        ),
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
        todoItems: removeTodoTaskInstances(state.todoItems, taskId),
      };
    }),

    removeTaskFromWorkspace: (taskId, componentIds) => persistSet((state: AppState) => {
      const task = state.tasks[taskId];
      if (!task) return {};
      if (componentIds === null) {
        const removedNodeIds = new Set<string>();
        state.workspaceNodes.forEach((node) => {
          if (node.taskId === taskId) removedNodeIds.add(node.id);
        });
        Object.values(state.goals).forEach((goal) => goal.nodes.forEach((node) => {
          if (node.taskId === taskId) removedNodeIds.add(node.id);
        }));
        const nextTasks = { ...state.tasks };
        delete nextTasks[taskId];
        return {
          tasks: nextTasks,
          drafts: state.drafts.map((draft) => {
            const draftNodeIds = new Set(draft.nodes.filter((node) => node.taskId === taskId).map((node) => node.id));
            return {
              ...draft,
              nodes: draft.nodes.filter((node) => node.taskId !== taskId),
              edges: draft.edges.filter((edge) => !draftNodeIds.has(edge.source) && !draftNodeIds.has(edge.target)),
            };
          }),
          workspaceNodes: state.workspaceNodes.filter((node) => node.taskId !== taskId),
          goals: Object.fromEntries(Object.entries(state.goals).map(([goalId, goal]) => [goalId, {
            ...goal,
            nodes: goal.nodes.filter((node) => node.taskId !== taskId),
            edges: goal.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
          }])),
          mergedEdges: state.mergedEdges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
          selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
          todoItems: removeTodoTaskInstances(state.todoItems, taskId),
        };
      }

      const removedIds = new Set(componentIds);
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            componentIds: (task.componentIds || []).filter((id) => !removedIds.has(id)),
          },
        },
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
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
      const removeCategoryMembership = (edge: GoalEdge): GoalEdge[] => {
        if (edge.source !== nodeId && edge.target !== nodeId) return [edge];
        const remainingCategoryIds = getEdgeCategoryIds(state, edge).filter(
          (categoryId) => categoryId !== targetGoal.category,
        );
        return remainingCategoryIds.length > 0 ? [{ ...edge, categoryIds: remainingCategoryIds }] : [];
      };
      const nextCrossEdges = state.crossGoalEdges.flatMap(removeCategoryMembership);
      const nextMergedEdges = state.mergedEdges.flatMap(removeCategoryMembership);

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

    updateWorkspaceNodeSize: (nodeId, width, height) => persistSet((state: AppState) => ({
      goals: Object.fromEntries(Object.entries(state.goals).map(([goalId, goal]) => [goalId, {
        ...goal,
        nodes: goal.nodes.map((node) => node.id === nodeId ? { ...node, width, height } : node),
      }])),
      workspaceNodes: state.workspaceNodes.map((node) => node.id === nodeId ? { ...node, width, height } : node),
    })),

    addWorkspaceNode: (node) => persistSet((state: AppState) => {
      if (state.workspaceNodes.some((existingNode) => existingNode.id === node.id || existingNode.taskId === node.taskId)) {
        return {};
      }
      return { workspaceNodes: [...state.workspaceNodes, node] };
    }),

    addWorkspaceDirectory: (directory) => persistSet((state: AppState) => {
      if (state.workspaceDirectories.some((existing) => existing.id === directory.id)) return {};
      return { workspaceDirectories: [...state.workspaceDirectories, directory] };
    }),

    updateWorkspaceDirectory: (directoryId, updates) => persistSet((state: AppState) => ({
      workspaceDirectories: state.workspaceDirectories.map((directory) => (
        directory.id === directoryId ? { ...directory, ...updates } : directory
      )),
    })),

    deleteWorkspaceDirectory: (directoryId) => persistSet((state: AppState) => ({
      workspaceDirectories: state.workspaceDirectories.filter((directory) => directory.id !== directoryId),
      todoLanes: state.todoLanes.map((lane) => lane.directoryId === directoryId ? { ...lane, directoryId: null } : lane),
      mergedEdges: state.mergedEdges.filter((edge) => edge.source !== directoryId && edge.target !== directoryId),
    })),

    convertWorkspaceTaskNodeToDirectory: (nodeId) => {
      const state = get();
      const sourceNode = state.workspaceNodes.find((node) => node.id === nodeId)
        || Object.values(state.goals).flatMap((goal) => goal.nodes).find((node) => node.id === nodeId);
      const task = sourceNode ? state.tasks[sourceNode.taskId] : undefined;
      if (!sourceNode || !task || state.workspaceDirectories.some((directory) => directory.id === nodeId)) return false;

      const convertedNodeIds = new Set<string>();
      state.workspaceNodes.forEach((node) => { if (node.taskId === task.id) convertedNodeIds.add(node.id); });
      Object.values(state.goals).forEach((goal) => goal.nodes.forEach((node) => {
        if (node.taskId === task.id) convertedNodeIds.add(node.id);
      }));
      const rewriteEdge = (edge: GoalEdge): GoalEdge | null => {
        const source = convertedNodeIds.has(edge.source) ? nodeId : edge.source;
        const target = convertedNodeIds.has(edge.target) ? nodeId : edge.target;
        return source === target ? null : { ...edge, source, target };
      };
      const movedGoalEdges: GoalEdge[] = [];
      const goals = Object.fromEntries(Object.entries(state.goals).map(([goalId, goal]) => {
        const remainingEdges: GoalEdge[] = [];
        goal.edges.forEach((edge) => {
          if (convertedNodeIds.has(edge.source) || convertedNodeIds.has(edge.target)) {
            const rewritten = rewriteEdge(edge);
            if (rewritten) movedGoalEdges.push(rewritten);
          } else {
            remainingEdges.push(edge);
          }
        });
        return [goalId, {
          ...goal,
          nodes: goal.nodes.filter((node) => node.taskId !== task.id),
          edges: remainingEdges,
        }];
      }));
      const edgeByEndpoints = new Map<string, GoalEdge>();
      [...state.mergedEdges, ...movedGoalEdges].forEach((edge) => {
        const rewritten = rewriteEdge(edge);
        if (!rewritten) return;
        const key = [rewritten.source, rewritten.target].sort().join(':');
        if (!edgeByEndpoints.has(key)) edgeByEndpoints.set(key, rewritten);
      });
      const mergedNodePositions = { ...state.mergedNodePositions };
      convertedNodeIds.forEach((id) => { if (id !== nodeId) delete mergedNodePositions[id]; });
      const position = state.mergedNodePositions[nodeId] || sourceNode.position;
      mergedNodePositions[nodeId] = position;
      const firstTimeBlock = getTaskTimeBlocks(task)[0];
      const directory: WorkspaceDirectory = {
        id: nodeId,
        name: task.title.trim() || '未命名目录',
        position,
        color: task.color && /^#[0-9a-f]{6}$/i.test(task.color) ? task.color : TASK_COLOR_HEX[task.color || 'indigo'] || TASK_COLOR_HEX.indigo,
        componentIds: [...(task.componentIds || [])],
        isCollapsed: false,
        sourceTaskId: task.id,
        startTime: firstTimeBlock?.startTime,
        endTime: firstTimeBlock?.endTime,
      };
      persistSet(() => ({
        goals,
        workspaceNodes: state.workspaceNodes.filter((node) => node.taskId !== task.id),
        workspaceDirectories: [...state.workspaceDirectories, directory],
        mergedEdges: Array.from(edgeByEndpoints.values()),
        crossGoalEdges: state.crossGoalEdges.flatMap((edge) => {
          const rewritten = rewriteEdge(edge);
          return rewritten ? [rewritten] : [];
        }),
        mergedNodePositions,
        mergedNodeIds: state.mergedNodeIds.filter((id) => !convertedNodeIds.has(id)),
        activeNodeActionsId: null,
      }));
      return true;
    },

    convertWorkspaceDirectoryToTask: (directoryId) => {
      const state = get();
      const directory = state.workspaceDirectories.find((item) => item.id === directoryId);
      if (!directory) return null;
      const existingTask = directory.sourceTaskId ? state.tasks[directory.sourceTaskId] : undefined;
      const taskId = existingTask?.id || `t-directory-${genId()}`;
      const existingTimeBlocks = existingTask ? getTaskTimeBlocks(existingTask) : [];
      const convertedTime = existingTask && directory.startTime && directory.endTime
        ? normalizeTaskTimeBlocks(existingTask, [
            {
              id: existingTimeBlocks[0]?.id.startsWith('legacy-') || !existingTimeBlocks[0]
                ? `task-time-${genId()}`
                : existingTimeBlocks[0].id,
              startTime: directory.startTime,
              endTime: directory.endTime,
            },
            ...existingTimeBlocks.slice(1),
          ])
        : {};
      const task: Task = existingTask
        ? {
            ...existingTask,
            title: directory.name,
            componentIds: [...directory.componentIds],
            color: directory.color,
            ...convertedTime,
          }
        : {
            id: taskId,
            title: directory.name,
            description: '',
            duration: 0,
            isDone: false,
            statusId: 'status-not-started',
            componentIds: [...directory.componentIds],
            startTime: directory.startTime || '',
            endTime: directory.endTime || '',
            color: directory.color,
          };
      const position = state.mergedNodePositions[directoryId] || directory.position;
      persistSet(() => ({
        tasks: { ...state.tasks, [taskId]: task },
        workspaceNodes: [
          ...state.workspaceNodes.filter((node) => node.id !== directoryId && node.taskId !== taskId),
          { id: directoryId, taskId, position },
        ],
        workspaceDirectories: state.workspaceDirectories.filter((item) => item.id !== directoryId),
        todoLanes: state.todoLanes.map((lane) => lane.directoryId === directoryId ? { ...lane, directoryId: null } : lane),
        activeNodeActionsId: null,
      }));
      return taskId;
    },

    addMergedEdge: (edge) => persistSet((state: AppState) => ({
      mergedEdges: [...state.mergedEdges, edge]
    })),

    deleteMergedEdge: (edgeId) => persistSet((state: AppState) => ({
      mergedEdges: state.mergedEdges.filter((e) => e.id !== edgeId)
    })),

    removeEdgeFromWorkspace: (edgeId) => persistSet((state: AppState) => {
      return {
        mergedEdges: state.mergedEdges.filter((edge) => edge.id !== edgeId),
        goals: Object.fromEntries(Object.entries(state.goals).map(([goalId, goal]) => [goalId, {
          ...goal,
          edges: goal.edges.filter((edge) => edge.id !== edgeId),
        }])),
        crossGoalEdges: state.crossGoalEdges.filter((edge) => edge.id !== edgeId),
      };
    }),

    addMergedNodeId: (nodeId) => persistSet((state: AppState) => {
      if (state.mergedNodeIds.includes(nodeId)) return {};
      return { mergedNodeIds: [...state.mergedNodeIds, nodeId] };
    }),

    deleteMergedNodeId: (nodeId) => persistSet((state: AppState) => ({
      mergedNodeIds: state.mergedNodeIds.filter((id) => id !== nodeId)
    })),

    clearMergedNodeIds: () => persistSet({ mergedNodeIds: [] }),

    clearWorkspace: () => persistSet((state: AppState) => ({
      tasks: EMPTY_TASKS,
      goals: {},
      selectedGoalId: null,
      selectedTaskId: null,
      activeNodeActionsId: null,
      isMergedView: false,
      activeMergedGoalIds: [],
      workspaceComponentFilter: null,
      workspaceComponents: [],
      workspaceDirectories: [],
      drafts: [],
      todoLanes: normalizeTodoLanes([], state.categories),
      todoItems: [],
      crossGoalEdges: [],
      bomTree: EMPTY_BOM_TREE,
      timelineTaskOrder: [],
      isTimelineCollapsed: false,
      mergedNodePositions: {},
      workspaceNodes: [],
      mergedEdges: [],
      mergedNodeIds: []
    }))
  };
});
