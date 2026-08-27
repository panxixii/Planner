import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { X, Check, Trash2, Calendar, Clock, AlertCircle, Tags } from 'lucide-react';

const COLORS = ['indigo', 'emerald', 'sky', 'rose', 'amber', 'violet'];

const COLOR_STYLES: Record<string, string> = {
  indigo: 'bg-[#9387d1]',
  emerald: 'bg-[#67c8bd]',
  sky: 'bg-[#79bfd5]',
  rose: 'bg-[#d78fb5]',
  amber: 'bg-[#d9b958]',
  violet: 'bg-[#9b8ae4]',
};

const COLOR_LABELS: Record<string, string> = {
  indigo: '靛青',
  emerald: '青绿',
  sky: '天蓝',
  rose: '玫红',
  amber: '琥珀',
  violet: '紫罗兰',
};

const fieldClassName = 'h-10 w-full rounded-lg border border-neutral-200 bg-[#ffffff] px-3 text-sm text-neutral-800 outline-none transition-colors placeholder:text-neutral-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100';
const labelClassName = 'text-xs font-semibold text-neutral-600';

const toDateTimeLocal = (value: string | undefined, isEnd = false) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${isEnd ? '23:59' : '00:00'}`;
  }
  return value.slice(0, 16);
};

export const TaskDrawer: React.FC = () => {
  const selectedTaskId = useAppStore((state) => state.selectedTaskId);
  const selectTask = useAppStore((state) => state.selectTask);
  const tasks = useAppStore((state) => state.tasks);
  const categories = useAppStore((state) => state.categories);
  const goals = useAppStore((state) => state.goals);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);

  const task = selectedTaskId ? tasks[selectedTaskId] : null;
  const assignedCategories = useMemo(() => {
    if (!selectedTaskId || !task) return [];

    const categoryIds = new Set(task.categoryIds || []);
    Object.values(goals).forEach((goal) => {
      if (goal.nodes.some((node) => node.taskId === selectedTaskId)) {
        categoryIds.add(goal.category);
      }
    });

    return categories.filter((category) => categoryIds.has(category.id));
  }, [categories, goals, selectedTaskId, task]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState('indigo');
  const [errorMsg, setErrorMsg] = useState('');

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Sync edits
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDuration(task.duration !== undefined ? task.duration : 0);
      setIsDone(task.isDone || false);
      setStartTime(toDateTimeLocal(task.startTime));
      setEndTime(toDateTimeLocal(task.endTime, true));
      setColor(task.color || 'indigo');
      setErrorMsg('');
      setIsConfirmingDelete(false);
    }
  }, [task, selectedTaskId]);

  if (!selectedTaskId || !task) return null;

  const handleSave = () => {
    if (startTime && endTime && startTime > endTime) {
      setErrorMsg('开始日期必须早于/等于结束日期');
      return;
    }

    updateTask(selectedTaskId, {
      title,
      description,
      duration: Number(duration),
      isDone,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      color,
    });
    
    // Close on save
    selectTask(null);
  };

  const handleDelete = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    deleteTask(selectedTaskId);
    selectTask(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="关闭任务详情"
        onClick={() => selectTask(null)}
        className="absolute inset-0 cursor-default bg-neutral-900/30 backdrop-blur-[2px]"
      />

      <aside
        id="task-drawer-panel"
        aria-label="任务详情"
        className="relative flex h-full w-full flex-col border-l border-neutral-200 bg-[#fbfcfe] shadow-2xl sm:w-[460px]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#79bfd5]" />
            <h2 className="truncate text-sm font-semibold text-neutral-800">任务详情</h2>
          </div>
          <button
            type="button"
            onClick={() => selectTask(null)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
          {errorMsg ? (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="task-title" className={labelClassName}>任务标题</label>
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={fieldClassName}
                placeholder="任务名称"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-description" className={labelClassName}>描述</label>
              <textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-lg border border-neutral-200 bg-[#ffffff] px-3 py-2.5 text-sm leading-6 text-neutral-800 outline-none transition-colors placeholder:text-neutral-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                placeholder="任务描述"
              />
            </div>
          </section>

          <section className="mt-5 border-t border-neutral-200 pt-5">
            <div className="mb-2 flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5 text-neutral-400" />
              <h3 className={labelClassName}>所属分类</h3>
            </div>
            <div className="flex min-h-8 flex-wrap items-center gap-1.5">
              {assignedCategories.length > 0 ? assignedCategories.map((category) => (
                <span
                  key={category.id}
                  className="inline-flex h-7 items-center rounded-md border border-purple-200 bg-purple-50 px-2.5 text-xs font-medium text-purple-600"
                >
                  {category.label}
                </span>
              )) : (
                <span className="text-xs text-neutral-400">未关联分类</span>
              )}
            </div>
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-5">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="task-duration" className={`flex items-center gap-1.5 ${labelClassName}`}>
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                预期（小时）
              </label>
              <input
                id="task-duration"
                type="number"
                min="0"
                step="0.25"
                value={duration || ''}
                onChange={(event) => setDuration(Math.max(0, Number(event.target.value)))}
                className={fieldClassName}
                placeholder="未设置"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <span className={labelClassName}>状态</span>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => setIsDone((value) => !value)}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-neutral-200 bg-[#ffffff] text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                <Check className={`h-3.5 w-3.5 ${isDone ? 'opacity-100' : 'opacity-35'}`} />
                <span>{isDone ? '已完成' : '未完成'}</span>
              </button>
            </div>
          </section>

          <section className="mt-5 space-y-3 border-t border-neutral-200 pt-5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              <h3 className={labelClassName}>日期与时间</h3>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-start-time" className="text-[11px] font-medium text-neutral-500">开始时间</label>
              <input
                id="task-start-time"
                type="datetime-local"
                step="60"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-end-time" className="text-[11px] font-medium text-neutral-500">结束时间</label>
              <input
                id="task-end-time"
                type="datetime-local"
                step="60"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={fieldClassName}
              />
            </div>
          </section>

          <section className="mt-5 border-t border-neutral-200 pt-5">
            <h3 className={labelClassName}>节点颜色</h3>
            <div className="mt-2.5 flex items-center gap-2.5">
              {COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${COLOR_STYLES[colorOption]} transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-2`}
                  aria-label={COLOR_LABELS[colorOption]}
                  title={COLOR_LABELS[colorOption]}
                >
                  {color === colorOption ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-[#ffffff] px-5 py-4">
          <button
            type="button"
            onClick={handleDelete}
            className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
              isConfirmingDelete
                ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700'
                : 'border-transparent text-rose-600 hover:border-rose-200 hover:bg-rose-50'
            }`}
            title={isConfirmingDelete ? '再次点击确认删除' : '删除任务'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isConfirmingDelete ? '确认删除' : '删除'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectTask(null)}
              className="h-9 rounded-md border border-neutral-200 bg-[#ffffff] px-4 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex h-9 items-center gap-1.5 rounded-md border border-purple-500 bg-purple-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
            >
              <Check className="h-3.5 w-3.5" />
              <span>保存</span>
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
};
