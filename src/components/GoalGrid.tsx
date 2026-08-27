import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Goal, CategoryType, Task, AppCategory } from '../types';
import { Target, ArrowRight, Plus, AlertCircle, Trash2, Pencil } from 'lucide-react';

interface FlatCategoryItem {
  id: string;
  label: string;
  level: number;
}

const flattenCategoryTree = (categories: AppCategory[]): FlatCategoryItem[] => {
  const nodeMap: Record<string, { category: AppCategory; children: string[] }> = {};
  const roots: string[] = [];

  categories.forEach((c) => {
    nodeMap[c.id] = { category: c, children: [] };
  });

  categories.forEach((c) => {
    if (c.parentId && nodeMap[c.parentId]) {
      nodeMap[c.parentId].children.push(c.id);
    } else {
      roots.push(c.id);
    }
  });

  const result: FlatCategoryItem[] = [];
  const traverse = (id: string, level: number) => {
    const node = nodeMap[id];
    if (!node) return;
    result.push({
      id: node.category.id,
      label: node.category.label,
      level
    });
    node.children.forEach((childId) => {
      traverse(childId, level + 1);
    });
  };

  roots.forEach((rootId) => {
    traverse(rootId, 0);
  });

  return result;
};

export const GoalGrid: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const selectGoal = useAppStore((state) => state.selectGoal);
  const addGoal = useAppStore((state) => state.addGoal);
  const deleteGoal = useAppStore((state) => state.deleteGoal);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const categoriesList = useAppStore((state) => state.categories);

  const flattenedCategories = React.useMemo(() => {
    return flattenCategoryTree(categoriesList);
  }, [categoriesList]);

  // Goal adding interaction state
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryType>('career');
  const [color, setColor] = useState('indigo');
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Goal editing interaction state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<CategoryType>('career');

  // Synchronize category selection state when opening creation form
  React.useEffect(() => {
    if (isCreating && categoriesList.length > 0) {
      if (selectedCategoryId !== 'all' && categoriesList.some(c => c.id === selectedCategoryId)) {
        setCategory(selectedCategoryId);
      } else {
        setCategory(categoriesList[0].id);
      }
    }
  }, [isCreating, categoriesList, selectedCategoryId]);

  // Filter goals
  const filteredGoals = Object.values(goals).filter((g) => {
    if (selectedCategoryId === 'all') return true;
    return g.category === selectedCategoryId;
  });

  const handleCreateGoal = () => {
    if (!title.trim()) return;

    const newGoalId = `goal-${Math.random().toString(36).substring(2, 9)}`;
    const newGoal: Goal = {
      id: newGoalId,
      title,
      description: description || '暂无描述',
      category: category === 'all' ? 'career' : category,
      color,
      nodes: [],
      edges: []
    };

    addGoal(newGoal);
    setTitle('');
    setDescription('');
    setIsCreating(false);
  };

  const getMetric = (goal: Goal) => {
    const total = (goal?.nodes || []).length;
    if (total === 0) return { total, done: 0, percent: 0, hours: 0 };

    let done = 0;
    let hours = 0;
    (goal?.nodes || []).forEach((node) => {
      if (node && node.taskId) {
        const associatedTask = tasks[node.taskId];
        if (associatedTask) {
          hours += associatedTask.duration;
          if (associatedTask.isDone) done++;
        }
      }
    });

    return {
      total,
      done,
      percent: Math.round((done / total) * 100),
      hours
    };
  };

  const categoryLabels = categoriesList.reduce((acc, c) => {
    acc[c.id] = c.label;
    return acc;
  }, { all: '全部计划' } as Record<string, string>);

  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40',
    sky: 'text-sky-400 border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
    violet: 'text-violet-400 border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40'
  };

  return (
    <div className="w-full min-w-0 max-w-5xl flex-1 overflow-y-auto p-6 mx-auto box-border select-none font-sans space-y-6">
      {/* Category Header */}
      <div className="flex w-full min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight text-neutral-800">
              <Target className="w-5 h-5 shrink-0 text-purple-600 animate-pulse" />
              <span className="truncate">{categoryLabels[selectedCategoryId]}</span>
            </h1>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 shadow-2xs transition-all cursor-pointer font-bold font-mono uppercase"
        >
          <Plus className="w-4 h-4 text-purple-600" />
          <span>新建计划</span>
        </button>
      </div>

      {/* Goal creation Form */}
      {isCreating && (
        <div className="p-6 bg-white border border-neutral-200 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider font-mono">新建计划</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">计划名称</span>
              <input
                type="text"
                placeholder="计划名称"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:bg-white focus:border-purple-500 font-medium"
              />
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">所属分类</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:border-purple-500 font-mono font-semibold"
              >
                {flattenedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'\u00A0'.repeat(c.level * 3)}{c.level > 0 ? '└─ ' : ''}{c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">计划描述</span>
            <input
              type="text"
              placeholder="补充计划描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:bg-white focus:border-purple-500 font-medium"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-lg text-xs bg-neutral-100 text-neutral-600 hover:bg-neutral-200 cursor-pointer font-mono font-bold"
            >
              取消
            </button>
            <button
              onClick={handleCreateGoal}
              className="px-4 py-2 rounded-lg text-xs bg-gradient-to-r from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] hover:opacity-90 text-white font-bold font-mono cursor-pointer uppercase shadow-xs border-0"
            >
              创建计划
            </button>
          </div>
        </div>
      )}

      {/* Grid List */}
      {filteredGoals.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-white border border-neutral-200 border-dashed text-neutral-400 text-xs font-mono select-none">
          暂无计划
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGoals.map((g) => {
            const { total, done, percent, hours } = getMetric(g);
            const isConfirmingDelete = deletingGoalId === g.id;
            const isEditingThisGoal = editingGoalId === g.id;
            return (
              <div
                key={g.id}
                onClick={() => {
                  if (isConfirmingDelete || isEditingThisGoal) return;
                  selectGoal(g.id);
                }}
                className="group relative bg-white hover:bg-neutral-55 border border-neutral-200 rounded-xl p-5 flex flex-col justify-between h-56 transition-all duration-300 hover:scale-[1.01] hover:border-neutral-300 cursor-pointer shadow-xs overflow-hidden"
              >
                {isConfirmingDelete ? (
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute inset-0 bg-rose-50/95 backdrop-blur-xs flex flex-col justify-between p-5 z-10 animate-in fade-in zoom-in-95 duration-150 select-none"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase font-mono">
                        <AlertCircle className="w-4 h-4" />
                        <span>确认彻底删除吗？</span>
                      </div>
                      <h4 className="text-[11px] font-semibold text-neutral-800 leading-normal font-sans">
                        删除“{g.title}”及其任务节点？此操作不可撤销。
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          deleteGoal(g.id);
                          setDeletingGoalId(null);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold font-sans transition-all cursor-pointer text-center border border-rose-600 shadow-2xs"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={() => setDeletingGoalId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-[11px] font-bold font-sans transition-all cursor-pointer text-center"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}

                {isEditingThisGoal ? (
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute inset-0 bg-white border border-neutral-200 flex flex-col justify-between p-4 z-15 animate-in fade-in zoom-in-95 duration-150 select-none shadow-sm"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-purple-600 font-bold text-xs uppercase font-mono">
                        <Pencil className="w-3.5 h-3.5 animate-pulse" />
                        <span>编辑计划</span>
                      </div>
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="计划标题"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-neutral-800 text-xs focus:outline-hidden focus:bg-white focus:border-purple-500 font-medium font-sans"
                        />
                      </div>
                      <div className="space-y-1">
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="计划描述"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-neutral-850 text-[11px] focus:outline-hidden focus:bg-white focus:border-purple-500 font-medium font-sans resize-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-neutral-800 text-xs focus:outline-hidden focus:border-purple-500 font-mono font-medium"
                        >
                          {flattenedCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {'\u00A0'.repeat(c.level * 3)}{c.level > 0 ? '└─ ' : ''}{c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1.5 border-t border-neutral-100">
                      <button
                        onClick={() => {
                          if (editTitle.trim()) {
                            updateGoal(g.id, {
                              title: editTitle,
                              description: editDescription,
                              category: editCategory
                            });
                            setEditingGoalId(null);
                          }
                        }}
                        className="flex-1 py-1 rounded bg-gradient-to-r from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] hover:opacity-90 text-white text-[11px] font-bold font-sans transition-all cursor-pointer text-center shadow-2xs border-0"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingGoalId(null)}
                        className="px-2.5 py-1 rounded bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-[11px] font-bold font-sans transition-all cursor-pointer text-center"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {/* Tag Indicator & Actions */}
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-[9.5px] text-purple-600 font-bold font-mono tracking-wide uppercase">
                      {categoriesList.find(c => c.id === g.category)?.label || g.category}
                    </span>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-450 font-semibold font-mono mr-1">
                        {hours} 小时
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGoalId(g.id);
                          setEditTitle(g.title);
                          setEditDescription(g.description);
                          setEditCategory(g.category);
                        }}
                        className="p-1 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title="编辑此目标计划"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingGoalId(g.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title="删除此目标计划"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold tracking-tight text-neutral-800 group-hover:text-neutral-900 transition-colors">
                      {g.title}
                    </h3>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                      {g.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar and open workspace */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                    <span className="font-bold">完成度</span>
                    <span className="text-purple-600 font-bold">{percent}% ({done}/{total})</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden border border-neutral-200/50">
                    <div 
                      className="h-full bg-gradient-to-r from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-end font-mono text-[9px] text-neutral-400 group-hover:text-purple-600 transition-colors pt-1 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      打开画布
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
