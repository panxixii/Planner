import React, { useState } from 'react';
import { CheckCircle2, ListPlus, Network, Trash2, Undo2 } from 'lucide-react';
import { useAppStore } from '../store';
import { getComponentLabel } from '../workspaceComponents';
import { ColorPicker } from './ColorPicker';

interface CanvasSelectionToolbarProps {
  taskIds: string[];
  onRemove: () => void;
}

export const CanvasSelectionToolbar: React.FC<CanvasSelectionToolbarProps> = ({ taskIds, onRemove }) => {
  const tasks = useAppStore((state) => state.tasks);
  const components = useAppStore((state) => state.workspaceComponents);
  const updateTask = useAppStore((state) => state.updateTask);
  const addTaskToTodo = useAppStore((state) => state.addTaskToTodo);
  const setTaskComponentIds = useAppStore((state) => state.setTaskComponentIds);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const [showComponents, setShowComponents] = useState(false);

  const runGrouped = (action: () => void) => {
    beginHistoryGroup();
    action();
    endHistoryGroup();
  };

  const allDone = taskIds.length > 0 && taskIds.every((taskId) => tasks[taskId]?.isDone);

  return (
    <div className="absolute left-1/2 top-5 z-50 flex -translate-x-1/2 items-start gap-1.5 rounded-xl border border-neutral-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
      <span className="flex h-9 items-center px-2 text-[11px] font-bold text-neutral-500">已选 {taskIds.length} 项</span>
      <button type="button" onClick={() => runGrouped(() => taskIds.forEach((taskId) => updateTask(taskId, { isDone: !allDone })))} className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50">
        {allDone ? <Undo2 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{allDone ? '恢复任务' : '设为完成'}
      </button>
      <button type="button" onClick={() => runGrouped(() => taskIds.forEach(addTaskToTodo))} className="flex h-9 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-semibold text-sky-600"><ListPlus className="h-3.5 w-3.5" />加入 Todo</button>
      <div className="relative">
        <button type="button" onClick={() => setShowComponents((value) => !value)} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-[11px] font-semibold text-purple-600"><Network className="h-3.5 w-3.5" />归属</button>
        {showComponents ? (
          <div className="absolute left-1/2 top-full z-[120] mt-2 w-56 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-2 shadow-2xl">
            {components.length > 0 ? components.map((component, index) => {
              const assignedCount = taskIds.filter((taskId) => tasks[taskId]?.componentIds?.includes(component.id)).length;
              const checked = assignedCount === taskIds.length;
              return <label key={component.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-neutral-50"><input type="checkbox" checked={checked} ref={(input) => { if (input) input.indeterminate = assignedCount > 0 && !checked; }} onChange={(event) => runGrouped(() => taskIds.forEach((taskId) => { const ids = new Set(tasks[taskId]?.componentIds || []); if (event.target.checked) ids.add(component.id); else ids.delete(component.id); setTaskComponentIds(taskId, Array.from(ids)); }))} className="h-3.5 w-3.5 accent-[#8d78d5]" /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: component.color }} /><span className="truncate">{getComponentLabel(component, index)}</span></label>;
            }) : <span className="block px-2 py-3 text-center text-[11px] text-neutral-400">暂无联通块</span>}
          </div>
        ) : null}
      </div>
      <div className="w-40"><ColorPicker label="统一颜色" value={tasks[taskIds[0]]?.color || '#9387D1'} onChange={(color) => runGrouped(() => taskIds.forEach((taskId) => updateTask(taskId, { color })))} /></div>
      <button type="button" onClick={() => runGrouped(onRemove)} className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-600"><Trash2 className="h-3.5 w-3.5" />移除</button>
    </div>
  );
};
