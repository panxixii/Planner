import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { X, Check, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';

export const TaskDrawer: React.FC = () => {
  const selectedTaskId = useAppStore((state) => state.selectedTaskId);
  const selectTask = useAppStore((state) => state.selectTask);
  const tasks = useAppStore((state) => state.tasks);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);

  const task = selectedTaskId ? tasks[selectedTaskId] : null;

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
      setStartTime(task.startTime || '');
      setEndTime(task.endTime || '');
      setColor(task.color || 'indigo');
      setErrorMsg('');
      setIsConfirmingDelete(false);
    }
  }, [task, selectedTaskId]);

  if (!selectedTaskId || !task) return null;

  const colors = ['indigo', 'emerald', 'sky', 'rose', 'amber', 'violet'];

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
      {/* Backdrop glass blur overlay */}
      <div 
        onClick={() => selectTask(null)}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Floating Panel (Apple Modern Card look) */}
      <div id="task-drawer-panel" className="relative w-full max-w-md h-full bg-white border-l border-neutral-200 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <h3 className="text-sm font-semibold text-neutral-800 font-sans tracking-tight uppercase">
                编辑任务
              </h3>
            </div>
            <button 
              onClick={() => selectTask(null)}
              className="p-1 rounded-full text-neutral-450 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-4 text-xs text-neutral-700">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">任务标题</label>
              <input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
                placeholder="任务名称"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">描述</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:bg-white focus:border-blue-500 leading-relaxed"
                placeholder="任务描述"
              />
            </div>

            {/* Two Column details: Duration & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono flex items-center gap-1">
                  <Clock className="w-3 text-neutral-400" /> 预估时间 (小时)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={duration || ''} 
                  onChange={(e) => setDuration(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-neutral-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-mono"
                  placeholder="未设定工时..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">进度审核</label>
                <button
                  onClick={() => setIsDone(!isDone)}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 transition-all text-xs font-semibold cursor-pointer font-mono
                    ${isDone 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold' 
                      : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:border-neutral-300'
                    }`}
                >
                  <Check className={`w-3.5 h-3.5 transition-transform ${isDone ? 'scale-110 text-emerald-600' : 'scale-0'}`} />
                  <span>{isDone ? '已完成' : '未完成'}</span>
                </button>
              </div>
            </div>

            {/* Dates range */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono flex items-center gap-1">
                <Calendar className="w-3 text-neutral-400" /> 日期
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 font-mono">开始日期</span>
                  <input 
                    type="date"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 font-mono">结束日期</span>
                  <input 
                    type="date"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Color tags */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">节点视觉色块主色</label>
              <div className="flex gap-2.5">
                {colors.map((c) => {
                  const colorBg: Record<string, string> = {
                    indigo: 'bg-[#9387d1]',
                    emerald: 'bg-[#67c8bd]',
                    sky: 'bg-[#79bfd5]',
                    rose: 'bg-[#d78fb5]',
                    amber: 'bg-[#d9b958]',
                    violet: 'bg-[#9b8ae4]'
                  };
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${colorBg[c]} relative hover:scale-110 cursor-pointer`}
                    >
                      {color === c && (
                        <span className="absolute inset-0 rounded-full border border-neutral-600 scale-110 shadow-xs animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-neutral-200 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer border uppercase
              ${isConfirmingDelete 
                ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 font-extrabold animate-pulse' 
                : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-transparent hover:border-rose-200'
              }`}
            title="删除任务"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isConfirmingDelete ? '再次确认' : '删除'}</span>
          </button>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={() => selectTask(null)}
              className="px-4 py-2 rounded-lg text-xs bg-neutral-155 text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer border border-neutral-200/50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-xs bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-blue-500/20"
            >
              <Check className="w-4 h-4" />
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
