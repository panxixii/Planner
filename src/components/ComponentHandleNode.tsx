import React, { useMemo } from 'react';
import { Check, GripHorizontal, ListPlus, PanelRightOpen } from 'lucide-react';
import { Handle, Position } from '@xyflow/react';
import { useAppStore } from '../store';

interface ComponentHandleNodeData {
  label: string;
  memberNodeIds: string[];
  componentId: string;
  color: string;
}

export const ComponentHandleNode: React.FC<{ data: ComponentHandleNodeData }> = ({ data }) => {
  const openComponentDetails = useAppStore((state) => state.openComponentDetails);
  const addComponentToTodo = useAppStore((state) => state.addComponentToTodo);
  const tasks = useAppStore((state) => state.tasks);
  const todoItems = useAppStore((state) => state.todoItems);
  const memberTaskIds = useMemo(() => Object.values(tasks)
    .filter((task) => task.componentIds?.includes(data.componentId))
    .map((task) => task.id), [data.componentId, tasks]);
  const todoTaskIds = useMemo(() => new Set(todoItems.map((item) => item.taskId)), [todoItems]);
  const handleNodeId = `handle-cc-${data.componentId}`;
  const showActions = useAppStore((state) => state.activeNodeActionsId === handleNodeId);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const allInTodo = memberTaskIds.length > 0 && memberTaskIds.every((taskId) => todoTaskIds.has(taskId));

  return (
    <div className={`relative ${showActions ? 'planner-node-actions-open' : ''}`}>
      {showActions ? (
        <div
          className="planner-node-popover nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            disabled={memberTaskIds.length === 0 || allInTodo}
            onClick={() => {
              addComponentToTodo(data.componentId);
              setActiveNodeActionsId(null);
            }}
            className="flex h-8 min-w-[104px] items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold text-sky-600 transition-colors hover:bg-sky-100 disabled:cursor-default disabled:opacity-50"
            title={allInTodo ? '此联通块的节点均已在 Todo 中' : '创建同名 Todo 分线并加入全部未加入节点'}
          >
            {allInTodo ? <Check className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
            <span>{allInTodo ? '已全部加入' : '加入 Todo'}</span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          if (event.detail > 1) return;
          event.stopPropagation();
          setActiveNodeActionsId(showActions ? null : handleNodeId);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setActiveNodeActionsId(null);
          openComponentDetails(data.componentId);
        }}
        className="group flex cursor-grab items-center gap-1.5 rounded-full border border-white/50 px-3 py-1.5 text-[11px] font-medium text-white shadow-md transition-opacity hover:opacity-90 active:cursor-grabbing"
        style={{ pointerEvents: 'all', backgroundColor: data.color }}
        title="单击显示操作；双击打开详情；从右侧连接点拖出连线"
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-white/80" />
        <span className="max-w-32 truncate font-semibold">{data.label}</span>
        <span className="rounded-full bg-black/15 px-1.5 py-0.5 font-mono text-[9px] leading-none text-white/90">{data.memberNodeIds.length} 节点</span>
        <PanelRightOpen className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="planner-mind-handle planner-mind-handle-source"
        style={{ width: 10, height: 10, right: -5, backgroundColor: data.color, borderColor: '#fff' }}
        title="拖动连接任务节点"
      />
    </div>
  );
};
