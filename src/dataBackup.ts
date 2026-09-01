import { PLANNER_STORAGE_KEY, useAppStore } from './store';

const BACKUP_FORMAT = 'planner-data-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_SIZE = 20 * 1024 * 1024;

interface PlannerBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const validateData = (data: unknown): data is Record<string, unknown> => {
  if (!isRecord(data)) return false;
  return isRecord(data.tasks)
    && isRecord(data.goals)
    && Array.isArray(data.taskStatuses)
    && Array.isArray(data.workspaceNodes)
    && Array.isArray(data.mergedEdges)
    && Array.isArray(data.workspaceComponents);
};

const withoutDraftStrokes = (data: Record<string, unknown>): Record<string, unknown> => ({
  ...data,
  drafts: Array.isArray(data.drafts)
    ? data.drafts.map((draft) => isRecord(draft) ? { ...draft, strokes: [] } : draft)
    : [],
});

const getCurrentPersistedData = (): Record<string, unknown> => {
  const saved = localStorage.getItem(PLANNER_STORAGE_KEY);
  if (saved) {
    const parsed: unknown = JSON.parse(saved);
    if (validateData(parsed)) return withoutDraftStrokes(parsed);
  }

  const state = useAppStore.getState();
  return {
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
    drafts: state.drafts.map((draft) => ({ ...draft, strokes: [] })),
    crossGoalEdges: state.crossGoalEdges,
    isSidebarCollapsed: state.isSidebarCollapsed,
    showHelp: state.showHelp,
    timelineTaskOrder: state.timelineTaskOrder,
    isTimelineCollapsed: state.isTimelineCollapsed,
    mergedNodePositions: state.mergedNodePositions,
    workspaceNodes: state.workspaceNodes,
    mergedEdges: state.mergedEdges,
    mergedNodeIds: state.mergedNodeIds,
  };
};

const getBackupFilename = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `planner-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
};

export const downloadPlannerBackup = () => {
  const backup: PlannerBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: getCurrentPersistedData(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getBackupFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const importPlannerBackup = async (file: File): Promise<Record<string, unknown>> => {
  if (file.size > MAX_BACKUP_SIZE) {
    throw new Error('备份文件超过 20 MB，无法导入');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('文件不是有效的 JSON 备份');
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('这不是 Planner 导出的备份文件');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`不支持此备份版本：${String(parsed.version)}`);
  }
  if (!validateData(parsed.data)) {
    throw new Error('备份内容不完整或已经损坏');
  }

  return withoutDraftStrokes(parsed.data);
};
