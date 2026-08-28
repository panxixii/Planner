import React, { useEffect, useState } from 'react';
import { Network, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { WorkspaceEdgeShape } from '../types';
import { ColorPicker } from './ColorPicker';

export const ComponentDetailsDrawer: React.FC = () => {
  const activeId = useAppStore((state) => state.activeComponentDetailsId);
  const component = useAppStore((state) => state.workspaceComponents.find((item) => item.id === activeId));
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const updateComponent = useAppStore((state) => state.updateWorkspaceComponent);
  const deleteComponent = useAppStore((state) => state.deleteWorkspaceComponent);
  const setTaskComponentIds = useAppStore((state) => state.setTaskComponentIds);
  const openDetails = useAppStore((state) => state.openComponentDetails);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [activeId]);

  if (!activeId || !component) return null;

  const memberCount = Object.values(tasks).filter((task) => task.componentIds?.includes(component.id)).length;
  const workspaceTaskIds = new Set([
    ...Object.values(goals).flatMap((goal) => goal.nodes.map((node) => node.taskId)),
    ...workspaceNodes.map((node) => node.taskId),
  ]);
  const update = (updates: Parameters<typeof updateComponent>[1]) => updateComponent(component.id, updates);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" onClick={() => openDetails(null)} className="absolute inset-0 bg-neutral-900/25" aria-label="关闭联通块详情" />
      <aside className="relative flex h-full w-full flex-col border-l border-neutral-200 bg-white shadow-2xl sm:w-[420px]">
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-5">
          <div className="flex items-center gap-2"><Network className="h-4 w-4 text-purple-600" /><h2 className="text-sm font-semibold text-neutral-800">联通块详情</h2></div>
          <button type="button" onClick={() => openDetails(null)} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100" title="关闭"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 custom-scrollbar">
          <label className="block space-y-1.5"><span className="text-xs font-semibold text-neutral-600">名称</span><input value={component.name} onFocus={beginHistoryGroup} onChange={(event) => update({ name: event.target.value })} onBlur={endHistoryGroup} placeholder="未命名联通块" className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-purple-300" /></label>
          <section className="space-y-3 border-t border-neutral-200 pt-5">
            <ColorPicker label="手柄颜色" value={component.color} onChange={(color) => update({ color })} />
            <ColorPicker label="统一节点颜色" value={component.nodeColor} onChange={(color) => update({ nodeColor: color })} />
          </section>
          <section className="space-y-3 border-t border-neutral-200 pt-5">
            <ColorPicker label="连线颜色" value={component.edgeColor} onChange={(color) => update({ edgeColor: color })} />
            <label className="block space-y-1.5"><span className="text-xs font-semibold text-neutral-600">连线形状</span><select value={component.edgeShape} onChange={(event) => update({ edgeShape: event.target.value as WorkspaceEdgeShape })} className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none"><option value="bezier">曲线</option><option value="smoothstep">折线</option><option value="straight">直线</option></select></label>
          </section>
          <section className="space-y-2 border-t border-neutral-200 pt-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-neutral-600">所属节点</span><span className="text-[10px] text-neutral-400">{memberCount} 个</span></div><div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar">{Object.values(tasks).filter((task) => workspaceTaskIds.has(task.id)).map((task) => { const checked = task.componentIds?.includes(component.id) || false; return <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50"><input type="checkbox" checked={checked} onChange={(event) => { const ids = new Set(task.componentIds || []); if (event.target.checked) ids.add(component.id); else ids.delete(component.id); setTaskComponentIds(task.id, Array.from(ids)); }} className="h-3.5 w-3.5 accent-[#8d78d5]" /><span className="truncate">{task.title || '未命名节点'}</span></label>; })}</div></section>
          <section className="space-y-2 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => {
                if (isConfirmingDelete) {
                  deleteComponent(component.id);
                  return;
                }
                setIsConfirmingDelete(true);
              }}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors ${isConfirmingDelete ? 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >
              <Trash2 className="h-4 w-4" />
              {isConfirmingDelete ? '确认删除' : '删除联通块'}
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};
