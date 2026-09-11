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
import { CalendarDays, Check, CircleDot, Columns3, GitBranch, GripVertical, List, Maximize, MousePointer2, Pipette, Plus, Scan, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoEdge, TodoItem, TodoLane, TodoLaneSection } from '../types';
import { TodoBoard } from './TodoBoard';
import { TodoGantt } from './TodoGantt';
import { TodoItemToolbarHost } from './TodoItemToolbar';
import { TodoStatusBadge, isTodoItemStruck } from './TodoStatusBadge';
import { TodoTimeLabel } from './TodoTimeLabel';
import { TodoViewSwitcher, type TodoLaneView } from './TodoViewSwitcher';
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
  onHandleDown: (event: { clientY: number; preventDefault: () => void; stopPropagation: () => void }) => void;
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
  const dragMovedRef = useRef(false);
  const pressRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const clearTap = () => { if (tapTimer.current !== null) { window.clearTimeout(tapTimer.current); tapTimer.current = null; } };
  useEffect(() => clearTap, []);
  useEffect(() => { if (!editing) setDraft(section.name); }, [section.name, editing]);
  useEffect(() => { if (!toolbarOpen) setConfirmDelete(false); }, [toolbarOpen]);
  const closeToolbar = () => { setToolbarOpen(false); setConfirmDelete(false); };
  const openToolbar = (pointerX?: number) => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = pointerX ?? rect.left + rect.width / 2;
    setToolbarPos({ top: Math.max(8, rect.top - 48), left: Math.max(70, Math.min(x, window.innerWidth - 70)) });
    setConfirmDelete(false);
    setToolbarOpen(true);
  };
  const handleTap = (event: React.MouseEvent) => {
    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
    if (tapTimer.current !== null) { clearTap(); return; }
    const x = event.clientX;
    tapTimer.current = window.setTimeout(() => { tapTimer.current = null; if (toolbarOpen) closeToolbar(); else openToolbar(x); }, 230);
  };
  useEffect(() => {
    if (!toolbarOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      onDelete();
      closeToolbar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toolbarOpen, onDelete]);
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
        <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) commit(); if (event.key === 'Escape') { setDraft(section.name); setEditing(false); } }} className="block h-7 w-36 rounded-md border border-purple-300 bg-white px-2 text-[11px] font-bold text-neutral-700 shadow-md outline-none" aria-label="分段名称" />
      ) : (
        <button
          type="button"
          onPointerDown={(event) => {
            dragMovedRef.current = false;
            pressRef.current = { x: event.clientX, y: event.clientY, dragging: false };
            if (toolbarOpen || menuOpen) return;
            const move = (moveEvent: PointerEvent) => {
              const press = pressRef.current;
              if (!press || press.dragging) return;
              if (Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y) < 4) return;
              press.dragging = true;
              dragMovedRef.current = true;
              clearTap();
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              onHandleDown(moveEvent);
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
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

const buildDirectoryPath = (itemId: string, laneEdges: TodoEdge[], itemById: Map<string, TodoItem>): string[] => {
  const parents = new Map<string, string[]>();
  laneEdges.forEach((edge) => {
    parents.set(edge.targetItemId, [...(parents.get(edge.targetItemId) || []), edge.sourceItemId]);
  });
  const segments: string[] = [];
  const visited = new Set<string>([itemId]);
  let currentId = itemId;
  while (true) {
    const parentIds = parents.get(currentId);
    if (!parentIds || parentIds.length === 0) break;
    const parentId = parentIds.find((id) => !visited.has(id)) || parentIds[0];
    if (visited.has(parentId)) break;
    const parent = itemById.get(parentId);
    if (!parent || !parent.isDirectory) break;
    segments.unshift(parent.text || '未命名目录');
    visited.add(parentId);
    currentId = parentId;
  }
  return segments;
};

const TodoRow: React.FC<{
  item: TodoItem;
  pathLabel?: string;
  dragging?: boolean;
  dropHint?: 'above' | 'below' | null;
  onSortDragStart?: (itemId: string, half: 'top' | 'bottom' | null, targetItemId: string | null, commit?: boolean) => void;
}> = ({ item, pathLabel, dragging = false, dropHint = null, onSortDragStart }) => {
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [pointerX, setPointerX] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragMovedRef = useRef(false);
  useEffect(() => { if (editing) { setDraft(item.text); inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const { handleClick, cancel } = useTapClick((element, event) => { setPointerX(event.clientX); setToolbarOpen((open) => !open); });
  const beginEdit = () => { cancel(); setToolbarOpen(false); setEditing(true); };
  const commitEdit = () => {
    setEditing(false);
    const text = draft.trim();
    if (!text) { if (item.text !== '未命名待办') update(item.id, { text: '未命名待办' }); return; }
    if (text !== item.text) update(item.id, { text });
  };
  return (
    <div
      ref={rowRef}
      data-todo-row={item.id}
      onClick={(event) => {
        if (dragMovedRef.current) { dragMovedRef.current = false; return; }
        if (editing) return;
        if ((event.target as HTMLElement).closest('button, [role="toolbar"]')) return;
        handleClick(event);
      }}
      onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; beginEdit(); }}
      className={`group relative z-10 flex items-center gap-2 rounded-lg px-2 py-1 transition-opacity ${editing ? 'bg-neutral-50' : 'cursor-default'} ${dragging ? 'opacity-40' : ''} ${dropHint === 'above' ? 'shadow-[inset_0_2px_0_0_#8b5cf6]' : dropHint === 'below' ? 'shadow-[inset_0_-2px_0_0_#8b5cf6]' : ''}`}
      title={editing ? undefined : '单击显示操作，双击编辑；按住左侧手柄可拖动排序'}
    >
      {onSortDragStart ? (
        <span
          onPointerDown={(event) => {
            if (event.button !== 0 || !onSortDragStart) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragMovedRef.current = false;
            const move = (moveEvent: PointerEvent) => {
              const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-todo-row]');
              const row = element instanceof HTMLElement ? element : null;
              if (row && row.dataset.todoRow !== item.id) { dragMovedRef.current = true; cancel(); }
              if (!row) { onSortDragStart(item.id, null, null); return; }
              const rect = row.getBoundingClientRect();
              onSortDragStart(item.id, moveEvent.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom', row.dataset.todoRow || null);
            };
            const up = (upEvent: PointerEvent) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest('[data-todo-row]');
              const row = element instanceof HTMLElement ? element : null;
              if (row) {
                const rect = row.getBoundingClientRect();
                onSortDragStart(item.id, upEvent.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom', row.dataset.todoRow || null, true);
              } else {
                onSortDragStart(item.id, null, null, true);
              }
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          className="flex h-6 w-3.5 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-300 transition-colors hover:text-neutral-500 active:cursor-grabbing"
          title="拖动调整顺序"
        >
          <GripVertical className="h-3 w-3" />
        </span>
      ) : <span className="h-6 w-3.5 shrink-0" aria-hidden="true" />}
      <TodoCheckbox done={item.isDone} onClick={() => toggle(item.id)} />
      <input
        ref={inputRef}
        readOnly={!editing}
        value={editing ? draft : item.text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (editing) commitEdit(); }}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(item.text); event.currentTarget.blur(); } }}
        className={`min-w-0 flex-1 bg-transparent py-1 text-sm outline-none ${editing ? 'cursor-text' : 'cursor-default'} ${isTodoItemStruck(item) ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}
        aria-label="待办文本"
      />
      {pathLabel ? (
        <span className="max-w-40 shrink-0 truncate text-[10px] leading-none text-neutral-300" title={`${pathLabel}${item.text}`}>
          {pathLabel}
        </span>
      ) : null}
      <TodoTimeLabel itemId={item.id} />
      <TodoStatusBadge itemId={item.id} />
      <TodoItemToolbarHost itemId={item.id} open={toolbarOpen} anchor={rowRef.current} pointerX={pointerX} onClose={() => setToolbarOpen(false)} />
    </div>
  );
};

const ListLane: React.FC<{ lane: TodoLane; laneNamesById: Map<string, string>; highlight?: boolean; onOpenView: (view: 'board' | 'kanban' | 'gantt') => void }> = ({ lane, laneNamesById, highlight = false, onOpenView }) => {
  const allItems = useAppStore((state) => state.todoItems);
  const allEdges = useAppStore((state) => state.todoEdges);
  const create = useAppStore((state) => state.createTodoItem);
  const renameLane = useAppStore((state) => state.renameTodoLane);
  const deleteLane = useAppStore((state) => state.deleteTodoLane);
  const [draft, setDraft] = useState('');
  const items = useMemo(() => allItems
    .filter((item) => !item.isDirectory && (item.laneId === lane.id || (item.referencedLaneIds || []).includes(lane.id)))
    .sort((a, b) => a.order - b.order), [allItems, lane.id]);
  const submit = () => { const text = draft.trim(); if (!text) return; create(lane.id, text); setDraft(''); };
  const [sortDrag, setSortDrag] = useState<{ itemId: string; half: 'top' | 'bottom' | null; targetItemId: string | null } | null>(null);
  const sortDragRef = useRef<{ itemId: string; half: 'top' | 'bottom' | null; targetItemId: string | null } | null>(null);
  sortDragRef.current = sortDrag;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const reorderItem = useAppStore((state) => state.reorderTodoItem);
  const handleSortDrag = (itemId: string, half: 'top' | 'bottom' | null, targetItemId: string | null, commit = false) => {
    if (commit) {
      const current = sortDragRef.current;
      setSortDrag(null);
      if (!current || !current.targetItemId || current.targetItemId === itemId) return;
      const visible = itemsRef.current;
      const targetIndex = visible.findIndex((candidate) => candidate.id === current.targetItemId);
      if (targetIndex < 0) return;
      const insertIndex = current.half === 'top' ? targetIndex : targetIndex + 1;
      const draggedIndex = visible.findIndex((candidate) => candidate.id === itemId);
      if (draggedIndex < 0 || draggedIndex === insertIndex || draggedIndex === insertIndex - 1) return;
      const prevOrder = insertIndex > 0 ? visible[insertIndex - 1].order : visible[0].order - 1;
      const nextOrder = insertIndex < visible.length ? visible[insertIndex].order : visible[visible.length - 1].order + 1;
      reorderItem(itemId, (prevOrder + nextOrder) / 2);
      return;
    }
    setSortDrag((current) => (current?.targetItemId === targetItemId && current?.half === half ? current : { itemId, half, targetItemId }));
  };
  return <section
    data-lane-card={lane.id}
    className={`rounded-xl border bg-white/80 p-4 shadow-xs transition-all ${highlight ? 'ring-2 ring-purple-300 border-purple-300' : 'border-neutral-200'}`}
  >
    <div className="relative z-10 mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${lane.type === 'main' ? 'bg-purple-500' : 'bg-sky-400'}`} />{lane.type === 'custom' ? <input value={lane.name} onChange={(event) => renameLane(lane.id, event.target.value)} onBlur={(event) => { if (!event.currentTarget.value.trim()) renameLane(lane.id, '未命名分线'); }} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-neutral-700 outline-none" aria-label="分线名称" /> : <h3 className="text-sm font-bold text-neutral-700">{lane.name}</h3>}</div>
      <div className="flex items-center gap-2"><span className="text-[11px] text-neutral-400">{items.filter((item) => item.isDone).length}/{items.length}</span><div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"><button type="button" onClick={() => onOpenView('board')} className="flex h-7 w-7 items-center justify-center rounded-md text-purple-600 hover:bg-white hover:shadow-sm" title="画板"><GitBranch className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onOpenView('gantt')} className="flex h-7 w-7 items-center justify-center rounded-md text-sky-600 hover:bg-white hover:shadow-sm" title="甘特图"><CalendarDays className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onOpenView('kanban')} className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 hover:bg-white hover:shadow-sm" title="看板"><Columns3 className="h-3.5 w-3.5" /></button></div>{lane.type === 'custom' ? <DeleteLaneButton onDelete={() => deleteLane(lane.id)} /> : null}</div>
    </div>
    <div className="space-y-1.5">
      {items.map((item) => {
        let pathLabel: string | undefined;
        if (lane.id === 'todo-main') {
          const sourceLaneId = item.laneId !== 'todo-main' ? item.laneId : item.originLaneId;
          if (sourceLaneId) {
            const itemById = new Map(allItems.map((candidate) => [candidate.id, candidate]));
            const laneEdges = allEdges.filter((edge) => edge.laneId === sourceLaneId);
            const directorySegments = buildDirectoryPath(item.id, laneEdges, itemById);
            const laneName = laneNamesById.get(sourceLaneId) || '未知分线';
            pathLabel = [laneName, ...directorySegments].map((segment) => `${segment}/`).join('');
          }
        }
        return <TodoRow
          key={`${item.id}-${item.laneId === lane.id ? 'own' : 'ref'}`}
          item={item}
          pathLabel={pathLabel}
          dragging={sortDrag?.itemId === item.id}
          dropHint={sortDrag?.targetItemId === item.id ? (sortDrag.half === 'top' ? 'above' : 'below') : null}
          onSortDragStart={handleSortDrag}
        />;
      })}
      <div className="relative z-10 flex items-center gap-2 px-2 pt-1"><span className="h-[18px] w-[18px] shrink-0 rounded-[5px] border border-dashed border-neutral-300" /><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) submit(); }} placeholder="添加待办" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-neutral-300" aria-label={`添加到${lane.name}`} /><button type="button" onClick={submit} disabled={!draft.trim()} className="flex h-7 w-7 items-center justify-center rounded text-purple-500 hover:bg-purple-50 disabled:opacity-0" title="添加待办"><Plus className="h-4 w-4" /></button></div>
    </div>
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
  onHandleDown: (event: { clientY: number; preventDefault: () => void; stopPropagation: () => void }) => void;
}> = ({ laneId, section, onHandleDown }) => {
  const updateSection = useAppStore((state) => state.updateTodoLaneSection);
  const deleteSection = useAppStore((state) => state.deleteTodoLaneSection);
  return <SectionTab section={section} onRename={(name) => updateSection(laneId, section.id, { name })} onColor={(color) => updateSection(laneId, section.id, { color })} onDelete={() => deleteSection(laneId, section.id, 'merge')} onHandleDown={onHandleDown} />;
};

const LaneBandsLayer: React.FC<{
  lanes: TodoLane[];
  hiddenSectionId?: string | null;
  onDeleteZoneChange?: (armed: boolean) => void;
  onRequestDelete?: (payload: { laneId: string; sectionId: string }) => void;
}> = ({ lanes, hiddenSectionId, onDeleteZoneChange, onRequestDelete }) => {
  const updateSection = useAppStore((state) => state.updateTodoLaneSection);
  const [bandDrag, setBandDrag] = useState<{ laneId: string; id: string; mode: 'move' | 'top' | 'bottom'; startY: number; originTop: number; originHeight: number } | null>(null);
  const [liveBands, setLiveBands] = useState<Record<string, { top: number; height: number }>>({});
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteArmedRef = useRef(false);
  const setBandDeleteZoneActive = useAppStore((state) => state.setBandDeleteZoneActive);
  const deleteArmedSetter = (value: boolean) => {
    if (deleteArmedRef.current !== value) {
      deleteArmedRef.current = value;
      setDeleteArmed(value);
      setBandDeleteZoneActive(value);
      onDeleteZoneChange?.(value);
    }
  };
  useEffect(() => () => { setBandDeleteZoneActive(false); onDeleteZoneChange?.(false); }, [setBandDeleteZoneActive, onDeleteZoneChange]);

  useEffect(() => {
    if (!bandDrag) return undefined;
    const headerZone = () => {
      const header = document.querySelector('[data-app-header]') as HTMLElement | null;
      return header ? header.getBoundingClientRect().bottom : Number.POSITIVE_INFINITY;
    };
    const scroller = () => document.querySelector('[data-todo-scroller]') as HTMLElement | null;
    let lastClientY = bandDrag.startY;
    let startScrollTop = scroller()?.scrollTop ?? 0;
    const applyLive = (clientY: number) => {
      const currentScrollTop = scroller()?.scrollTop ?? 0;
      const delta = clientY - bandDrag.startY - (currentScrollTop - startScrollTop);
      setLiveBands((current) => {
        if (bandDrag.mode === 'move') {
          return { ...current, [bandDrag.id]: { top: bandDrag.originTop + delta, height: bandDrag.originHeight } };
        }
        if (bandDrag.mode === 'top') {
          const maxGrow = bandDrag.originHeight - 28;
          const shift = Math.min(Math.max(-bandDrag.originTop, delta), maxGrow);
          return { ...current, [bandDrag.id]: { top: bandDrag.originTop + shift, height: bandDrag.originHeight - shift } };
        }
        return { ...current, [bandDrag.id]: { top: bandDrag.originTop, height: Math.max(28, bandDrag.originHeight + delta) } };
      });
    };
    const onMove = (event: PointerEvent) => {
      lastClientY = event.clientY;
      if (bandDrag.mode === 'move') deleteArmedSetter(event.clientY < headerZone());
      applyLive(event.clientY);
    };
    const EDGE = 64;
    const MAX_SPEED = 18;
    const autoScroll = () => {
      rafId = window.requestAnimationFrame(autoScroll);
      const container = scroller();
      if (!container) return;
      const distanceTop = lastClientY - EDGE;
      const distanceBottom = window.innerHeight - EDGE - lastClientY;
      let deltaScroll = 0;
      if (distanceTop < 0) deltaScroll = -Math.min(MAX_SPEED, Math.ceil(-distanceTop / 6));
      else if (distanceBottom < 0) deltaScroll = Math.min(MAX_SPEED, Math.ceil(-distanceBottom / 6));
      if (deltaScroll === 0) return;
      container.scrollTop += deltaScroll;
      if (bandDrag.mode === 'move') deleteArmedSetter(lastClientY < headerZone());
      applyLive(lastClientY);
    };
    let rafId = window.requestAnimationFrame(autoScroll);
    const onUp = () => {
      window.cancelAnimationFrame(rafId);
      const armed = deleteArmedRef.current;
      deleteArmedSetter(false);
      setBandDrag((current) => {
        if (!current) return null;
        if (armed && current.mode === 'move') {
          onRequestDelete?.({ laneId: current.laneId, sectionId: current.id });
        } else if (liveBands[current.id]) {
          const live = liveBands[current.id];
          updateSection(current.laneId, current.id, { top: Math.max(0, live.top), height: live.height });
        }
        return null;
      });
      setLiveBands({});
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [bandDrag, liveBands, updateSection, onRequestDelete]);

  const startBandDrag = useCallback((event: React.PointerEvent, laneId: string, section: TodoLaneSection, mode: 'move' | 'top' | 'bottom') => {
    event.preventDefault();
    event.stopPropagation();
    setLiveBands({});
    setBandDrag({ laneId, id: section.id, mode, startY: event.clientY, originTop: section.top, originHeight: section.height });
  }, []);

  return <>
    {lanes.flatMap((lane) => lane.sections.filter((section) => section.id !== hiddenSectionId).map((section) => {
      const live = liveBands[section.id];
      const top = live ? live.top : section.top;
      const height = live ? live.height : section.height;
      const isDragging = bandDrag?.id === section.id;
      return (
        <div
          key={section.id}
          className="pointer-events-none absolute inset-x-0 rounded-lg transition-shadow"
          style={{ top, height, backgroundColor: isDragging && deleteArmed ? 'rgba(244,63,94,0.25)' : withAlpha(section.color, 0.35), zIndex: 0, boxShadow: isDragging ? (deleteArmed ? '0 0 0 1.5px rgba(244,63,94,0.6)' : '0 0 0 1.5px rgba(139,92,246,0.45)') : undefined }}
        >
          <div className="pointer-events-auto absolute inset-x-0 -top-px h-1.5 cursor-row-resize" onPointerDown={(event) => startBandDrag(event, lane.id, section, 'top')} title="拖拽调整色块上边缘" style={{ touchAction: 'none' }} />
          <div className="pointer-events-auto absolute inset-x-0 -bottom-px h-1.5 cursor-row-resize" onPointerDown={(event) => startBandDrag(event, lane.id, section, 'bottom')} title="拖拽调整色块下边缘" style={{ touchAction: 'none' }} />
          <SectionTabWrapper laneId={lane.id} section={section} onHandleDown={(event) => startBandDrag(event, lane.id, section, 'move')} />
        </div>
      );
    }))}
  </>;
};

interface BoardNodeData extends Record<string, unknown> { itemId: string; text: string; done: boolean; color?: string; progressStatus?: 'not-started' | 'in-progress' | 'cancelled'; isDirectory?: boolean }

const boardColors: Record<string, string> = {
  emerald: '#67c8bd', rose: '#d78fb5', sky: '#79bfd5', amber: '#d9b958', violet: '#9b8ae4', indigo: '#9387d1',
};

const mixWithWhite = (hex: string, ratio: number) => {
  const channels = hex.replace('#', '').match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) return '#f6f5fc';
  return `#${channels.map((channel) => Math.round(255 - (255 - channel) * ratio).toString(16).padStart(2, '0')).join('')}`;
};

const BoardNode = React.memo(({ id, data, selected }: NodeProps<Node<BoardNodeData>>) => {
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [pointerX, setPointerX] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setDraft(data.text); inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const { handleClick, cancel } = useTapClick((_element, event) => { setPointerX(event.clientX); setToolbarOpen((open) => !open); });
  const color = boardColors[data.color || ''] || data.color || '#9387d1';
  const surface = mixWithWhite(color, 0.08);
  const borderColor = mixWithWhite(color, 0.34);
  return <div
    ref={nodeRef}
    className={`group relative flex h-full min-h-10 w-full items-center border shadow-md transition-colors px-4 py-2 ${data.isDirectory ? 'rounded-xl justify-start' : 'rounded-[999px] justify-center'} ${data.done && !data.isDirectory ? 'border-neutral-300 bg-neutral-100/90' : ''} ${editing ? 'nodrag' : ''}`}
    style={data.isDirectory ? { backgroundColor: surface, borderColor: selected ? color : borderColor } : data.done ? undefined : { borderColor: color }}
    onClick={(event) => { if (editing) return; if ((event.target as HTMLElement).closest('button, [role="toolbar"]')) return; handleClick(event); }}
    onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; cancel(); setToolbarOpen(false); setEditing(true); }}
    title={editing ? undefined : '单击显示操作，双击编辑'}>
    <NodeResizer isVisible={selected} minWidth={128} minHeight={40} maxWidth={Number.POSITIVE_INFINITY} maxHeight={180} color={color} handleStyle={{ width: 8, height: 8, borderRadius: 3 }} onResizeEnd={(_event, params) => update(data.itemId, { width: params.width, height: params.height })} />
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-400" />
    {data.isDirectory ? <span className="absolute inset-y-2 left-1.5 w-1 rounded-full" style={{ backgroundColor: color }} /> : null}
    <div className="flex w-full items-center gap-2">
      <TodoCheckbox done={data.done} onClick={() => toggle(data.itemId)} />
      <input
        ref={inputRef}
        readOnly={!editing}
        value={editing ? draft : data.text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!editing) return;
          setEditing(false);
          const text = draft.trim();
          if (!text) { if (data.text !== '未命名待办') update(data.itemId, { text: '未命名待办' }); return; }
          if (text !== data.text) update(data.itemId, { text });
        }}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); if (event.key === 'Escape') event.currentTarget.blur(); }}
        className={`min-w-0 flex-1 bg-transparent py-1 text-xs font-semibold outline-none ${editing ? 'nodrag cursor-text' : 'cursor-default'} ${data.done || data.progressStatus === 'cancelled' ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}
        aria-label={data.isDirectory ? '目录标题' : '待办文本'}
      />
      <TodoTimeLabel itemId={data.itemId} />
      <TodoStatusBadge itemId={data.itemId} compact={data.isDirectory} />
    </div>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white" style={{ backgroundColor: color }} />
    <TodoItemToolbarHost itemId={data.itemId} open={toolbarOpen} anchor={nodeRef.current} pointerX={pointerX} onClose={() => setToolbarOpen(false)} showDirectoryToggle />
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
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id || (item.referencedLaneIds || []).includes(lane.id)), [allItems, lane.id]);
  const nodes = useMemo<Node<BoardNodeData>[]>(() => items.map((item) => ({ id: item.id, type: 'todoNode', position: item.position, width: item.width, height: item.height, data: { itemId: item.id, text: item.text, done: item.isDone, color: item.color, progressStatus: item.progressStatus, isDirectory: item.isDirectory } })), [items]);
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
  const addSection = useAppStore((state) => state.addTodoLaneSection);
  const pendingFocusLaneId = useAppStore((state) => state.pendingFocusLaneId);
  const consumeFocusedLane = useAppStore((state) => state.consumeFocusedLane);
  const [boardLaneId, setBoardLaneId] = useState<string | null>(null);
  const [laneView, setLaneView] = useState<TodoLaneView>('board');
  const [focusedLaneId, setFocusedLaneId] = useState<string | null>(null);
  const [headerDrag, setHeaderDrag] = useState<{ y: number; inContainer: boolean } | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target || !target.closest('[data-app-header]')) return;
      if (target.closest('button, input, select, [role="toolbar"], label')) return;
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;
      const move = (moveEvent: PointerEvent) => {
        if (!active) {
          if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
          active = true;
        }
        const container = document.querySelector('[data-lanes-container]') as HTMLElement | null;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const inContainer = moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom && moveEvent.clientX > rect.left && moveEvent.clientX < rect.right;
        setHeaderDrag({ y: moveEvent.clientY, inContainer });
      };
      const up = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!active) return;
        const container = document.querySelector('[data-lanes-container]') as HTMLElement | null;
        if (container && upEvent.clientY > container.getBoundingClientRect().top) {
          const top = upEvent.clientY - container.getBoundingClientRect().top + container.scrollTop;
          addSection(allLanes[0]?.id || '', undefined, top);
        }
        setHeaderDrag(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [addSection, allLanes]);
  const [pendingBandDelete, setPendingBandDelete] = useState<{ laneId: string; sectionId: string } | null>(null);
  const deleteSection = useAppStore((state) => state.deleteTodoLaneSection);
  const lanes = useMemo(() => allLanes.filter(visibleLane), [allLanes]);
  const laneNamesById = useMemo(() => new Map(allLanes.map((lane) => [lane.id, lane.name])), [allLanes]);
  const boardLane = boardLaneId ? lanes.find((lane) => lane.id === boardLaneId) : null;

  useEffect(() => {
    if (!pendingFocusLaneId) return;
    const laneId = pendingFocusLaneId;
    consumeFocusedLane();
    setBoardLaneId(null);
    window.setTimeout(() => {
      const card = document.querySelector(`[data-lane-card="${laneId}"]`) as HTMLElement | null;
      const scroller = document.querySelector('[data-todo-scroller]') as HTMLElement | null;
      if (!card || !scroller) return;
      let offset = 0;
      let node: HTMLElement | null = card;
      while (node && node !== scroller) {
        offset += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const target = offset - (scroller.clientHeight - card.offsetHeight) / 2;
      scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      setFocusedLaneId(laneId);
      window.setTimeout(() => setFocusedLaneId((current) => (current === laneId ? null : current)), 1600);
    }, 60);
  }, [pendingFocusLaneId, consumeFocusedLane]);

  if (boardLane) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50 p-6"><div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col"><div className="flex items-center justify-between gap-3"><h2 className="truncate text-lg font-bold text-neutral-800">{boardLane.name}</h2><TodoViewSwitcher view={laneView} onChange={setLaneView} onBack={() => setBoardLaneId(null)} /></div><div className="mt-5 flex min-h-0 flex-1">{laneView === 'board' ? <ReactFlowProvider><BoardCanvas lane={boardLane} /></ReactFlowProvider> : laneView === 'kanban' ? <TodoBoard lane={boardLane} /> : <TodoGantt lane={boardLane} />}</div></div></div>;
  }
  return <div data-todo-scroller className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-50 p-6 custom-scrollbar"><div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3"><h2 className="text-lg font-bold text-neutral-800">Todo</h2><div className="flex items-center gap-1 text-xs text-neutral-400"><List className="h-3.5 w-3.5" />List</div></div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => addLane()} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Plus className="h-4 w-4" />新增分线</button>
      </div>
    </div>
    {headerDrag ? (() => {
      const container = document.querySelector('[data-lanes-container]') as HTMLElement | null;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return createPortal(
        <div className="pointer-events-none fixed z-[300] rounded-lg border-2 border-dashed border-purple-400 bg-purple-200/40" style={{ top: headerDrag.y, left: rect.left, width: rect.width, height: 120, opacity: headerDrag.inContainer ? 1 : 0.45 }}>
          <span className="absolute -top-6 left-2 rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">松手创建分段色块</span>
        </div>,
        document.body,
      );
    })() : null}
    <div data-lanes-container className="relative mt-6 flex flex-col gap-4">{lanes.map((lane) => <ListLane key={lane.id} lane={lane} laneNamesById={laneNamesById} highlight={focusedLaneId === lane.id} onOpenView={(view) => { setLaneView(view); setBoardLaneId(lane.id); }} />)}<LaneBandsLayer lanes={lanes} hiddenSectionId={pendingBandDelete?.sectionId} onRequestDelete={setPendingBandDelete} /></div>
    {pendingBandDelete ? createPortal(
      <div className="fixed left-1/2 top-3 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 shadow-xl">
        <span className="text-xs font-bold text-neutral-700">删除这个分段色块？</span>
        <button type="button" onClick={() => { deleteSection(pendingBandDelete.laneId, pendingBandDelete.sectionId, 'merge'); setPendingBandDelete(null); }} className="flex h-8 items-center rounded-lg border border-rose-500 bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700">确认删除</button>
        <button type="button" onClick={() => setPendingBandDelete(null)} className="flex h-8 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100">取消</button>
      </div>,
      document.body,
    ) : null}
  </div></div>;
};
