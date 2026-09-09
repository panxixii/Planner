import React from 'react';
import { ArrowLeft, CalendarDays, Columns3, GitBranch } from 'lucide-react';

export type TodoLaneView = 'board' | 'gantt' | 'kanban';

export const TodoViewSwitcher: React.FC<{ view: TodoLaneView; onChange: (view: TodoLaneView) => void; onBack?: () => void; className?: string }> = ({ view, onChange, onBack, className = '' }) => (
  <div className={`flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5 ${className}`}>
    {onBack ? (
      <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white hover:text-neutral-600 hover:shadow-sm" title="返回 List" aria-label="返回 List"><ArrowLeft className="h-3.5 w-3.5" /></button>
    ) : null}
    <button type="button" onClick={() => onChange('board')} className={`flex h-8 w-8 items-center justify-center rounded-md ${view === 'board' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="画板"><GitBranch className="h-3.5 w-3.5" /></button>
    <button type="button" onClick={() => onChange('gantt')} className={`flex h-8 w-8 items-center justify-center rounded-md ${view === 'gantt' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="甘特图"><CalendarDays className="h-3.5 w-3.5" /></button>
    <button type="button" onClick={() => onChange('kanban')} className={`flex h-8 w-8 items-center justify-center rounded-md ${view === 'kanban' ? 'bg-white text-amber-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="看板"><Columns3 className="h-3.5 w-3.5" /></button>
  </div>
);
