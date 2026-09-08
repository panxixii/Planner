import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, PanelRightOpen } from 'lucide-react';
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
  const updateComponent = useAppStore((state) => state.updateWorkspaceComponent);
  const handleNodeId = `handle-cc-${data.componentId}`;
  const showActions = useAppStore((state) => state.activeNodeActionsId === handleNodeId);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commitName = () => {
    updateComponent(data.componentId, { name: draftName });
    setIsEditing(false);
  };

  return (
    <div className={`relative ${showActions ? 'planner-node-actions-open' : ''}`}>
      {showActions ? (
        <div
          className="planner-node-popover nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => { setActiveNodeActionsId(null); openComponentDetails(data.componentId); }} className="flex h-8 min-w-[76px] items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-semibold text-neutral-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600" title="打开联通块详情"><PanelRightOpen className="h-3.5 w-3.5" />详情</button>
        </div>
      ) : null}
      <div
        onClick={(event) => {
          if (event.detail > 1 || isEditing) return;
          event.stopPropagation();
          setActiveNodeActionsId(showActions ? null : handleNodeId);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setActiveNodeActionsId(null);
          setDraftName(data.label);
          setIsEditing(true);
        }}
        className="group flex cursor-grab items-center gap-1.5 rounded-full border border-white/50 px-3 py-1.5 text-[11px] font-medium text-white shadow-md transition-opacity hover:opacity-90 active:cursor-grabbing"
        style={{ pointerEvents: 'all', backgroundColor: data.color }}
        title="单击显示操作，双击编辑名称；从右侧连接点拖出连线"
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-white/80" />
        {isEditing ? <input ref={inputRef} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={commitName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } else if (event.key === 'Escape') { setIsEditing(false); setDraftName(data.label); } }} className="nodrag nopan max-w-32 bg-transparent font-semibold text-white outline-none placeholder:text-white/60" aria-label="联通块名称" /> : <span className="max-w-32 truncate font-semibold">{data.label}</span>}
        <span className="rounded-full bg-black/15 px-1.5 py-0.5 font-mono text-[9px] leading-none text-white/90">{data.memberNodeIds.length} 节点</span>
      </div>
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
