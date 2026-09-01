import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock3, Folder, ListPlus, ListTodo, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import { getTaskBlockTimestamps, getTaskTimeBlocks } from '../taskTimeBlocks';
import { getDirectoryDescendantTaskIds, getWorkspaceGraph } from '../workspaceComponents';

interface DirectoryNodeData {
  directoryId: string;
}

const formatRange = (startTime?: string, endTime?: string) => {
  if (!startTime || !endTime) return '未设置时间范围';
  const format = (value: string) => value.replace('T', ' ').slice(0, 16);
  return `${format(startTime)} — ${format(endTime)}`;
};

const toLocalDateTimeInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const DirectoryNode = React.memo(({ id, data, selected }: NodeProps) => {
  const { directoryId } = data as unknown as DirectoryNodeData;
  const directory = useAppStore((state) => state.workspaceDirectories.find((item) => item.id === directoryId));
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const mergedEdges = useAppStore((state) => state.mergedEdges);
  const mergedNodePositions = useAppStore((state) => state.mergedNodePositions);
  const directories = useAppStore((state) => state.workspaceDirectories);
  const updateDirectory = useAppStore((state) => state.updateWorkspaceDirectory);
  const deleteDirectory = useAppStore((state) => state.deleteWorkspaceDirectory);
  const addDirectoryToTodo = useAppStore((state) => state.addDirectoryToTodo);
  const convertToTask = useAppStore((state) => state.convertWorkspaceDirectoryToTask);
  const showActions = useAppStore((state) => state.activeNodeActionsId === id);
  const setActiveNodeActionsId = useAppStore((state) => state.setActiveNodeActionsId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isEditingTime, setIsEditingTime] = useState(false);
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
    setIsConfirmingDelete(false);
    setTimeError('');
  }, [showActions]);

  const descendantTaskIds = useMemo(() => {
    if (!directory) return new Set<string>();
    const graph = getWorkspaceGraph(goals, workspaceNodes, mergedEdges, {
      ...mergedNodePositions,
      ...Object.fromEntries(directories.map((item) => [item.id, mergedNodePositions[item.id] || item.position])),
    });
    return getDirectoryDescendantTaskIds(directory.id, directories, graph);
  }, [directories, directory, goals, mergedEdges, mergedNodePositions, workspaceNodes]);

  const outOfRangeCount = useMemo(() => {
    if (!directory?.startTime || !directory.endTime) return 0;
    const start = new Date(directory.startTime).getTime();
    const end = new Date(directory.endTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    let count = 0;
    descendantTaskIds.forEach((taskId) => {
      const task = tasks[taskId];
      if (!task) return;
      const isOutside = getTaskTimeBlocks(task).some((block) => {
        const range = getTaskBlockTimestamps(block, task.duration);
        return range.start < start || range.end > end;
      });
      if (isOutside) count += 1;
    });
    return count;
  }, [descendantTaskIds, directory, tasks]);

  if (!directory) return null;

  const commitName = () => {
    updateDirectory(directory.id, { name: draftName.trim() || '未命名目录' });
    setIsEditing(false);
  };

  const openTimeEditor = () => {
    setDraftStart(directory.startTime || '');
    setDraftEnd(directory.endTime || '');
    setTimeError('');
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
        setActiveNodeActionsId(showActions ? null : id);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDraftName(directory.name);
        setIsEditing(true);
        setActiveNodeActionsId(null);
      }}
      className={`group relative flex h-[58px] w-[178px] items-center rounded-xl border bg-white px-3 shadow-sm transition-shadow ${selected ? 'ring-2 ring-purple-300 ring-offset-2' : ''} ${showActions ? 'planner-node-actions-open' : ''}`}
      style={{ borderColor: directory.color }}
      title="单击显示目录操作，双击编辑名称"
    >
      {showActions ? (
        <div className="planner-node-popover nodrag nopan nowheel absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => updateDirectory(directory.id, { isCollapsed: !directory.isCollapsed })} className="flex h-8 items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 text-[11px] font-semibold text-purple-600 hover:bg-purple-100" title={directory.isCollapsed ? '展开子节点' : '折叠子节点'}>{directory.isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}折叠</button>
          <div className="relative">
            <button type="button" onClick={openTimeEditor} className="flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"><Clock3 className="h-3.5 w-3.5" />时间</button>
            {isEditingTime ? (
              <div className="absolute bottom-full left-1/2 z-[10001] mb-2 w-72 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-neutral-700">目录约束时间</span><button type="button" onClick={() => setIsEditingTime(false)} className="text-neutral-400 hover:text-neutral-600"><X className="h-4 w-4" /></button></div>
                <label className="block text-[10px] font-semibold text-neutral-500">开始时间（可选）<input type="datetime-local" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs outline-none focus:border-purple-300" /></label>
                {!draftStart && draftEnd ? <p className="mt-1 text-[10px] text-purple-500">未填写时，保存瞬间作为开始时间</p> : null}
                <label className="mt-2 block text-[10px] font-semibold text-neutral-500">结束时间<input type="datetime-local" value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2 text-xs outline-none focus:border-purple-300" /></label>
                {timeError ? <p className="mt-2 text-[10px] text-rose-500">{timeError}</p> : null}
                <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => { setDraftStart(''); setDraftEnd(''); }} className="h-8 rounded-md px-2 text-[11px] text-neutral-400 hover:bg-neutral-50">清除</button><button type="button" onClick={saveTimeRange} className="h-8 rounded-md bg-purple-600 px-3 text-[11px] font-semibold text-white">保存</button></div>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => addDirectoryToTodo(directory.id)} className="flex h-8 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 text-[11px] font-semibold text-sky-600 hover:bg-sky-100" title="将目录下任务加入同名 Todo 分线"><ListPlus className="h-3.5 w-3.5" />Todo</button>
          <button type="button" onClick={() => convertToTask(directory.id)} className="flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100" title="保留位置和连线并转换为任务节点"><ListTodo className="h-3.5 w-3.5" />任务</button>
          <button type="button" onClick={() => { if (isConfirmingDelete) { deleteDirectory(directory.id); setActiveNodeActionsId(null); } else setIsConfirmingDelete(true); }} className={`flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${isConfirmingDelete ? 'border-rose-500 bg-rose-600 text-white' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>{isConfirmingDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}{isConfirmingDelete ? '确认' : '删除'}</button>
        </div>
      ) : null}

      <button type="button" onClick={(event) => { event.stopPropagation(); updateDirectory(directory.id, { isCollapsed: !directory.isCollapsed }); }} className="nodrag mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: directory.color, backgroundColor: `${directory.color}18` }} title={directory.isCollapsed ? '展开子节点' : '折叠子节点'}>
        {directory.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        {isEditing ? <input ref={inputRef} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={commitName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } if (event.key === 'Escape') setIsEditing(false); }} className="nodrag w-full bg-transparent text-xs font-bold text-neutral-800 outline-none" /> : <div className="truncate text-xs font-bold text-neutral-800">{directory.name || '未命名目录'}</div>}
        <div className="mt-1 flex items-center gap-1 text-[9px] text-neutral-400"><span>{descendantTaskIds.size} 个任务</span><span>·</span><span className="truncate">{formatRange(directory.startTime, directory.endTime)}</span></div>
      </div>
      {outOfRangeCount > 0 ? <div className="ml-1 flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-rose-500" title={`${outOfRangeCount} 个任务超出目录时间范围`}><AlertTriangle className="h-3 w-3" />{outOfRangeCount}</div> : null}
      <Handle type="target" position={Position.Left} id="left" className="planner-mind-handle planner-mind-handle-target" />
      <Handle type="source" position={Position.Right} id="right" className="planner-mind-handle planner-mind-handle-source" />
    </div>
  );
});

DirectoryNode.displayName = 'DirectoryNode';
