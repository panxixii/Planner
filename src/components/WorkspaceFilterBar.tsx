import React from 'react';
import { Filter, ListChecks } from 'lucide-react';
import { useAppStore } from '../store';

export const WorkspaceFilterBar: React.FC = () => {
  const categories = useAppStore((state) => state.categories);
  const categoryFilter = useAppStore((state) => state.workspaceCategoryFilter);
  const setCategoryFilter = useAppStore((state) => state.setWorkspaceCategoryFilter);

  const allSelected = categoryFilter === null;
  const selectedCount = allSelected ? categories.length : categoryFilter.length;

  const toggleCategory = (categoryId: string) => {
    const currentIds = allSelected
      ? categories.map((category) => category.id)
      : categoryFilter;
    const nextIds = currentIds.includes(categoryId)
      ? currentIds.filter((id) => id !== categoryId)
      : [...currentIds, categoryId];

    setCategoryFilter(nextIds.length === categories.length ? null : nextIds);
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b border-neutral-200 bg-white px-5 select-none">
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-600">
        <Filter className="h-3.5 w-3.5 text-purple-600" />
        <span>筛选</span>
      </div>

      <label className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-2.5 text-xs font-semibold text-purple-700">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(event) => setCategoryFilter(event.target.checked ? null : [])}
          className="h-3.5 w-3.5 accent-[#8d78d5]"
        />
        <ListChecks className="h-3.5 w-3.5" />
        <span>全部</span>
      </label>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
        {categories.map((category) => {
          const checked = allSelected || categoryFilter.includes(category.id);
          return (
            <label
              key={category.id}
              className={`flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs transition-colors ${
                checked
                  ? 'border-neutral-200 bg-neutral-50 text-neutral-700'
                  : 'border-transparent bg-white text-neutral-400 hover:border-neutral-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCategory(category.id)}
                className="h-3.5 w-3.5 accent-[#8d78d5]"
              />
              <span>{category.label}</span>
            </label>
          );
        })}
      </div>

      <span className="shrink-0 text-[10px] font-medium text-neutral-400">
        {selectedCount}/{categories.length}
      </span>
    </div>
  );
};
