import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { formatLocalDateTime, getTaskBlockTimestamps, parseTaskTime } from '../taskTimeBlocks';
import type { TodoItem } from '../types';
import { DateTimePicker } from './DateTimePicker';

type ScheduleView = 'day' | 'week' | 'month';

type CalendarEvent = {
  itemId: string;
  blockId: string;
  title: string;
  color: string;
  isDone: boolean;
  start: number;
  end: number;
  allDay: boolean;
};

type DraftEvent = {
  start: number;
  end: number;
  allDay: boolean;
  title: string;
};

type DragState = {
  pointerId: number;
  itemId: string;
  blockId: string;
  edge: 'move' | 'start' | 'end';
  originY: number;
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
  dayStart: number;
};

const WEEKDAYS_SUN = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const HOUR_HEIGHT = 56;
const SNAP_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_DURATION_MS = 60 * 60_000;
const COLORS: Record<string, string> = {
  emerald: '#67c8bd',
  rose: '#d78fb5',
  sky: '#79bfd5',
  amber: '#d9b958',
  violet: '#9b8ae4',
  indigo: '#9387d1',
};

const pad = (value: number) => String(value).padStart(2, '0');
const startOfDay = (date: Date | number) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
};
const addDays = (timestamp: number, days: number) => timestamp + days * DAY_MS;
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const formatDateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};
const formatMonthLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const formatRange = (start: number, end: number, allDay: boolean) => {
  if (allDay) {
    const startDate = new Date(start);
    const endDate = new Date(end - 1);
    if (sameDay(start, end - 1)) return `${startDate.getMonth() + 1}/${startDate.getDate()} 全天`;
    return `${startDate.getMonth() + 1}/${startDate.getDate()} – ${endDate.getMonth() + 1}/${endDate.getDate()} 全天`;
  }
  if (sameDay(start, end)) return `${formatTime(start)} – ${formatTime(end)}`;
  return `${formatDateLabel(start)} ${formatTime(start)} – ${formatDateLabel(end)} ${formatTime(end)}`;
};
const snap = (timestamp: number) => Math.round(timestamp / SNAP_MS) * SNAP_MS;
const clampDuration = (start: number, end: number) => Math.max(end, start + SNAP_MS);
const eventColor = (color?: string) => {
  if (!color) return COLORS.indigo;
  if (COLORS[color]) return COLORS[color];
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return COLORS.indigo;
};
const withAlpha = (hex: string, alpha: number) => {
  const cleaned = hex.replace('#', '');
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Monday-based week start (Feishu CN default). */
const startOfWeek = (timestamp: number) => {
  const date = new Date(startOfDay(timestamp));
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date.getTime(), offset);
};
const getWeekDays = (anchor: number) => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));

const getMonthGrid = (anchor: number) => {
  const monthStart = new Date(new Date(anchor).getFullYear(), new Date(anchor).getMonth(), 1).getTime();
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const collectEvents = (items: TodoItem[]): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  for (const item of items) {
    if (item.isDirectory) continue;
    const blocks = item.timeBlocks?.length
      ? item.timeBlocks
      : item.startTime && item.endTime
        ? [{ id: `legacy-${item.id}`, startTime: item.startTime, endTime: item.endTime }]
        : [];
    for (const block of blocks) {
      if (!block.startTime || !block.endTime) continue;
      const allDay = isDateOnly(block.startTime) && isDateOnly(block.endTime);
      const range = getTaskBlockTimestamps(block, 1);
      events.push({
        itemId: item.id,
        blockId: block.id,
        title: item.text || '未命名日程',
        color: eventColor(item.color),
        isDone: item.isDone || item.progressStatus === 'cancelled',
        start: range.start,
        end: range.end,
        allDay,
      });
    }
  }
  return events.sort((a, b) => a.start - b.start || a.end - b.end);
};

const overlapsDay = (event: CalendarEvent, day: number) => {
  const dayEnd = addDays(day, 1);
  return event.start < dayEnd && event.end > day;
};

const timedLayoutForDay = (events: CalendarEvent[], day: number) => {
  const dayEnd = addDays(day, 1);
  const timed = events
    .filter((event) => !event.allDay && overlapsDay(event, day))
    .map((event) => ({
      ...event,
      clipStart: Math.max(event.start, day),
      clipEnd: Math.min(event.end, dayEnd),
    }))
    .sort((a, b) => a.clipStart - b.clipStart || b.clipEnd - a.clipEnd);

  const columnEnds: number[] = [];
  const placed = timed.map((event) => {
    let column = 0;
    while (columnEnds[column] !== undefined && columnEnds[column] > event.clipStart) column += 1;
    columnEnds[column] = event.clipEnd;
    return { ...event, column };
  });

  return placed.map((event) => {
    const cluster = placed.filter((other) => other.clipStart < event.clipEnd && other.clipEnd > event.clipStart);
    const totalColumns = Math.max(1, ...cluster.map((other) => other.column + 1));
    return {
      ...event,
      totalColumns,
      top: ((event.clipStart - day) / DAY_MS) * 24 * HOUR_HEIGHT,
      height: Math.max(22, ((event.clipEnd - event.clipStart) / DAY_MS) * 24 * HOUR_HEIGHT),
    };
  });
};

const MiniMonth: React.FC<{
  cursor: number;
  selected: number;
  onSelect: (day: number) => void;
  onCursorChange: (month: number) => void;
  eventDays: Set<string>;
}> = ({ cursor, selected, onSelect, onCursorChange, eventDays }) => {
  const monthStart = new Date(new Date(cursor).getFullYear(), new Date(cursor).getMonth(), 1).getTime();
  const days = getMonthGrid(monthStart);
  const today = startOfDay(Date.now());
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold text-neutral-700">{formatMonthLabel(monthStart)}</span>
        <div className="flex items-center gap-0.5">
          <button type="button" className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" onClick={() => onCursorChange(new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() - 1, 1).getTime())} aria-label="上一月">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" onClick={() => onCursorChange(new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 1).getTime())} aria-label="下一月">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS_MON.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold text-neutral-400">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = new Date(day).getMonth() === new Date(monthStart).getMonth();
          const isSelected = sameDay(day, selected);
          const isToday = sameDay(day, today);
          const key = new Date(day).toISOString().slice(0, 10);
          const hasEvent = eventDays.has(key);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={`relative flex h-7 items-center justify-center rounded-md text-[11px] font-medium transition-colors ${
                isSelected
                  ? 'bg-purple-600 text-white'
                  : isToday
                    ? 'bg-purple-50 text-purple-700'
                    : inMonth
                      ? 'text-neutral-700 hover:bg-neutral-100'
                      : 'text-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {new Date(day).getDate()}
              {hasEvent && !isSelected ? <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-purple-400" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const EventChip: React.FC<{
  event: CalendarEvent;
  style?: React.CSSProperties;
  compact?: boolean;
  onClick: (event: React.MouseEvent) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>, edge: DragState['edge']) => void;
}> = ({ event, style, compact, onClick, onPointerDown }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(keyboardEvent) => {
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        onClick(keyboardEvent as unknown as React.MouseEvent);
      }
    }}
    onPointerDown={onPointerDown ? (pointerEvent) => onPointerDown(pointerEvent, 'move') : undefined}
    className={`group absolute overflow-hidden rounded-md border px-1.5 text-left shadow-sm transition-shadow hover:shadow-md ${event.isDone ? 'opacity-55' : ''}`}
    style={{
      background: withAlpha(event.color, 0.18),
      borderColor: withAlpha(event.color, 0.45),
      color: event.color,
      ...style,
    }}
    title={`${event.title}\n${formatRange(event.start, event.end, event.allDay)}`}
  >
    {onPointerDown ? (
      <>
        <span
          className="absolute inset-x-1 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
          onPointerDown={(pointerEvent) => { pointerEvent.stopPropagation(); onPointerDown(pointerEvent, 'start'); }}
        />
        <span
          className="absolute inset-x-1 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
          onPointerDown={(pointerEvent) => { pointerEvent.stopPropagation(); onPointerDown(pointerEvent, 'end'); }}
        />
      </>
    ) : null}
    <div className={`truncate font-semibold ${compact ? 'text-[10px] leading-4' : 'text-[11px] leading-4'}`}>
      {event.allDay || compact ? event.title : `${formatTime(event.start)} ${event.title}`}
    </div>
    {!compact && !event.allDay && style && Number(style.height) > 36 ? (
      <div className="truncate text-[10px] opacity-80">{formatTime(event.end)}</div>
    ) : null}
  </div>
);

const DayHourGrid: React.FC<{
  day: number;
  events: CalendarEvent[];
  now: number;
  onSlotCreate: (start: number, end: number) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onBeginDrag: (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLDivElement>, edge: DragState['edge'], day: number) => void;
  dragPreview: DragState | null;
}> = ({ day, events, now, onSlotCreate, onOpenEvent, onBeginDrag, dragPreview }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => {
    const mapped = timedLayoutForDay(events, day).map((item) => {
      if (!dragPreview || dragPreview.itemId !== item.itemId || dragPreview.blockId !== item.blockId) return item;
      const clipStart = Math.max(dragPreview.previewStart, day);
      const clipEnd = Math.min(dragPreview.previewEnd, addDays(day, 1));
      return {
        ...item,
        clipStart,
        clipEnd,
        top: ((clipStart - day) / DAY_MS) * 24 * HOUR_HEIGHT,
        height: Math.max(22, ((clipEnd - clipStart) / DAY_MS) * 24 * HOUR_HEIGHT),
      };
    });
    return mapped;
  }, [day, dragPreview, events]);
  const allDay = events.filter((event) => event.allDay && overlapsDay(event, day));
  const showNow = sameDay(day, now);

  const yToTime = (clientY: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return day + 9 * 60 * 60_000;
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top + (bodyRef.current?.scrollTop || 0)));
    return snap(day + (y / (24 * HOUR_HEIGHT)) * DAY_MS);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {allDay.length > 0 ? (
        <div className="shrink-0 border-b border-neutral-200 px-3 py-2">
          <div className="relative min-h-8 space-y-1">
            {allDay.map((event) => (
              <button
                key={`${event.itemId}-${event.blockId}`}
                type="button"
                onClick={() => onOpenEvent(event)}
                className={`flex w-full items-center rounded-md border px-2 py-1 text-left text-[11px] font-semibold ${event.isDone ? 'opacity-55' : ''}`}
                style={{ background: withAlpha(event.color, 0.16), borderColor: withAlpha(event.color, 0.4), color: event.color }}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div ref={bodyRef} className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="absolute inset-x-0 border-t border-neutral-100" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 left-2 text-[10px] font-medium text-neutral-300">{pad(hour)}:00</span>
            </div>
          ))}
          <div
            className="absolute inset-0 left-12 cursor-crosshair"
            onDoubleClick={(mouseEvent) => {
              const start = yToTime(mouseEvent.clientY);
              onSlotCreate(start, start + DEFAULT_DURATION_MS);
            }}
            onClick={(mouseEvent) => {
              if ((mouseEvent.target as HTMLElement).closest('[data-event-chip]')) return;
            }}
          />
          {layout.map((event) => (
            <div key={`${event.itemId}-${event.blockId}`} data-event-chip className="absolute left-12 right-1" style={{ top: event.top, height: event.height, marginLeft: `${(event.column / event.totalColumns) * 100}%`, width: `calc(${100 / event.totalColumns}% - 4px)` }}>
              <EventChip
                event={event}
                style={{ inset: 0, position: 'absolute' }}
                onClick={(mouseEvent) => { mouseEvent.stopPropagation(); onOpenEvent(event); }}
                onPointerDown={(pointerEvent, edge) => onBeginDrag(event, pointerEvent, edge, day)}
              />
            </div>
          ))}
          {showNow ? (
            <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: ((now - day) / DAY_MS) * 24 * HOUR_HEIGHT }}>
              <span className="ml-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="h-px flex-1 bg-rose-500" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const SchedulePage: React.FC = () => {
  const todoItems = useAppStore((state) => state.todoItems);
  const createTodoItem = useAppStore((state) => state.createTodoItem);
  const updateTodoItem = useAppStore((state) => state.updateTodoItem);
  const addTodoTimeBlock = useAppStore((state) => state.addTodoTimeBlock);
  const updateTodoTimeBlock = useAppStore((state) => state.updateTodoTimeBlock);
  const removeTodoTimeBlock = useAppStore((state) => state.removeTodoTimeBlock);
  const removeTodoItem = useAppStore((state) => state.removeTodoItem);
  const toggleTodoItemDone = useAppStore((state) => state.toggleTodoItemDone);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);

  const [view, setView] = useState<ScheduleView>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [miniCursor, setMiniCursor] = useState(() => startOfDay(Date.now()));
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [selectedKey, setSelectedKey] = useState<{ itemId: string; blockId: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const dragRef = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragState | null>(null);
  const now = Date.now();

  const events = useMemo(() => collectEvents(todoItems), [todoItems]);
  const selected = useMemo(
    () => (selectedKey ? events.find((event) => event.itemId === selectedKey.itemId && event.blockId === selectedKey.blockId) || null : null),
    [events, selectedKey],
  );
  const eventDays = useMemo(() => {
    const keys = new Set<string>();
    for (const event of events) {
      const cursor = startOfDay(event.start);
      const last = startOfDay(event.end - 1);
      for (let day = cursor; day <= last; day = addDays(day, 1)) {
        keys.add(new Date(day).toISOString().slice(0, 10));
      }
    }
    return keys;
  }, [events]);

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const monthDays = useMemo(() => getMonthGrid(anchor), [anchor]);
  const title = view === 'month'
    ? formatMonthLabel(anchor)
    : view === 'week'
      ? `${formatDateLabel(weekDays[0])} – ${formatDateLabel(weekDays[6])}`
      : `${formatDateLabel(anchor)} 周${WEEKDAYS_SUN[new Date(anchor).getDay()]}`;

  useEffect(() => {
    if (!selectedKey) return;
    if (!selected) {
      setSelectedKey(null);
      return;
    }
    setEditTitle(selected.title === '未命名日程' ? '' : selected.title);
    setEditStart(formatLocalDateTime(selected.start));
    setEditEnd(formatLocalDateTime(selected.end));
  }, [selected, selectedKey]);

  const openEvent = (event: CalendarEvent) => setSelectedKey({ itemId: event.itemId, blockId: event.blockId });
  const closeEvent = () => setSelectedKey(null);

  const goToday = () => {
    const today = startOfDay(Date.now());
    setAnchor(today);
    setMiniCursor(today);
  };

  const shift = (direction: -1 | 1) => {
    if (view === 'day') setAnchor((value) => addDays(value, direction));
    else if (view === 'week') setAnchor((value) => addDays(value, direction * 7));
    else setAnchor((value) => new Date(new Date(value).getFullYear(), new Date(value).getMonth() + direction, 1).getTime());
  };

  const openCreate = (start: number, end: number, allDay = false) => {
    setSelectedKey(null);
    setDraft({ start, end: clampDuration(start, end), allDay, title: '' });
  };

  const commitDraft = () => {
    if (!draft) return;
    const itemId = createTodoItem('todo-main', draft.title.trim() || '新日程');
    if (!itemId) return;
    const start = draft.allDay
      ? `${new Date(draft.start).getFullYear()}-${pad(new Date(draft.start).getMonth() + 1)}-${pad(new Date(draft.start).getDate())}`
      : formatLocalDateTime(draft.start);
    const end = draft.allDay
      ? `${new Date(draft.end - 1).getFullYear()}-${pad(new Date(draft.end - 1).getMonth() + 1)}-${pad(new Date(draft.end - 1).getDate())}`
      : formatLocalDateTime(draft.end);
    addTodoTimeBlock(itemId, { startTime: start, endTime: end });
    setDraft(null);
  };

  const saveSelected = () => {
    if (!selected) return;
    updateTodoItem(selected.itemId, { text: editTitle.trim() });
    const startMs = parseTaskTime(editStart);
    const endMs = clampDuration(startMs, parseTaskTime(editEnd, true));
    updateTodoTimeBlock(selected.itemId, selected.blockId, {
      startTime: formatLocalDateTime(startMs),
      endTime: formatLocalDateTime(endMs),
    });
    closeEvent();
  };

  const deleteSelected = () => {
    if (!selected) return;
    const item = todoItems.find((candidate) => candidate.id === selected.itemId);
    const blocks = item?.timeBlocks || [];
    if (blocks.length <= 1 && !(item?.text || '').trim()) removeTodoItem(selected.itemId);
    else removeTodoTimeBlock(selected.itemId, selected.blockId);
    closeEvent();
  };

  const onBeginDrag = (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLDivElement>, edge: DragState['edge'], day: number) => {
    if (event.allDay) return;
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    (pointerEvent.currentTarget as HTMLElement).setPointerCapture(pointerEvent.pointerId);
    beginHistoryGroup();
    const next: DragState = {
      pointerId: pointerEvent.pointerId,
      itemId: event.itemId,
      blockId: event.blockId,
      edge,
      originY: pointerEvent.clientY,
      originalStart: event.start,
      originalEnd: event.end,
      previewStart: event.start,
      previewEnd: event.end,
      dayStart: day,
    };
    dragRef.current = next;
    setDragPreview(next);
  };

  useEffect(() => {
    const onMove = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
      const deltaMs = Math.round(((pointerEvent.clientY - drag.originY) / HOUR_HEIGHT) * 60 * 60_000 / SNAP_MS) * SNAP_MS;
      let previewStart = drag.originalStart;
      let previewEnd = drag.originalEnd;
      if (drag.edge === 'move') {
        previewStart = snap(drag.originalStart + deltaMs);
        previewEnd = previewStart + (drag.originalEnd - drag.originalStart);
      } else if (drag.edge === 'start') {
        previewStart = Math.min(snap(drag.originalStart + deltaMs), drag.originalEnd - SNAP_MS);
      } else {
        previewEnd = Math.max(snap(drag.originalEnd + deltaMs), drag.originalStart + SNAP_MS);
      }
      const next = { ...drag, previewStart, previewEnd };
      dragRef.current = next;
      setDragPreview(next);
    };
    const onUp = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
      updateTodoTimeBlock(drag.itemId, drag.blockId, {
        startTime: formatLocalDateTime(drag.previewStart),
        endTime: formatLocalDateTime(drag.previewEnd),
      });
      dragRef.current = null;
      setDragPreview(null);
      endHistoryGroup();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [endHistoryGroup, updateTodoTimeBlock]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-50">
      <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-neutral-50/80 p-4">
        <button
          type="button"
          onClick={() => openCreate(snap(Date.now()), snap(Date.now()) + DEFAULT_DURATION_MS)}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-purple-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          创建日程
        </button>
        <MiniMonth
          cursor={miniCursor}
          selected={anchor}
          onSelect={(day) => { setAnchor(day); setMiniCursor(day); if (view === 'month') setView('day'); }}
          onCursorChange={setMiniCursor}
          eventDays={eventDays}
        />
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-2 text-[11px] font-bold tracking-wide text-neutral-400 uppercase">日历</div>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" />
            我的日程
            <span className="ml-auto text-[10px] text-neutral-400">{events.length}</span>
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            日程与 Todo / 甘特共用时间块。在此创建或调整后，其他视图会同步更新。
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4">
          <button type="button" onClick={goToday} className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50">今天</button>
          <div className="flex items-center rounded-lg border border-neutral-200 p-0.5">
            <button type="button" onClick={() => shift(-1)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50" aria-label="上一段"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => shift(1)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50" aria-label="下一段"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-800">{title}</div>
          <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {([
              ['day', '日'],
              ['week', '周'],
              ['month', '月'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`h-7 rounded-md px-3 text-xs font-semibold transition-colors ${view === id ? 'bg-white text-purple-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === 'day' ? (
          <DayHourGrid
            day={anchor}
            events={events}
            now={now}
            onSlotCreate={(start, end) => openCreate(start, end)}
            onOpenEvent={openEvent}
            onBeginDrag={onBeginDrag}
            dragPreview={dragPreview}
          />
        ) : null}

        {view === 'week' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="grid shrink-0 grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-neutral-200">
              <div />
              {weekDays.map((day) => {
                const isToday = sameDay(day, now);
                return (
                  <button key={day} type="button" onClick={() => { setAnchor(day); setView('day'); }} className="border-l border-neutral-100 px-2 py-2 text-center hover:bg-neutral-50">
                    <div className="text-[10px] font-semibold text-neutral-400">周{WEEKDAYS_SUN[new Date(day).getDay()]}</div>
                    <div className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-purple-600 text-white' : 'text-neutral-700'}`}>
                      {new Date(day).getDate()}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid shrink-0 grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-neutral-200">
              <div className="px-1 py-2 text-[10px] font-medium text-neutral-300">全天</div>
              {weekDays.map((day) => (
                <div key={`allday-${day}`} className="min-h-10 space-y-0.5 border-l border-neutral-100 p-1">
                  {events.filter((event) => event.allDay && overlapsDay(event, day)).map((event) => (
                    <button
                      key={`${event.itemId}-${event.blockId}`}
                      type="button"
                      onClick={() => openEvent(event)}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold ${event.isDone ? 'opacity-55' : ''}`}
                      style={{ background: withAlpha(event.color, 0.18), color: event.color }}
                    >
                      {event.title}
                    </button>
                  ))}
                  <button type="button" className="block h-5 w-full rounded text-[10px] text-transparent hover:bg-purple-50 hover:text-purple-400" onClick={() => openCreate(day, addDays(day, 1), true)}>+ 全天</button>
                </div>
              ))}
            </div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
              <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_HEIGHT }}>
                <div className="relative">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="absolute inset-x-0" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                      <span className="absolute -top-2 right-1 text-[10px] text-neutral-300">{pad(hour)}</span>
                    </div>
                  ))}
                </div>
                {weekDays.map((day) => {
                  const layout = timedLayoutForDay(events, day).map((item) => {
                    if (!dragPreview || dragPreview.itemId !== item.itemId || dragPreview.blockId !== item.blockId) return item;
                    const clipStart = Math.max(dragPreview.previewStart, day);
                    const clipEnd = Math.min(dragPreview.previewEnd, addDays(day, 1));
                    return {
                      ...item,
                      top: ((clipStart - day) / DAY_MS) * 24 * HOUR_HEIGHT,
                      height: Math.max(22, ((clipEnd - clipStart) / DAY_MS) * 24 * HOUR_HEIGHT),
                    };
                  });
                  return (
                    <div
                      key={day}
                      className="relative border-l border-neutral-100"
                      onDoubleClick={(mouseEvent) => {
                        const rect = (mouseEvent.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const y = mouseEvent.clientY - rect.top;
                        const start = snap(day + (y / (24 * HOUR_HEIGHT)) * DAY_MS);
                        openCreate(start, start + DEFAULT_DURATION_MS);
                      }}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div key={hour} className="absolute inset-x-0 border-t border-neutral-50" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
                      ))}
                      {layout.map((event) => (
                        <EventChip
                          key={`${event.itemId}-${event.blockId}`}
                          event={event}
                          style={{ top: event.top, height: event.height, left: 4, right: 4 }}
                          onClick={(mouseEvent) => { mouseEvent.stopPropagation(); openEvent(event); }}
                          onPointerDown={(pointerEvent, edge) => onBeginDrag(event, pointerEvent, edge, day)}
                        />
                      ))}
                      {sameDay(day, now) ? (
                        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ((now - day) / DAY_MS) * 24 * HOUR_HEIGHT }}>
                          <div className="h-px bg-rose-500" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {view === 'month' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="grid shrink-0 grid-cols-7 border-b border-neutral-200">
              {WEEKDAYS_MON.map((label) => (
                <div key={label} className="px-3 py-2 text-xs font-semibold text-neutral-400">周{label}</div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
              {monthDays.map((day) => {
                const inMonth = new Date(day).getMonth() === new Date(anchor).getMonth();
                const dayEvents = events.filter((event) => overlapsDay(event, day)).slice(0, 4);
                const extra = events.filter((event) => overlapsDay(event, day)).length - dayEvents.length;
                const isToday = sameDay(day, now);
                return (
                  <div
                    key={day}
                    className={`flex min-h-0 flex-col border-r border-b border-neutral-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-neutral-50/70'}`}
                    onDoubleClick={() => openCreate(day + 9 * 60 * 60_000, day + 10 * 60 * 60_000)}
                  >
                    <button
                      type="button"
                      onClick={() => { setAnchor(day); setView('day'); }}
                      className={`mb-1 flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
                        isToday ? 'bg-purple-600 text-white' : inMonth ? 'text-neutral-700 hover:bg-neutral-100' : 'text-neutral-300'
                      }`}
                    >
                      {new Date(day).getDate()}
                    </button>
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                      {dayEvents.map((event) => (
                        <button
                          key={`${event.itemId}-${event.blockId}`}
                          type="button"
                          onClick={() => openEvent(event)}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold ${event.isDone ? 'opacity-55' : ''}`}
                          style={{ background: withAlpha(event.color, 0.18), color: event.color }}
                        >
                          {event.allDay ? event.title : `${formatTime(event.start)} ${event.title}`}
                        </button>
                      ))}
                      {extra > 0 ? <div className="px-1 text-[10px] font-medium text-neutral-400">还有 {extra} 项</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/20 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-800">创建日程</h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"><X className="h-4 w-4" /></button>
            </div>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              onKeyDown={(event) => { if (event.key === 'Enter') commitDraft(); }}
              placeholder="添加标题"
              className="mb-4 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
            />
            <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatRange(draft.start, draft.end, draft.allDay)}
            </div>
            <label className="mb-4 flex items-center gap-2 text-xs font-medium text-neutral-600">
              <input type="checkbox" checked={draft.allDay} onChange={(event) => setDraft({ ...draft, allDay: event.target.checked, end: event.target.checked ? addDays(startOfDay(draft.start), 1) : draft.start + DEFAULT_DURATION_MS, start: startOfDay(draft.start) + (event.target.checked ? 0 : 9 * 60 * 60_000) })} />
              全天
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="h-9 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">取消</button>
              <button type="button" onClick={commitDraft} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700">创建</button>
            </div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/10" onClick={closeEvent}>
          <aside className="flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-5">
              <h2 className="text-sm font-bold text-neutral-800">日程详情</h2>
              <button type="button" onClick={closeEvent} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder="日程标题"
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-semibold outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <div>
                <div className="mb-1.5 text-[11px] font-bold text-neutral-400">开始</div>
                <DateTimePicker value={editStart} onChange={setEditStart} />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold text-neutral-400">结束</div>
                <DateTimePicker value={editEnd} onChange={setEditEnd} />
              </div>
              <button
                type="button"
                onClick={() => toggleTodoItemDone(selected.itemId)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                <Check className="h-3.5 w-3.5" />
                {selected.isDone ? '标为未完成' : '标为已完成'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-4">
              <button type="button" onClick={deleteSelected} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-500 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </button>
              <button type="button" onClick={saveSelected} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700">保存</button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
};
