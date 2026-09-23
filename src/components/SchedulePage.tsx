import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { formatLocalDateTime, getTaskBlockTimestamps, parseTaskTime } from '../taskTimeBlocks';
import type { TodoItem } from '../types';
import { ColorPicker } from './ColorPicker';
import { DateTimePicker } from './DateTimePicker';

type ScheduleView = 'day' | 'week' | 'month';

type CalendarEvent = {
  itemId: string;
  blockId: string;
  title: string;
  color: string;
  start: number;
  end: number;
  calendarId: string;
};

type DraftEvent = {
  start: number;
  end: number;
  title: string;
  calendarId: string;
  /** Viewport rect of the temporary dashed slot (Feishu-style). */
  slot: { left: number; top: number; width: number; height: number };
};

const CALENDAR_STORAGE_KEY = 'planner-schedule-calendars-v1';
const DEFAULT_CALENDAR_ID = 'cal-default';
const CALENDAR_COLORS = ['#9387d1', '#67c8bd', '#79bfd5', '#d78fb5', '#d9b958', '#9b8ae4'];

type ScheduleCalendar = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  laneId?: string;
};

const loadCalendars = (): ScheduleCalendar[] => {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!raw) return [{ id: DEFAULT_CALENDAR_ID, name: '我的日程', color: '#9387d1', visible: true }];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ id: DEFAULT_CALENDAR_ID, name: '我的日程', color: '#9387d1', visible: true }];
    }
    return parsed.map((item: Partial<ScheduleCalendar>, index: number) => ({
      id: typeof item.id === 'string' ? item.id : `cal-${index}`,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `日历 ${index + 1}`,
      color: typeof item.color === 'string' ? item.color : CALENDAR_COLORS[index % CALENDAR_COLORS.length],
      visible: item.visible !== false,
      laneId: typeof item.laneId === 'string' ? item.laneId : undefined,
    }));
  } catch {
    return [{ id: DEFAULT_CALENDAR_ID, name: '我的日程', color: '#9387d1', visible: true }];
  }
};

const CalendarSelect: React.FC<{
  calendars: ScheduleCalendar[];
  value: string;
  onChange: (calendarId: string) => void;
}> = ({ calendars, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = calendars.find((calendar) => calendar.id === value) || calendars[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-xs font-medium outline-none transition-colors ${
          open ? 'border-purple-300 ring-2 ring-purple-100' : 'border-neutral-200 hover:border-purple-200'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selected?.color || '#9387D1' }} />
        <span className="min-w-0 flex-1 truncate text-neutral-700">{selected?.name || '选择日历'}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute inset-x-0 top-10 z-40 max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl"
        >
          {calendars.map((calendar) => {
            const active = calendar.id === value;
            return (
              <button
                key={calendar.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(calendar.id);
                  setOpen(false);
                }}
                className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors ${
                  active
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: calendar.color }} />
                <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0 text-purple-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const DRAFT_POPOVER_WIDTH = 360;
const DRAFT_POPOVER_EST_HEIGHT = 340;
const DRAFT_POPOVER_GAP = 8;
const CALENDAR_EDITOR_WIDTH = 280;
const CALENDAR_EDITOR_EST_HEIGHT = 176;
const CREATE_DURATION_MS = 30 * 60_000;
const DRAG_THRESHOLD_PX = 4;

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
  activated: boolean;
  slot: DraftEvent['slot'];
};

const WEEKDAYS_SUN = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const HOUR_HEIGHT = 56;
const SNAP_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const CREATE_SLOT_HEIGHT = (CREATE_DURATION_MS / DAY_MS) * 24 * HOUR_HEIGHT;
const COLORS: Record<string, string> = {
  emerald: '#67c8bd',
  rose: '#d78fb5',
  sky: '#79bfd5',
  amber: '#d9b958',
  violet: '#9b8ae4',
  indigo: '#9387d1',
};

const placeDraftPopover = (slot: DraftEvent['slot']) => {
  const preferRight = slot.left + slot.width / 2 < window.innerWidth / 2;
  let left = preferRight
    ? slot.left + slot.width + DRAFT_POPOVER_GAP
    : slot.left - DRAFT_POPOVER_WIDTH - DRAFT_POPOVER_GAP;
  let top = slot.top;
  const maxLeft = Math.max(12, window.innerWidth - DRAFT_POPOVER_WIDTH - 12);
  const maxTop = Math.max(12, window.innerHeight - DRAFT_POPOVER_EST_HEIGHT - 12);
  left = Math.min(Math.max(12, left), maxLeft);
  top = Math.min(Math.max(12, top), maxTop);
  return { left, top, preferRight };
};

const pad = (value: number) => String(value).padStart(2, '0');
const startOfDay = (date: Date | number) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
};
const addDays = (timestamp: number, days: number) => timestamp + days * DAY_MS;
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
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
const formatRange = (start: number, end: number) => {
  if (sameDay(start, end)) return `${formatDateLabel(start)} ${formatTime(start)} – ${formatTime(end)}`;
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

const collectEvents = (items: TodoItem[], calendars: ScheduleCalendar[]): CalendarEvent[] => {
  const calendarById = new Map(calendars.map((calendar) => [calendar.id, calendar]));
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
      const range = getTaskBlockTimestamps(block, 1);
      const calendarId = item.calendarId && calendarById.has(item.calendarId) ? item.calendarId : DEFAULT_CALENDAR_ID;
      const calendar = calendarById.get(calendarId);
      events.push({
        itemId: item.id,
        blockId: block.id,
        title: item.text || '未命名日程',
        color: calendar?.color || eventColor(item.color),
        start: range.start,
        end: range.end,
        calendarId,
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
    .filter((event) => overlapsDay(event, day))
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
  onOpen: (slot: DraftEvent['slot']) => void;
  onDelete: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>, edge: DragState['edge'], slot: DraftEvent['slot']) => void;
}> = ({ event, style, compact, onOpen, onDelete, onPointerDown }) => {
  const measureSlot = (element: HTMLElement): DraftEvent['slot'] => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-event-chip
      onClick={(mouseEvent) => {
        mouseEvent.stopPropagation();
        onOpen(measureSlot(mouseEvent.currentTarget));
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          keyboardEvent.preventDefault();
          onOpen(measureSlot(keyboardEvent.currentTarget));
        }
      }}
      onPointerDown={onPointerDown ? (pointerEvent) => {
        pointerEvent.stopPropagation();
        onPointerDown(pointerEvent, 'move', measureSlot(pointerEvent.currentTarget));
      } : undefined}
      className="group absolute overflow-hidden rounded-md border px-1.5 text-left shadow-sm transition-shadow hover:shadow-md"
      style={{
        background: withAlpha(event.color, 0.18),
        borderColor: withAlpha(event.color, 0.45),
        color: event.color,
        ...style,
      }}
      title={`${event.title}\n${formatRange(event.start, event.end)}\n单击编辑`}
    >
      {onPointerDown ? (
        <>
          <span
            className="absolute inset-x-1 top-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            onPointerDown={(pointerEvent) => {
              pointerEvent.stopPropagation();
              onPointerDown(pointerEvent, 'start', measureSlot(pointerEvent.currentTarget.parentElement as HTMLElement));
            }}
          />
          <span
            className="absolute inset-x-1 bottom-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            onPointerDown={(pointerEvent) => {
              pointerEvent.stopPropagation();
              onPointerDown(pointerEvent, 'end', measureSlot(pointerEvent.currentTarget.parentElement as HTMLElement));
            }}
          />
        </>
      ) : null}
      <button
        type="button"
        onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
        onClick={(mouseEvent) => {
          mouseEvent.stopPropagation();
          onDelete();
        }}
        className="absolute right-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded text-rose-500 opacity-0 transition-opacity hover:bg-white/80 group-hover:opacity-100 focus-visible:opacity-100"
        title="删除日程"
        aria-label={`删除${event.title}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <div className={`truncate pr-5 font-semibold ${compact ? 'text-[10px] leading-4' : 'text-[11px] leading-4'}`}>
        {compact ? event.title : `${formatTime(event.start)} ${event.title}`}
      </div>
      {!compact && style && Number(style.height) > 36 ? (
        <div className="truncate text-[10px] opacity-80">{formatTime(event.end)}</div>
      ) : null}
    </div>
  );
};

const DayHourGrid: React.FC<{
  day: number;
  events: CalendarEvent[];
  now: number;
  onSlotCreate: (start: number, end: number, slot: DraftEvent['slot']) => void;
  onOpenEvent: (event: CalendarEvent, slot: DraftEvent['slot']) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  onBeginDrag: (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLDivElement>, edge: DragState['edge'], day: number, slot: DraftEvent['slot']) => void;
  dragPreview: DragState | null;
}> = ({ day, events, now, onSlotCreate, onOpenEvent, onDeleteEvent, onBeginDrag, dragPreview }) => {
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
  const showNow = sameDay(day, now);

  const yToTime = (clientY: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return day + 9 * 60 * 60_000;
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top + (bodyRef.current?.scrollTop || 0)));
    return snap(day + (y / (24 * HOUR_HEIGHT)) * DAY_MS);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div ref={bodyRef} className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="absolute inset-x-0 border-t border-neutral-100" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 left-2 text-[10px] font-medium text-neutral-300">{pad(hour)}:00</span>
            </div>
          ))}
          <div
            className="absolute inset-0 left-12 cursor-crosshair"
            onClick={(mouseEvent) => {
              if ((mouseEvent.target as HTMLElement).closest('[data-event-chip]')) return;
              const start = yToTime(mouseEvent.clientY);
              const end = Math.min(start + CREATE_DURATION_MS, addDays(day, 1));
              const overlayRect = (mouseEvent.currentTarget as HTMLDivElement).getBoundingClientRect();
              const topInColumn = ((start - day) / DAY_MS) * 24 * HOUR_HEIGHT;
              const height = Math.max(18, ((end - start) / DAY_MS) * 24 * HOUR_HEIGHT);
              onSlotCreate(start, end, {
                left: overlayRect.left + 2,
                top: overlayRect.top + topInColumn,
                width: Math.max(48, overlayRect.width - 4),
                height,
              });
            }}
          />
          {layout.map((event) => (
            <div key={`${event.itemId}-${event.blockId}`} data-event-chip className="absolute left-12 right-1" style={{ top: event.top, height: event.height, marginLeft: `${(event.column / event.totalColumns) * 100}%`, width: `calc(${100 / event.totalColumns}% - 4px)` }}>
              <EventChip
                event={event}
                style={{ inset: 0, position: 'absolute' }}
                onOpen={(slot) => onOpenEvent(event, slot)}
                onDelete={() => onDeleteEvent(event)}
                onPointerDown={(pointerEvent, edge, slot) => onBeginDrag(event, pointerEvent, edge, day, slot)}
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
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const todoLanes = useAppStore((state) => state.todoLanes);
  const addTodoLane = useAppStore((state) => state.addTodoLane);
  const renameTodoLane = useAppStore((state) => state.renameTodoLane);

  const [view, setView] = useState<ScheduleView>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [miniCursor, setMiniCursor] = useState(() => startOfDay(Date.now()));
  const [calendars, setCalendars] = useState<ScheduleCalendar[]>(() => loadCalendars());
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [calendarEditorAnchor, setCalendarEditorAnchor] = useState<DraftEvent['slot'] | null>(null);
  const [calendarEditName, setCalendarEditName] = useState('');
  const [calendarEditColor, setCalendarEditColor] = useState('#9387D1');
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [selectedKey, setSelectedKey] = useState<{ itemId: string; blockId: string } | null>(null);
  const [editSlot, setEditSlot] = useState<DraftEvent['slot'] | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editCalendarId, setEditCalendarId] = useState(DEFAULT_CALENDAR_ID);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const provisioningCalendarLanesRef = useRef(new Set<string>());
  const [dragPreview, setDragPreview] = useState<DragState | null>(null);
  const now = Date.now();

  const defaultCalendarId = calendars[0]?.id || DEFAULT_CALENDAR_ID;
  const visibleCalendarIds = useMemo(
    () => new Set(calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id)),
    [calendars],
  );
  const allEvents = useMemo(() => collectEvents(todoItems, calendars), [todoItems, calendars]);
  const events = useMemo(
    () => allEvents.filter((event) => visibleCalendarIds.has(event.calendarId)),
    [allEvents, visibleCalendarIds],
  );
  const eventCountByCalendar = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of allEvents) {
      counts.set(event.calendarId, (counts.get(event.calendarId) || 0) + 1);
    }
    return counts;
  }, [allEvents]);
  const selected = useMemo(
    () => (selectedKey ? allEvents.find((event) => event.itemId === selectedKey.itemId && event.blockId === selectedKey.blockId) || null : null),
    [allEvents, selectedKey],
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
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendars));
  }, [calendars]);

  useEffect(() => {
    const existingLaneIds = new Set(todoLanes.map((lane) => lane.id));
    const claimedLaneIds = new Set(calendars.flatMap((calendar) => calendar.laneId ? [calendar.laneId] : []));
    const calendar = calendars.find((item) => !item.laneId || !existingLaneIds.has(item.laneId));
    if (!calendar || provisioningCalendarLanesRef.current.has(calendar.id)) return;
    provisioningCalendarLanesRef.current.add(calendar.id);
    const reusableLane = todoLanes.find((lane) => (
      lane.type === 'custom'
      && lane.name === calendar.name
      && !claimedLaneIds.has(lane.id)
    ));
    const laneId = reusableLane?.id || addTodoLane(calendar.name);
    setCalendars((current) => current.map((item) => (
      item.id === calendar.id ? { ...item, laneId } : item
    )));
  }, [addTodoLane, calendars, todoLanes]);

  useEffect(() => {
    const laneByCalendarId = new Map<string, string>(calendars.flatMap((calendar) => (
      calendar.laneId ? [[calendar.id, calendar.laneId] as const] : []
    )));
    const calendarLaneIds = new Set(laneByCalendarId.values());
    todoItems.forEach((item) => {
      if (!item.calendarId) return;
      const laneId = laneByCalendarId.get(item.calendarId);
      if (!laneId) return;
      const referencedLaneIds = (item.referencedLaneIds || []).filter((id) => (
        id !== 'todo-main' && !calendarLaneIds.has(id)
      ));
      const referencesChanged = referencedLaneIds.length !== (item.referencedLaneIds || []).length;
      if (item.laneId === laneId && !referencesChanged) return;
      updateTodoItem(item.id, {
        laneId,
        referencedLaneIds: referencedLaneIds.length > 0 ? referencedLaneIds : undefined,
      });
    });
  }, [calendars, todoItems, updateTodoItem]);

  useEffect(() => {
    if (!selectedKey) {
      setEditSlot(null);
      return;
    }
    if (!selected) {
      setSelectedKey(null);
      setEditSlot(null);
      return;
    }
    setEditTitle(selected.title === '未命名日程' ? '' : selected.title);
    setEditStart(formatLocalDateTime(selected.start));
    setEditEnd(formatLocalDateTime(selected.end));
    setEditCalendarId(selected.calendarId);
  }, [selected, selectedKey]);

  const openEvent = (event: CalendarEvent, slot: DraftEvent['slot']) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setDraft(null);
    setEditSlot(slot);
    setSelectedKey({ itemId: event.itemId, blockId: event.blockId });
  };
  const closeEvent = () => {
    setSelectedKey(null);
    setEditSlot(null);
  };

  const commitNewCalendar = () => {
    const name = newCalendarName.trim() || `日历 ${calendars.length + 1}`;
    const laneId = addTodoLane(name);
    setCalendars((current) => [
      ...current,
      {
        id: `cal-${Date.now().toString(36)}`,
        name,
        color: CALENDAR_COLORS[current.length % CALENDAR_COLORS.length],
        visible: true,
        laneId,
      },
    ]);
    setNewCalendarName('');
    setCreatingCalendar(false);
  };

  const openCalendarEditor = (calendar: ScheduleCalendar, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    setCreatingCalendar(false);
    setEditingCalendarId(calendar.id);
    setCalendarEditorAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setCalendarEditName(calendar.name);
    setCalendarEditColor(calendar.color);
  };

  const closeCalendarEditor = () => {
    setEditingCalendarId(null);
    setCalendarEditorAnchor(null);
  };

  const commitCalendarEdit = () => {
    if (!editingCalendarId) return;
    const currentCalendar = calendars.find((calendar) => calendar.id === editingCalendarId);
    const nextName = calendarEditName.trim() || currentCalendar?.name || '未命名日历';
    if (currentCalendar?.laneId) renameTodoLane(currentCalendar.laneId, nextName);
    setCalendars((current) => current.map((calendar) => (
      calendar.id === editingCalendarId
        ? {
            ...calendar,
            name: nextName,
            color: calendarEditColor,
          }
        : calendar
    )));
    closeCalendarEditor();
  };

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

  const openCreate = (start: number, end: number, slot?: DraftEvent['slot']) => {
    closeEvent();
    const fallbackSlot = {
      left: window.innerWidth / 2 - 80,
      top: window.innerHeight / 3,
      width: 160,
      height: CREATE_SLOT_HEIGHT,
    };
    const preferredCalendar = calendars.find((calendar) => calendar.visible)?.id || defaultCalendarId;
    setDraft({
      start,
      end: clampDuration(start, end),
      title: '',
      calendarId: preferredCalendar,
      slot: slot || fallbackSlot,
    });
  };

  const commitDraft = () => {
    if (!draft) return;
    const calendar = calendars.find((item) => item.id === draft.calendarId);
    const itemId = createTodoItem(calendar?.laneId || 'todo-main', draft.title.trim() || '新日程');
    if (!itemId) return;
    updateTodoItem(itemId, {
      calendarId: draft.calendarId,
      color: calendar?.color || undefined,
    });
    addTodoTimeBlock(itemId, {
      startTime: formatLocalDateTime(draft.start),
      endTime: formatLocalDateTime(draft.end),
    });
    setDraft(null);
  };

  const saveSelected = () => {
    if (!selected) return;
    const calendar = calendars.find((item) => item.id === editCalendarId);
    const item = todoItems.find((candidate) => candidate.id === selected.itemId);
    const calendarLaneIds = new Set(calendars.flatMap((entry) => entry.laneId ? [entry.laneId] : []));
    const referencedLaneIds = (item?.referencedLaneIds || []).filter((id) => (
      id !== 'todo-main' && !calendarLaneIds.has(id)
    ));
    updateTodoItem(selected.itemId, {
      text: editTitle.trim(),
      calendarId: editCalendarId,
      color: calendar?.color || undefined,
      laneId: calendar?.laneId || item?.laneId || 'todo-main',
      referencedLaneIds: referencedLaneIds.length > 0 ? referencedLaneIds : undefined,
    });
    const startMs = parseTaskTime(editStart);
    const endMs = clampDuration(startMs, parseTaskTime(editEnd, true));
    updateTodoTimeBlock(selected.itemId, selected.blockId, {
      startTime: formatLocalDateTime(startMs),
      endTime: formatLocalDateTime(endMs),
    });
    closeEvent();
  };

  const deleteEvent = (event: CalendarEvent) => {
    const item = todoItems.find((candidate) => candidate.id === event.itemId);
    const blocks = item?.timeBlocks || [];
    if (blocks.length <= 1 && !(item?.text || '').trim()) removeTodoItem(event.itemId);
    else removeTodoTimeBlock(event.itemId, event.blockId);
    if (selectedKey?.itemId === event.itemId && selectedKey.blockId === event.blockId) closeEvent();
  };

  const onBeginDrag = (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLDivElement>, edge: DragState['edge'], day: number, slot: DraftEvent['slot']) => {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    (pointerEvent.currentTarget as HTMLElement).setPointerCapture?.(pointerEvent.pointerId);
    const activated = edge !== 'move';
    if (activated) {
      beginHistoryGroup();
      suppressClickRef.current = true;
    }
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
      activated,
      slot,
    };
    dragRef.current = next;
    if (activated) setDragPreview(next);
  };

  useEffect(() => {
    const onMove = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
      if (!drag.activated) {
        if (Math.abs(pointerEvent.clientY - drag.originY) < DRAG_THRESHOLD_PX) return;
        beginHistoryGroup();
        drag.activated = true;
        suppressClickRef.current = true;
      }
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
      const next = { ...drag, previewStart, previewEnd, activated: true };
      dragRef.current = next;
      setDragPreview(next);
    };
    const onUp = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || pointerEvent.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setDragPreview(null);
      if (!drag.activated) return;
      updateTodoTimeBlock(drag.itemId, drag.blockId, {
        startTime: formatLocalDateTime(drag.previewStart),
        endTime: formatLocalDateTime(drag.previewEnd),
      });
      endHistoryGroup();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [beginHistoryGroup, endHistoryGroup, updateTodoTimeBlock]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-50">
      <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-neutral-50/80 p-4">
        <MiniMonth
          cursor={miniCursor}
          selected={anchor}
          onSelect={(day) => { setAnchor(day); setMiniCursor(day); if (view === 'month') setView('day'); }}
          onCursorChange={setMiniCursor}
          eventDays={eventDays}
        />
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold tracking-wide text-neutral-400 uppercase">日历</div>
            <button
              type="button"
              onClick={() => {
                closeCalendarEditor();
                setCreatingCalendar(true);
                setNewCalendarName('');
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-purple-600 transition-colors hover:bg-purple-50"
            >
              <Plus className="h-3 w-3" />
              创建日历
            </button>
          </div>
          <div className="space-y-1">
            {calendars.map((calendar) => (
              <div key={calendar.id} data-calendar-row className="group flex items-center gap-2 rounded-md px-1 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                <button
                  type="button"
                  onClick={() => setCalendars((current) => current.map((item) => item.id === calendar.id ? { ...item, visible: !item.visible } : item))}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border"
                  style={{
                    background: calendar.visible ? calendar.color : 'transparent',
                    borderColor: calendar.color,
                  }}
                  aria-label={calendar.visible ? `隐藏${calendar.name}` : `显示${calendar.name}`}
                >
                  {calendar.visible ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                </button>
                <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                <span className="relative h-6 w-6 shrink-0">
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-400 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                    {eventCountByCalendar.get(calendar.id) || 0}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      const row = event.currentTarget.closest('[data-calendar-row]') as HTMLElement | null;
                      if (row) openCalendarEditor(calendar, row);
                    }}
                    className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
                      editingCalendarId === calendar.id
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'
                    }`}
                    title={`编辑${calendar.name}`}
                    aria-label={`编辑${calendar.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </span>
              </div>
            ))}
          </div>
          {creatingCalendar ? (
            <div className="mt-2 space-y-2 rounded-lg border border-purple-100 bg-purple-50/50 p-2">
              <input
                autoFocus
                value={newCalendarName}
                onChange={(event) => setNewCalendarName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitNewCalendar();
                  if (event.key === 'Escape') setCreatingCalendar(false);
                }}
                placeholder="日历名称"
                className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-purple-300"
              />
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setCreatingCalendar(false)} className="h-7 rounded-md px-2 text-[11px] font-semibold text-neutral-500 hover:bg-white">取消</button>
                <button type="button" onClick={commitNewCalendar} className="h-7 rounded-md bg-purple-600 px-2.5 text-[11px] font-semibold text-white hover:bg-purple-700">创建</button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {editingCalendarId && calendarEditorAnchor ? (() => {
        const left = Math.min(
          calendarEditorAnchor.left + calendarEditorAnchor.width + 8,
          window.innerWidth - CALENDAR_EDITOR_WIDTH - 12,
        );
        const top = Math.min(
          Math.max(12, calendarEditorAnchor.top),
          window.innerHeight - CALENDAR_EDITOR_EST_HEIGHT - 12,
        );
        return (
          <div className="fixed inset-0 z-50" onClick={closeCalendarEditor}>
            <div
              className="absolute w-[280px] space-y-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
              style={{ left: Math.max(12, left), top }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700">编辑日历</span>
                <button type="button" onClick={closeCalendarEditor} className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100" aria-label="关闭">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                autoFocus
                value={calendarEditName}
                onChange={(event) => setCalendarEditName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitCalendarEdit();
                  if (event.key === 'Escape') closeCalendarEditor();
                }}
                placeholder="日历名称"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <ColorPicker
                value={calendarEditColor}
                label="日历颜色"
                onChange={setCalendarEditColor}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeCalendarEditor} className="h-8 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">取消</button>
                <button type="button" onClick={commitCalendarEdit} className="h-8 rounded-lg bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-700">保存</button>
              </div>
            </div>
          </div>
        );
      })() : null}

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
            onSlotCreate={(start, end, slot) => openCreate(start, end, slot)}
            onOpenEvent={openEvent}
            onDeleteEvent={deleteEvent}
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
                      onClick={(mouseEvent) => {
                        if ((mouseEvent.target as HTMLElement).closest('[data-event-chip]')) return;
                        const column = mouseEvent.currentTarget as HTMLDivElement;
                        const columnRect = column.getBoundingClientRect();
                        const y = mouseEvent.clientY - columnRect.top;
                        const start = snap(day + (y / (24 * HOUR_HEIGHT)) * DAY_MS);
                        const end = Math.min(start + CREATE_DURATION_MS, addDays(day, 1));
                        const topInColumn = ((start - day) / DAY_MS) * 24 * HOUR_HEIGHT;
                        const height = Math.max(18, ((end - start) / DAY_MS) * 24 * HOUR_HEIGHT);
                        openCreate(start, end, {
                          left: columnRect.left + 4,
                          top: columnRect.top + topInColumn,
                          width: Math.max(40, columnRect.width - 8),
                          height,
                        });
                      }}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div key={hour} className="absolute inset-x-0 border-t border-neutral-50" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
                      ))}
                      {layout.map((event) => (
                        <div key={`${event.itemId}-${event.blockId}`} data-event-chip>
                          <EventChip
                            event={event}
                            style={{ top: event.top, height: event.height, left: 4, right: 4 }}
                            onOpen={(slot) => openEvent(event, slot)}
                            onDelete={() => deleteEvent(event)}
                            onPointerDown={(pointerEvent, edge, slot) => onBeginDrag(event, pointerEvent, edge, day, slot)}
                          />
                        </div>
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
                    onClick={(mouseEvent) => {
                      if ((mouseEvent.target as HTMLElement).closest('button')) return;
                      const cell = mouseEvent.currentTarget as HTMLDivElement;
                      const rect = cell.getBoundingClientRect();
                      openCreate(day + 9 * 60 * 60_000, day + 9 * 60 * 60_000 + CREATE_DURATION_MS, {
                        left: rect.left + 6,
                        top: Math.min(mouseEvent.clientY - 12, rect.bottom - 28),
                        width: Math.max(48, rect.width - 12),
                        height: 24,
                      });
                    }}
                  >
                    <button
                      type="button"
                      onClick={(mouseEvent) => { mouseEvent.stopPropagation(); setAnchor(day); setView('day'); }}
                      className={`mb-1 flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
                        isToday ? 'bg-purple-600 text-white' : inMonth ? 'text-neutral-700 hover:bg-neutral-100' : 'text-neutral-300'
                      }`}
                    >
                      {new Date(day).getDate()}
                    </button>
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                      {dayEvents.map((event) => (
                        <div key={`${event.itemId}-${event.blockId}`} className="group relative">
                          <button
                            type="button"
                            onClick={(mouseEvent) => {
                              mouseEvent.stopPropagation();
                              const rect = (mouseEvent.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              openEvent(event, { left: rect.left, top: rect.top, width: rect.width, height: Math.max(24, rect.height) });
                            }}
                            className="block w-full truncate rounded py-0.5 pl-1 pr-6 text-left text-[10px] font-semibold"
                            style={{ background: withAlpha(event.color, 0.18), color: event.color }}
                            title="单击编辑"
                          >
                            {`${formatTime(event.start)} ${event.title}`}
                          </button>
                          <button
                            type="button"
                            onClick={(mouseEvent) => {
                              mouseEvent.stopPropagation();
                              deleteEvent(event);
                            }}
                            className="absolute right-0.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-rose-500 opacity-0 transition-opacity hover:bg-white/80 group-hover:opacity-100 focus-visible:opacity-100"
                            title="删除日程"
                            aria-label={`删除${event.title}`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
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

      {draft ? (() => {
        const popover = placeDraftPopover(draft.slot);
        return (
          <div className="fixed inset-0 z-50" onClick={() => setDraft(null)}>
            <div
              className="pointer-events-none absolute rounded-md border-2 border-dashed border-purple-400 bg-purple-100/40"
              style={{
                left: draft.slot.left,
                top: draft.slot.top,
                width: draft.slot.width,
                height: draft.slot.height,
              }}
            >
              <div className="truncate px-1.5 pt-0.5 text-[10px] font-semibold text-purple-600">
                {formatTime(draft.start)} – {formatTime(draft.end)}
              </div>
            </div>
            <div
              className="absolute w-[360px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
              style={{ left: popover.left, top: popover.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-800">创建日程</h2>
                <button type="button" onClick={() => setDraft(null)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"><X className="h-4 w-4" /></button>
              </div>
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                onKeyDown={(event) => { if (event.key === 'Enter') commitDraft(); }}
                placeholder="添加标题"
                className="mb-3 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mb-3 flex items-center gap-2">
                <DateTimePicker
                  compact
                  className="min-w-0 flex-1"
                  value={formatLocalDateTime(draft.start)}
                  onChange={(value) => {
                    const start = parseTaskTime(value);
                    const end = Math.max(draft.end, start + SNAP_MS);
                    setDraft({ ...draft, start, end });
                  }}
                />
                <span className="shrink-0 text-xs font-semibold text-neutral-300">–</span>
                <DateTimePicker
                  compact
                  className="min-w-0 flex-1"
                  value={formatLocalDateTime(draft.end)}
                  onChange={(value) => {
                    const end = parseTaskTime(value, true);
                    setDraft({ ...draft, end: Math.max(end, draft.start + SNAP_MS) });
                  }}
                />
              </div>
              <div className="mb-4 space-y-1">
                <span className="text-[11px] font-bold text-neutral-400">归属日历</span>
                <CalendarSelect
                  calendars={calendars}
                  value={draft.calendarId}
                  onChange={(calendarId) => setDraft({ ...draft, calendarId })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDraft(null)} className="h-8 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">取消</button>
                <button type="button" onClick={commitDraft} className="h-8 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700">创建</button>
              </div>
            </div>
          </div>
        );
      })() : null}

      {selected && editSlot ? (() => {
        const popover = placeDraftPopover(editSlot);
        return (
          <div className="fixed inset-0 z-50" onClick={closeEvent}>
            <div
              className="pointer-events-none absolute rounded-md border-2 border-purple-400 bg-purple-100/25"
              style={{ left: editSlot.left, top: editSlot.top, width: editSlot.width, height: editSlot.height }}
            />
            <div
              className="absolute w-[360px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
              style={{ left: popover.left, top: popover.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-800">编辑日程</h2>
                <button type="button" onClick={closeEvent} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"><X className="h-4 w-4" /></button>
              </div>
              <input
                autoFocus
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') saveSelected(); }}
                placeholder="添加标题"
                className="mb-3 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm font-medium outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <DateTimePicker compact className="min-w-0 flex-1" value={editStart} onChange={setEditStart} />
                  <span className="shrink-0 text-xs font-semibold text-neutral-300">–</span>
                  <DateTimePicker compact className="min-w-0 flex-1" value={editEnd} onChange={setEditEnd} />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-neutral-400">归属日历</span>
                  <CalendarSelect
                    calendars={calendars}
                    value={editCalendarId}
                    onChange={setEditCalendarId}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeEvent} className="h-8 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">取消</button>
                <button type="button" onClick={saveSelected} className="h-8 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700">保存</button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
};
