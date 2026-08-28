import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import type { TaskStatus } from '../types';
import { DateTimePicker } from './DateTimePicker';
import { ColorPicker } from './ColorPicker';

const NAMED_COLOR_HEX: Record<string, string> = {
  indigo: '#9387D1', emerald: '#67C8BD', sky: '#79BFD5', rose: '#D78FB5', amber: '#D9B958', violet: '#9B8AE4',
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
  const taskStatuses = useAppStore((state) => state.taskStatuses);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const addTaskStatus = useAppStore((state) => state.addTaskStatus);
  const renameTaskStatus = useAppStore((state) => state.renameTaskStatus);
  const deleteTaskStatus = useAppStore((state) => state.deleteTaskStatus);

  const task = selectedTaskId ? tasks[selectedTaskId] : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(1);
  const [statusId, setStatusId] = useState('status-not-started');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState('indigo');
  const [textColor, setTextColor] = useState('#334155');
  const [errorMsg, setErrorMsg] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isManagingStatuses, setIsManagingStatuses] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusLabel, setEditingStatusLabel] = useState('');
  const [confirmingStatusDeleteId, setConfirmingStatusDeleteId] = useState<string | null>(null);

  // Sync edits
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDuration(task.duration !== undefined ? task.duration : 0);
      setStatusId(task.statusId || (task.isDone ? 'status-completed' : 'status-not-started'));
      setStartTime(toDateTimeLocal(task.startTime));
      setEndTime(toDateTimeLocal(task.endTime, true));
      setColor(NAMED_COLOR_HEX[task.color || 'indigo'] || task.color || '#9387D1');
      setTextColor(task.textColor || '#334155');
      setErrorMsg('');
      setIsConfirmingDelete(false);
      setIsManagingStatuses(false);
      setNewStatusLabel('');
      setEditingStatusId(null);
      setConfirmingStatusDeleteId(null);
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
      statusId,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      color,
      textColor,
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

  const handleAddStatus = () => {
    const createdStatusId = addTaskStatus(newStatusLabel);
    if (!createdStatusId) return;
    setStatusId(createdStatusId);
    setNewStatusLabel('');
  };

  const startRenamingStatus = (status: TaskStatus) => {
    setEditingStatusId(status.id);
    setEditingStatusLabel(status.label);
    setConfirmingStatusDeleteId(null);
  };

  const commitStatusRename = () => {
    if (!editingStatusId || !editingStatusLabel.trim()) return;
    renameTaskStatus(editingStatusId, editingStatusLabel);
    setEditingStatusId(null);
    setEditingStatusLabel('');
  };

  const handleStatusDelete = (targetStatusId: string) => {
    if (confirmingStatusDeleteId !== targetStatusId) {
      setConfirmingStatusDeleteId(targetStatusId);
      return;
    }
    deleteTaskStatus(targetStatusId);
    if (statusId === targetStatusId) setStatusId('status-not-started');
    setConfirmingStatusDeleteId(null);
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
            <div className="grid grid-cols-2 gap-3">
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
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="task-status" className={labelClassName}>状态</label>
                  <button
                    type="button"
                    onClick={() => setIsManagingStatuses((value) => !value)}
                    className={`flex h-5 w-5 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 ${
                      isManagingStatuses ? 'bg-neutral-100 text-neutral-700' : ''
                    }`}
                    aria-label="管理任务状态"
                    title="管理任务状态"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <select
                  id="task-status"
                  value={statusId}
                  onChange={(event) => setStatusId(event.target.value)}
                  className={fieldClassName}
                >
                  {taskStatuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isManagingStatuses ? (
              <div className="mt-4 border-t border-neutral-200 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-neutral-500">状态选项</span>
                  <span className="text-[10px] text-neutral-400">默认状态不可删除</span>
                </div>

                <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                  {taskStatuses.map((status) => (
                    <div key={status.id} className="flex h-10 items-center gap-2">
                      {editingStatusId === status.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingStatusLabel}
                            onChange={(event) => setEditingStatusLabel(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') commitStatusRename();
                              if (event.key === 'Escape') setEditingStatusId(null);
                            }}
                            className="h-7 min-w-0 flex-1 rounded-md border border-purple-300 bg-white px-2 text-xs text-neutral-800 outline-none ring-2 ring-purple-100"
                            aria-label={`重命名${status.label}`}
                          />
                          <button
                            type="button"
                            onClick={commitStatusRename}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
                            aria-label="保存状态名称"
                            title="保存"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStatusId(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label="取消重命名"
                            title="取消"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{status.label}</span>
                          <button
                            type="button"
                            onClick={() => startRenamingStatus(status)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label={`重命名${status.label}`}
                            title="重命名"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!status.isSystem ? (
                            <button
                              type="button"
                              onClick={() => handleStatusDelete(status.id)}
                              className={`flex h-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 ${
                                confirmingStatusDeleteId === status.id ? 'w-auto bg-rose-50 px-2 text-[10px] font-semibold' : 'w-7'
                              }`}
                              aria-label={confirmingStatusDeleteId === status.id ? `确认删除${status.label}` : `删除${status.label}`}
                              title={confirmingStatusDeleteId === status.id ? '再次点击确认删除' : '删除'}
                            >
                              {confirmingStatusDeleteId === status.id
                                ? '确认删除'
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newStatusLabel}
                    onChange={(event) => setNewStatusLabel(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddStatus();
                    }}
                    className="h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                    placeholder="新状态名称"
                    aria-label="新状态名称"
                  />
                  <button
                    type="button"
                    onClick={handleAddStatus}
                    disabled={!newStatusLabel.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="添加状态"
                    title="添加状态"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-5 space-y-3 border-t border-neutral-200 pt-5">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              <h3 className={labelClassName}>日期与时间</h3>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-start-time" className="text-[11px] font-medium text-neutral-500">开始时间</label>
              <DateTimePicker
                id="task-start-time"
                value={startTime}
                onChange={setStartTime}
                placeholder="选择开始日期与时间"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-end-time" className="text-[11px] font-medium text-neutral-500">结束时间</label>
              <DateTimePicker
                id="task-end-time"
                value={endTime}
                onChange={setEndTime}
                placeholder="选择结束日期与时间"
              />
            </div>
          </section>

          <section className="mt-5 border-t border-neutral-200 pt-5">
            <h3 className={labelClassName}>节点颜色</h3>
            <div className="mt-2.5 space-y-2.5"><ColorPicker label="任务节点颜色" value={color} onChange={setColor} /><ColorPicker label="节点字体颜色" value={textColor} onChange={setTextColor} /></div>
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
