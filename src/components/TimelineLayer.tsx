import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  GripVertical,
  LocateFixed,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatLocalDateTime, getTaskBlockTimestamps, getTaskTimeBlocks } from '../taskTimeBlocks';
import { getTaskComponentIds, getWorkspaceGraph } from '../workspaceComponents';
import type { Task, TaskTimeBlock } from '../types';

type ZoomScaleType = 'minutes' | 'hours' | 'days';
type ScaleDefinition = { unitMs: number; columnWidth: number };
type TimelineTaskRow = { task: Task; depth: number; hasChildren: boolean };
type TaskResizeState = {
  pointerId: number;
  taskId: string;
  blockId: string;
  edge: 'start' | 'end' | 'move';
  startX: number;
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
  didMove: boolean;
};

const DEFAULT_TASK_COLUMN_WIDTH = 240;
const MIN_TASK_COLUMN_WIDTH = 180;
const MAX_TASK_COLUMN_WIDTH = 420;
const WINDOW_COLUMN_COUNT = 360;
const WINDOW_SHIFT_COLUMNS = 120;

const SCALE_DEFINITIONS: Record<ZoomScaleType, ScaleDefinition> = {
  minutes: { unitMs: 5 * 60_000, columnWidth: 64 },
  hours: { unitMs: 60 * 60_000, columnWidth: 72 },
  days: { unitMs: 24 * 60 * 60_000, columnWidth: 88 },
};

const SCALE_LABELS: Record<ZoomScaleType, string> = { minutes: '分', hours: '时', days: '天' };
const SCALE_TOOLTIPS: Record<ZoomScaleType, string> = {
  minutes: '5 分钟刻度，拉伸精度 1 分钟',
  hours: '1 小时刻度，拉伸精度 1 分钟',
  days: '1 天刻度，拉伸精度 1 小时',
};
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const colorClasses: Record<string, string> = {
  emerald: 'from-[#67c8bd] to-[#8ed9cf] border-[#9adbd2] text-white shadow-[#67c8bd]/10',
  rose: 'from-[#d78fb5] to-[#e5abc9] border-[#e8b5d0] text-white shadow-[#d78fb5]/10',
  sky: 'from-[#79bfd5] to-[#9bd5e0] border-[#a8dce5] text-white shadow-[#79bfd5]/10',
  amber: 'from-[#d9b958] to-[#e7cf82] border-[#ead797] text-white shadow-[#d9b958]/10',
  violet: 'from-[#9b8ae4] to-[#c2a9e7] border-[#c9b6e9] text-white shadow-[#9b8ae4]/10',
  indigo: 'from-[#9387d1] to-[#b7a8df] border-[#c3b8e5] text-white shadow-[#9387d1]/10',
};
const namedTimelineColors: Record<string, string> = {
  emerald: '#67c8bd', rose: '#d78fb5', sky: '#79bfd5', amber: '#d9b958', violet: '#9b8ae4', indigo: '#9387d1',
};

const alignTimestamp = (timestamp: number, scale: ZoomScaleType) => {
  if (scale === 'days') {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
  const { unitMs } = SCALE_DEFINITIONS[scale];
  return Math.floor(timestamp / unitMs) * unitMs;
};

const getCenteredRangeStart = (timestamp: number, scale: ZoomScaleType) => (
  alignTimestamp(timestamp, scale) - Math.floor(WINDOW_COLUMN_COUNT / 2) * SCALE_DEFINITIONS[scale].unitMs
);

const withAlpha = (hexColor: string, alpha: string) => (
  /^#[0-9a-f]{6}$/i.test(hexColor) ? `${hexColor}${alpha}` : hexColor
);

const formatHeader = (timestamp: number, scale: ZoomScaleType) => {
  const date = new Date(timestamp);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (scale === 'days') return { primary: monthDay, secondary: WEEKDAY_LABELS[date.getDay()] };
  if (scale === 'hours') return { primary: `${hours}:00`, secondary: date.getHours() === 0 ? monthDay : '' };
  return { primary: `${hours}:${minutes}`, secondary: date.getMinutes() === 0 ? monthDay : '' };
};

const formatDuration = (start: number, end: number) => {
  const minutes = Math.max(1, Math.round((end - start) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const getCountdown = (timestamp: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(timestamp);
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60_000));
  if (days === 0) return '今日截止';
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  return `剩 ${days} 天`;
};

const getCountdownClass = (timestamp: number, isDone: boolean) => {
  if (isDone) return 'border border-neutral-200 bg-neutral-100 text-neutral-400';
  const days = Math.ceil((timestamp - Date.now()) / (24 * 60 * 60_000));
  if (days < 0) return 'border border-rose-100 bg-rose-50 text-rose-500';
  if (days <= 2) return 'border border-amber-200 bg-amber-50 text-amber-600';
  return 'border border-emerald-100 bg-emerald-50 text-emerald-600';
};

export const TimelineLayer: React.FC = () => {
  const tasks = useAppStore((state) => state.tasks);
  const selectTask = useAppStore((state) => state.selectTask);
  const addTask = useAppStore((state) => state.addTask);
  const addWorkspaceNode = useAppStore((state) => state.addWorkspaceNode);
  const addTaskTimeBlock = useAppStore((state) => state.addTaskTimeBlock);
  const updateTaskTimeBlock = useAppStore((state) => state.updateTaskTimeBlock);
  const deleteTaskTimeBlock = useAppStore((state) => state.deleteTaskTimeBlock);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const timelineTaskOrder = useAppStore((state) => state.timelineTaskOrder);
  const setTimelineTaskOrder = useAppStore((state) => state.setTimelineTaskOrder);
  const isTimelineCollapsed = useAppStore((state) => state.isTimelineCollapsed);
  const toggleTimeline = useAppStore((state) => state.toggleTimeline);
  const workspaceComponentFilter = useAppStore((state) => state.workspaceComponentFilter);
  const setWorkspaceComponentFilter = useAppStore((state) => state.setWorkspaceComponentFilter);
  const timeTemplates = useAppStore((state) => state.timeTemplates);
  const activeTimeTemplateIds = useAppStore((state) => state.activeTimeTemplateIds);
  const goals = useAppStore((state) => state.goals);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const mergedEdges = useAppStore((state) => state.mergedEdges);
  const mergedNodePositions = useAppStore((state) => state.mergedNodePositions);

  const initialNowRef = useRef(Date.now());
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const taskColumnWidthRef = useRef(DEFAULT_TASK_COLUMN_WIDTH);
  const columnResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const pendingScrollAdjustmentRef = useRef<number | null>(null);
  const pendingFocusTimestampRef = useRef<number | null>(initialNowRef.current);
  const taskResizeRef = useRef<TaskResizeState | null>(null);
  const suppressTaskClickRef = useRef<{ key: string; until: number } | null>(null);

  const [zoomScale, setZoomScale] = useState<ZoomScaleType>('hours');
  const [rangeStart, setRangeStart] = useState(() => getCenteredRangeStart(initialNowRef.current, 'hours'));
  const [nowTimestamp, setNowTimestamp] = useState(initialNowRef.current);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASK_COLUMN_WIDTH);
  const [taskResizePreview, setTaskResizePreview] = useState<TaskResizeState | null>(null);
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set());
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const scaleDefinition = SCALE_DEFINITIONS[zoomScale];
  const timelineWidth = WINDOW_COLUMN_COUNT * scaleDefinition.columnWidth;
  const rangeEnd = rangeStart + WINDOW_COLUMN_COUNT * scaleDefinition.unitMs;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (pendingScrollAdjustmentRef.current !== null) {
      container.scrollLeft += pendingScrollAdjustmentRef.current;
      pendingScrollAdjustmentRef.current = null;
      return;
    }
    if (pendingFocusTimestampRef.current !== null) {
      const timestamp = pendingFocusTimestampRef.current;
      const viewportWidth = Math.max(0, container.clientWidth - taskColumnWidth);
      const position = ((timestamp - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
      container.scrollLeft = Math.max(0, position - viewportWidth / 2);
      pendingFocusTimestampRef.current = null;
    }
  }, [isTimelineCollapsed, rangeStart, scaleDefinition.columnWidth, scaleDefinition.unitMs, taskColumnWidth, zoomScale]);

  const visibleTasks = useMemo(() => {
    const selectedIds = new Set(workspaceComponentFilter || []);
    return Object.values(tasks).filter((task) => (
      (showCompletedTasks || !task.isDone)
      && (workspaceComponentFilter === null || getTaskComponentIds(task).some((componentId) => selectedIds.has(componentId)))
    ));
  }, [showCompletedTasks, tasks, workspaceComponentFilter]);

  const orderedVisibleTasks = useMemo(() => {
    const orderById = new Map(timelineTaskOrder.map((id, index) => [id, index]));
    return [...visibleTasks].sort((left, right) => {
      const leftOrder = orderById.get(left.id);
      const rightOrder = orderById.get(right.id);
      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      return left.title.localeCompare(right.title);
    });
  }, [timelineTaskOrder, visibleTasks]);

  const timelineRows = useMemo<TimelineTaskRow[]>(() => {
    const visibleTaskIds = new Set(orderedVisibleTasks.map((task) => task.id));
    const taskOrder = new Map<string, number>(orderedVisibleTasks.map((task, index) => [task.id, index]));
    const graph = getWorkspaceGraph(goals, workspaceNodes, mergedEdges, mergedNodePositions);
    const parentCandidates = new Map<string, Map<string, number>>();
    graph.edges.forEach((edge) => {
      const sourcePosition = graph.nodePositions.get(edge.source);
      const targetPosition = graph.nodePositions.get(edge.target);
      const sourceTaskId = graph.nodeTaskIds.get(edge.source);
      const targetTaskId = graph.nodeTaskIds.get(edge.target);
      if (!sourcePosition || !targetPosition || !sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;
      const sourceIsParent = sourcePosition.x <= targetPosition.x;
      const parentTaskId = sourceIsParent ? sourceTaskId : targetTaskId;
      const childTaskId = sourceIsParent ? targetTaskId : sourceTaskId;
      if (!visibleTaskIds.has(parentTaskId) || !visibleTaskIds.has(childTaskId)) return;
      const distance = Math.abs(targetPosition.x - sourcePosition.x);
      const candidates = parentCandidates.get(childTaskId) || new Map<string, number>();
      const currentDistance = candidates.get(parentTaskId);
      if (currentDistance === undefined || distance < currentDistance) candidates.set(parentTaskId, distance);
      parentCandidates.set(childTaskId, candidates);
    });
    const parentByTaskId = new Map<string, string>();
    parentCandidates.forEach((candidates, childTaskId) => {
      let closestParentId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      candidates.forEach((distance, parentTaskId) => {
        if (distance < closestDistance || (distance === closestDistance && (taskOrder.get(parentTaskId) ?? Number.MAX_SAFE_INTEGER) < (taskOrder.get(closestParentId || '') ?? Number.MAX_SAFE_INTEGER))) {
          closestParentId = parentTaskId;
          closestDistance = distance;
        }
      });
      if (closestParentId) parentByTaskId.set(childTaskId, closestParentId);
    });
    const childrenByTaskId = new Map<string, string[]>();
    parentByTaskId.forEach((parentTaskId, childTaskId) => {
      const children = childrenByTaskId.get(parentTaskId) || [];
      children.push(childTaskId);
      childrenByTaskId.set(parentTaskId, children);
    });
    childrenByTaskId.forEach((children) => children.sort((left, right) => (taskOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (taskOrder.get(right) ?? Number.MAX_SAFE_INTEGER)));
    const taskById = new Map<string, Task>(orderedVisibleTasks.map((task) => [task.id, task]));
    const rows: TimelineTaskRow[] = [];
    const visited = new Set<string>();
    const appendTask = (taskId: string, depth: number) => {
      if (visited.has(taskId)) return;
      const task = taskById.get(taskId);
      if (!task) return;
      visited.add(taskId);
      const children = childrenByTaskId.get(taskId) || [];
      rows.push({ task, depth, hasChildren: children.length > 0 });
      if (!collapsedTaskIds.has(taskId)) children.forEach((childId) => appendTask(childId, depth + 1));
    };
    orderedVisibleTasks.forEach((task) => { if (!parentByTaskId.has(task.id)) appendTask(task.id, 0); });
    orderedVisibleTasks.forEach((task) => {
      if (visited.has(task.id)) return;
      const ancestorIds = new Set<string>();
      let ancestorId = parentByTaskId.get(task.id);
      while (ancestorId && !ancestorIds.has(ancestorId)) {
        if (visited.has(ancestorId)) return;
        ancestorIds.add(ancestorId);
        ancestorId = parentByTaskId.get(ancestorId);
      }
      appendTask(task.id, 0);
    });
    return rows;
  }, [collapsedTaskIds, goals, mergedEdges, mergedNodePositions, orderedVisibleTasks, workspaceNodes]);

  const toggleTaskCollapse = useCallback((taskId: string) => {
    setCollapsedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const headers = useMemo(() => Array.from({ length: WINDOW_COLUMN_COUNT }, (_, index) => {
    const timestamp = rangeStart + index * scaleDefinition.unitMs;
    return { timestamp, ...formatHeader(timestamp, zoomScale) };
  }), [rangeStart, scaleDefinition.unitMs, zoomScale]);

  const activeTemplateType = zoomScale === 'days' ? 'weekly' : 'daily';
  const activeTimeTemplate = timeTemplates.find((template) => template.id === activeTimeTemplateIds[activeTemplateType] && template.type === activeTemplateType) || null;
  const templateBands = useMemo(() => {
    if (!activeTimeTemplate) return [];
    const bands: Array<{ key: string; left: number; width: number; color: string }> = [];
    const cycleDays = activeTimeTemplate.type === 'daily' ? 1 : 7;
    const firstCycle = new Date(rangeStart);
    firstCycle.setHours(0, 0, 0, 0);
    if (activeTimeTemplate.type === 'weekly') firstCycle.setDate(firstCycle.getDate() - firstCycle.getDay());
    const cycleMs = cycleDays * 24 * 60 * 60_000;
    for (let cycleStart = firstCycle.getTime(); cycleStart <= rangeEnd; cycleStart += cycleMs) {
      activeTimeTemplate.blocks.forEach((block) => {
        const start = cycleStart + block.startMinute * 60_000;
        const end = cycleStart + block.endMinute * 60_000;
        const visibleStart = Math.max(start, rangeStart);
        const visibleEnd = Math.min(end, rangeEnd);
        if (visibleEnd <= visibleStart) return;
        bands.push({ key: `${block.id}-${cycleStart}`, left: ((visibleStart - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth, width: ((visibleEnd - visibleStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth, color: block.color });
      });
    }
    return bands;
  }, [activeTimeTemplate, rangeEnd, rangeStart, scaleDefinition.columnWidth, scaleDefinition.unitMs]);

  const getTemplateColorAt = useCallback((timestamp: number) => {
    if (!activeTimeTemplate) return null;
    const date = new Date(timestamp);
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    const cycleMinute = activeTimeTemplate.type === 'daily' ? minuteOfDay : date.getDay() * 1440 + minuteOfDay;
    return activeTimeTemplate.blocks.find((block) => cycleMinute >= block.startMinute && cycleMinute < block.endMinute)?.color || null;
  }, [activeTimeTemplate]);

  const getViewportCenterTimestamp = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return nowTimestamp;
    const viewportWidth = Math.max(0, container.clientWidth - taskColumnWidth);
    return rangeStart + ((container.scrollLeft + viewportWidth / 2) / scaleDefinition.columnWidth) * scaleDefinition.unitMs;
  }, [nowTimestamp, rangeStart, scaleDefinition.columnWidth, scaleDefinition.unitMs, taskColumnWidth]);

  const handleScaleChange = (nextScale: ZoomScaleType) => {
    if (nextScale === zoomScale) return;
    const center = getViewportCenterTimestamp();
    pendingFocusTimestampRef.current = center;
    pendingScrollAdjustmentRef.current = null;
    setZoomScale(nextScale);
    setRangeStart(getCenteredRangeStart(center, nextScale));
  };

  const handleReturnToNow = () => {
    const now = Date.now();
    setNowTimestamp(now);
    pendingFocusTimestampRef.current = now;
    pendingScrollAdjustmentRef.current = null;
    setRangeStart(getCenteredRangeStart(now, zoomScale));
  };

  const handleTimelineScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || pendingScrollAdjustmentRef.current !== null) return;
    const threshold = scaleDefinition.columnWidth * 24;
    const shiftWidth = scaleDefinition.columnWidth * WINDOW_SHIFT_COLUMNS;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (container.scrollLeft < threshold) {
      pendingScrollAdjustmentRef.current = shiftWidth;
      setRangeStart((current) => current - WINDOW_SHIFT_COLUMNS * scaleDefinition.unitMs);
    } else if (container.scrollLeft > maxScrollLeft - threshold) {
      pendingScrollAdjustmentRef.current = -shiftWidth;
      setRangeStart((current) => current + WINDOW_SHIFT_COLUMNS * scaleDefinition.unitMs);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY;
  };

  const timestampFromTrackEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = rangeStart + ((event.clientX - rect.left) / scaleDefinition.columnWidth) * scaleDefinition.unitMs;
    return Math.round(raw / (zoomScale === 'days' ? 60 * 60_000 : 60_000)) * (zoomScale === 'days' ? 60 * 60_000 : 60_000);
  };

  const defaultDurationMs = zoomScale === 'minutes' ? 30 * 60_000 : zoomScale === 'hours' ? 60 * 60_000 : 24 * 60 * 60_000;
  const addPeriodToTask = (event: React.MouseEvent<HTMLDivElement>, task: Task) => {
    if (event.target !== event.currentTarget) return;
    const start = timestampFromTrackEvent(event);
    addTaskTimeBlock(task.id, { startTime: formatLocalDateTime(start), endTime: formatLocalDateTime(start + defaultDurationMs) });
  };

  const createTaskAt = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const start = timestampFromTrackEvent(event);
    const end = start + defaultDurationMs;
    const suffix = Math.random().toString(36).slice(2, 9);
    const taskId = `t-gantt-${suffix}`;
    beginHistoryGroup();
    addTask({ id: taskId, title: '新任务', description: '', duration: defaultDurationMs / 3_600_000, isDone: false, statusId: 'status-not-started', componentIds: [], startTime: formatLocalDateTime(start), endTime: formatLocalDateTime(end), timeBlocks: [{ id: `task-time-${suffix}`, startTime: formatLocalDateTime(start), endTime: formatLocalDateTime(end) }], color: 'indigo' });
    addWorkspaceNode({ id: `node-gantt-${suffix}`, taskId, position: { x: 80 + (workspaceNodes.length % 4) * 190, y: 90 + Math.floor(workspaceNodes.length / 4) * 100 } });
    setTimelineTaskOrder([...timelineTaskOrder.filter((id) => id !== taskId), taskId]);
    setWorkspaceComponentFilter(null);
    endHistoryGroup();
    selectTask(taskId);
  };

  const handleDragStart = (event: React.DragEvent, id: string, title: string) => {
    setDraggedTaskId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    if (dragPreviewRef.current) {
      dragPreviewRef.current.textContent = title || '空白任务';
      event.dataTransfer.setDragImage(dragPreviewRef.current, 18, 18);
    }
  };

  const handleDragEnd = () => {
    if (draggedTaskId && dragOverTaskId && draggedTaskId !== dragOverTaskId) {
      const orderedIds = orderedVisibleTasks.map((task) => task.id);
      const fromIndex = orderedIds.indexOf(draggedTaskId);
      const toIndex = orderedIds.indexOf(dragOverTaskId);
      if (fromIndex >= 0 && toIndex >= 0) {
        const nextOrder = [...orderedIds];
        const [movedId] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, movedId);
        setTimelineTaskOrder(nextOrder);
      }
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const applyTaskColumnWidth = (width: number) => {
    const nextWidth = Math.min(MAX_TASK_COLUMN_WIDTH, Math.max(MIN_TASK_COLUMN_WIDTH, width));
    taskColumnWidthRef.current = nextWidth;
    timelineRootRef.current?.style.setProperty('--task-column-width', `${nextWidth}px`);
    return nextWidth;
  };

  const handleColumnResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    columnResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: taskColumnWidthRef.current };
  };
  const handleColumnResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = columnResizeRef.current;
    if (resize?.pointerId === event.pointerId) applyTaskColumnWidth(resize.startWidth + event.clientX - resize.startX);
  };
  const handleColumnResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (columnResizeRef.current?.pointerId !== event.pointerId) return;
    columnResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setTaskColumnWidth(taskColumnWidthRef.current);
  };
  const handleColumnResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setTaskColumnWidth(applyTaskColumnWidth(taskColumnWidthRef.current + (event.key === 'ArrowLeft' ? -12 : 12)));
  };

  const handleTaskResizeStart = (event: React.PointerEvent<HTMLDivElement>, task: Task, block: TaskTimeBlock, edge: 'start' | 'end') => {
    event.preventDefault();
    event.stopPropagation();
    const range = getTaskBlockTimestamps(block, task.duration);
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { pointerId: event.pointerId, taskId: task.id, blockId: block.id, edge, startX: event.clientX, originalStart: range.start, originalEnd: range.end, previewStart: range.start, previewEnd: range.end, didMove: false };
    taskResizeRef.current = next;
    setTaskResizePreview(next);
  };
  const handleTaskMoveStart = (event: React.PointerEvent<HTMLDivElement>, task: Task, block: TaskTimeBlock) => {
    if (event.button !== 0) return;
    const range = getTaskBlockTimestamps(block, task.duration);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: TaskResizeState = { pointerId: event.pointerId, taskId: task.id, blockId: block.id, edge: 'move', startX: event.clientX, originalStart: range.start, originalEnd: range.end, previewStart: range.start, previewEnd: range.end, didMove: false };
    taskResizeRef.current = next;
    setTaskResizePreview(next);
  };
  const handleTaskResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = taskResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const pointerDelta = event.clientX - resize.startX;
    if (resize.edge === 'move' && !resize.didMove && Math.abs(pointerDelta) < 3) return;
    const rawDelta = (pointerDelta / scaleDefinition.columnWidth) * scaleDefinition.unitMs;
    const snapMs = zoomScale === 'days' ? 60 * 60_000 : 60_000;
    const delta = Math.round(rawDelta / snapMs) * snapMs;
    const next = resize.edge === 'move'
      ? { ...resize, previewStart: resize.originalStart + delta, previewEnd: resize.originalEnd + delta, didMove: true }
      : resize.edge === 'start'
        ? { ...resize, previewStart: Math.min(resize.originalEnd - snapMs, resize.originalStart + delta), didMove: delta !== 0 }
        : { ...resize, previewEnd: Math.max(resize.originalStart + snapMs, resize.originalEnd + delta), didMove: delta !== 0 };
    taskResizeRef.current = next;
    setTaskResizePreview(next);
  };
  const handleTaskResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = taskResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (resize.didMove) {
      updateTaskTimeBlock(resize.taskId, resize.blockId, { startTime: formatLocalDateTime(resize.previewStart), endTime: formatLocalDateTime(resize.previewEnd) });
      if (resize.edge === 'move') suppressTaskClickRef.current = { key: `${resize.taskId}:${resize.blockId}`, until: Date.now() + 300 };
    }
    taskResizeRef.current = null;
    setTaskResizePreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const getDragBorderClass = (taskId: string) => {
    if (taskId !== dragOverTaskId || !draggedTaskId) return '';
    const taskIds = orderedVisibleTasks.map((task) => task.id);
    return taskIds.indexOf(draggedTaskId) > taskIds.indexOf(taskId) ? 'border-t-2 border-t-purple-500' : 'border-b-2 border-b-purple-500';
  };

  const isNowInRange = nowTimestamp >= rangeStart && nowTimestamp < rangeEnd;
  const nowLinePosition = ((nowTimestamp - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
  const trackBackground = `repeating-linear-gradient(to right, transparent 0, transparent ${scaleDefinition.columnWidth - 1}px, #f0f0f0 ${scaleDefinition.columnWidth - 1}px, #f0f0f0 ${scaleDefinition.columnWidth}px)`;

  return (
    <div ref={timelineRootRef} id="timeline" style={{ '--task-column-width': `${taskColumnWidth}px` } as React.CSSProperties} className={`flex shrink-0 select-none flex-col border-t border-neutral-200 bg-white transition-[height] duration-300 ${isTimelineCollapsed ? 'h-[45px] overflow-hidden' : 'h-80'}`}>
      <div ref={dragPreviewRef} aria-hidden="true" className="pointer-events-none fixed -left-[1000px] top-0 z-[-1] h-9 w-56 truncate rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-lg" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50/50 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-purple-500" /><h4 className="text-xs font-bold text-neutral-800">任务排期</h4></div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 shadow-xs hover:bg-neutral-50"><input type="checkbox" checked={showCompletedTasks} onChange={(event) => setShowCompletedTasks(event.target.checked)} className="h-3.5 w-3.5 accent-[#8d78d5]" />显示全部</label>
          <button type="button" onClick={handleReturnToNow} className="flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 shadow-xs hover:bg-neutral-50" title="将当前时间移回视图中央"><LocateFixed className="h-3.5 w-3.5" />回到现在</button>
          <div className="flex items-center gap-1 rounded-lg bg-neutral-200/70 p-1" aria-label="时间轴精度">{(Object.keys(SCALE_LABELS) as ZoomScaleType[]).map((value) => <button type="button" key={value} onClick={() => handleScaleChange(value)} className={`h-6 min-w-8 rounded-md px-2 text-[11px] font-medium ${zoomScale === value ? 'bg-white font-bold text-neutral-900 shadow-xs' : 'text-neutral-500 hover:bg-white/50 hover:text-neutral-800'}`} title={SCALE_TOOLTIPS[value]}>{SCALE_LABELS[value]}</button>)}</div>
          <button type="button" onClick={toggleTimeline} className="flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 shadow-xs hover:bg-neutral-50" title={isTimelineCollapsed ? '展开甘特图排期' : '收起甘特图排期'}>{isTimelineCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{isTimelineCollapsed ? '展开' : '折叠'}</button>
        </div>
      </div>

      {!isTimelineCollapsed ? (
        <div ref={scrollContainerRef} onScroll={handleTimelineScroll} onWheel={handleWheel} className="custom-scrollbar relative isolate min-w-0 flex-1 overflow-auto bg-white">
          <div className="relative" style={{ width: `calc(var(--task-column-width) + ${timelineWidth}px)`, minHeight: '100%' }}>
            <div className="sticky top-0 z-40 flex h-11 border-b border-neutral-200 bg-[#f7f8fb] text-[10px] text-neutral-400">
              <div style={{ width: 'var(--task-column-width)' }} className="sticky left-0 z-50 flex shrink-0 items-center border-r border-neutral-200 bg-[#f7f8fb] px-6 font-bold text-neutral-600">排期任务<div role="separator" aria-label="调整任务标题栏宽度" aria-orientation="vertical" aria-valuemin={MIN_TASK_COLUMN_WIDTH} aria-valuemax={MAX_TASK_COLUMN_WIDTH} aria-valuenow={Math.round(taskColumnWidth)} tabIndex={0} onPointerDown={handleColumnResizeStart} onPointerMove={handleColumnResizeMove} onPointerUp={handleColumnResizeEnd} onPointerCancel={handleColumnResizeEnd} onKeyDown={handleColumnResizeKeyDown} className="absolute inset-y-0 right-0 w-2 touch-none cursor-col-resize outline-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-neutral-300 hover:after:w-0.5 hover:after:bg-purple-500 focus:after:w-0.5 focus:after:bg-purple-500" title="拖动调整标题栏宽度" /></div>
              <div className="relative flex" style={{ width: timelineWidth }}>
                {templateBands.map((band) => <div key={`header-${band.key}`} className="pointer-events-none absolute inset-y-0 z-0" style={{ left: band.left, width: band.width, backgroundColor: withAlpha(band.color, '2e') }} />)}
                {headers.map((header) => <div key={header.timestamp} style={{ width: scaleDefinition.columnWidth, color: getTemplateColorAt(header.timestamp) || undefined }} className="relative z-[1] flex shrink-0 flex-col items-center justify-center border-r border-neutral-100"><span className="text-[10.5px] font-semibold leading-4">{header.primary}</span><span className="h-3 text-[8px] leading-3 opacity-75">{header.secondary}</span></div>)}
                {isNowInRange ? <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-400" style={{ left: nowLinePosition }} /> : null}
              </div>
            </div>

            {templateBands.length > 0 ? <div className="pointer-events-none absolute top-11 z-0 overflow-hidden" style={{ left: 'var(--task-column-width)', width: timelineWidth, height: (timelineRows.length + 1) * 52 }}>{templateBands.map((band) => <div key={band.key} className="absolute inset-y-0" style={{ left: band.left, width: band.width, backgroundColor: withAlpha(band.color, '20') }} />)}</div> : null}

            {timelineRows.map(({ task, depth, hasChildren }) => {
              const blocks = getTaskTimeBlocks(task);
              const ranges = blocks.map((block) => ({ block, ...getTaskBlockTimestamps(block, task.duration) }));
              const latestEnd = ranges.reduce((latest, range) => Math.max(latest, range.end), Number.NEGATIVE_INFINITY);
              return (
                <div key={task.id} onDragOver={(event) => { event.preventDefault(); if (draggedTaskId !== task.id) setDragOverTaskId(task.id); }} className={`flex h-[52px] border-b border-neutral-100 ${draggedTaskId === task.id ? 'cursor-grabbing bg-neutral-100 opacity-40' : 'hover:bg-neutral-50/60'} ${getDragBorderClass(task.id)}`}>
                  <div style={{ width: 'var(--task-column-width)' }} className="sticky left-0 z-30 flex shrink-0 items-center border-r border-neutral-200 bg-white px-4 pr-5">
                    <div draggable onDragStart={(event) => handleDragStart(event, task.id, task.title)} onDragEnd={handleDragEnd} className="shrink-0 cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing" title="拖动调整任务顺序"><GripVertical className="h-3.5 w-3.5" /></div>
                    <div className="custom-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"><div className="flex min-w-max items-center gap-1.5 py-1" style={{ paddingLeft: depth * 18 }}>
                      {hasChildren ? <button type="button" onClick={() => toggleTaskCollapse(task.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title={collapsedTaskIds.has(task.id) ? '展开子任务' : '折叠子任务'}>{collapsedTaskIds.has(task.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button> : <span className="h-5 w-5 shrink-0" />}
                      <div className="min-w-max pr-2"><button type="button" onClick={() => selectTask(task.id)} className="block whitespace-nowrap text-left text-xs font-semibold text-neutral-800 hover:text-purple-600">{task.title || '未命名任务'}</button><div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[9px] text-neutral-400"><span>预期: {task.duration}h</span>{Number.isFinite(latestEnd) ? <span className={`shrink-0 rounded px-1 text-[8px] leading-4 ${getCountdownClass(latestEnd, task.isDone)}`}>{getCountdown(latestEnd)}</span> : <span className="rounded bg-neutral-100 px-1 text-[8px] leading-4 text-neutral-400">未排期</span>}</div></div>
                    </div></div>
                  </div>

                  <div onDoubleClick={(event) => addPeriodToTask(event, task)} className="relative z-0 flex shrink-0 items-center" style={{ width: timelineWidth, backgroundImage: trackBackground }}>
                    {isNowInRange ? <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400" style={{ left: nowLinePosition }} /> : null}
                    {ranges.map(({ block, start, end }) => {
                      const preview = taskResizePreview?.taskId === task.id && taskResizePreview.blockId === block.id ? taskResizePreview : null;
                      const blockStart = preview?.previewStart ?? start;
                      const blockEnd = preview?.previewEnd ?? end;
                      if (blockStart >= rangeEnd || blockEnd <= rangeStart) return null;
                      const visibleStart = Math.max(blockStart, rangeStart);
                      const visibleEnd = Math.min(blockEnd, rangeEnd);
                      const barLeft = ((visibleStart - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
                      const barWidth = Math.min(timelineWidth - barLeft, Math.max(4, ((visibleEnd - visibleStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth));
                      const barColor = colorClasses[task.color || 'indigo'];
                      const barHex = /^#[0-9a-f]{6}$/i.test(task.color || '') ? task.color! : namedTimelineColors[task.color || 'indigo'];
                      const blockKey = `${task.id}:${block.id}`;
                      return <div key={block.id} role="button" tabIndex={0} onPointerDown={(event) => handleTaskMoveStart(event, task, block)} onPointerMove={handleTaskResizeMove} onPointerUp={handleTaskResizeEnd} onPointerCancel={handleTaskResizeEnd} onClick={(event) => { const suppressed = suppressTaskClickRef.current; if (suppressed?.key === blockKey && Date.now() < suppressed.until) { event.preventDefault(); event.stopPropagation(); return; } selectTask(task.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectTask(task.id); } }} onDoubleClick={(event) => event.stopPropagation()} style={{ left: barLeft, width: barWidth, ...(!task.isDone && !barColor ? { background: `linear-gradient(to right, ${barHex}, ${barHex}C2)`, borderColor: `${barHex}99`, color: '#fff' } : {}) }} className={`group/time-block absolute z-10 flex h-7 touch-none cursor-grab items-center justify-between gap-1 rounded-md border bg-gradient-to-r px-2.5 text-left shadow-xs outline-none transition-shadow hover:z-30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-purple-200 active:cursor-grabbing focus-within:z-30 ${task.isDone ? 'border-neutral-300 from-neutral-100 to-neutral-200 text-neutral-400 opacity-70 line-through' : (barColor || '')}`} title="拖动移动时间块；点击打开任务详情">
                        <div onPointerDown={(event) => handleTaskResizeStart(event, task, block, 'start')} onPointerMove={handleTaskResizeMove} onPointerUp={handleTaskResizeEnd} onPointerCancel={handleTaskResizeEnd} className="absolute inset-y-0 left-0 z-20 w-2 touch-none cursor-ew-resize bg-white/25 opacity-0 hover:opacity-100" title="拖动修改开始时间" />
                        <span className="pointer-events-none min-w-0 flex-1 truncate text-left text-[10px] font-medium">{task.title || '未命名任务'}</span>
                        {barWidth >= 78 ? <span className="flex shrink-0 items-center gap-0.5 text-[9px] opacity-85"><Clock className="h-2.5 w-2.5" />{formatDuration(blockStart, blockEnd)}</span> : null}
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteTaskTimeBlock(task.id, block.id); }} onDoubleClick={(event) => event.stopPropagation()} className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 opacity-0 shadow-sm outline-none transition-[opacity,background-color] hover:bg-rose-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-200 group-hover/time-block:opacity-100" aria-label={`删除${task.title || '未命名任务'}的这个时间块`} title="删除这个时间块"><Trash2 className="h-3 w-3" /></button>
                        <div onPointerDown={(event) => handleTaskResizeStart(event, task, block, 'end')} onPointerMove={handleTaskResizeMove} onPointerUp={handleTaskResizeEnd} onPointerCancel={handleTaskResizeEnd} className="absolute inset-y-0 right-0 z-20 w-2 touch-none cursor-ew-resize bg-white/25 opacity-0 hover:opacity-100" title="拖动修改结束时间" />
                      </div>;
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex h-[52px] border-b border-neutral-100 bg-neutral-50/30">
              <div style={{ width: 'var(--task-column-width)' }} className="sticky left-0 z-30 flex shrink-0 items-center gap-2 border-r border-neutral-200 bg-neutral-50 px-6 text-[11px] font-semibold text-neutral-400"><Plus className="h-3.5 w-3.5" />新任务</div>
              <div onDoubleClick={createTaskAt} className="relative shrink-0 cursor-crosshair" style={{ width: timelineWidth, backgroundImage: trackBackground }} title="双击在此时间创建任务">{isNowInRange ? <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400" style={{ left: nowLinePosition }} /> : null}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
