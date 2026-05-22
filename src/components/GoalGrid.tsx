import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Goal, CategoryType, Task } from '../types';
import { Target, Layers, ArrowRight, Plus, HelpCircle, BarChart3, AlertCircle, BookOpen, Trash2 } from 'lucide-react';

export const GoalGrid: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const selectGoal = useAppStore((state) => state.selectGoal);
  const addGoal = useAppStore((state) => state.addGoal);
  const deleteGoal = useAppStore((state) => state.deleteGoal);
  const showHelp = useAppStore((state) => state.showHelp);
  const toggleHelp = useAppStore((state) => state.toggleHelp);
  const categoriesList = useAppStore((state) => state.categories);

  // Goal adding interaction state
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryType>('career');
  const [color, setColor] = useState('indigo');
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

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
      description: description || 'New plan descriptions.',
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
    const total = goal.nodes.length;
    if (total === 0) return { total, done: 0, percent: 0, hours: 0 };

    let done = 0;
    let hours = 0;
    goal.nodes.forEach((node) => {
      const associatedTask = tasks[node.taskId];
      if (associatedTask) {
        hours += associatedTask.duration;
        if (associatedTask.isDone) done++;
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
    acc[c.id] = `${c.label}赛道`;
    return acc;
  }, { all: '全局规划蓝图概览' } as Record<string, string>);

  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40',
    sky: 'text-sky-400 border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
    violet: 'text-violet-400 border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40'
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto p-6 max-w-5xl mx-auto select-none font-sans">
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600 animate-pulse" />
              <span>{categoryLabels[selectedCategoryId]}</span>
            </h1>
            <button
              onClick={toggleHelp}
              className={`text-[9px] font-bold font-sans px-1.5 py-0.5 rounded cursor-pointer transition-all border shrink-0
                ${showHelp 
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                  : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'}`}
              title="切换显示当前页面的规划说明卡片"
            >
              <span>提示:{showHelp ? '显示' : '隐藏'}</span>
            </button>
          </div>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            浏览规划周期调度的人生成长赛道与 DAG 起始图谱
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 shadow-2xs transition-all cursor-pointer font-bold font-mono uppercase"
        >
          <Plus className="w-4 h-4 text-blue-600" />
          <span>新建目标计划</span>
        </button>
      </div>

      {/* Conditional Quick Help banner on dashboard */}
      {showHelp && (
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3 shadow-2xs animate-in fade-in slide-in-from-top-1.5 duration-250 select-none">
          <BookOpen className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-blue-900 font-sans uppercase">📌 生涯蓝图调度指引手册</h4>
            <p className="text-[11px] text-blue-800 leading-relaxed font-sans">
              在<strong>职业、健康、财富、成长</strong>各领域目标卡片中，点击可进入 <strong>DAG 连线拓扑画布</strong>。您可以直接拖拉左侧 <strong>BOM 库</strong> 以快速部署预设蓝图组件，亦可通过连线调整计划先后驱，双击连线自动拆卸移除自定义依赖，随时掌控生涯路线。
            </p>
          </div>
        </div>
      )}

      {/* Goal creation Form */}
      {isCreating && (
        <div className="p-6 bg-white border border-neutral-200 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider font-mono">创建人生成长计划</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">计划标题</span>
              <input
                type="text"
                placeholder="例如：产品设计冲刺计划..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
              />
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">所属领域赛道</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:border-blue-500 font-mono font-semibold"
              >
                {categoriesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}领域</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-500 font-mono uppercase font-bold">具体目标说明</span>
            <input
              type="text"
              placeholder="简要列出达成该人生蓝图所需的关键里程碑成效..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-neutral-800 text-xs focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
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
              className="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono cursor-pointer uppercase shadow-xs border border-blue-500/20"
            >
              保存计划蓝图
            </button>
          </div>
        </div>
      )}

      {/* Grid List */}
      {filteredGoals.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-white border border-neutral-200 border-dashed text-neutral-400 text-xs font-mono select-none">
          该领域下暂无已登记的目标计划，立即新建一个开启您的人生图谱吧！
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGoals.map((g) => {
            const { total, done, percent, hours } = getMetric(g);
            const isConfirmingDelete = deletingGoalId === g.id;
            return (
              <div
                key={g.id}
                onClick={() => {
                  if (isConfirmingDelete) return;
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
                        确定永久清除计划 “{g.title}” 吗？此操作将彻底销毁该计划名下的所有规划节点、拓扑连线，且无法撤销！
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

                <div className="space-y-3">
                  {/* Tag Indicator & Actions */}
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[9.5px] text-blue-600 font-bold font-mono tracking-wide uppercase">
                      {categoriesList.find(c => c.id === g.category)?.label || g.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-450 font-semibold font-mono">
                        {hours} 小时预计工时
                      </span>
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
                    <span className="font-bold">进度指标</span>
                    <span className="text-blue-600 font-bold">{percent}% ({done}/{total})</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden border border-neutral-200/50">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-end font-mono text-[9px] text-neutral-400 group-hover:text-blue-600 transition-colors pt-1 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      开启拓扑白板
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
