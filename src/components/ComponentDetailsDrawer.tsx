import React from 'react';
import { Network, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { WorkspaceEdgeShape } from '../types';

const NODE_COLORS = ['indigo', 'emerald', 'sky', 'rose', 'amber', 'violet'];
const COLOR_HEX: Record<string, string> = {
  indigo: '#9387d1', emerald: '#67c8bd', sky: '#79bfd5', rose: '#d78fb5', amber: '#d9b958', violet: '#9b8ae4',
};

export const ComponentDetailsDrawer: React.FC = () => {
  const activeId = useAppStore((state) => state.activeComponentDetailsId);
  const component = useAppStore((state) => state.workspaceComponents.find((item) => item.id === activeId));
  const tasks = useAppStore((state) => state.tasks);
  const goals = useAppStore((state) => state.goals);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const updateComponent = useAppStore((state) => state.updateWorkspaceComponent);
  const setTaskComponentIds = useAppStore((state) => state.setTaskComponentIds);
  const openDetails = useAppStore((state) => state.openComponentDetails);
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
          <label className="block space-y-1.5"><span className="text-xs font-semibold text-neutral-600">名称</span><input value={component.name} onChange={(event) => update({ name: event.target.value })} placeholder="未命名联通块" className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-purple-300" /></label>
          <section className="space-y-3 border-t border-neutral-200 pt-5">
            <label className="flex items-center justify-between text-xs font-semibold text-neutral-600"><span>手柄颜色</span><input type="color" value={component.color} onChange={(event) => update({ color: event.target.value })} className="h-8 w-12 cursor-pointer rounded border border-neutral-200 bg-white p-1" /></label>
            <div className="space-y-2"><span className="text-xs font-semibold text-neutral-600">统一节点颜色</span><div className="flex gap-2">{NODE_COLORS.map((color) => <button key={color} type="button" onClick={() => update({ nodeColor: color })} className={`h-7 w-7 rounded-md border-2 ${component.nodeColor === color ? 'border-neutral-700' : 'border-white'}`} style={{ backgroundColor: COLOR_HEX[color] }} title={color} />)}</div></div>
          </section>
          <section className="space-y-3 border-t border-neutral-200 pt-5">
            <label className="flex items-center justify-between text-xs font-semibold text-neutral-600"><span>连线颜色</span><input type="color" value={component.edgeColor} onChange={(event) => update({ edgeColor: event.target.value })} className="h-8 w-12 cursor-pointer rounded border border-neutral-200 bg-white p-1" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-semibold text-neutral-600">连线形状</span><select value={component.edgeShape} onChange={(event) => update({ edgeShape: event.target.value as WorkspaceEdgeShape })} className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none"><option value="bezier">曲线</option><option value="smoothstep">折线</option><option value="straight">直线</option></select></label>
          </section>
          <section className="space-y-2 border-t border-neutral-200 pt-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-neutral-600">所属节点</span><span className="text-[10px] text-neutral-400">{memberCount} 个</span></div><div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar">{Object.values(tasks).filter((task) => workspaceTaskIds.has(task.id)).map((task) => { const checked = task.componentIds?.includes(component.id) || false; return <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50"><input type="checkbox" checked={checked} onChange={(event) => { const ids = new Set(task.componentIds || []); if (event.target.checked) ids.add(component.id); else ids.delete(component.id); setTaskComponentIds(task.id, Array.from(ids)); }} className="h-3.5 w-3.5 accent-[#8d78d5]" /><span className="truncate">{task.title || '未命名节点'}</span></label>; })}</div></section>
        </div>
      </aside>
    </div>
  );
};
