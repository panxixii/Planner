import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Inbox,
  LocateFixed,
} from 'lucide-react';
import { useAppStore } from '../store';
import { getTaskComponentIds } from '../workspaceComponents';

type ZoomScaleType = 'minutes' | 'hours' | 'days';

type ScaleDefinition = {
  unitMs: number;
  columnWidth: number;
};

const DEFAULT_TASK_COLUMN_WIDTH = 240;
const MIN_TASK_COLUMN_WIDTH = 180;
const MAX_TASK_COLUMN_WIDTH = 420;
const WINDOW_COLUMN_COUNT = 360;
const WINDOW_SHIFT_COLUMNS = 120;

const SCALE_DEFINITIONS: Record<ZoomScaleType, ScaleDefinition> = {
  minutes: { unitMs: 5 * 60 * 1000, columnWidth: 64 },
  hours: { unitMs: 60 * 60 * 1000, columnWidth: 72 },
  days: { unitMs: 24 * 60 * 60 * 1000, columnWidth: 88 },
};

const SCALE_LABELS: Record<ZoomScaleType, string> = {
  minutes: '分',
  hours: '时',
  days: '天',
};

const SCALE_TOOLTIPS: Record<ZoomScaleType, string> = {
  minutes: '以 5 分钟为最小刻度查看连续时间轴',
  hours: '以 1 小时为最小刻度查看连续时间轴',
  days: '以 1 天为最小刻度查看连续时间轴',
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const alignTimestamp = (timestamp: number, scale: ZoomScaleType) => {
  if (scale === 'days') {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  const { unitMs } = SCALE_DEFINITIONS[scale];
  return Math.floor(timestamp / unitMs) * unitMs;
};

const getCenteredRangeStart = (timestamp: number, scale: ZoomScaleType) => {
  const { unitMs } = SCALE_DEFINITIONS[scale];
  return alignTimestamp(timestamp, scale) - Math.floor(WINDOW_COLUMN_COUNT / 2) * unitMs;
};

const parseTaskTimestamp = (value: string, endOfDate = false) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    return endOfDate ? timestamp + 24 * 60 * 60 * 1000 : timestamp;
  }

  return new Date(value).getTime();
};

const formatHeader = (timestamp: number, scale: ZoomScaleType) => {
  const date = new Date(timestamp);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (scale === 'days') {
    return { primary: monthDay, secondary: WEEKDAY_LABELS[date.getDay()] };
  }

  if (scale === 'hours') {
    return {
      primary: `${hours}:00`,
      secondary: date.getHours() === 0 ? monthDay : '',
    };
  }

  return {
    primary: `${hours}:${minutes}`,
    secondary: date.getMinutes() === 0 ? monthDay : '',
  };
};

const colorClasses: Record<string, string> = {
  emerald: 'from-[#67c8bd] to-[#8ed9cf] border-[#9adbd2] text-white shadow-[#67c8bd]/10',
  rose: 'from-[#d78fb5] to-[#e5abc9] border-[#e8b5d0] text-white shadow-[#d78fb5]/10',
  sky: 'from-[#79bfd5] to-[#9bd5e0] border-[#a8dce5] text-white shadow-[#79bfd5]/10',
  amber: 'from-[#d9b958] to-[#e7cf82] border-[#ead797] text-white shadow-[#d9b958]/10',
  violet: 'from-[#9b8ae4] to-[#c2a9e7] border-[#c9b6e9] text-white shadow-[#9b8ae4]/10',
  indigo: 'from-[#9387d1] to-[#b7a8df] border-[#c3b8e5] text-white shadow-[#9387d1]/10',
};

export const TimelineLayer: React.FC = () => {
  const tasks = useAppStore((state) => state.tasks);
  const selectTask = useAppStore((state) => state.selectTask);
  const timelineTaskOrder = useAppStore((state) => state.timelineTaskOrder);
  const setTimelineTaskOrder = useAppStore((state) => state.setTimelineTaskOrder);
  const isTimelineCollapsed = useAppStore((state) => state.isTimelineCollapsed);
  const toggleTimeline = useAppStore((state) => state.toggleTimeline);
  const workspaceComponentFilter = useAppStore((state) => state.workspaceComponentFilter);

  const initialNowRef = useRef(Date.now());
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const taskColumnWidthRef = useRef(DEFAULT_TASK_COLUMN_WIDTH);
  const columnResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const pendingScrollAdjustmentRef = useRef<number | null>(null);
  const pendingFocusTimestampRef = useRef<number | null>(initialNowRef.current);

  const [zoomScale, setZoomScale] = useState<ZoomScaleType>('days');
  const [rangeStart, setRangeStart] = useState(() => getCenteredRangeStart(initialNowRef.current, 'days'));
  const [nowTimestamp, setNowTimestamp] = useState(initialNowRef.current);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASK_COLUMN_WIDTH);

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
      const timelineViewportWidth = Math.max(0, container.clientWidth - taskColumnWidth);
      const position = ((timestamp - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
      container.scrollLeft = Math.max(0, position - timelineViewportWidth / 2);
      pendingFocusTimestampRef.current = null;
    }
  }, [isTimelineCollapsed, rangeStart, scaleDefinition.columnWidth, scaleDefinition.unitMs, taskColumnWidth, zoomScale]);

  const visibleTasks = useMemo(() => {
    const selectedIds = new Set(workspaceComponentFilter || []);
    return Object.values(tasks).filter((task) => (
      task.startTime
      && task.endTime
      && (
        workspaceComponentFilter === null
        || getTaskComponentIds(task).some((componentId) => selectedIds.has(componentId))
      )
    ));
  }, [tasks, workspaceComponentFilter]);

  const orderedVisibleTasks = useMemo(() => {
    const orderById = new Map(timelineTaskOrder.map((id, index) => [id, index]));
    return [...visibleTasks].sort((a, b) => {
      const indexA = orderById.get(a.id);
      const indexB = orderById.get(b.id);
      if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
      if (indexA !== undefined) return -1;
      if (indexB !== undefined) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [timelineTaskOrder, visibleTasks]);

  const headers = useMemo(
    () => Array.from({ length: WINDOW_COLUMN_COUNT }, (_, index) => {
      const timestamp = rangeStart + index * scaleDefinition.unitMs;
      return { timestamp, ...formatHeader(timestamp, zoomScale) };
    }),
    [rangeStart, scaleDefinition.unitMs, zoomScale],
  );

  const getViewportCenterTimestamp = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return nowTimestamp;

    const timelineViewportWidth = Math.max(0, container.clientWidth - taskColumnWidth);
    const centerPosition = container.scrollLeft + timelineViewportWidth / 2;
    return rangeStart + (centerPosition / scaleDefinition.columnWidth) * scaleDefinition.unitMs;
  }, [nowTimestamp, rangeStart, scaleDefinition.columnWidth, scaleDefinition.unitMs, taskColumnWidth]);

  const handleScaleChange = (nextScale: ZoomScaleType) => {
    if (nextScale === zoomScale) return;
    const centerTimestamp = getViewportCenterTimestamp();
    pendingFocusTimestampRef.current = centerTimestamp;
    pendingScrollAdjustmentRef.current = null;
    setZoomScale(nextScale);
    setRangeStart(getCenteredRangeStart(centerTimestamp, nextScale));
  };

  const handleReturnToNow = () => {
    const currentTimestamp = Date.now();
    const nextRangeStart = getCenteredRangeStart(currentTimestamp, zoomScale);
    setNowTimestamp(currentTimestamp);

    if (nextRangeStart === rangeStart) {
      const container = scrollContainerRef.current;
      if (!container) return;
      const timelineViewportWidth = Math.max(0, container.clientWidth - taskColumnWidth);
      const position = ((currentTimestamp - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
      container.scrollLeft = Math.max(0, position - timelineViewportWidth / 2);
      return;
    }

    pendingFocusTimestampRef.current = currentTimestamp;
    pendingScrollAdjustmentRef.current = null;
    setRangeStart(nextRangeStart);
  };

  const handleTimelineScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || pendingScrollAdjustmentRef.current !== null) return;

    const edgeThreshold = scaleDefinition.columnWidth * 24;
    const shiftWidth = scaleDefinition.columnWidth * WINDOW_SHIFT_COLUMNS;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    if (container.scrollLeft < edgeThreshold) {
      pendingScrollAdjustmentRef.current = shiftWidth;
      setRangeStart((currentStart) => currentStart - WINDOW_SHIFT_COLUMNS * scaleDefinition.unitMs);
    } else if (container.scrollLeft > maxScrollLeft - edgeThreshold) {
      pendingScrollAdjustmentRef.current = -shiftWidth;
      setRangeStart((currentStart) => currentStart + WINDOW_SHIFT_COLUMNS * scaleDefinition.unitMs);
    }
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

  const handleDragOver = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    if (draggedTaskId !== targetId) setDragOverTaskId(targetId);
  };

  const handleDragEnd = () => {
    if (draggedTaskId && dragOverTaskId && draggedTaskId !== dragOverTaskId) {
      const orderedIds = orderedVisibleTasks.map((task) => task.id);
      const fromIndex = orderedIds.indexOf(draggedTaskId);
      const toIndex = orderedIds.indexOf(dragOverTaskId);

      if (fromIndex !== -1 && toIndex !== -1) {
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
    columnResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: taskColumnWidthRef.current,
    };
  };

  const handleColumnResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = columnResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    applyTaskColumnWidth(resize.startWidth + event.clientX - resize.startX);
  };

  const handleColumnResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = columnResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    columnResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTaskColumnWidth(taskColumnWidthRef.current);
  };

  const handleColumnResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    setTaskColumnWidth(applyTaskColumnWidth(taskColumnWidthRef.current + direction * 12));
  };

  const getDragBorderClass = (taskId: string) => {
    if (taskId !== dragOverTaskId || !draggedTaskId) return '';
    const taskIds = orderedVisibleTasks.map((task) => task.id);
    const fromIndex = taskIds.indexOf(draggedTaskId);
    const toIndex = taskIds.indexOf(taskId);
    if (fromIndex === -1 || toIndex === -1) return '';
    return fromIndex > toIndex
      ? 'border-t-2 border-t-purple-500'
      : 'border-b-2 border-b-purple-500';
  };

  const getDaysRemaining = (endTime: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endTime);
    end.setHours(0, 0, 0, 0);
    const days = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return '今日截止';
    if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
    return `剩 ${days} 天`;
  };

  const getCountdownClass = (endTime: string, isDone: boolean) => {
    if (isDone) return 'bg-neutral-100 text-neutral-400 border border-neutral-200';
    const end = new Date(endTime);
    const days = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return 'bg-rose-50 text-rose-500 border border-rose-100';
    if (days <= 2) return 'bg-amber-50 text-amber-600 border border-amber-200';
    return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  };

  const currentColumnIndex = Math.floor((nowTimestamp - rangeStart) / scaleDefinition.unitMs);
  const isNowInRange = nowTimestamp >= rangeStart && nowTimestamp < rangeEnd;
  const nowLinePosition = ((nowTimestamp - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
  const trackBackground = `repeating-linear-gradient(to right, transparent 0, transparent ${scaleDefinition.columnWidth - 1}px, #f0f0f0 ${scaleDefinition.columnWidth - 1}px, #f0f0f0 ${scaleDefinition.columnWidth}px)`;

  return (
    <div
      ref={timelineRootRef}
      id="timeline"
      style={{ '--task-column-width': `${taskColumnWidth}px` } as React.CSSProperties}
      className={`flex shrink-0 select-none flex-col border-t border-neutral-200 bg-white transition-all duration-300 ${isTimelineCollapsed ? 'h-[45px] overflow-hidden' : 'h-80'}`}
    >
      <div
        ref={dragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-[1000px] top-0 z-[-1] h-9 w-56 truncate rounded-md border border-neutral-200 bg-[#ffffff] px-3 py-2 text-xs font-semibold text-neutral-700 shadow-lg"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50/50 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-purple-500" />
          <h4 className="text-xs font-bold text-neutral-800">任务排期</h4>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleReturnToNow}
            className="flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 shadow-xs transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
            title="将当前时间移回视图中央"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            回到现在
          </button>

          <div className="flex items-center gap-1 rounded-lg bg-neutral-200/70 p-1" aria-label="时间轴精度">
            {(Object.keys(SCALE_LABELS) as ZoomScaleType[]).map((scale) => {
              const isActive = zoomScale === scale;
              return (
                <button
                  type="button"
                  key={scale}
                  onClick={() => handleScaleChange(scale)}
                  className={`h-6 min-w-8 rounded-md px-2 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-white font-bold text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:bg-white/50 hover:text-neutral-800'
                  }`}
                  title={SCALE_TOOLTIPS[scale]}
                >
                  {SCALE_LABELS[scale]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={toggleTimeline}
            className="flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-800"
            title={isTimelineCollapsed ? '展开甘特图排期' : '收起甘特图排期'}
          >
            {isTimelineCollapsed
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
            {isTimelineCollapsed ? '展开' : '折叠'}
          </button>
        </div>
      </div>

      {!isTimelineCollapsed ? (
        <div
          ref={scrollContainerRef}
          onScroll={handleTimelineScroll}
          className="custom-scrollbar relative isolate min-w-0 flex-1 overflow-auto bg-[#ffffff]"
        >
          <div style={{ width: `calc(var(--task-column-width) + ${timelineWidth}px)`, minHeight: '100%' }}>
            <div className="sticky top-0 z-40 flex h-11 border-b border-neutral-200 bg-[#f7f8fb] text-[10px] text-neutral-400">
              <div
                style={{ width: 'var(--task-column-width)' }}
                className="sticky left-0 z-50 flex shrink-0 items-center border-r border-neutral-200 bg-[#f7f8fb] px-6 font-bold text-neutral-600"
              >
                排期任务
                <div
                  role="separator"
                  aria-label="调整任务标题栏宽度"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_TASK_COLUMN_WIDTH}
                  aria-valuemax={MAX_TASK_COLUMN_WIDTH}
                  aria-valuenow={Math.round(taskColumnWidth)}
                  tabIndex={0}
                  onPointerDown={handleColumnResizeStart}
                  onPointerMove={handleColumnResizeMove}
                  onPointerUp={handleColumnResizeEnd}
                  onPointerCancel={handleColumnResizeEnd}
                  onKeyDown={handleColumnResizeKeyDown}
                  className="absolute inset-y-0 right-0 w-2 touch-none cursor-col-resize outline-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-neutral-300 hover:after:w-0.5 hover:after:bg-purple-500 focus:after:w-0.5 focus:after:bg-purple-500"
                  title="拖动调整标题栏宽度"
                />
              </div>
              <div className="relative flex" style={{ width: timelineWidth }}>
                {headers.map((header, index) => {
                  const isCurrentColumn = isNowInRange && index === currentColumnIndex;
                  return (
                    <div
                      key={header.timestamp}
                      style={{ width: scaleDefinition.columnWidth }}
                      className={`flex shrink-0 flex-col items-center justify-center border-r border-neutral-100 ${
                        isCurrentColumn ? 'bg-amber-50 text-amber-700' : ''
                      }`}
                    >
                      <span className="text-[10.5px] font-semibold leading-4">{header.primary}</span>
                      <span className="h-3 text-[8px] leading-3 opacity-75">{header.secondary}</span>
                    </div>
                  );
                })}
                {isNowInRange ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-400"
                    style={{ left: nowLinePosition }}
                  />
                ) : null}
              </div>
            </div>

            {orderedVisibleTasks.length === 0 ? (
              <div className="sticky left-0 flex h-44 w-screen max-w-full flex-col items-center justify-center gap-2 text-xs text-neutral-400">
                <Inbox className="h-8 w-8 stroke-1 text-neutral-300" />
                <span>暂无排期任务</span>
              </div>
            ) : (
              orderedVisibleTasks.map((task) => {
                let startTimestamp = parseTaskTimestamp(task.startTime!);
                let endTimestamp = parseTaskTimestamp(task.endTime!, true);

                if (!Number.isFinite(startTimestamp)) startTimestamp = rangeStart;
                if (!Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) {
                  endTimestamp = startTimestamp + Math.max(task.duration, 1 / 60) * 60 * 60 * 1000;
                }

                const intersectsRange = startTimestamp < rangeEnd && endTimestamp > rangeStart;
                const visibleStart = Math.max(startTimestamp, rangeStart);
                const visibleEnd = Math.min(endTimestamp, rangeEnd);
                const barLeft = ((visibleStart - rangeStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
                const calculatedWidth = ((visibleEnd - visibleStart) / scaleDefinition.unitMs) * scaleDefinition.columnWidth;
                const barWidth = Math.min(timelineWidth - barLeft, Math.max(4, calculatedWidth));
                const barColor = colorClasses[task.color || 'indigo'] || colorClasses.indigo;

                return (
                  <div
                    key={task.id}
                    onDragOver={(event) => handleDragOver(event, task.id)}
                    className={`flex h-[52px] border-b border-neutral-100 transition-colors ${
                      draggedTaskId === task.id ? 'cursor-grabbing bg-neutral-100 opacity-40' : 'hover:bg-neutral-50/60'
                    } ${getDragBorderClass(task.id)}`}
                  >
                    <div
                      style={{ width: 'var(--task-column-width)' }}
                      className="sticky left-0 z-30 flex shrink-0 items-center gap-2 border-r border-neutral-200 bg-[#ffffff] px-4 pr-5"
                    >
                      <div
                        draggable
                        onDragStart={(event) => handleDragStart(event, task.id, task.title)}
                        onDragEnd={handleDragEnd}
                        className="shrink-0 cursor-grab text-neutral-300 transition-colors hover:text-neutral-500 active:cursor-grabbing"
                        title="拖动调整任务顺序"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => selectTask(task.id)}
                          className="block w-full truncate text-left text-xs font-semibold text-neutral-800 transition-colors hover:text-purple-600"
                        >
                          {task.title}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-neutral-400">
                          <span>预期: {task.duration}h</span>
                          <span className={`shrink-0 rounded px-1 text-[8px] leading-4 ${getCountdownClass(task.endTime!, task.isDone)}`}>
                            {getDaysRemaining(task.endTime!)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative z-0 flex shrink-0 items-center"
                      style={{ width: timelineWidth, backgroundImage: trackBackground }}
                    >
                      {isNowInRange ? (
                        <>
                          <div
                            className="pointer-events-none absolute inset-y-0 bg-amber-50/70"
                            style={{
                              left: currentColumnIndex * scaleDefinition.columnWidth,
                              width: scaleDefinition.columnWidth,
                            }}
                          />
                          <div
                            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400"
                            style={{ left: nowLinePosition }}
                          />
                        </>
                      ) : null}

                      {intersectsRange ? (
                        <button
                          type="button"
                          onClick={() => selectTask(task.id)}
                          style={{ left: barLeft, width: barWidth }}
                          className={`absolute z-10 flex h-7 items-center justify-between gap-1 overflow-hidden rounded-md border bg-gradient-to-r px-2.5 text-left shadow-xs transition-transform hover:scale-[1.008] ${
                            task.isDone
                              ? 'border-neutral-300 from-neutral-100 to-neutral-200 text-neutral-400 opacity-70 line-through'
                              : barColor
                          }`}
                        >
                          <span className="truncate text-[10px] font-medium">{task.title}</span>
                          {barWidth >= 78 ? (
                            <span className="flex shrink-0 items-center gap-0.5 text-[9px] opacity-85">
                              <Clock className="h-2.5 w-2.5" />
                              {zoomScale === 'minutes'
                                ? `${Math.max(1, Math.round((endTimestamp - startTimestamp) / 60_000))}m`
                                : zoomScale === 'hours'
                                  ? `${Math.max(1, Math.round((endTimestamp - startTimestamp) / 3_600_000))}h`
                                  : `${task.duration}h`}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
