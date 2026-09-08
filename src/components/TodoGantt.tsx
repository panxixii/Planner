import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, Folder, LocateFixed, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { formatLocalDateTime, parseTaskTime } from '../taskTimeBlocks';
import type { TaskTimeBlock, TodoLane } from '../types';
import { TodoItemToolbarHost } from './TodoItemToolbar';
import { useTapClick } from './useTapClick';
import type { TodoItem } from '../types';

type TodoGanttItem = TodoItem;

type Scale = 'minutes' | 'hours' | 'days';
type DragState = {
  pointerId: number;
  itemId: string;
  blockId: string;
  edge: 'start' | 'end' | 'move';
  startX: number;
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
};

const LEFT_WIDTH = 240;
const COLUMNS = 360;
const scales = {
  minutes: { unitMs: 5 * 60_000, width: 58, snapMs: 60_000 },
  hours: { unitMs: 60 * 60_000, width: 64, snapMs: 15 * 60_000 },
  days: { unitMs: 24 * 60 * 60_000, width: 82, snapMs: 60 * 60_000 },
};
const colors: Record<string, string> = { emerald: '#67c8bd', rose: '#d78fb5', sky: '#79bfd5', amber: '#d9b958', violet: '#9b8ae4', indigo: '#9387d1' };
const align = (timestamp: number, unitMs: number) => Math.floor(timestamp / unitMs) * unitMs;
const labelFor = (timestamp: number, scale: Scale) => {
  const date = new Date(timestamp);
  if (scale === 'days') return { main: `${date.getMonth() + 1}/${date.getDate()}`, sub: `周${'日一二三四五六'[date.getDay()]}` };
  const minutes = scale === 'hours' ? '00' : String(date.getMinutes()).padStart(2, '0');
  return { main: `${String(date.getHours()).padStart(2, '0')}:${minutes}`, sub: date.getHours() === 0 && date.getMinutes() === 0 ? `${date.getMonth() + 1}/${date.getDate()}` : '' };
};
const durationLabel = (start: number, end: number) => {
  const hours = Math.max(1 / 60, (end - start) / 3_600_000);
  return hours < 24 ? `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h` : `${(hours / 24).toFixed(hours % 24 === 0 ? 0 : 1)}d`;
};

const GanttTaskLabel: React.FC<{
  item: TodoGanttItem;
  onToggle: () => void;
  onOpenToolbar: (el: HTMLElement) => void;
}> = ({ item, onToggle, onOpenToolbar }) => {
  const { handleClick } = useTapClick((element) => onOpenToolbar(element));
  return (
    <div
      className="sticky left-0 z-20 flex shrink-0 cursor-default items-center gap-2 border-r border-neutral-200 bg-white px-4"
      style={{ width: LEFT_WIDTH }}
      onClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; handleClick(event); }}
      title="单击显示操作"
    >
      <button type="button" onClick={onToggle} className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border ${item.isDone ? 'border-neutral-500 bg-neutral-500 text-white' : 'border-neutral-300 text-transparent'}`}><Check className="h-3 w-3" /></button>
      {item.isDirectory ? <Folder className="h-3.5 w-3.5 shrink-0 text-purple-400" /> : null}
      <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${item.isDone ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>{item.text || '未命名待办'}</span>
    </div>
  );
};

const GanttTimeBlock: React.FC<{
  item: TodoGanttItem;
  left: number;
  width: number;
  color: string;
  previewStart: number;
  previewEnd: number;
  isDone: boolean;
  onBeginDrag: (event: React.PointerEvent<HTMLDivElement>, edge: DragState['edge']) => void;
  onMoveDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onEndDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}> = ({ item, left, width, color, previewStart, previewEnd, isDone, onBeginDrag, onMoveDrag, onEndDrag, onRemove }) => {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div
      onPointerDown={(event) => onBeginDrag(event, 'move')}
      onPointerMove={onMoveDrag}
      onPointerUp={onEndDrag}
      onPointerCancel={onEndDrag}
      className={`group absolute z-10 flex h-7 touch-none cursor-grab items-center rounded-md border px-2 text-[10px] font-semibold text-white shadow-sm active:cursor-grabbing ${isDone ? 'opacity-50 line-through grayscale' : ''}`}
      style={{ left, width, backgroundColor: color, borderColor: color }}
      title="拖动移动；拖动两端调整"
    >
      <div onPointerDown={(event) => onBeginDrag(event, 'start')} onPointerMove={onMoveDrag} onPointerUp={onEndDrag} onPointerCancel={onEndDrag} className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize rounded-l-md bg-white/25 opacity-0 group-hover:opacity-100" />
      <span className="pointer-events-none min-w-0 flex-1 truncate">{item.text}</span>
      {width > 80 ? <span className="pointer-events-none ml-1 flex items-center gap-0.5 opacity-80"><Clock3 className="h-2.5 w-2.5" />{durationLabel(previewStart, previewEnd)}</span> : null}
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (confirmRemove) { onRemove(); return; }
          setConfirmRemove(true);
        }}
        className={`absolute -right-2 -top-2 flex h-5 items-center justify-center rounded-full border px-1.5 text-[9px] font-bold shadow-sm transition-all ${confirmRemove ? 'border-rose-500 bg-rose-600 text-white opacity-100' : 'w-5 border-rose-200 bg-white text-rose-500 opacity-0 group-hover:opacity-100'}`}
        title={confirmRemove ? '再次点击确认删除' : '删除时间块'}
      >{confirmRemove ? '确认' : <Trash2 className="h-3 w-3" />}</button>
      <div onPointerDown={(event) => onBeginDrag(event, 'end')} onPointerMove={onMoveDrag} onPointerUp={onEndDrag} onPointerCancel={onEndDrag} className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize rounded-r-md bg-white/25 opacity-0 group-hover:opacity-100" />
    </div>
  );
};

export const TodoGantt: React.FC<{ lane: TodoLane }> = ({ lane }) => {
  const allItems = useAppStore((state) => state.todoItems);
  const createItem = useAppStore((state) => state.createTodoItem);
  const toggleItem = useAppStore((state) => state.toggleTodoItemDone);
  const addBlock = useAppStore((state) => state.addTodoTimeBlock);
  const updateBlock = useAppStore((state) => state.updateTodoTimeBlock);
  const removeBlock = useAppStore((state) => state.removeTodoTimeBlock);
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id).sort((a, b) => a.order - b.order), [allItems, lane.id]);
  const initialFocus = useMemo(() => {
    const first = items.flatMap((item) => item.timeBlocks || []).map((block) => parseTaskTime(block.startTime)).find(Number.isFinite);
    return first || Date.now();
  }, []);
  const [scale, setScale] = useState<Scale>('days');
  const definition = scales[scale];
  const [toolbar, setToolbar] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [rangeStart, setRangeStart] = useState(() => align(initialFocus, scales.days.unitMs) - 30 * scales.days.unitMs);
  const [preview, setPreview] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<number | null>(initialFocus);
  const timelineWidth = COLUMNS * definition.width;
  const rangeEnd = rangeStart + COLUMNS * definition.unitMs;
  const now = Date.now();

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || pendingFocusRef.current === null) return;
    const left = ((pendingFocusRef.current - rangeStart) / definition.unitMs) * definition.width;
    container.scrollLeft = Math.max(0, left - Math.max(0, container.clientWidth - LEFT_WIDTH) / 2);
    pendingFocusRef.current = null;
  }, [definition.unitMs, definition.width, rangeStart, scale]);

  const changeScale = (nextScale: Scale) => {
    const focus = pendingFocusRef.current ?? Date.now();
    pendingFocusRef.current = focus;
    setScale(nextScale);
    setRangeStart(align(focus, scales[nextScale].unitMs) - 30 * scales[nextScale].unitMs);
  };

  const headers = useMemo(() => Array.from({ length: COLUMNS }, (_, index) => {
    const timestamp = rangeStart + index * definition.unitMs;
    return { timestamp, ...labelFor(timestamp, scale) };
  }), [definition.unitMs, rangeStart, scale]);
  const background = `repeating-linear-gradient(to right, transparent 0, transparent ${definition.width - 1}px, rgba(148,163,184,.18) ${definition.width - 1}px, rgba(148,163,184,.18) ${definition.width}px)`;

  const focusToday = () => {
    const next = align(Date.now(), definition.unitMs) - 30 * definition.unitMs;
    pendingFocusRef.current = Date.now();
    setRangeStart(next);
  };
  const addAt = (itemId: string, timestamp: number) => {
    const start = Math.round(timestamp / definition.snapMs) * definition.snapMs;
    const duration = scale === 'days' ? 24 * 60 * 60_000 : 2 * 60 * 60_000;
    addBlock(itemId, { startTime: formatLocalDateTime(start), endTime: formatLocalDateTime(start + duration) });
  };
  const timestampAtEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rangeStart + ((event.clientX - rect.left) / definition.width) * definition.unitMs;
  };
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, itemId: string, block: TaskTimeBlock, edge: DragState['edge']) => {
    event.preventDefault();
    event.stopPropagation();
    const originalStart = parseTaskTime(block.startTime);
    const originalEnd = parseTaskTime(block.endTime);
    if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const state = { pointerId: event.pointerId, itemId, blockId: block.id, edge, startX: event.clientX, originalStart, originalEnd, previewStart: originalStart, previewEnd: originalEnd };
    dragRef.current = state;
    setPreview(state);
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rawDelta = ((event.clientX - current.startX) / definition.width) * definition.unitMs;
    const delta = Math.round(rawDelta / definition.snapMs) * definition.snapMs;
    let previewStart = current.originalStart;
    let previewEnd = current.originalEnd;
    if (current.edge === 'move') { previewStart += delta; previewEnd += delta; }
    else if (current.edge === 'start') previewStart = Math.min(current.originalStart + delta, current.originalEnd - definition.snapMs);
    else previewEnd = Math.max(current.originalEnd + delta, current.originalStart + definition.snapMs);
    const next = { ...current, previewStart, previewEnd };
    dragRef.current = next;
    setPreview(next);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    updateBlock(current.itemId, current.blockId, { startTime: formatLocalDateTime(current.previewStart), endTime: formatLocalDateTime(current.previewEnd) });
    dragRef.current = null;
    setPreview(null);
  };

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
      <div className="flex items-center gap-2 text-xs font-bold text-neutral-700"><CalendarDays className="h-4 w-4 text-purple-500" />{lane.name} · 甘特图</div>
      <div className="flex items-center gap-2"><div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">{(['minutes', 'hours', 'days'] as Scale[]).map((value) => <button key={value} type="button" onClick={() => changeScale(value)} className={`h-7 rounded-md px-2.5 text-[11px] font-semibold ${scale === value ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-400'}`}>{value === 'minutes' ? '分钟' : value === 'hours' ? '小时' : '天'}</button>)}</div><button type="button" onClick={focusToday} className="flex h-8 items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-[11px] font-semibold text-purple-600"><LocateFixed className="h-3.5 w-3.5" />今天</button></div>
    </div>
    <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-auto">
      <div className="min-w-max" style={{ '--todo-column-width': `${LEFT_WIDTH}px` } as React.CSSProperties}>
        <div className="sticky top-0 z-30 flex h-12 border-b border-neutral-200 bg-white">
          <div className="sticky left-0 z-40 flex shrink-0 items-center border-r border-neutral-200 bg-white px-4 text-[11px] font-bold text-neutral-500" style={{ width: LEFT_WIDTH }}>待办</div>
          <div className="flex shrink-0" style={{ width: timelineWidth }}>{headers.map((header) => <div key={header.timestamp} className="flex shrink-0 flex-col items-center justify-center border-r border-neutral-100 text-[10px] text-neutral-500" style={{ width: definition.width }}><span className="font-semibold">{header.main}</span><span className="text-[9px] text-neutral-300">{header.sub}</span></div>)}</div>
        </div>
        {items.map((item) => <div key={item.id} className="flex h-[52px] border-b border-neutral-100 hover:bg-neutral-50/50">
          <GanttTaskLabel item={item} onToggle={() => toggleItem(item.id)} onOpenToolbar={(el) => setToolbar((current) => current?.id === item.id ? null : { id: item.id, el })} />
          <div onDoubleClick={(event) => addAt(item.id, timestampAtEvent(event))} className="relative flex shrink-0 items-center" style={{ width: timelineWidth, backgroundImage: background }} title="双击添加时间块">
            {now >= rangeStart && now < rangeEnd ? <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400" style={{ left: ((now - rangeStart) / definition.unitMs) * definition.width }} /> : null}
            {(item.timeBlocks || []).map((block) => {
              const active = preview?.itemId === item.id && preview.blockId === block.id ? preview : null;
              const start = active?.previewStart ?? parseTaskTime(block.startTime);
              const end = active?.previewEnd ?? parseTaskTime(block.endTime);
              if (!Number.isFinite(start) || !Number.isFinite(end) || start >= rangeEnd || end <= rangeStart) return null;
              const left = ((Math.max(start, rangeStart) - rangeStart) / definition.unitMs) * definition.width;
              const width = Math.max(5, ((Math.min(end, rangeEnd) - Math.max(start, rangeStart)) / definition.unitMs) * definition.width);
              const color = colors[item.color || ''] || item.color || colors.indigo;
              return <GanttTimeBlock key={block.id} item={item} left={left} width={width} color={color} previewStart={start} previewEnd={end} isDone={item.isDone} onBeginDrag={(event, edge) => beginDrag(event, item.id, block, edge)} onMoveDrag={moveDrag} onEndDrag={endDrag} onRemove={() => removeBlock(item.id, block.id)} />;
            })}
          </div>
        </div>)}
        <div className="flex h-[52px] border-b border-neutral-100 bg-neutral-50/30"><div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-neutral-200 bg-neutral-50 px-5 text-[11px] font-semibold text-neutral-400" style={{ width: LEFT_WIDTH }}><Plus className="h-3.5 w-3.5" />新待办</div><div onDoubleClick={(event) => { const timestamp = timestampAtEvent(event); const itemId = createItem(lane.id, '新待办'); if (itemId) addAt(itemId, timestamp); }} className="relative shrink-0 cursor-crosshair" style={{ width: timelineWidth, backgroundImage: background }} title="双击创建带时间的待办" /></div>
      </div>
    </div>
    {toolbar ? <TodoItemToolbarHost itemId={toolbar.id} open anchor={toolbar.el} onClose={() => setToolbar(null)} /> : null}
  </div>;
};
