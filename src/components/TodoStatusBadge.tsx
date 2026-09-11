import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Check, Circle, CircleCheck, CircleDashed } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoItem } from '../types';

type StatusKey = 'status-not-started' | 'status-in-progress' | 'status-completed' | 'status-cancelled';

const STATUS_META: Record<StatusKey, { label: string; dot: string; icon: React.FC<{ className?: string }> }> = {
  'status-not-started': { label: '未开始', dot: '#94a3b8', icon: CircleDashed },
  'status-in-progress': { label: '进行中', dot: '#8b5cf6', icon: Circle },
  'status-completed': { label: '已完成', dot: '#10b981', icon: CircleCheck },
  'status-cancelled': { label: '已取消', dot: '#f43f5e', icon: Ban },
};

const STATUS_ORDER: StatusKey[] = ['status-not-started', 'status-in-progress', 'status-completed', 'status-cancelled'];

export const statusKeyOf = (item: TodoItem): StatusKey => {
  if (item.isDone) return 'status-completed';
  if (item.progressStatus === 'in-progress') return 'status-in-progress';
  if (item.progressStatus === 'cancelled') return 'status-cancelled';
  return 'status-not-started';
};

export const isTodoItemStruck = (item: TodoItem): boolean => item.isDone || item.progressStatus === 'cancelled';

export const TodoStatusBadge: React.FC<{ itemId: string; compact?: boolean }> = ({ itemId, compact = false }) => {
  const item = useAppStore((state) => state.todoItems.find((candidate) => candidate.id === itemId));
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const open = menuPos !== null;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuPos(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!item) return null;
  const status = statusKeyOf(item);
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  const applyStatus = (key: StatusKey) => {
    if (key === 'status-completed') {
      if (!item.isDone) toggle(item.id);
    } else {
      if (item.isDone) toggle(item.id);
      update(item.id, { progressStatus: key === 'status-in-progress' ? 'in-progress' : key === 'status-cancelled' ? 'cancelled' : 'not-started' });
    }
    setMenuPos(null);
  };

  const openMenu = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 130) });
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(event) => { event.stopPropagation(); if (open) setMenuPos(null); else openMenu(); }}
        onDoubleClick={(event) => event.stopPropagation()}
        className={compact
          ? `flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5`
          : 'flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-bold transition-colors hover:brightness-95'}
        style={compact ? { color: meta.dot } : { color: meta.dot, borderColor: `${meta.dot}66`, backgroundColor: `${meta.dot}14` }}
        title={`${meta.label}（点击选择状态）`}
        aria-label={`状态：${meta.label}，点击选择`}
        aria-expanded={open}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
        {compact ? null : <span>{meta.label}</span>}
      </button>
      {open && menuPos ? createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={() => setMenuPos(null)} aria-label="关闭状态选择" />
          <div role="menu" aria-label="选择任务状态" className="fixed z-[200] w-32 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl" style={{ top: menuPos.top, left: menuPos.left }}>
            <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold text-neutral-400">变更任务状态</p>
            {STATUS_ORDER.map((key) => {
              const option = STATUS_META[key];
              const OptionIcon = option.icon;
              const isCurrent = key === status;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={(event) => { event.stopPropagation(); applyStatus(key); }}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors ${isCurrent ? 'bg-purple-50 font-semibold text-purple-700' : 'text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <OptionIcon className="h-3.5 w-3.5 shrink-0" style={{ color: option.dot }} />
                  <span className="flex-1">{option.label}</span>
                  {isCurrent ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
};
