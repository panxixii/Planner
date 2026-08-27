import React, { useEffect, useRef, useState } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { Check, PanelRightOpen, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';

interface TaskNodeData {
  taskId: string;
  goalId?: string | null;
  isMerged?: boolean;
}

const colorMap: Record<string, { accent: string; surface: string; border: string }> = {
  emerald: { accent: '#67c8bd', surface: '#f0fbf8', border: '#b9e5df' },
  rose: { accent: '#d78fb5', surface: '#fff5fa', border: '#efc9dc' },
  sky: { accent: '#79bfd5', surface: '#f2fbfd', border: '#bedfe8' },
  amber: { accent: '#d9b958', surface: '#fffbed', border: '#eadb9f' },
  violet: { accent: '#9b8ae4', surface: '#f8f5ff', border: '#d6ccf1' },
  indigo: { accent: '#9387d1', surface: '#f6f5fc', border: '#d1cbea' },
};

export const TaskNode = React.memo(({ id, data, selected }: NodeProps) => {
  const { taskId, goalId, isMerged } = data as unknown as TaskNodeData;
  const task = useAppStore((state) => state.tasks[taskId]);
  const selectTask = useAppStore((state) => state.selectTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const removeTaskFromWorkspace = useAppStore((state) => state.removeTaskFromWorkspace);
  const deleteNodeFromGoal = useAppStore((state) => state.deleteNodeFromGoal);
  const workspaceCategoryFilter = useAppStore((state) => state.workspaceCategoryFilter);
  const showActions = useAppStore((state) => state.activeNodeActionsId === id);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (!task) {
    return (
      <div className="min-w-28 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-center text-xs text-neutral-500">
        任务未定义
      </div>
    );
  }

  const scheme = colorMap[task.color || 'indigo'] || colorMap.indigo;

  const startEditing = () => {
    if (isEditing) return;
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  const commitTitle = () => {
    if (draftTitle !== task.title) {
      updateTask(taskId, { title: draftTitle });
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={startEditing}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isEditing) {
          commitTitle();
        }
        setIsConfirmingDelete(false);
        setActiveNodeActionsId(showActions ? null : id);
      }}
      title="单击改名，双击显示节点操作"
      className={`planner-mind-node group relative flex h-10 min-w-28 max-w-52 items-center justify-center rounded-full border px-5 text-center transition-[box-shadow,border-color,transform,opacity] duration-150 ${
        task.isDone ? 'opacity-55' : ''
      } ${selected ? 'planner-mind-node-selected' : ''}`}
      style={{
        backgroundColor: task.isDone ? '#f7f8fa' : scheme.surface,
        borderColor: task.isDone ? (selected ? '#9ca3af' : '#d1d5db') : (selected ? scheme.accent : scheme.border),
        boxShadow: task.isDone
          ? (selected ? '0 0 0 3px #9ca3af26, 0 4px 12px #9ca3af20' : '0 2px 8px #9ca3af18')
          : selected
            ? `0 0 0 3px ${scheme.accent}26, 0 6px 16px ${scheme.accent}24`
            : `0 3px 10px ${scheme.accent}1c`,
      }}
    >
      {showActions ? (
        <div
          className="nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (isConfirmingDelete) {
                setActiveNodeActionsId(null);
                if (isMerged) {
                  removeTaskFromWorkspace(taskId, workspaceCategoryFilter);
                } else if (goalId) {
                  deleteNodeFromGoal(goalId, id);
                } else {
                  deleteTask(taskId);
                }
                return;
              }
              setIsConfirmingDelete(true);
            }}
            className={`flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
              isConfirmingDelete
                ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700'
                : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
            aria-label={isConfirmingDelete ? '确认从当前工作区移除' : '从当前工作区移除'}
            title={isConfirmingDelete ? '再次点击确认移除' : '从当前工作区移除'}
          >
            {isConfirmingDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span>{isConfirmingDelete ? '确认' : '删除'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsConfirmingDelete(false);
              setActiveNodeActionsId(null);
              selectTask(taskId);
            }}
            className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
            aria-label="打开任务详情"
            title="打开任务详情"
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
            <span>详情</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsConfirmingDelete(false);
              setActiveNodeActionsId(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="关闭全部节点操作"
            title="关闭全部节点操作"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <span
        className="absolute inset-y-2 left-1.5 w-1 rounded-full"
        style={{ backgroundColor: task.isDone ? '#b8c0cc' : scheme.accent }}
      />

      <input
        ref={inputRef}
        value={isEditing ? draftTitle : task.title}
        readOnly={!isEditing}
        aria-label="任务标题"
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => {
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          if (isEditing) commitTitle();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitTitle();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            skipBlurCommitRef.current = true;
            setDraftTitle(task.title);
            setIsEditing(false);
            event.currentTarget.blur();
          }
        }}
        className={`${isEditing ? 'nodrag nopan cursor-text' : 'cursor-pointer'} max-w-44 bg-transparent p-0 text-center text-xs font-semibold text-neutral-700 outline-none ${task.isDone ? 'line-through text-neutral-400' : ''}`}
        style={{ width: `${Math.max(4, Math.min((isEditing ? draftTitle : task.title).length, 20))}ch` }}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="planner-mind-handle planner-mind-handle-target"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="planner-mind-handle planner-mind-handle-source"
      />
    </div>
  );
});

TaskNode.displayName = 'TaskNode';
