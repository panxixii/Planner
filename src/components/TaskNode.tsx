import React, { useEffect, useRef, useState } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { Check, CircleDot, ListMinus, ListPlus, Network, PanelRightOpen, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { getComponentLabel, getTaskComponentIds } from '../workspaceComponents';

interface TaskNodeData {
  taskId: string;
  goalId?: string | null;
  isMerged?: boolean;
  onResizeStart?: () => void;
  onResizeEnd?: (nodeId: string, width: number, height: number) => void;
}

const colorMap: Record<string, { accent: string; surface: string; border: string }> = {
  emerald: { accent: '#67c8bd', surface: '#f0fbf8', border: '#b9e5df' },
  rose: { accent: '#d78fb5', surface: '#fff5fa', border: '#efc9dc' },
  sky: { accent: '#79bfd5', surface: '#f2fbfd', border: '#bedfe8' },
  amber: { accent: '#d9b958', surface: '#fffbed', border: '#eadb9f' },
  violet: { accent: '#9b8ae4', surface: '#f8f5ff', border: '#d6ccf1' },
  indigo: { accent: '#9387d1', surface: '#f6f5fc', border: '#d1cbea' },
};

const mixHexWithWhite = (color: string, colorRatio: number) => {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) return '#f6f5fc';
  return `#${channels.map((channel) => Math.round(255 - (255 - channel) * colorRatio).toString(16).padStart(2, '0')).join('')}`;
};

const hexToScheme = (color: string) => ({
  accent: color,
  surface: mixHexWithWhite(color, 0.08),
  border: mixHexWithWhite(color, 0.34),
});

export const TaskNode = React.memo(({ id, data, selected }: NodeProps) => {
  const { taskId, goalId, isMerged, onResizeStart, onResizeEnd } = data as unknown as TaskNodeData;
  const task = useAppStore((state) => state.tasks[taskId]);
  const selectTask = useAppStore((state) => state.selectTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const removeTaskFromWorkspace = useAppStore((state) => state.removeTaskFromWorkspace);
  const deleteNodeFromGoal = useAppStore((state) => state.deleteNodeFromGoal);
  const workspaceComponentFilter = useAppStore((state) => state.workspaceComponentFilter);
  const setTaskComponentIds = useAppStore((state) => state.setTaskComponentIds);
  const addTaskToTodo = useAppStore((state) => state.addTaskToTodo);
  const removeTaskFromTodo = useAppStore((state) => state.removeTaskFromTodo);
  const isInTodo = useAppStore((state) => state.todoItems.some((item) => item.taskId === taskId));
  const components = useAppStore((state) => state.workspaceComponents);
  const taskStatuses = useAppStore((state) => state.taskStatuses);
  const showActions = useAppStore((state) => state.activeNodeActionsId === id);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingTodoRemoval, setIsConfirmingTodoRemoval] = useState(false);
  const [isChoosingComponents, setIsChoosingComponents] = useState(false);
  const [isChoosingStatus, setIsChoosingStatus] = useState(false);
  const assignedComponentIds = new Set(task ? getTaskComponentIds(task) : []);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (showActions) return;
    setIsConfirmingDelete(false);
    setIsConfirmingTodoRemoval(false);
    setIsChoosingComponents(false);
    setIsChoosingStatus(false);
  }, [showActions]);

  if (!task) {
    return (
      <div className="min-w-28 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-center text-xs text-neutral-500">
        任务未定义
      </div>
    );
  }

  const selectedColor = task.color || 'indigo';
  const scheme = colorMap[selectedColor] || (/^#[0-9a-f]{6}$/i.test(selectedColor) ? hexToScheme(selectedColor) : colorMap.indigo);

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
      onClick={(event) => {
        if (event.detail > 1 || isEditing) return;
        setIsConfirmingDelete(false);
        setIsConfirmingTodoRemoval(false);
        setIsChoosingComponents(false);
        setIsChoosingStatus(false);
        setActiveNodeActionsId(showActions ? null : id);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsConfirmingDelete(false);
        setIsConfirmingTodoRemoval(false);
        setIsChoosingComponents(false);
        setIsChoosingStatus(false);
        setActiveNodeActionsId(null);
        startEditing();
      }}
      title="单击显示节点操作，双击编辑标题"
      className={`planner-mind-node group relative flex h-full min-h-10 w-full min-w-28 items-center justify-center rounded-[999px] border px-5 text-center transition-[box-shadow,border-color,transform] duration-150 ${selected ? 'planner-mind-node-selected' : ''} ${showActions ? 'planner-node-actions-open' : ''}`}
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
      <NodeResizer isVisible={selected} minWidth={112} minHeight={40} maxWidth={420} maxHeight={180} color={scheme.accent} handleStyle={{ width: 8, height: 8, borderRadius: 3 }} lineStyle={{ borderWidth: 1 }} onResizeStart={() => onResizeStart?.()} onResizeEnd={(_event, params) => onResizeEnd?.(id, params.width, params.height)} />
      {showActions ? (
        <div
          className="planner-node-popover nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
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
                  removeTaskFromWorkspace(taskId, workspaceComponentFilter);
                } else if (goalId) {
                  deleteNodeFromGoal(goalId, id);
                } else {
                  deleteTask(taskId);
                }
                return;
              }
              setIsConfirmingDelete(true);
              setIsConfirmingTodoRemoval(false);
              setIsChoosingComponents(false);
              setIsChoosingStatus(false);
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

          {isMerged ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  setIsConfirmingTodoRemoval(false);
                  setIsChoosingStatus(false);
                  setIsChoosingComponents((value) => !value);
                }}
                className="flex h-8 w-[76px] items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 text-[11px] font-semibold text-purple-600 transition-colors hover:bg-purple-100"
                aria-label="设置归属联通块"
                title="让此节点也在其他联通块中使用"
              >
                <Network className="h-3.5 w-3.5" />
                <span>归属</span>
              </button>
              {isChoosingComponents ? (
                <div className="planner-node-popover absolute bottom-full left-1/2 z-[10001] mb-2 w-56 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl">
                  <p className="px-1 pb-1.5 text-[10px] font-semibold text-neutral-500">所属联通块</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto custom-scrollbar">
                    {components.length > 0 ? components.map((component, index) => (
                      <label key={component.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-neutral-600 hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={assignedComponentIds.has(component.id)}
                          onChange={(event) => {
                            const nextIds = new Set(assignedComponentIds);
                            if (event.target.checked) nextIds.add(component.id);
                            else nextIds.delete(component.id);
                            setTaskComponentIds(taskId, Array.from(nextIds));
                          }}
                          className="h-3.5 w-3.5 accent-[#8d78d5]"
                        />
                        <span className="truncate">{getComponentLabel(component, index)}</span>
                      </label>
                    )) : (
                      <span className="block px-2 py-2 text-[11px] text-neutral-400">暂无联通块</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsConfirmingDelete(false);
                setIsConfirmingTodoRemoval(false);
                setIsChoosingComponents(false);
                setIsChoosingStatus((value) => !value);
              }}
              className="flex h-8 w-[76px] items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              aria-label="变更任务状态"
              title="变更任务状态"
            >
              <CircleDot className="h-3.5 w-3.5" />
              <span>状态</span>
            </button>
            {isChoosingStatus ? (
              <div className="planner-node-popover absolute bottom-full left-1/2 z-[10001] mb-2 w-44 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold text-neutral-400">变更任务状态</p>
                <div className="max-h-52 space-y-0.5 overflow-y-auto custom-scrollbar">
                  {taskStatuses.map((status) => {
                    const isCurrent = (task.statusId || (task.isDone ? 'status-completed' : 'status-not-started')) === status.id;
                    return (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => {
                          updateTask(taskId, { statusId: status.id });
                          setIsChoosingStatus(false);
                          setActiveNodeActionsId(null);
                        }}
                        className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[11px] transition-colors ${
                          isCurrent ? 'bg-purple-50 font-semibold text-purple-700' : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="truncate">{status.label}</span>
                        {isCurrent ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsConfirmingDelete(false);
              setIsChoosingComponents(false);
              setIsChoosingStatus(false);
              if (!isInTodo) {
                addTaskToTodo(taskId);
                setActiveNodeActionsId(null);
                return;
              }
              if (isConfirmingTodoRemoval) {
                removeTaskFromTodo(taskId);
                setIsConfirmingTodoRemoval(false);
                setActiveNodeActionsId(null);
                return;
              }
              setIsConfirmingTodoRemoval(true);
            }}
            className={`flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
              isConfirmingTodoRemoval
                ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700'
                : isInTodo
                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : 'border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100'
            }`}
            aria-label={isConfirmingTodoRemoval ? '确认从 Todo 移除' : isInTodo ? '从 Todo 移除' : '加入 Todo 主线'}
            title={isConfirmingTodoRemoval ? '再次点击确认移除' : isInTodo ? '从 Todo 移除此任务' : '加入此任务及其子节点'}
          >
            {isConfirmingTodoRemoval ? <Trash2 className="h-3.5 w-3.5" /> : isInTodo ? <ListMinus className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
            <span>Todo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsConfirmingDelete(false);
              setIsConfirmingTodoRemoval(false);
              setIsChoosingComponents(false);
              setIsChoosingStatus(false);
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

        </div>
      ) : null}

      <span
        className="absolute inset-y-2 left-1.5 w-1 rounded-full"
        style={{ backgroundColor: task.isDone ? '#b8c0cc' : scheme.accent }}
      />

      <textarea
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
        rows={1}
        className={`${isEditing ? 'nodrag nopan cursor-text' : 'cursor-pointer'} h-full w-full resize-none overflow-hidden bg-transparent px-2 py-2 text-center text-xs font-semibold leading-4 outline-none ${task.isDone ? 'line-through opacity-55' : ''}`}
        style={{ color: task.textColor || '#334155' }}
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
