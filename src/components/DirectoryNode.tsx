import React, { useEffect, useRef, useState } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { Check, ChevronDown, ChevronRight, Clock3, ListPlus, ListTodo, Network, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { getComponentLabel } from '../workspaceComponents';
import { getNodeColorScheme } from '../nodeColors';
import { DateTimePicker } from './DateTimePicker';

interface DirectoryNodeData {
  directoryId: string;
  onResizeStart?: () => void;
  onResizeEnd?: (nodeId: string, width: number, height: number) => void;
}

const toLocalDateTimeInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const DirectoryNode = React.memo(({ id, data, selected }: NodeProps) => {
  const { directoryId, onResizeStart, onResizeEnd } = data as unknown as DirectoryNodeData;
  const directory = useAppStore((state) => state.workspaceDirectories.find((item) => item.id === directoryId));
  const components = useAppStore((state) => state.workspaceComponents);
  const updateDirectory = useAppStore((state) => state.updateWorkspaceDirectory);
  const deleteDirectory = useAppStore((state) => state.deleteWorkspaceDirectory);
  const addDirectoryToTodo = useAppStore((state) => state.addDirectoryToTodo);
  const convertToTask = useAppStore((state) => state.convertWorkspaceDirectoryToTask);
  const showActions = useAppStore((state) => state.activeNodeActionsId === id);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [isChoosingComponents, setIsChoosingComponents] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [timeError, setTimeError] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    if (showActions) return;
    setIsEditingTime(false);
    setIsChoosingComponents(false);
    setIsConfirmingDelete(false);
    setTimeError('');
  }, [showActions]);

  if (!directory) return null;

  const scheme = getNodeColorScheme(directory.color);
  const assignedComponentIds = new Set(directory.componentIds);
  const startEditing = () => {
    if (isEditing) return;
    setDraftName(directory.name);
    setIsEditing(true);
  };
  const commitName = () => {
    const name = draftName.trim() || '未命名目录';
    if (name !== directory.name) updateDirectory(directory.id, { name });
    setIsEditing(false);
  };
  const openTimeEditor = () => {
    setDraftStart(directory.startTime || '');
    setDraftEnd(directory.endTime || '');
    setTimeError('');
    setIsChoosingComponents(false);
    setIsEditingTime((open) => !open);
  };
  const saveTimeRange = () => {
    if (!draftStart && !draftEnd) {
      updateDirectory(directory.id, { startTime: undefined, endTime: undefined });
      setIsEditingTime(false);
      setTimeError('');
      return;
    }
    if (!draftEnd) {
      setTimeError('请至少设置截止时间');
      return;
    }
    const effectiveStart = draftStart || toLocalDateTimeInput(new Date());
    if (effectiveStart >= draftEnd) {
      setTimeError('截止时间必须晚于开始时间');
      return;
    }
    updateDirectory(directory.id, { startTime: effectiveStart, endTime: draftEnd });
    setIsEditingTime(false);
    setTimeError('');
  };

  return (
    <div
      onClick={(event) => {
        if (event.detail > 1 || isEditing) return;
        setIsEditingTime(false);
        setIsChoosingComponents(false);
        setIsConfirmingDelete(false);
        setActiveNodeActionsId(showActions ? null : id);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditingTime(false);
        setIsChoosingComponents(false);
        setIsConfirmingDelete(false);
        setActiveNodeActionsId(null);
        startEditing();
      }}
      className={`planner-mind-node group relative flex h-full min-h-10 w-full min-w-28 items-center justify-center rounded-xl border px-5 text-center transition-[box-shadow,border-color,transform] duration-150 ${selected ? 'planner-mind-node-selected' : ''} ${showActions ? 'planner-node-actions-open' : ''}`}
      style={{
        backgroundColor: scheme.surface,
        borderColor: selected ? scheme.accent : scheme.border,
        boxShadow: selected
          ? `0 0 0 3px ${scheme.accent}26, 0 6px 16px ${scheme.accent}24`
          : `0 3px 10px ${scheme.accent}1c`,
      }}
      title="单击显示目录操作，双击编辑标题"
    >
      <NodeResizer isVisible={selected} minWidth={112} minHeight={40} maxWidth={420} maxHeight={180} color={scheme.accent} handleStyle={{ width: 8, height: 8, borderRadius: 3 }} lineStyle={{ borderWidth: 1 }} onResizeStart={() => onResizeStart?.()} onResizeEnd={(_event, params) => onResizeEnd?.(id, params.width, params.height)} />

      {showActions ? (
        <div className="planner-node-popover nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { if (isConfirmingDelete) { deleteDirectory(directory.id); setActiveNodeActionsId(null); } else { setIsConfirmingDelete(true); setIsEditingTime(false); setIsChoosingComponents(false); } }} className={`flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors ${isConfirmingDelete ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`} title={isConfirmingDelete ? '再次点击确认删除' : '删除目录'}>{isConfirmingDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}<span>{isConfirmingDelete ? '确认' : '删除'}</span></button>
          <button type="button" onClick={() => convertToTask(directory.id)} className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100" title="保留位置和连线并转换为任务节点"><ListTodo className="h-3.5 w-3.5" />任务</button>
          <div className="relative">
            <button type="button" onClick={() => { setIsConfirmingDelete(false); setIsEditingTime(false); setIsChoosingComponents((open) => !open); }} className="flex h-8 w-[76px] items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 text-[11px] font-semibold text-purple-600 hover:bg-purple-100" title="设置归属联通块"><Network className="h-3.5 w-3.5" />归属</button>
            {isChoosingComponents ? (
              <div className="planner-node-popover absolute bottom-full left-1/2 z-[10001] mb-2 w-56 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl">
                <p className="px-1 pb-1.5 text-[10px] font-semibold text-neutral-500">所属联通块</p>
                <div className="max-h-48 space-y-1 overflow-y-auto custom-scrollbar">
                  {components.length > 0 ? components.map((component, index) => (
                    <label key={component.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-neutral-600 hover:bg-neutral-50">
                      <input type="checkbox" checked={assignedComponentIds.has(component.id)} onChange={(event) => { const nextIds = new Set(assignedComponentIds); if (event.target.checked) nextIds.add(component.id); else nextIds.delete(component.id); updateDirectory(directory.id, { componentIds: Array.from(nextIds) }); }} className="h-3.5 w-3.5 accent-[#8d78d5]" />
                      <span className="truncate">{getComponentLabel(component, index)}</span>
                    </label>
                  )) : <span className="block px-2 py-2 text-[11px] text-neutral-400">暂无联通块</span>}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button type="button" onClick={openTimeEditor} className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"><Clock3 className="h-3.5 w-3.5" />时间</button>
            {isEditingTime ? (
              <div className="planner-node-popover absolute bottom-full left-1/2 z-[10001] mb-2 w-[360px] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-neutral-700">目录约束时间</span><button type="button" onClick={() => setIsEditingTime(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600" title="关闭"><X className="h-4 w-4" /></button></div>
                <div className="space-y-3 text-left"><div className="text-[10px] font-semibold text-neutral-500"><span>开始时间（可选）</span><div className="mt-1"><DateTimePicker value={draftStart} onChange={setDraftStart} placeholder="选择开始日期与时间" /></div></div>{!draftStart && draftEnd ? <p className="text-[10px] text-purple-500">未设置时，保存瞬间作为开始时间</p> : null}<div className="text-[10px] font-semibold text-neutral-500"><span>截止时间</span><div className="mt-1"><DateTimePicker value={draftEnd} onChange={setDraftEnd} placeholder="选择截止日期与时间" /></div></div></div>
                {timeError ? <p className="mt-2 text-left text-[10px] text-rose-500">{timeError}</p> : null}
                <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => { setDraftStart(''); setDraftEnd(''); }} className="h-8 rounded-md px-2 text-[11px] text-neutral-400 hover:bg-neutral-50">清除</button><button type="button" onClick={saveTimeRange} className="h-8 rounded-md bg-purple-600 px-3 text-[11px] font-semibold text-white hover:bg-purple-700">保存</button></div>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => { addDirectoryToTodo(directory.id); setActiveNodeActionsId(null); }} className="flex h-8 w-[68px] items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 text-[11px] font-semibold text-sky-600 hover:bg-sky-100" title="将目录下任务加入同名 Todo 分线"><ListPlus className="h-3.5 w-3.5" />Todo</button>
        </div>
      ) : null}

      <span className="absolute inset-y-2 left-1.5 w-1 rounded-full" style={{ backgroundColor: scheme.accent }} />
      <textarea
        ref={inputRef}
        value={isEditing ? draftName : directory.name}
        readOnly={!isEditing}
        aria-label="目录标题"
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={() => { if (skipBlurCommitRef.current) { skipBlurCommitRef.current = false; return; } if (isEditing) commitName(); }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); event.currentTarget.blur(); } else if (event.key === 'Escape') { event.preventDefault(); skipBlurCommitRef.current = true; setDraftName(directory.name); setIsEditing(false); event.currentTarget.blur(); } }}
        rows={1}
        className={`${isEditing ? 'nodrag nopan cursor-text' : 'cursor-pointer'} h-full w-full resize-none overflow-hidden bg-transparent px-2 py-2 text-center text-xs font-semibold leading-4 text-[#334155] outline-none`}
      />

      <Handle type="target" position={Position.Left} id="left" className="planner-mind-handle planner-mind-handle-target" />
      <Handle type="source" position={Position.Right} id="right" className="planner-mind-handle planner-mind-handle-source" />
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); updateDirectory(directory.id, { isCollapsed: !directory.isCollapsed }); }} onDoubleClick={(event) => event.stopPropagation()} className="nodrag nopan absolute -right-8 top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-neutral-500 text-white shadow-sm hover:bg-purple-600" title={directory.isCollapsed ? '展开子节点' : '折叠子节点'} aria-label={directory.isCollapsed ? '展开子节点' : '折叠子节点'}>{directory.isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>
    </div>
  );
});

DirectoryNode.displayName = 'DirectoryNode';
