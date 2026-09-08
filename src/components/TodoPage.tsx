import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionLineType,
  Edge,
  Handle,
  Node,
  NodeChange,
  NodeProps,
  NodeResizer,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, CalendarDays, Check, CircleDot, Columns3, GitBranch, List, Maximize, MousePointer2, Pipette, Plus, Scan, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoItem, TodoLane, TodoLaneSection } from '../types';
import { TodoBoard } from './TodoBoard';
import { TodoGantt } from './TodoGantt';
import { TodoItemToolbarHost } from './TodoItemToolbar';
import { useTapClick } from './useTapClick';
import { createPortal } from 'react-dom';

const visibleLane = (lane: TodoLane) => lane.id === 'todo-main' || lane.type === 'custom';

const TodoCheckbox: React.FC<{ done: boolean; onClick: () => void }> = ({ done, onClick }) => (
  <button type="button" onClick={onClick} className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${done ? 'border-neutral-500 bg-neutral-500 text-white' : 'border-neutral-300 bg-white text-transparent hover:border-purple-400'}`} aria-label={done ? '标记为未完成' : '标记为完成'}>
    <Check className="h-3 w-3 stroke-[3]" />
  </button>
);

const withAlpha = (hex: string, alpha: number) => {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3 ? cleaned.split('').map((character) => character + character).join('') : cleaned;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeHex = (value: string) => {
  const cleaned = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(cleaned)) return `#${cleaned.split('').map((character) => character + character).join('').toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  return null;
};

const hexToRgbParts = (hex: string) => {
  const full = normalizeHex(hex) || '#9387D1';
  return {
    r: Number.parseInt(full.slice(1, 3), 16),
    g: Number.parseInt(full.slice(3, 5), 16),
    b: Number.parseInt(full.slice(5, 7), 16),
  };
};

const rgbToHexParts = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const rgbToHsv = (r: number, g: number, b: number) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: hue < 0 ? hue + 360 : hue, s: max === 0 ? 0 : delta / max, v: max };
};

const hsvToHex = (h: number, s: number, v: number) => {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const match = v - chroma;
  const [red, green, blue] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHexParts((red + match) * 255, (green + match) * 255, (blue + match) * 255);
};

const WHEEL_SIZE = 150;
const RING_WIDTH = 16;
const SV_SIZE = WHEEL_SIZE - RING_WIDTH * 2 - 12;

const ColorWheel: React.FC<{ value: string; onChange: (color: string) => void }> = ({ value, onChange }) => {
  const normalized = normalizeHex(value) || '#9387D1';
  const initialRgb = hexToRgbParts(normalized);
  const [draft, setDraft] = useState(() => rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const draggingRef = useRef<'ring' | 'square' | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rgb = hexToRgbParts(normalized);
    setDraft(rgbToHsv(rgb.r, rgb.g, rgb.b));
  }, [normalized]);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const applyHue = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    setDraft((current) => ({ ...current, h: hue }));
  };
  const applySv = (clientX: number, clientY: number) => {
    const rect = squareRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraft((current) => ({ ...current, s: clamp01((clientX - rect.left) / rect.width), v: 1 - clamp01((clientY - rect.top) / rect.height) }));
  };
  const commit = () => {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    const { h, s, v } = draftRef.current;
    onChange(hsvToHex(h, s, v));
  };

  const center = WHEEL_SIZE / 2;
  const knobRadius = center - RING_WIDTH / 2;
  const knobAngle = (draft.h * Math.PI) / 180;
  const knobX = center + knobRadius * Math.sin(knobAngle);
  const knobY = center - knobRadius * Math.cos(knobAngle);

  return (
    <div className="relative mx-auto select-none" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      <div
        ref={wheelRef}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draggingRef.current = 'ring'; applyHue(event.clientX, event.clientY); }}
        onPointerMove={(event) => { if (draggingRef.current === 'ring') applyHue(event.clientX, event.clientY); }}
        onPointerUp={commit}
        onPointerCancel={commit}
        className="absolute inset-0 cursor-crosshair rounded-full touch-none"
        style={{
          background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          WebkitMask: `radial-gradient(circle, transparent 0 calc(50% - ${RING_WIDTH}px), #000 calc(50% - ${RING_WIDTH}px + 0.5px))`,
          mask: `radial-gradient(circle, transparent 0 calc(50% - ${RING_WIDTH}px), #000 calc(50% - ${RING_WIDTH}px + 0.5px))`,
        }}
        aria-label="色相环"
      >
        <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md" style={{ left: knobX, top: knobY, backgroundColor: `hsl(${draft.h} 100% 50%)` }} />
      </div>
      <div
        ref={squareRef}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draggingRef.current = 'square'; applySv(event.clientX, event.clientY); }}
        onPointerMove={(event) => { if (draggingRef.current === 'square') applySv(event.clientX, event.clientY); }}
        onPointerUp={commit}
        onPointerCancel={commit}
        className="absolute cursor-crosshair touch-none overflow-hidden rounded-full border border-neutral-200/70 shadow-inner"
        style={{ left: (WHEEL_SIZE - SV_SIZE) / 2, top: (WHEEL_SIZE - SV_SIZE) / 2, width: SV_SIZE, height: SV_SIZE, background: `radial-gradient(circle, transparent, rgba(0,0,0,0.05)), linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${draft.h} 100% 50%))` }}
        aria-label="饱和度与明度"
      >
        <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: draft.s * SV_SIZE, top: (1 - draft.v) * SV_SIZE, backgroundColor: hsvToHex(draft.h, draft.s, draft.v) }} />
      </div>
    </div>
  );
};

const HexInput: React.FC<{ value: string; onChange: (color: string) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const color = normalizeHex(event.target.value);
        if (color) onChange(color);
      }}
      onBlur={() => setDraft(value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      className="h-7 w-[72px] rounded-md border border-neutral-200 px-1.5 font-mono text-[10px] uppercase outline-none transition-colors focus:border-purple-300"
      spellCheck={false}
      aria-label="十六进制颜色"
    />
  );
};

const RgbChannelInput: React.FC<{ channel: 'r' | 'g' | 'b'; value: string; onChange: (color: string) => void }> = ({ channel, value, onChange }) => {
  const current = hexToRgbParts(value);
  const [draft, setDraft] = useState(String(current[channel]));
  useEffect(() => setDraft(String(current[channel])), [value, channel]);
  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) { setDraft(String(current[channel])); return; }
    const next = { ...current, [channel]: Math.max(0, Math.min(255, parsed)) };
    onChange(rgbToHexParts(next.r, next.g, next.b));
  };
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-center text-[9px] font-bold uppercase text-neutral-400">{channel}</span>
      <input
        type="number"
        min={0}
        max={255}
        value={draft}
        onChange={(event) => { setDraft(event.target.value); commit(event.target.value); }}
        onBlur={() => commit(draft)}
        className="h-7 w-full rounded-md border border-neutral-200 px-1 text-center text-[10px] outline-none transition-colors focus:border-purple-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={`RGB ${channel.toUpperCase()} 通道`}
      />
    </label>
  );
};

const SectionTab: React.FC<{
  section: TodoLaneSection;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDelete: () => void;
  onHandleDown: (event: React.PointerEvent) => void;
}> = ({ section, onRename, onColor, onDelete, onHandleDown }) => {
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.name);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tapTimer = useRef<number | null>(null);
  const clearTap = () => { if (tapTimer.current !== null) { window.clearTimeout(tapTimer.current); tapTimer.current = null; } };
  useEffect(() => clearTap, []);
  useEffect(() => { if (!editing) setDraft(section.name); }, [section.name, editing]);
  useEffect(() => { if (!toolbarOpen) setConfirmDelete(false); }, [toolbarOpen]);
  const closeToolbar = () => { setToolbarOpen(false); setConfirmDelete(false); };
  const openToolbar = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(70, Math.min(rect.left + rect.width / 2, window.innerWidth - 70));
    setToolbarPos({ top: Math.max(8, rect.top - 48), left });
    setConfirmDelete(false);
    setToolbarOpen(true);
  };
  const handleTap = () => {
    if (tapTimer.current !== null) { clearTap(); return; }
    tapTimer.current = window.setTimeout(() => { tapTimer.current = null; if (toolbarOpen) closeToolbar(); else openToolbar(); }, 230);
  };
  const openColorPanel = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - 232);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 360);
    setMenuPosition({ top, left });
    setMenuOpen(true);
  };
  const startEditing = () => { clearTap(); closeToolbar(); setMenuOpen(false); setDraft(section.name); setEditing(true); };
  const commit = () => { const name = draft.trim(); if (name) onRename(name); setEditing(false); };
  return (
    <div ref={anchorRef} className="pointer-events-auto absolute left-full top-0 z-40 select-none">
      {editing ? (
        <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') { setDraft(section.name); setEditing(false); } }} className="block h-7 w-36 rounded-md border border-purple-300 bg-white px-2 text-[11px] font-bold text-neutral-700 shadow-md outline-none" aria-label="分段名称" />
      ) : (
        <button
          type="button"
          onPointerDown={(event) => { if (!toolbarOpen && !menuOpen) onHandleDown(event); }}
          onClick={handleTap}
          onDoubleClick={startEditing}
          className="flex h-7 max-w-40 cursor-grab items-center gap-1.5 rounded-md border border-purple-200 pl-2 pr-2.5 text-[11px] font-bold text-neutral-700 shadow-md transition-all hover:-translate-y-px hover:border-purple-300 hover:shadow-lg active:cursor-grabbing"
          style={{ backgroundColor: section.color }}
          title="单击显示操作，双击重命名，拖动移动色块"
        >
          <span className="truncate">{section.name}</span>
          <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white/85 shadow-sm" aria-hidden="true">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: section.color }} />
          </span>
        </button>
      )}
      {toolbarOpen && !editing && toolbarPos ? createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={closeToolbar} aria-label="关闭分段操作" />
          <div role="toolbar" aria-label="分段操作" className="fixed z-[200] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" style={{ top: toolbarPos.top, left: toolbarPos.left }}>
            <button type="button" onClick={() => { closeToolbar(); openColorPanel(); }} className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100" aria-label="更换分段颜色" title="更换分段颜色">
              <Pipette className="h-3.5 w-3.5" /><span>换色</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmDelete) { closeToolbar(); onDelete(); return; }
                setConfirmDelete(true);
              }}
              className={`flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors ${confirmDelete ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
              aria-label={confirmDelete ? '确认删除分段' : '删除分段'}
              title={confirmDelete ? '再次点击确认删除' : '删除分段'}
            >
              {confirmDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>{confirmDelete ? '确认' : '删除'}</span>
            </button>
          </div>
        </>,
        document.body,
      ) : null}
      {menuOpen && !editing && menuPosition ? createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={() => setMenuOpen(false)} aria-label="关闭分段菜单" />
          <div role="dialog" aria-label="分段设置" className="fixed z-[200] w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <header className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5">
              <Pipette className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-bold text-neutral-700">{section.name}</span>
            </header>
            <div className="p-3.5">
              <ColorWheel value={section.color} onChange={onColor} />
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-neutral-400">HEX</span>
                <HexInput value={section.color} onChange={onColor} />
              </div>
              <div className="mt-2 grid grid-cols-[auto_1fr_1fr_1fr] items-end gap-1.5">
                <span className="pb-1.5 text-[10px] font-bold text-neutral-400">RGB</span>
                {(['r', 'g', 'b'] as const).map((channel) => (
                  <RgbChannelInput key={channel} channel={channel} value={section.color} onChange={onColor} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end">
                <label className="relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2 text-[10px] font-semibold text-purple-600 transition-colors hover:bg-purple-100">
                  <Pipette className="h-3 w-3" />
                  系统取色器
                  <input type="color" value={section.color} onChange={(event) => onColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="系统取色器" />
                </label>
              </div>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </div>
  );
};

const ListLane: React.FC<{ lane: TodoLane; onOpenView: (view: 'board' | 'kanban' | 'gantt') => void }> = ({ lane, onOpenView }) => {
  const allItems = useAppStore((state) => state.todoItems);
  const create = useAppStore((state) => state.createTodoItem);
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const remove = useAppStore((state) => state.removeTodoItem);
  const renameLane = useAppStore((state) => state.renameTodoLane);
  const deleteLane = useAppStore((state) => state.deleteTodoLane);
  const addSection = useAppStore((state) => state.addTodoLaneSection);
  const updateSection = useAppStore((state) => state.updateTodoLaneSection);
  const deleteSection = useAppStore((state) => state.deleteTodoLaneSection);
  const [draft, setDraft] = useState('');
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id).sort((a, b) => a.order - b.order), [allItems, lane.id]);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);
  const [bandDrag, setBandDrag] = useState<{ id: string; mode: 'move' | 'top' | 'bottom'; startY: number; originTop: number; originHeight: number } | null>(null);
  const [liveBands, setLiveBands] = useState<Record<string, { top: number; height: number }>>({});

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setListHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    setListHeight(element.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bandDrag) return;
    const onMove = (event: PointerEvent) => {
      setLiveBands((current) => {
        const base = bandDrag.id in current ? current[bandDrag.id] : { top: bandDrag.originTop, height: bandDrag.originHeight };
        const delta = event.clientY - bandDrag.startY;
        if (bandDrag.mode === 'move') {
          return { ...current, [bandDrag.id]: { ...base, top: Math.max(0, bandDrag.originTop + delta) } };
        }
        if (bandDrag.mode === 'top') {
          const maxGrow = bandDrag.originHeight - 28;
          const shrink = Math.min(Math.max(-bandDrag.originTop, delta), maxGrow);
          return { ...current, [bandDrag.id]: { ...base, top: bandDrag.top + shrink, height: bandDrag.originHeight - shrink } };
        }
        return { ...current, [bandDrag.id]: { ...base, height: Math.max(28, bandDrag.originHeight + delta) } };
      });
    };
    const onUp = () => {
      setBandDrag((current) => {
        if (current && liveBands[current.id]) {
          updateSection(lane.id, current.id, liveBands[current.id]);
        }
        return null;
      });
      setLiveBands({});
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [bandDrag, lane.id, liveBands, updateSection]);

  const startBandDrag = useCallback((event: React.PointerEvent, section: TodoLaneSection, mode: 'move' | 'top' | 'bottom') => {
    event.preventDefault();
    event.stopPropagation();
    setLiveBands({});
    setBandDrag({ id: section.id, mode, startY: event.clientY, originTop: section.top, originHeight: section.height });
  }, []);

  const submit = () => { const text = draft.trim(); if (!text) return; create(lane.id, text); setDraft(''); };
const TodoRow: React.FC<{ item: TodoItem }> = ({ item }) => {
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const { handleClick, cancel } = useTapClick(() => { if (!editing) setToolbarOpen((open) => !open); });
  const beginEdit = () => { cancel(); setToolbarOpen(false); setEditing(true); };
  const commitEdit = () => { if (!item.text.trim()) update(item.id, { text: '未命名待办' }); setEditing(false); };
  return (
    <div
      ref={rowRef}
      onClick={(event) => { if (editing) return; if ((event.target as HTMLElement).closest('button, [role="toolbar"]')) return; handleClick(event); }}
      onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; beginEdit(); }}
      className={`group relative flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-neutral-50 ${editing ? 'bg-neutral-50' : 'cursor-default'}`}
      title={editing ? undefined : '单击显示操作，双击编辑'}
    >
      <TodoCheckbox done={item.isDone} onClick={() => toggle(item.id)} />
      <input
        ref={inputRef}
        readOnly={!editing}
        value={item.text}
        onChange={(event) => update(item.id, { text: event.target.value })}
        onBlur={commitEdit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.blur(); } }}
        className={`min-w-0 flex-1 bg-transparent py-1 text-sm outline-none ${editing ? 'cursor-text' : 'cursor-default'} ${item.isDone ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}
        aria-label="待办文本"
      />
      <TodoItemToolbarHost itemId={item.id} open={toolbarOpen} anchor={rowRef.current} onClose={() => setToolbarOpen(false)} />
    </div>
  );
};
  return <section className="relative rounded-xl border border-neutral-200 bg-white/80 p-4 shadow-xs">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${lane.type === 'main' ? 'bg-purple-500' : 'bg-sky-400'}`} />{lane.type === 'custom' ? <input value={lane.name} onChange={(event) => renameLane(lane.id, event.target.value)} onBlur={(event) => { if (!event.currentTarget.value.trim()) renameLane(lane.id, '未命名分线'); }} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-neutral-700 outline-none" aria-label="分线名称" /> : <h3 className="text-sm font-bold text-neutral-700">{lane.name}</h3>}</div>
      <div className="flex items-center gap-2"><span className="text-[11px] text-neutral-400">{items.filter((item) => item.isDone).length}/{items.length}</span><div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"><button type="button" onClick={() => onOpenView('board')} className="flex h-7 w-7 items-center justify-center rounded-md text-purple-600 hover:bg-white hover:shadow-sm" title="画板"><GitBranch className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onOpenView('kanban')} className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 hover:bg-white hover:shadow-sm" title="看板"><Columns3 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onOpenView('gantt')} className="flex h-7 w-7 items-center justify-center rounded-md text-sky-600 hover:bg-white hover:shadow-sm" title="甘特图"><CalendarDays className="h-3.5 w-3.5" /></button></div>{lane.type === 'custom' ? <DeleteLaneButton onDelete={() => deleteLane(lane.id)} /> : null}</div>
    </div>
    <div ref={listRef} data-lane-list={lane.id} className="relative space-y-1.5">
      {items.map((item) => <TodoRow key={item.id} item={item} />)}
      <div className="flex items-center gap-2 px-2 pt-1"><span className="h-[18px] w-[18px] shrink-0 rounded-[5px] border border-dashed border-neutral-300" /><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} placeholder="添加待办" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-neutral-300" aria-label={`添加到${lane.name}`} /><button type="button" onClick={submit} disabled={!draft.trim()} className="flex h-7 w-7 items-center justify-center rounded text-purple-500 hover:bg-purple-50 disabled:opacity-0" title="添加待办"><Plus className="h-4 w-4" /></button></div>
      {lane.sections.map((section) => {
        const live = liveBands[section.id];
        const top = live ? live.top : section.top;
        const height = live ? live.height : section.height;
        const isDragging = bandDrag?.id === section.id;
        return (
          <div
            key={section.id}
            className="pointer-events-none absolute inset-x-0 rounded-lg transition-shadow"
            style={{ top, height, backgroundColor: withAlpha(section.color, 0.35), zIndex: 10, boxShadow: isDragging ? '0 0 0 1.5px rgba(139,92,246,0.45)' : undefined }}
          >
            <div className="pointer-events-auto absolute inset-x-0 -top-px h-1.5 cursor-row-resize" onPointerDown={(event) => startBandDrag(event, section, 'top')} title="拖拽调整色块上边缘" style={{ touchAction: 'none' }} />
            <div className="pointer-events-auto absolute inset-x-0 -bottom-px h-1.5 cursor-row-resize" onPointerDown={(event) => startBandDrag(event, section, 'bottom')} title="拖拽调整色块下边缘" style={{ touchAction: 'none' }} />
            <SectionTabWrapper laneId={lane.id} section={section} onHandleDown={(event) => startBandDrag(event, section, 'move')} />
          </div>
        );
      })}
    </div>
    <button type="button" onClick={() => addSection(lane.id)} className="mt-2 flex h-6 items-center gap-1 self-start rounded px-1.5 text-[11px] font-semibold text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-purple-500"><Plus className="h-3 w-3" />新增分段</button>
  </section>;
};

const DeleteLaneButton: React.FC<{ onDelete: () => void }> = ({ onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { if (confirming) { setConfirming(false); onDelete(); return; } setConfirming(true); }}
      onMouseLeave={() => setConfirming(false)}
      className={`flex h-7 items-center justify-center gap-1 rounded text-[11px] font-semibold transition-all ${confirming ? 'w-[52px] bg-rose-600 px-1.5 text-white' : 'w-7 text-neutral-300 hover:bg-rose-50 hover:text-rose-500'}`}
      title={confirming ? '再次点击确认删除' : '删除分线，待办移回主线'}
    >
      {confirming ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}{confirming ? '确认' : ''}
    </button>
  );
};

const SectionTabWrapper: React.FC<{
  laneId: string;
  section: TodoLaneSection;
  onHandleDown: (event: React.PointerEvent) => void;
}> = ({ laneId, section, onHandleDown }) => {
  const updateSection = useAppStore((state) => state.updateTodoLaneSection);
  const deleteSection = useAppStore((state) => state.deleteTodoLaneSection);
  return <SectionTab section={section} onRename={(name) => updateSection(laneId, section.id, { name })} onColor={(color) => updateSection(laneId, section.id, { color })} onDelete={() => deleteSection(laneId, section.id, 'merge')} onHandleDown={onHandleDown} />;
};

interface BoardNodeData extends Record<string, unknown> { itemId: string; text: string; done: boolean; color?: string; progressStatus?: 'not-started' | 'in-progress' }

const boardColors: Record<string, string> = {
  emerald: '#67c8bd', rose: '#d78fb5', sky: '#79bfd5', amber: '#d9b958', violet: '#9b8ae4', indigo: '#9387d1',
};

const BoardNode = React.memo(({ id, data, selected }: NodeProps<Node<BoardNodeData>>) => {
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const { handleClick, cancel } = useTapClick(() => setToolbarOpen((open) => !open));
  const color = boardColors[data.color || ''] || data.color || '#9387d1';
  return <div
    ref={nodeRef}
    className={`group relative flex h-full min-h-10 w-full min-w-32 items-center rounded-[999px] border px-4 py-2 shadow-md transition-colors ${data.done ? 'border-neutral-300 bg-neutral-100/90' : 'bg-white'} ${editing ? 'nodrag' : ''}`}
    style={data.done ? undefined : { borderColor: color }}
    onClick={(event) => { if (editing) return; if ((event.target as HTMLElement).closest('button, [role="toolbar"]')) return; handleClick(event); }}
    onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; cancel(); setToolbarOpen(false); setEditing(true); }}
    title={editing ? undefined : '单击显示操作，双击编辑'}>
    <NodeResizer isVisible={selected} minWidth={128} minHeight={40} maxWidth={420} maxHeight={180} color={color} handleStyle={{ width: 8, height: 8, borderRadius: 3 }} onResizeEnd={(_event, params) => update(data.itemId, { width: params.width, height: params.height })} />
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-400" />
    <div className="flex items-center gap-2">
      <TodoCheckbox done={data.done} onClick={() => toggle(data.itemId)} />
      <input
        ref={inputRef}
        readOnly={!editing}
        value={data.text}
        onChange={(event) => update(data.itemId, { text: event.target.value })}
        onBlur={() => { if (!data.text.trim()) update(data.itemId, { text: '未命名待办' }); setEditing(false); }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur(); }}
        className={`min-w-24 flex-1 bg-transparent py-1 text-xs font-semibold outline-none ${editing ? 'nodrag cursor-text' : 'cursor-default'} ${data.done ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}
        aria-label="待办文本"
      />
    </div>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white" style={{ backgroundColor: color }} />
    <TodoItemToolbarHost itemId={data.itemId} open={toolbarOpen} anchor={nodeRef.current} onClose={() => setToolbarOpen(false)} />
  </div>;
});
BoardNode.displayName = 'BoardNode';
const nodeTypes = { todoNode: BoardNode };

const DeleteSelectionBar: React.FC<{ count: number; onDelete: () => void }> = ({ count, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 p-2 shadow-xl">
      <span className="px-2 text-[11px] font-bold text-neutral-500">已选 {count} 项</span>
      <button
        type="button"
        onClick={() => { if (confirming) { setConfirming(false); onDelete(); return; } setConfirming(true); }}
        onMouseLeave={() => setConfirming(false)}
        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${confirming ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
        title={confirming ? '再次点击确认删除' : '删除选中节点'}
      >
        {confirming ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
        {confirming ? '确认' : '删除'}
      </button>
    </div>
  );
};

const BoardCanvas: React.FC<{ lane: TodoLane }> = ({ lane }) => {
  const allItems = useAppStore((state) => state.todoItems);
  const allEdges = useAppStore((state) => state.todoEdges);
  const create = useAppStore((state) => state.createTodoItem);
  const update = useAppStore((state) => state.updateTodoItem);
  const addEdge = useAppStore((state) => state.addTodoEdge);
  const removeEdge = useAppStore((state) => state.removeTodoEdge);
  const removeItem = useAppStore((state) => state.removeTodoItem);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const suppressCreateRef = useRef(false);
  const [canvasTool, setCanvasTool] = useState<'pan' | 'select'>('pan');
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id), [allItems, lane.id]);
  const nodes = useMemo<Node<BoardNodeData>[]>(() => items.map((item) => ({ id: item.id, type: 'todoNode', position: item.position, width: item.width, height: item.height, data: { itemId: item.id, text: item.text, done: item.isDone, color: item.color, progressStatus: item.progressStatus } })), [items]);
  const edges = useMemo<Edge[]>(() => allEdges.filter((edge) => edge.laneId === lane.id).map((edge) => ({ id: edge.id, source: edge.sourceItemId, target: edge.targetItemId, type: 'bezier', style: { stroke: '#9b8ae4', strokeWidth: 2 }, interactionWidth: 24 })), [allEdges, lane.id]);
  const [localNodes, setLocalNodes] = useState(nodes);
  useEffect(() => setLocalNodes(nodes), [nodes]);
  const onNodesChange = useCallback((changes: NodeChange<Node<BoardNodeData>>[]) => setLocalNodes((current) => applyNodeChanges(changes, current)), []);
  const connect = useCallback((connection: Connection) => { if (connection.source && connection.target) addEdge(lane.id, connection.source, connection.target); }, [addEdge, lane.id]);
  const selectedNodes = localNodes.filter((node) => node.selected);
  const removeSelected = useCallback(() => selectedNodes.forEach((node) => removeItem(node.id)), [removeItem, selectedNodes]);
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodes.length > 0) {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key === 'Tab' && selectedNodes.length === 1) {
      event.preventDefault();
      const parent = selectedNodes[0];
      const itemId = create(lane.id, '新待办');
      if (!itemId) return;
      update(itemId, { position: { x: parent.position.x + 220, y: parent.position.y } });
      addEdge(lane.id, parent.id, itemId);
    }
  }, [addEdge, create, lane.id, removeSelected, selectedNodes, update]);
  return <div onKeyDown={handleKeyDown} tabIndex={0} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs outline-none">
    {selectedNodes.length > 1 ? <DeleteSelectionBar count={selectedNodes.length} onDelete={removeSelected} /> : null}
    <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-neutral-200 bg-white/95 p-1 shadow-lg"><button type="button" onClick={() => setCanvasTool('pan')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ${canvasTool === 'pan' ? 'bg-purple-100 text-purple-600' : 'text-neutral-500 hover:bg-neutral-50'}`}><MousePointer2 className="h-3.5 w-3.5" />移动</button><button type="button" onClick={() => setCanvasTool('select')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold ${canvasTool === 'select' ? 'bg-purple-100 text-purple-600' : 'text-neutral-500 hover:bg-neutral-50'}`}><Scan className="h-3.5 w-3.5" />框选</button></div>
    <div className="absolute bottom-6 right-6 z-30 flex items-center gap-1 rounded-xl border border-purple-200 bg-white/95 p-1.5 shadow-lg"><button type="button" onClick={() => zoomIn()} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-neutral-600 hover:bg-purple-50"><ZoomIn className="h-3.5 w-3.5" />放大</button><button type="button" onClick={() => zoomOut()} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-neutral-600 hover:bg-purple-50"><ZoomOut className="h-3.5 w-3.5" />缩小</button><button type="button" onClick={() => fitView({ padding: 0.25, duration: 400 })} className="flex h-8 items-center gap-1 rounded-lg bg-purple-50 px-2 text-[11px] font-semibold text-purple-600 hover:bg-purple-100"><Maximize className="h-3.5 w-3.5" />适应</button></div>
    <ReactFlow nodes={localNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeDragStop={() => { localNodes.forEach((node) => { if (node.selected) update(node.id, { position: node.position }); }); }} onConnect={connect} onConnectStart={() => { suppressCreateRef.current = true; }} onConnectEnd={() => { window.setTimeout(() => { suppressCreateRef.current = false; }, 200); }} onEdgeDoubleClick={(_event, edge) => removeEdge(edge.id)} onPaneClick={(event) => { if (event.detail !== 2 || suppressCreateRef.current) return; const position = screenToFlowPosition({ x: event.clientX, y: event.clientY }); const itemId = create(lane.id, '新待办'); if (itemId) update(itemId, { position: { x: position.x - 80, y: position.y - 24 } }); }} zoomOnDoubleClick={false} selectionOnDrag={canvasTool === 'select'} selectionMode={SelectionMode.Partial} panOnDrag={canvasTool === 'pan' ? [0, 1, 2] : [1, 2]} nodesDeletable={false} deleteKeyCode={null} fitView minZoom={0.15} maxZoom={1.5} connectionRadius={28} connectionLineType={ConnectionLineType.Bezier} connectionLineStyle={{ stroke: '#9b8ae4', strokeWidth: 2 }}>
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#d9ddea" />
    </ReactFlow>
  </div>;
};

export const TodoPage: React.FC = () => {
  const allLanes = useAppStore((state) => state.todoLanes);
  const addLane = useAppStore((state) => state.addTodoLane);
  const [boardLaneId, setBoardLaneId] = useState<string | null>(null);
  const [laneView, setLaneView] = useState<'board' | 'kanban' | 'gantt'>('board');
  const lanes = useMemo(() => allLanes.filter(visibleLane), [allLanes]);
  const boardLane = boardLaneId ? lanes.find((lane) => lane.id === boardLaneId) : null;
  if (boardLane) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50 p-6"><div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setBoardLaneId(null)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"><ArrowLeft className="h-4 w-4" />返回 List</button><h2 className="truncate text-lg font-bold text-neutral-800">{boardLane.name}</h2><div className="flex shrink-0 rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5"><button type="button" onClick={() => setLaneView('board')} className={`flex h-8 w-8 items-center justify-center rounded-md ${laneView === 'board' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="画板"><GitBranch className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setLaneView('kanban')} className={`flex h-8 w-8 items-center justify-center rounded-md ${laneView === 'kanban' ? 'bg-white text-amber-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="看板"><Columns3 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setLaneView('gantt')} className={`flex h-8 w-8 items-center justify-center rounded-md ${laneView === 'gantt' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="甘特图"><CalendarDays className="h-3.5 w-3.5" /></button></div></div></div><div className="mt-5 flex min-h-0 flex-1">{laneView === 'board' ? <ReactFlowProvider><BoardCanvas lane={boardLane} /></ReactFlowProvider> : laneView === 'kanban' ? <TodoBoard lane={boardLane} /> : <TodoGantt lane={boardLane} />}</div></div></div>;
  }
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-50 p-6 custom-scrollbar"><div className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><h2 className="text-lg font-bold text-neutral-800">Todo</h2><div className="flex items-center gap-1 text-xs text-neutral-400"><List className="h-3.5 w-3.5" />List</div></div><button type="button" onClick={() => addLane()} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Plus className="h-4 w-4" />新增分线</button></div>
    <div className="mt-6 grid gap-8 lg:grid-cols-2">{lanes.map((lane) => <ListLane key={lane.id} lane={lane} onOpenView={(view) => { setLaneView(view); setBoardLaneId(lane.id); }} />)}</div>
  </div></div>;
};
