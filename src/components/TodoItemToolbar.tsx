import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleDot, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoItem } from '../types';

type StatusKey = 'status-not-started' | 'status-in-progress' | 'status-completed';

const STATUS_OPTIONS: { key: StatusKey; label: string; dot: string }[] = [
  { key: 'status-not-started', label: '未开始', dot: '#94a3b8' },
  { key: 'status-in-progress', label: '进行中', dot: '#8b5cf6' },
  { key: 'status-completed', label: '已完成', dot: '#10b981' },
];

export const statusKeyOf = (item: TodoItem): StatusKey => (item.isDone ? 'status-completed' : item.progressStatus === 'in-progress' ? 'status-in-progress' : 'status-not-started');

export const TodoItemToolbarHost: React.FC<{
  itemId: string;
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
}> = ({ itemId, open, anchor, onClose }) => {
  const item = useAppStore((state) => state.todoItems.find((candidate) => candidate.id === itemId));
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  const remove = useAppStore((state) => state.removeTodoItem);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => { if (!open) { setConfirmDelete(false); setStatusOpen(false); } }, [open]);
  useEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    setPos({ top: Math.max(8, rect.top - 48), left: Math.max(110, Math.min(rect.left + rect.width / 2, window.innerWidth - 110)) });
  }, [open, anchor]);

  if (!open || !pos || !item) return null;

  const status = statusKeyOf(item);
  const applyStatus = (key: StatusKey) => {
    if (key === 'status-completed') {
      if (!item.isDone) toggle(item.id);
    } else {
      if (item.isDone) toggle(item.id);
      update(item.id, { progressStatus: key === 'status-in-progress' ? 'in-progress' : 'not-started' });
    }
    onClose();
  };

  return createPortal(
    <>
      <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={onClose} aria-label="关闭待办操作" />
      <div role="toolbar" aria-label="待办操作" className="fixed z-[200] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" style={{ top: pos.top, left: pos.left }}>
        <div className="relative">
          <button type="button" onClick={() => { setConfirmDelete(false); setStatusOpen((value) => !value); }} className="flex h-8 w-[76px] items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100" aria-label="变更状态" title="变更状态" aria-expanded={statusOpen}>
            <CircleDot className="h-3.5 w-3.5" /><span>状态</span>
          </button>
          {statusOpen ? (
            <div className="absolute bottom-full left-1/2 z-[210] mb-2 w-44 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold text-neutral-400">变更任务状态</p>
              <div className="space-y-0.5">
                {STATUS_OPTIONS.map((option) => (
                  <button key={option.key} type="button" onClick={() => applyStatus(option.key)} className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[11px] transition-colors ${status === option.key ? 'bg-purple-50 font-semibold text-purple-700' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                    <span className="flex items-center gap-2 truncate"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.dot }} />{option.label}</span>
                    {status === option.key ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirmDelete) { onClose(); remove(item.id); return; }
            setStatusOpen(false);
            setConfirmDelete(true);
          }}
          className={`flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors ${confirmDelete ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
          aria-label={confirmDelete ? '确认删除待办' : '删除待办'}
          title={confirmDelete ? '再次点击确认删除' : '删除待办'}
        >
          {confirmDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          <span>{confirmDelete ? '确认' : '删除'}</span>
        </button>
      </div>
    </>,
    document.body,
  );
};
