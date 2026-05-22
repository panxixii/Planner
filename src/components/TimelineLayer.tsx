import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Calendar, Clock, Sparkles, SlidersHorizontal, Scale, ChevronRight, Inbox } from 'lucide-react';

type ZoomScaleType = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

const getTodayDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${r}`;
  return dateStr.startsWith('2026') ? dateStr : '2026-05-22';
};

export const TimelineLayer: React.FC = () => {
  const tasks = useAppStore((state) => state.tasks);
  const selectTask = useAppStore((state) => state.selectTask);
  const goals = useAppStore((state) => state.goals);
  const activeMergedGoalIds = useAppStore((state) => state.activeMergedGoalIds);

  const [zoomScale, setZoomScale] = useState<ZoomScaleType>('days');

  // 1. FILTER TASKS: Only display tasks that belong to goals currently LOADED into the merged workspace!
  const visibleTasks = useMemo(() => {
    const visibleTaskIds = new Set<string>();
    
    Object.entries(goals || {}).forEach(([gid, g]) => {
      if (activeMergedGoalIds && activeMergedGoalIds.includes(gid) && g && g.nodes) {
        g.nodes.forEach(n => {
          if (n && n.taskId) {
            visibleTaskIds.add(n.taskId);
          }
        });
      }
    });

    return Object.values(tasks).filter(
      (t) => visibleTaskIds.has(t.id) && t.startTime && t.endTime
    );
  }, [tasks, goals, activeMergedGoalIds]);

  // 2. DEFINE TIMELINE TIME BOUNDS & HEADERS PER SCALE
  const scaleConfig = useMemo(() => {
    switch (zoomScale) {
      case 'minutes': {
        const rangeStart = new Date('2026-05-22T09:00:00').getTime();
        const rangeEnd = new Date('2026-05-18T12:00:00').getTime(); // 3 hours
        return {
          title: '5月22日 09:00 - 12:00 (15分钟番茄刻度)',
          gridWidthClass: 'w-[1200px]',
          colCount: 12,
          rangeStart: new Date('2026-05-22T09:00:00').getTime(),
          rangeEnd: new Date('2026-05-22T12:00:00').getTime(),
          headers: ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45']
        };
      }
      case 'hours': {
        return {
          title: '5月22日 00:00 - 24:00 (2小时日常刻度)',
          gridWidthClass: 'w-[1200px]',
          colCount: 12,
          rangeStart: new Date('2026-05-22T00:00:00').getTime(),
          rangeEnd: new Date('2026-05-22T24:00:00').getTime(),
          headers: ['02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00']
        };
      }
      case 'weeks': {
        return {
          title: 'Q2中后期战役追踪 (4星期跨度)',
          gridWidthClass: 'w-[1000px]',
          colCount: 4,
          rangeStart: new Date('2026-05-18').getTime(),
          rangeEnd: new Date('2026-06-14').getTime() + 86400000,
          headers: [
            'W21 (5/18 - 5/24)', 
            'W22 (5/25 - 5/31)', 
            'W23 (6/01 - 6/07)', 
            'W24 (6/08 - 6/14)'
          ]
        };
      }
      case 'months': {
        return {
          title: 'Q2-Q3愿景周期管理 (5个月度跨度)',
          gridWidthClass: 'w-[1000px]',
          colCount: 5,
          rangeStart: new Date('2026-04-01').getTime(),
          rangeEnd: new Date('2026-08-31').getTime() + 86400000,
          headers: [
            '2026年4月 April', 
            '2026年5月 May', 
            '2026年6月 June', 
            '2026年7月 July', 
            '2026年8月 August'
          ]
        };
      }
      case 'days':
      default: {
        const startRaw = getTodayDateStr();
        const dates: string[] = [];
        const dateObj = new Date(startRaw);
        for (let i = 0; i < 22; i++) {
          dates.push(dateObj.toISOString().split('T')[0]);
          dateObj.setDate(dateObj.getDate() + 1);
        }
        
        const endDateObj = new Date(startRaw);
        endDateObj.setDate(endDateObj.getDate() + 21);
        const endDateStr = endDateObj.toISOString().split('T')[0];
        
        const startRawObj = new Date(startRaw);
        const startMD = `${startRawObj.getMonth() + 1}月${startRawObj.getDate()}日`;
        const endMD = `${endDateObj.getMonth() + 1}月${endDateObj.getDate()}日`;

        return {
          title: `${startMD} - ${endMD} (22天度量，目标追踪)`,
          gridWidthClass: 'w-[1600px]',
          colCount: 22,
          rangeStart: new Date(startRaw).getTime(),
          rangeEnd: endDateObj.getTime() + 86400000,
          headers: dates
        };
      }
    }
  }, [zoomScale]);

  const getDayShortLabel = (dateStr: string) => {
    const [, month, day] = dateStr.split('-');
    return `${month}/${day}`;
  };

  const getDayChineseName = (dateStr: string) => {
    const d = new Date(dateStr);
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[d.getDay()];
  };

  const getDaysRemainingStr = (endTimeStr?: string) => {
    if (!endTimeStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const end = new Date(endTimeStr);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今日截止';
    } else if (diffDays < 0) {
      return `已逾期 ${Math.abs(diffDays)} 天`;
    } else {
      return `剩 ${diffDays} 天`;
    }
  };

  const getCountdownBadgeClass = (endTimeStr: string, isDone: boolean) => {
    if (isDone) return 'bg-neutral-100 text-neutral-400 border border-neutral-200';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const end = new Date(endTimeStr);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'bg-rose-50 text-rose-500 border border-rose-100';
    } else if (diffDays <= 2) {
      return 'bg-amber-50 text-amber-600 border border-amber-150 animate-pulse';
    } else {
      return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    }
  };

  // 3. COLOR CLASSES MAPPING
  const colorClasses: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600 border-emerald-400/30 text-white shadow-emerald-500/10',
    rose: 'from-rose-500 to-rose-600 border-rose-400/30 text-white shadow-rose-500/10',
    sky: 'from-blue-500 to-blue-600 border-blue-400/30 text-white shadow-blue-500/10',
    amber: 'from-amber-500 to-amber-600 border-amber-400/30 text-white shadow-amber-500/10',
    violet: 'from-purple-500 to-purple-600 border-purple-400/30 text-white shadow-purple-500/10',
    indigo: 'from-indigo-400 to-indigo-600 border-indigo-400/30 text-white shadow-indigo-500/10'
  };

  return (
    <div id="timeline" className="bg-white border-t border-neutral-200 flex flex-col h-80 shrink-0 select-none">
      
      {/* 1. Timeline Upper Control Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-2.5 bg-neutral-50/50 border-b border-neutral-200">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <Calendar className="w-4 h-4 text-blue-500" />
          <h4 className="text-xs font-bold text-neutral-800 font-sans tracking-tight">
            人生成长排期甘特图轴
          </h4>
          <span className="text-[10px] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-blue-600 font-mono font-medium uppercase">
            {scaleConfig.title}
          </span>
        </div>

        {/* Dynamic Zoom Scales Segment Controller Controls */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-neutral-200/60 p-1 rounded-xl">
            {(['minutes', 'hours', 'days', 'weeks', 'months'] as ZoomScaleType[]).map((tab) => {
              const isActive = zoomScale === tab;
              const tabLabels: Record<ZoomScaleType, string> = {
                minutes: '分',
                hours: '时',
                days: '天',
                weeks: '周',
                months: '月'
              };
              const tabTooltips: Record<ZoomScaleType, string> = {
                minutes: '分钟视角 (Pomodoro)',
                hours: '小时视角 (Daily Agenda)',
                days: '天级视角',
                weeks: '星期视角',
                months: '月度大局'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setZoomScale(tab)}
                  className={`text-[10.5px] font-medium font-sans px-3 py-1 rounded-lg cursor-pointer transition-all uppercase
                    ${isActive 
                      ? 'bg-white text-neutral-850 font-bold shadow-xs' 
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/40'
                    }`}
                  title={tabTooltips[tab]}
                >
                  {tabLabels[tab]}
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-neutral-400 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 已毕
            <span className="w-2 h-2 rounded-full bg-blue-500" /> 推进中
          </div>
        </div>
      </div>

      {/* 2. Scrollable Gantt Matrix Engine */}
      <div className="flex-1 overflow-x-auto min-w-0 custom-scrollbar relative bg-white">
        <div className={`${scaleConfig.gridWidthClass} h-full flex flex-col`}>
          
          {/* A. Gantt Header Row */}
          <div 
            style={{ gridTemplateColumns: `240px repeat(${scaleConfig.colCount}, 1fr)` }}
            className="grid border-b border-neutral-100 bg-neutral-50/40 text-neutral-400 text-[10px] font-mono select-none divide-x divide-neutral-100"
          >
            <div className="p-3 font-bold text-neutral-600 uppercase tracking-wider pl-6 font-sans">
              已实例化计划下的阶段节点
            </div>
            {scaleConfig.headers.map((h, idx) => {
              const isToday = zoomScale === 'days' && h === getTodayDateStr();
              return (
                <div 
                  key={idx} 
                  className={`p-2 text-center flex flex-col justify-center items-center gap-0.5 min-w-0 
                    ${isToday ? 'bg-blue-50/75 text-blue-600 font-bold border-x border-blue-200' : ''}`}
                >
                  {zoomScale === 'days' ? (
                    <>
                      <span className="text-[10.5px] font-semibold">{getDayShortLabel(h)}</span>
                      <span className="text-[8px] opacity-75">{getDayChineseName(h)}</span>
                    </>
                  ) : (
                    <span className="text-[10.5px] font-semibold truncate leading-tight">{h}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* B. Gantt Progression Tracks */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {visibleTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-450 text-xs py-12 gap-2 font-mono">
                <Inbox className="w-8 h-8 text-neutral-350 stroke-1" />
                <span>当前合并画布没有载入任何拓扑节点，时间轴无排期指标。</span>
                <span className="text-[10px] text-neutral-400">请勾选载入成长计划，或拖拽左下角 BOM 里程碑至画布。</span>
              </div>
            ) : (
              visibleTasks.map((task) => {
                // Calculate bounds style using math utilities
                let startTs = new Date(task.startTime!).getTime();
                let endTs = new Date(task.endTime!).getTime() + 86400000;

                // Virtual mapping for Micro/Macro views so that they populate cleanly!
                if (zoomScale === 'hours') {
                  const seed = task.id.charCodeAt(task.id.length - 1) || 12;
                  const startHour = (seed % 8) + 8; // Schedule during daytime 8:00 to 15:00
                  startTs = new Date(`2026-05-22T0${startHour}:00:00`).getTime();
                  endTs = startTs + ((seed % 4) + 2) * 3600000; // 2-5 hours
                } else if (zoomScale === 'minutes') {
                  const seed = task.id.charCodeAt(task.id.length - 1) || 10;
                  const startMin = (seed % 3) * 30 + 10; // e.g. 10m, 40m, 70m
                  const startHour = 9 + (seed % 2); // 9 or 10 o'clock
                  startTs = new Date(`2026-05-22T0${startHour}:${startMin === 10 ? '10' : startMin}:00`).getTime();
                  endTs = startTs + 40 * 60000; // 40-minute blocks
                }

                const rangeTotal = scaleConfig.rangeEnd - scaleConfig.rangeStart;
                const outOfBounds = startTs > scaleConfig.rangeEnd || endTs < scaleConfig.rangeStart;

                let leftPct = 0;
                let widthPct = 0;
                let showBar = false;

                if (!outOfBounds) {
                  const clampedStart = Math.max(startTs, scaleConfig.rangeStart);
                  const clampedEnd = Math.min(endTs, scaleConfig.rangeEnd);
                  leftPct = ((clampedStart - scaleConfig.rangeStart) / rangeTotal) * 100;
                  widthPct = ((clampedEnd - clampedStart) / rangeTotal) * 100;
                  showBar = widthPct > 0;
                }

                const barColor = colorClasses[task.color || 'indigo'] || colorClasses.indigo;

                return (
                  <div 
                    key={task.id} 
                    style={{ gridTemplateColumns: `240px repeat(${scaleConfig.colCount}, 1fr)` }}
                    className="grid items-center hover:bg-neutral-50/50 transition-colors divide-x divide-neutral-100 py-2.5 h-[52px]"
                  >
                    {/* Normalized Task Identifier Row Header */}
                    <div className="px-6 flex flex-col justify-center min-w-0">
                      <button
                        onClick={() => selectTask(task.id)}
                        className="text-xs font-semibold text-neutral-800 hover:text-blue-600 truncate text-left transition-colors cursor-pointer font-sans"
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-1.5 text-[9px] text-neutral-450 font-mono">
                        <span>工期评估: {task.duration}h</span>
                        {task.endTime && (
                          <span className={`px-1 py-0.2 rounded text-[8px] font-medium leading-none shrink-0 ${getCountdownBadgeClass(task.endTime, task.isDone)}`}>
                            {getDaysRemainingStr(task.endTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timeline Multi Column Cell spanning track */}
                    <div 
                      style={{ gridColumn: `2 / span ${scaleConfig.colCount}` }}
                      className="relative h-full flex items-center px-1"
                    >
                      {/* Active Scheduled Milestone Bar */}
                      {showBar && (
                        <button
                          onClick={() => selectTask(task.id)}
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(2, widthPct)}%`
                          }}
                          className={`absolute h-7 rounded-lg border bg-gradient-to-r px-2.5 flex items-center justify-between gap-1 shadow-xs transition-transform hover:scale-[1.008] cursor-pointer text-left overflow-hidden group
                            ${task.isDone 
                              ? 'from-neutral-100 to-neutral-200 border-neutral-350 text-neutral-400 opacity-60 line-through' 
                              : barColor
                            }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-sans font-medium truncate">
                              {task.title}
                            </span>
                            {task.endTime && !task.isDone && (
                              <span className="hidden sm:inline bg-black/15 text-white/95 px-1 py-0.2 rounded text-[8px] font-bold shrink-0 font-mono scale-90">
                                {getDaysRemainingStr(task.endTime)}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-0.5 shrink-0 font-mono text-[9px] opacity-80 group-hover:opacity-100">
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {zoomScale === 'minutes' ? '40m' : 
                               zoomScale === 'hours' ? `${Math.round((endTs - startTs) / 3600000)}h` : 
                               `${task.duration}h`}
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Not scheduled inside this index */}
                      {!showBar && (
                        <div className="text-[9px] text-neutral-400 italic px-4 font-mono">
                          不在此排期视野。双击画布微调具体周期约束。
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};
