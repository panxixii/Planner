import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useAppStore } from '../store';
import { CheckCircle2, Circle, Clock, Calendar, ArrowUpRight } from 'lucide-react';

interface TaskNodeData {
  taskId: string;
  goalColor?: string;
  goalTitle?: string;
  isMerged?: boolean;
}

export const TaskNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as TaskNodeData;
  const taskId = data?.taskId;
  
  // Directly subscribe to this specific task from normalized store to achieve instant reactive synchrony
  const task = useAppStore((state) => state.tasks[taskId]);
  const updateTask = useAppStore((state) => state.updateTask);
  const selectTask = useAppStore((state) => state.selectTask);

  if (!task) {
    return (
      <div className="px-4 py-3 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-500 text-xs shadow-xs">
        任务未定义
      </div>
    );
  }

  const { title, description, duration, isDone, startTime, endTime, color } = task;

  // Render color tag classes
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    emerald: { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200 group-hover:border-emerald-500/50', 
      text: 'text-emerald-600',
      glow: 'shadow-[0_4px_15px_rgba(16,185,129,0.06)]'
    },
    rose: { 
      bg: 'bg-rose-50', 
      border: 'border-rose-200 group-hover:border-rose-500/50', 
      text: 'text-rose-600',
      glow: 'shadow-[0_4px_15px_rgba(244,63,94,0.06)]'
    },
    sky: { 
      bg: 'bg-blue-50', 
      border: 'border-blue-200 group-hover:border-blue-500/50', 
      text: 'text-blue-600',
      glow: 'shadow-[0_4px_15px_rgba(59,130,246,0.06)]'
    },
    amber: { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200 group-hover:border-amber-500/50', 
      text: 'text-amber-600',
      glow: 'shadow-[0_4px_15px_rgba(245,158,11,0.06)]'
    },
    violet: { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200 group-hover:border-purple-500/50', 
      text: 'text-purple-600',
      glow: 'shadow-[0_4px_15px_rgba(139,92,246,0.06)]'
    },
    indigo: { 
      bg: 'bg-indigo-50', 
      border: 'border-indigo-200 group-hover:border-indigo-500/50', 
      text: 'text-indigo-600',
      glow: 'shadow-[0_4px_15px_rgba(99,102,241,0.06)]'
    }
  };

  const scheme = colorMap[color || 'indigo'] || colorMap.indigo;

  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation(); // halt canvas selection drag triggers
    updateTask(taskId, { isDone: !isDone });
  };

  return (
    <div 
      onClick={() => selectTask(taskId)}
      className={`relative group w-72 rounded-xl border transition-all duration-300 cursor-pointer text-left shadow-xs
        ${isDone 
          ? 'bg-neutral-50/90 border-neutral-200/60 opacity-60 grayscale' 
          : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-md hover:scale-[1.015]'
        } ${scheme.glow}`}
    >
      {/* Top handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-neutral-300 transition-colors group-hover:!bg-blue-500 group-hover:!border-blue-200"
      />

      <div className="p-4 space-y-3">
        {/* Header Ribbon / Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono">
            <span className={`px-2 py-0.5 rounded bg-[#F1F3F5] text-[9.5px] font-semibold tracking-wide uppercase ${scheme.text} border border-neutral-200`}>
              {color || 'task'}
            </span>
            {data.isMerged && data.goalTitle && (
              <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-500 text-[9px] font-mono truncate max-w-[120px]">
                {data.goalTitle}
              </span>
            )}
          </div>
          
          <button 
            onClick={handleToggleDone}
            className="nodrag text-neutral-400 hover:text-neutral-600 transition-colors p-0.5 cursor-pointer"
            title={isDone ? "重新开启任务" : "标记为已完成"}
          >
            {isDone ? (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded tracking-wider font-bold font-mono border border-emerald-200">已完成</span>
            ) : (
              <Circle className="w-4 h-4 hover:text-blue-500 text-neutral-300" />
            )}
          </button>
        </div>

        {/* Title & Desc */}
        <div className="space-y-1">
          <h4 className={`text-xs font-semibold tracking-tight text-neutral-800 transition-colors underline-offset-4 decoration-1 ${isDone ? 'line-through text-neutral-400' : ''}`}>
            {title || '未命名任务'}
          </h4>
          <p className={`text-[11px] line-clamp-2 leading-relaxed ${isDone ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {description || '暂无详细描述信息。'}
          </p>
        </div>

        {/* Footer Meta Metrics */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[10px] text-neutral-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-neutral-400" />
            <span>{duration} 工时/小时</span>
          </div>

          {startTime && endTime ? (
            <div className="flex items-center gap-1 text-neutral-500">
              <Calendar className="w-3 h-3 text-neutral-400" />
              <span>{startTime.substring(5)} → {endTime.substring(5)}</span>
            </div>
          ) : (
            <span className="text-neutral-400 italic text-[9px]">暂无排程日期</span>
          )}
        </div>
      </div>

      {/* Detail Arrow */}
      <div className="absolute right-3.5 top-3.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-neutral-300 transition-colors group-hover:!bg-blue-500 group-hover:!border-blue-200"
      />
    </div>
  );
};
