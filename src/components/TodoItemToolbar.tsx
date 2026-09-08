import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderInput, ListTodo, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';

export const TodoItemToolbarHost: React.FC<{
  itemId: string;
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  showDirectoryToggle?: boolean;
}> = ({ itemId, open, anchor, onClose, showDirectoryToggle = false }) => {
  const item = useAppStore((state) => state.todoItems.find((candidate) => candidate.id === itemId));
  const remove = useAppStore((state) => state.removeTodoItem);
  const toggleDirectory = useAppStore((state) => state.toggleTodoItemDirectory);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);
  useEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    setPos({ top: Math.max(8, rect.top - 48), left: Math.max(90, Math.min(rect.left + rect.width / 2, window.innerWidth - 90)) });
  }, [open, anchor]);

  if (!open || !pos || !item) return null;

  return createPortal(
    <>
      <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={onClose} aria-label="关闭待办操作" />
      <div role="toolbar" aria-label="待办操作" className="fixed z-[200] flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" style={{ top: pos.top, left: pos.left }}>
        {showDirectoryToggle ? (
          <button
            type="button"
            onClick={() => { toggleDirectory(item.id); onClose(); }}
            className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            title={item.isDirectory ? '保留位置和连线并转换为任务节点' : '转换为目录节点'}
          >
            {item.isDirectory ? <ListTodo className="h-3.5 w-3.5" /> : <FolderInput className="h-3.5 w-3.5" />}
            <span>{item.isDirectory ? '任务' : '目录'}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (confirmDelete) { onClose(); remove(item.id); return; }
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
