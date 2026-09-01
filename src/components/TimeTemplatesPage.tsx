import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, Copy, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { TimeTemplate, TimeTemplateBlock } from '../types';
import { ColorPicker } from './ColorPicker';

const DAILY_WIDTH = 1536;
const WEEKLY_WIDTH = 1260;
const TRACK_HEIGHT = 120;
const DAY_MINUTES = 1440;
const WEEK_MINUTES = DAY_MINUTES * 7;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DEFAULT_COLORS = ['#8d78d5', '#67c8bd', '#79bfd5', '#d78fb5', '#d9b958', '#9b8ae4'];
const MIN_BLOCK_MINUTES = 1;

const getCycleMinutes = (type: TimeTemplate['type']) => type === 'daily' ? DAY_MINUTES : WEEK_MINUTES;
const getTimelineWidth = (type: TimeTemplate['type']) => type === 'daily' ? DAILY_WIDTH : WEEKLY_WIDTH;
const getSnapMinutes = () => 15;
const normalizeCycleMinute = (minutes: number, cycleMinutes: number) => (
  ((minutes % cycleMinutes) + cycleMinutes) % cycleMinutes
);
const getBlockDuration = (block: Pick<TimeTemplateBlock, 'startMinute' | 'endMinute'>, cycleMinutes: number) => (
  Math.max(MIN_BLOCK_MINUTES, Math.min(cycleMinutes, block.endMinute - block.startMinute))
);

interface BlockSegment {
  startMinute: number;
  duration: number;
  hasStartHandle: boolean;
  hasEndHandle: boolean;
}

const getBlockSegments = (block: TimeTemplateBlock, cycleMinutes: number): BlockSegment[] => {
  const startMinute = normalizeCycleMinute(block.startMinute, cycleMinutes);
  const duration = getBlockDuration(block, cycleMinutes);
  if (duration >= cycleMinutes) {
    return [{ startMinute: 0, duration: cycleMinutes, hasStartHandle: true, hasEndHandle: true }];
  }
  const endMinute = startMinute + duration;
  if (endMinute <= cycleMinutes) {
    return [{ startMinute, duration, hasStartHandle: true, hasEndHandle: true }];
  }
  return [
    { startMinute, duration: cycleMinutes - startMinute, hasStartHandle: true, hasEndHandle: false },
    { startMinute: 0, duration: endMinute - cycleMinutes, hasStartHandle: false, hasEndHandle: true },
  ];
};

const formatCyclePosition = (minutes: number, type: TimeTemplate['type']) => {
  const cycleMinutes = getCycleMinutes(type);
  const safeMinutes = minutes === cycleMinutes ? cycleMinutes : normalizeCycleMinute(minutes, cycleMinutes);
  if (safeMinutes === cycleMinutes) return type === 'daily' ? '24:00' : '下周日 00:00';
  const dayIndex = Math.min(6, Math.floor(safeMinutes / DAY_MINUTES));
  const minuteOfDay = safeMinutes % DAY_MINUTES;
  const time = `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
  return type === 'daily' ? time : `${WEEKDAYS[dayIndex]} ${time}`;
};

type PointerAction = {
  pointerId: number;
  templateId: string;
  blockId: string;
  kind: 'move' | 'start' | 'end';
  startX: number;
  startMinute: number;
  endMinute: number;
  type: TimeTemplate['type'];
};

export const TimeTemplatesPage: React.FC = () => {
  const templates = useAppStore((state) => state.timeTemplates);
  const activeTemplateIds = useAppStore((state) => state.activeTimeTemplateIds);
  const addTemplate = useAppStore((state) => state.addTimeTemplate);
  const duplicateTemplate = useAppStore((state) => state.duplicateTimeTemplate);
  const renameTemplate = useAppStore((state) => state.renameTimeTemplate);
  const deleteTemplate = useAppStore((state) => state.deleteTimeTemplate);
  const setActiveTemplate = useAppStore((state) => state.setActiveTimeTemplate);
  const addBlock = useAppStore((state) => state.addTimeTemplateBlock);
  const updateBlock = useAppStore((state) => state.updateTimeTemplateBlock);
  const deleteBlock = useAppStore((state) => state.deleteTimeTemplateBlock);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id || null);
  const [detailsBlockId, setDetailsBlockId] = useState<string | null>(null);
  const pointerActionRef = useRef<PointerAction | null>(null);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
  const detailsBlock = selectedTemplate?.blocks.find((block) => block.id === detailsBlockId) || null;
  const timelineWidth = selectedTemplate ? getTimelineWidth(selectedTemplate.type) : DAILY_WIDTH;
  const cycleMinutes = selectedTemplate ? getCycleMinutes(selectedTemplate.type) : DAY_MINUTES;
  const detailsDuration = detailsBlock ? getBlockDuration(detailsBlock, cycleMinutes) : 0;
  const detailsDurationHours = Math.floor(detailsDuration / 60);
  const detailsDurationMinutes = detailsDuration % 60;
  const dailyHeaders = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);

  useEffect(() => {
    if (selectedTemplateId && templates.some((template) => template.id === selectedTemplateId)) return;
    setSelectedTemplateId(templates[0]?.id || null);
    setDetailsBlockId(null);
  }, [selectedTemplateId, templates]);

  const handleCreateTemplate = (type: TimeTemplate['type']) => {
    const id = addTemplate(type);
    setSelectedTemplateId(id);
    setDetailsBlockId(null);
  };

  const handleDuplicateTemplate = () => {
    if (!selectedTemplate) return;
    const copyId = duplicateTemplate(selectedTemplate.id);
    if (!copyId) return;
    setSelectedTemplateId(copyId);
    setDetailsBlockId(null);
  };

  const updateDetailsDuration = (hours: number, minutes: number) => {
    if (!selectedTemplate || !detailsBlock) return;
    const safeHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(59, Math.floor(minutes))) : 0;
    const duration = Math.max(MIN_BLOCK_MINUTES, Math.min(cycleMinutes, safeHours * 60 + safeMinutes));
    const startMinute = normalizeCycleMinute(detailsBlock.startMinute, cycleMinutes);
    updateBlock(selectedTemplate.id, detailsBlock.id, {
      startMinute,
      endMinute: startMinute + duration,
    });
  };

  const handleTrackDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedTemplate || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawStart = ((event.clientX - rect.left) / rect.width) * cycleMinutes;
    const snapMinutes = getSnapMinutes();
    const defaultDuration = selectedTemplate.type === 'daily' ? 60 : DAY_MINUTES;
    const startMinute = normalizeCycleMinute(Math.floor(rawStart / snapMinutes) * snapMinutes, cycleMinutes);
    addBlock(selectedTemplate.id, {
      startMinute,
      endMinute: startMinute + defaultDuration,
      label: '新时间段',
      color: DEFAULT_COLORS[selectedTemplate.blocks.length % DEFAULT_COLORS.length],
    });
    setDetailsBlockId(null);
  };

  const handlePointerStart = (event: React.PointerEvent<HTMLDivElement>, block: TimeTemplateBlock, kind: PointerAction['kind']) => {
    if (!selectedTemplate) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginHistoryGroup();
    pointerActionRef.current = {
      pointerId: event.pointerId,
      templateId: selectedTemplate.id,
      blockId: block.id,
      kind,
      startX: event.clientX,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      type: selectedTemplate.type,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const action = pointerActionRef.current;
    if (!action || action.pointerId !== event.pointerId) return;
    const actionWidth = getTimelineWidth(action.type);
    const actionCycle = getCycleMinutes(action.type);
    const snapMinutes = getSnapMinutes();
    const rawDelta = ((event.clientX - action.startX) / actionWidth) * actionCycle;
    const delta = Math.round(rawDelta / snapMinutes) * snapMinutes;
    const duration = getBlockDuration(action, actionCycle);
    if (action.kind === 'move') {
      const startMinute = normalizeCycleMinute(action.startMinute + delta, actionCycle);
      updateBlock(action.templateId, action.blockId, { startMinute, endMinute: startMinute + duration });
    } else if (action.kind === 'start') {
      const nextDuration = Math.max(snapMinutes, Math.min(actionCycle, duration - delta));
      const startMinute = normalizeCycleMinute(action.endMinute - nextDuration, actionCycle);
      updateBlock(action.templateId, action.blockId, { startMinute, endMinute: startMinute + nextDuration });
    } else {
      const nextDuration = Math.max(snapMinutes, Math.min(actionCycle, duration + delta));
      const startMinute = normalizeCycleMinute(action.startMinute, actionCycle);
      updateBlock(action.templateId, action.blockId, { startMinute, endMinute: startMinute + nextDuration });
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerActionRef.current?.pointerId !== event.pointerId) return;
    pointerActionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    endHistoryGroup();
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-50">
      <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => handleCreateTemplate('daily')} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700"><Plus className="h-3.5 w-3.5" />24 小时</button>
          <button type="button" onClick={() => handleCreateTemplate('weekly')} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-purple-200 bg-purple-50 text-xs font-semibold text-purple-600 hover:bg-purple-100"><Plus className="h-3.5 w-3.5" />周模版</button>
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto custom-scrollbar">
          {(['daily', 'weekly'] as const).map((type) => (
            <section key={type}>
              <h3 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{type === 'daily' ? '24 小时模版' : '周模版'}</h3>
              <div className="space-y-1">
                {templates.filter((template) => template.type === type).map((template) => (
                  <button key={template.id} type="button" onClick={() => { setSelectedTemplateId(template.id); setDetailsBlockId(null); }} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs ${selectedTemplate?.id === template.id ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-transparent text-neutral-600 hover:bg-neutral-50'}`}>
                    <span className="truncate font-semibold">{template.name || '未命名模版'}</span>
                    {activeTemplateIds[type] === template.id ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {templates.length === 0 ? <p className="px-3 py-8 text-center text-xs text-neutral-400">暂无模版</p> : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-6 custom-scrollbar">
        {!selectedTemplate ? <div className="flex h-full items-center justify-center text-sm text-neutral-400">请选择或新建一个时间模版</div> : (
          <div className="mx-auto max-w-[1700px] space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3"><Clock3 className="h-5 w-5 text-purple-500" /><input value={selectedTemplate.name} onFocus={beginHistoryGroup} onChange={(event) => renameTemplate(selectedTemplate.id, event.target.value)} onBlur={endHistoryGroup} className="min-w-48 bg-transparent text-lg font-bold text-neutral-800 outline-none" aria-label="时间模版名称" /></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTemplate(selectedTemplate.type, activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? null : selectedTemplate.id)} className={`h-9 rounded-lg border px-3 text-xs font-semibold ${activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-purple-200 bg-purple-50 text-purple-600'}`}>{activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? '已应用 · 点击停用' : '应用到工作区'}</button>
                <button type="button" onClick={handleDuplicateTemplate} className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50" title="复制当前模版及其全部时间块"><Copy className="h-3.5 w-3.5" />创建副本</button>
                <button type="button" onClick={() => { if (window.confirm(`确定删除“${selectedTemplate.name || '未命名模版'}”吗？`)) deleteTemplate(selectedTemplate.id); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />删除模版</button>
              </div>
            </header>
            <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm custom-scrollbar">
              <div style={{ width: timelineWidth }}>
                <div className="flex h-12 border-b border-neutral-200 bg-neutral-50">
                  {selectedTemplate.type === 'daily' ? dailyHeaders.map((hour) => <div key={hour} style={{ width: DAILY_WIDTH / 24 }} className="flex shrink-0 items-center justify-center border-r border-neutral-200 text-[10px] font-semibold text-neutral-500">{String(hour).padStart(2, '0')}:00</div>) : WEEKDAYS.map((day) => <div key={day} style={{ width: WEEKLY_WIDTH / 7 }} className="flex shrink-0 items-center justify-center border-r border-neutral-200 text-xs font-semibold text-neutral-500">{day}</div>)}
                </div>
                <div onDoubleClick={handleTrackDoubleClick} className="relative" style={{ width: timelineWidth, height: TRACK_HEIGHT, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${(selectedTemplate.type === 'daily' ? DAILY_WIDTH / 24 : WEEKLY_WIDTH / 7) - 1}px, #e9ebef ${(selectedTemplate.type === 'daily' ? DAILY_WIDTH / 24 : WEEKLY_WIDTH / 7) - 1}px, #e9ebef ${selectedTemplate.type === 'daily' ? DAILY_WIDTH / 24 : WEEKLY_WIDTH / 7}px)` }}>
                  {selectedTemplate.blocks.flatMap((block) => {
                    const segments = getBlockSegments(block, cycleMinutes);
                    const labelSegmentIndex = segments.reduce((widestIndex, segment, index) => (
                      segment.duration > segments[widestIndex].duration ? index : widestIndex
                    ), 0);
                    const rangeLabel = `${formatCyclePosition(block.startMinute, selectedTemplate.type)}–${formatCyclePosition(block.endMinute, selectedTemplate.type)}`;
                    return segments.map((segment, index) => (
                      <div key={`${block.id}-${index}`} onDoubleClick={(event) => { event.stopPropagation(); setDetailsBlockId(block.id); }} onPointerDown={(event) => handlePointerStart(event, block, 'move')} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} style={{ left: segment.startMinute / cycleMinutes * timelineWidth, width: Math.max(4, segment.duration / cycleMinutes * timelineWidth), backgroundColor: block.color }} className="absolute top-9 flex h-11 touch-none cursor-grab items-center justify-center overflow-hidden rounded-md border border-white/50 px-3 text-[10px] font-semibold text-white shadow-md active:cursor-grabbing" title={`${block.label} · ${rangeLabel}`}>
                        {segment.hasStartHandle ? <div onPointerDown={(event) => handlePointerStart(event, block, 'start')} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-r bg-white/50" /> : null}
                        {index === labelSegmentIndex ? <span className="truncate">{block.label}</span> : null}
                        {segment.hasEndHandle ? <div onPointerDown={(event) => handlePointerStart(event, block, 'end')} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-l bg-white/50" /> : null}
                      </div>
                    ));
                  })}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {selectedTemplate && detailsBlock ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
          <button type="button" onClick={() => setDetailsBlockId(null)} className="absolute inset-0 bg-neutral-900/25" aria-label="关闭时间块详情" />
          <section className="custom-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-bold text-neutral-800">时间块详情</h2><button type="button" onClick={() => setDetailsBlockId(null)} className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4">
              <label className="block space-y-1.5"><span className="text-xs font-semibold text-neutral-600">标签名称</span><input value={detailsBlock.label} onFocus={beginHistoryGroup} onChange={(event) => updateBlock(selectedTemplate.id, detailsBlock.id, { label: event.target.value })} onBlur={endHistoryGroup} className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-purple-300" /></label>
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold text-neutral-600">时长</legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="relative block"><input type="number" min="0" max={Math.floor(cycleMinutes / 60)} step="1" value={detailsDurationHours} onFocus={beginHistoryGroup} onChange={(event) => updateDetailsDuration(Number(event.target.value), detailsDurationMinutes)} onBlur={endHistoryGroup} className="h-10 w-full rounded-lg border border-neutral-200 px-3 pr-10 text-sm outline-none focus:border-purple-300" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-400">小时</span></label>
                  <label className="relative block"><input type="number" min="0" max="59" step="1" value={detailsDurationMinutes} onFocus={beginHistoryGroup} onChange={(event) => updateDetailsDuration(detailsDurationHours, Number(event.target.value))} onBlur={endHistoryGroup} className="h-10 w-full rounded-lg border border-neutral-200 px-3 pr-10 text-sm outline-none focus:border-purple-300" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-400">分钟</span></label>
                </div>
              </fieldset>
              <ColorPicker label="时间块颜色" value={detailsBlock.color} onChange={(color) => updateBlock(selectedTemplate.id, detailsBlock.id, { color })} />
              <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{formatCyclePosition(detailsBlock.startMinute, selectedTemplate.type)} — {formatCyclePosition(detailsBlock.endMinute, selectedTemplate.type)}</div>
              <button type="button" onClick={() => { deleteBlock(selectedTemplate.id, detailsBlock.id); setDetailsBlockId(null); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" />删除时间块</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
