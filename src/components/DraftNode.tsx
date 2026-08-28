import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Network, Trash2 } from 'lucide-react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { useAppStore } from '../store';
import { getComponentLabel } from '../workspaceComponents';

interface DraftNodeData {
  draftId: string;
  taskId: string;
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

const getScheme = (color: string) => {
  if (colorMap[color]) return colorMap[color];
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return { accent: color, surface: `${color}14`, border: `${color}55` };
  }
  return colorMap.indigo;
};

export const DraftNode = React.memo(({ id, data, selected }: NodeProps) => {
  const { draftId, taskId, onResizeStart, onResizeEnd } = data as unknown as DraftNodeData;
  const task = useAppStore((state) => state.tasks[taskId]);
  const draftNodePosition = useAppStore((state) => state.drafts.find((draft) => draft.id === draftId)?.nodes.find((node) => node.id === id)?.position);
  const components = useAppStore((state) => state.workspaceComponents);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const updateTask = useAppStore((state) => state.updateTask);
  const setTaskComponentIds = useAppStore((state) => state.setTaskComponentIds);
  const addWorkspaceNode = useAppStore((state) => state.addWorkspaceNode);
  const removeDraftNode = useAppStore((state) => state.removeDraftNode);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [showMembership, setShowMembership] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const assignedIds = useMemo(() => new Set<string>(task?.componentIds || []), [task?.componentIds]);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    if (!showMembership) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setShowMembership(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [showMembership]);

  if (!task) {
    return <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-500">任务数据已缺失</div>;
  }

  const scheme = getScheme(task.color || 'indigo');
  const commitTitle = () => {
    const nextTitle = title.trim();
    if (nextTitle !== task.title) updateTask(taskId, { title: nextTitle });
    setIsEditing(false);
  };

  const toggleComponent = (componentId: string, checked: boolean) => {
    const nextIds = new Set<string>(assignedIds as Set<string>);
    if (checked) nextIds.add(componentId);
    else nextIds.delete(componentId);
    setTaskComponentIds(taskId, Array.from(nextIds));

    if (checked && !workspaceNodes.some((node) => node.taskId === taskId)) {
      addWorkspaceNode({
        id: `node-draft-${taskId}`,
        taskId,
        position: draftNodePosition || { x: 120, y: 120 + workspaceNodes.length * 24 },
      });
    }
  };

  return (
    <div
      ref={rootRef}
      className={`planner-mind-node group relative flex h-full min-h-10 w-full min-w-28 items-center justify-center rounded-[999px] border px-5 text-center shadow-sm ${selected ? 'planner-mind-node-selected' : ''}`}
      style={{ backgroundColor: scheme.surface, borderColor: selected ? scheme.accent : scheme.border }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isEditing) commitTitle();
        setConfirmDelete(false);
        setShowMembership((value) => !value);
      }}
      title="单击改名，双击设置归属联通块"
    >
      <NodeResizer isVisible={selected} minWidth={112} minHeight={40} maxWidth={420} maxHeight={180} color={scheme.accent} handleStyle={{ width: 8, height: 8, borderRadius: 3 }} lineStyle={{ borderWidth: 1 }} onResizeStart={() => onResizeStart?.()} onResizeEnd={(_event, params) => onResizeEnd?.(id, params.width, params.height)} />
      {showMembership ? (
        <div
          className="nodrag nopan nowheel absolute bottom-full left-1/2 z-[10020] mb-2 w-64 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-2.5 text-left shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600"><Network className="h-3.5 w-3.5 text-purple-500" />归属联通块</span>
          </div>
          <p className="mb-2 px-1 text-[10px] leading-4 text-neutral-400">勾选后，这个节点会进入工作区，并可被对应联通块复用。</p>
          <div className="max-h-44 space-y-1 overflow-y-auto custom-scrollbar">
            {components.length > 0 ? components.map((component, index) => (
              <label key={component.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-neutral-50">
                <input type="checkbox" checked={assignedIds.has(component.id)} onChange={(event) => toggleComponent(component.id, event.target.checked)} className="h-3.5 w-3.5 accent-[#8d78d5]" />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: component.color }} />
                <span className="truncate">{getComponentLabel(component, index)}</span>
              </label>
            )) : <span className="block rounded-lg bg-neutral-50 px-2 py-3 text-center text-[11px] text-neutral-400">请先在工作区筛选栏新建联通块</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) removeDraftNode(draftId, id);
              else setConfirmDelete(true);
            }}
            className={`mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[11px] font-semibold ${confirmDelete ? 'border-rose-500 bg-rose-500 text-white' : 'border-rose-200 bg-rose-50 text-rose-500'}`}
          >
            {confirmDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            {confirmDelete ? '再次点击确认移除' : '从当前草稿移除'}
          </button>
        </div>
      ) : null}

      <span className="absolute inset-y-2 left-1.5 w-1 rounded-full" style={{ backgroundColor: scheme.accent }} />
      <input
        ref={inputRef}
        value={isEditing ? title : task.title}
        readOnly={!isEditing}
        onClick={(event) => {
          event.stopPropagation();
          if (!isEditing) {
            setTitle(task.title);
            setIsEditing(true);
          }
        }}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setTitle(task.title);
            setIsEditing(false);
            event.currentTarget.blur();
          }
        }}
        aria-label="草稿节点标题"
        className={`${isEditing ? 'nodrag nopan cursor-text' : 'cursor-pointer'} max-w-44 bg-transparent p-0 text-center text-xs font-semibold text-neutral-700 outline-none`}
        style={{ width: `${Math.max(4, Math.min((isEditing ? title : task.title).length, 20))}ch` }}
      />
      <Handle type="target" position={Position.Left} id="left" className="planner-mind-handle planner-mind-handle-target" />
      <Handle type="source" position={Position.Right} id="right" className="planner-mind-handle planner-mind-handle-source" />
    </div>
  );
});

DraftNode.displayName = 'DraftNode';
