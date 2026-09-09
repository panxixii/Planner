import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleDashed, CircleCheck, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import type { TodoItem, TodoLane } from '../types';
import { TodoItemToolbarHost } from './TodoItemToolbar';
import { TodoStatusBadge } from './TodoStatusBadge';
import { useTapClick } from './useTapClick';

const STATUS_COLUMNS: { id: string; label: string; accent: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'status-not-started', label: '未开始', accent: '#94a3b8', icon: CircleDashed },
  { id: 'status-in-progress', label: '进行中', accent: '#8b5cf6', icon: Circle },
  { id: 'status-completed', label: '已完成', accent: '#10b981', icon: CircleCheck },
];

const TodoCheckbox: React.FC<{ done: boolean; onClick: () => void }> = ({ done, onClick }) => (
  <button type="button" onClick={onClick} className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300 bg-white text-transparent hover:border-purple-400'}`} aria-label={done ? '标记为未完成' : '标记为完成'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
);

const TodoCard: React.FC<{
  item: TodoItem;
  isCurrent: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onToggle: () => void;
  onUpdate: (text: string) => void;
  onOpenToolbar: (el: HTMLElement, pointerX: number) => void;
}> = ({ item, isCurrent, dragging, onDragStart, onDragEnd, onToggle, onUpdate, onOpenToolbar }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setDraft(item.text); inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const { handleClick, cancel } = useTapClick((element, event) => onOpenToolbar(element, event.clientX));
  return (
    <article
      draggable
      onDragStart={(event) => { onDragStart(); event.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (editing) return;
        if ((event.target as HTMLElement).closest('button')) return;
        handleClick(event);
      }}
      onDoubleClick={(event) => { if ((event.target as HTMLElement).closest('button')) return; cancel(); setEditing(true); }}
      className={`group rounded-lg border bg-white px-2.5 py-2 shadow-sm transition-shadow hover:shadow-md ${editing ? 'cursor-text border-purple-200' : 'cursor-grab active:cursor-grabbing'} ${isCurrent ? 'border-neutral-200' : 'border-dashed border-neutral-300'}`}
      style={dragging ? { opacity: 0.4 } : undefined}
      title={editing ? undefined : '单击显示操作，双击编辑'}
    >
      <div className="flex items-center gap-2">
        <TodoCheckbox done={item.isDone} onClick={onToggle} />
        <input
          ref={inputRef}
          readOnly={!editing}
          value={editing ? draft : item.text}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setEditing(false);
            const text = draft.trim();
            if (!text) { if (item.text !== '未命名待办') onUpdate('未命名待办'); return; }
            if (text !== item.text) onUpdate(text);
          }}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); if (event.key === 'Escape') event.currentTarget.blur(); }}
          className={`min-w-0 flex-1 bg-transparent py-0.5 text-xs font-semibold outline-none ${editing ? 'cursor-text' : 'cursor-default'} ${item.isDone ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}
          aria-label="待办文本"
        />
        <TodoStatusBadge itemId={item.id} />
      </div>
    </article>
  );
};

export const TodoBoard: React.FC<{ lane: TodoLane }> = ({ lane }) => {
  const allItems = useAppStore((state) => state.todoItems);
  const toggleDone = useAppStore((state) => state.toggleTodoItemDone);
  const createItem = useAppStore((state) => state.createTodoItem);
  const updateItem = useAppStore((state) => state.updateTodoItem);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);
  const [toolbar, setToolbar] = useState<{ id: string; el: HTMLElement; x: number } | null>(null);
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id && !item.isDirectory).sort((a, b) => a.order - b.order), [allItems, lane.id]);
  const doneSet = useMemo(() => new Set(items.filter((item) => item.isDone).map((item) => item.id)), [items]);
  const columns = useMemo(() => STATUS_COLUMNS.map((column) => ({
    ...column,
    items: items.filter((item) => {
      if (column.id === 'status-completed') return item.isDone;
      if (column.id === 'status-in-progress') return !item.isDone && item.progressStatus === 'in-progress';
      return !item.isDone && item.progressStatus !== 'in-progress';
    }),
  })), [items]);

  const moveToColumn = (itemId: string, columnId: string) => {
    setDragId(null);
    setDropColumn(null);
    if (columnId === 'status-completed') {
      if (!doneSet.has(itemId)) toggleDone(itemId);
      return;
    }
    if (doneSet.has(itemId)) toggleDone(itemId);
    updateItem(itemId, { progressStatus: columnId === 'status-in-progress' ? 'in-progress' : 'not-started' });
  };

  const statusOf = (item: TodoItem) => {
    if (item.isDone) return 'status-completed';
    return item.progressStatus === 'in-progress' ? 'status-in-progress' : 'status-not-started';
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-6 pb-2">
      {columns.map((column) => (
        <section
          key={column.id}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropColumn(column.id); }}
          onDragLeave={() => setDropColumn((current) => (current === column.id ? null : current))}
          onDrop={(event) => { event.preventDefault(); if (dragId) moveToColumn(dragId, column.id); }}
          className={`flex min-h-0 flex-col rounded-xl border bg-white/85 shadow-xs transition-colors ${dropColumn === column.id && dragId ? 'border-purple-300 bg-purple-50/50' : 'border-neutral-200'}`}
        >
          <header className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center" style={{ color: column.accent }}>
                <column.icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-neutral-700">{column.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400">{column.items.length}</span>
              {column.id === 'status-not-started' ? (
                <button type="button" onClick={() => createItem(lane.id, '新待办')} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title="添加待办"><Plus className="h-3.5 w-3.5" /></button>
              ) : null}
            </div>
          </header>
          <div className="flex min-h-24 flex-1 flex-col gap-1.5 p-2">
            {column.items.map((item) => {
              const isCurrent = statusOf(item) === column.id;
              return (
                <TodoCard key={item.id} item={item} isCurrent={isCurrent} dragging={dragId === item.id} onDragStart={() => setDragId(item.id)} onDragEnd={() => { setDragId(null); setDropColumn(null); }} onToggle={() => toggleDone(item.id)} onUpdate={(text) => updateItem(item.id, { text })} onOpenToolbar={(el, x) => setToolbar((current) => current?.id === item.id ? null : { id: item.id, el, x })} />
              );
            })}
            {column.items.length === 0 ? <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-neutral-200 py-6 text-[11px] text-neutral-300">拖拽任务到此列</div> : null}
          </div>
        </section>
      ))}
      {toolbar ? <TodoItemToolbarHost itemId={toolbar.id} open anchor={toolbar.el} pointerX={toolbar.x} onClose={() => setToolbar(null)} /> : null}
    </div>
  );
};
