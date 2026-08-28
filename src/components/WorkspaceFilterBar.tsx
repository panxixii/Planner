import React, { useState } from 'react';
import { Filter, ListChecks, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { getComponentLabel } from '../workspaceComponents';

export const WorkspaceFilterBar: React.FC = () => {
  const components = useAppStore((state) => state.workspaceComponents);
  const componentFilter = useAppStore((state) => state.workspaceComponentFilter);
  const setComponentFilter = useAppStore((state) => state.setWorkspaceComponentFilter);
  const addComponent = useAppStore((state) => state.addWorkspaceComponent);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');

  const allSelected = componentFilter === null;
  const selectedCount = allSelected ? components.length : componentFilter.length;

  const toggleComponent = (componentId: string) => {
    const currentIds = componentFilter || [];
    setComponentFilter(currentIds.includes(componentId)
      ? currentIds.filter((id) => id !== componentId)
      : [...currentIds, componentId]);
  };

  const createComponent = () => {
    addComponent(name.trim());
    setName('');
    setIsCreating(false);
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b border-neutral-200 bg-white px-5 select-none">
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-600">
        <Filter className="h-3.5 w-3.5 text-purple-600" />
        <span>联通块</span>
      </div>

      <label className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-2.5 text-xs font-semibold text-purple-700">
        <input type="checkbox" checked={allSelected} onChange={() => setComponentFilter(null)} className="h-3.5 w-3.5 accent-[#8d78d5]" />
        <ListChecks className="h-3.5 w-3.5" />
        <span>全部</span>
      </label>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
        {components.map((component, index) => {
          const checked = !allSelected && componentFilter.includes(component.id);
          return (
            <label key={component.id} className={`flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs transition-colors ${checked ? 'border-neutral-200 bg-neutral-50 text-neutral-700' : 'border-transparent bg-white text-neutral-400 hover:border-neutral-200'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleComponent(component.id)} className="h-3.5 w-3.5 accent-[#8d78d5]" />
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: component.color }} />
              <span>{getComponentLabel(component, index)}</span>
            </label>
          );
        })}
      </div>

      {isCreating ? (
        <form onSubmit={(event) => { event.preventDefault(); createComponent(); }} className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-purple-200 bg-white p-1">
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="联通块标题（可空）" className="w-32 bg-transparent px-1.5 text-xs outline-none" />
          <button type="submit" className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600" title="创建联通块" aria-label="创建联通块"><Plus className="h-3.5 w-3.5" /></button>
        </form>
      ) : (
        <button type="button" onClick={() => setIsCreating(true)} className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 text-xs font-semibold text-purple-600" title="新建联通块"><Plus className="h-3.5 w-3.5" /><span>新建</span></button>
      )}

      <span className="shrink-0 text-[10px] font-medium text-neutral-400">{selectedCount}/{components.length}</span>
    </div>
  );
};
