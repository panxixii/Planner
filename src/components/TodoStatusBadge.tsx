import React from 'react';
import { Circle, CircleCheck, CircleDashed } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoItem } from '../types';

type StatusKey = 'status-not-started' | 'status-in-progress' | 'status-completed';

const STATUS_META: Record<StatusKey, { label: string; dot: string; icon: React.FC<{ className?: string }>; next: StatusKey }> = {
  'status-not-started': { label: '未开始', dot: '#94a3b8', icon: CircleDashed, next: 'status-in-progress' },
  'status-in-progress': { label: '进行中', dot: '#8b5cf6', icon: Circle, next: 'status-completed' },
  'status-completed': { label: '已完成', dot: '#10b981', icon: CircleCheck, next: 'status-not-started' },
};

export const statusKeyOf = (item: TodoItem): StatusKey => (item.isDone ? 'status-completed' : item.progressStatus === 'in-progress' ? 'status-in-progress' : 'status-not-started');

export const TodoStatusBadge: React.FC<{ itemId: string; compact?: boolean }> = ({ itemId, compact = false }) => {
  const item = useAppStore((state) => state.todoItems.find((candidate) => candidate.id === itemId));
  const update = useAppStore((state) => state.updateTodoItem);
  const toggle = useAppStore((state) => state.toggleTodoItemDone);
  if (!item) return null;
  const status = statusKeyOf(item);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const cycle = () => {
    const next = meta.next;
    if (next === 'status-completed') {
      if (!item.isDone) toggle(item.id);
      return;
    }
    if (item.isDone) toggle(item.id);
    update(item.id, { progressStatus: next === 'status-in-progress' ? 'in-progress' : 'not-started' });
  };
  if (compact) {
    return (
      <button type="button" onClick={(event) => { event.stopPropagation(); cycle(); }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5" style={{ color: meta.dot }} title={`${meta.label}（点击切换状态）`} aria-label={`状态：${meta.label}，点击切换`}>
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); cycle(); }} className="flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-bold transition-colors hover:brightness-95" style={{ color: meta.dot, borderColor: `${meta.dot}66`, backgroundColor: `${meta.dot}14` }} title={`${meta.label}（点击切换状态）`} aria-label={`状态：${meta.label}，点击切换`}>
      <Icon className="h-3 w-3" />
      <span>{meta.label}</span>
    </button>
  );
};
