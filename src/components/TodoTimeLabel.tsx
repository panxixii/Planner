import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, X } from 'lucide-react';
import { useAppStore } from '../store';
import { DateTimePicker } from './DateTimePicker';

const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

const formatStamp = (value: string) => {
  if (!STAMP_PATTERN.test(value)) return value;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-');
  const base = `${Number(month)}/${Number(day)}`;
  if (!timePart) return base;
  const hasTime = !(timePart === '00:00' || timePart === '23:59');
  return hasTime ? `${base} ${timePart}` : base;
};

export const TodoTimeLabel: React.FC<{ itemId: string }> = ({ itemId }) => {
  const item = useAppStore((state) => state.todoItems.find((candidate) => candidate.id === itemId));
  const setTimeRange = useAppStore((state) => state.setTodoItemTimeRange);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [error, setError] = useState('');
  const anchorRef = useRef<HTMLButtonElement>(null);
  const open = panelPos !== null;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanelPos(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!item) return null;

  const label = item.endTime
    ? (item.startTime ? `${formatStamp(item.startTime)} → ${formatStamp(item.endTime)}` : `截止 ${formatStamp(item.endTime)}`)
    : '---';
  const title = item.endTime
    ? (item.startTime ? `${item.startTime} → ${item.endTime}，点击修改` : `截止 ${item.endTime}，点击修改`)
    : '未设置时间，点击设置';

  const openPanel = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraftStart(item.startTime || '');
    setDraftEnd(item.endTime || '');
    setError('');
    setPanelPos({ top: Math.max(8, rect.top - 190), left: Math.min(rect.right - 224, window.innerWidth - 236) });
  };

  const commit = () => {
    if (!draftEnd && draftStart) { setError('请选择截止时间，或清除开始时间'); return; }
    if (draftStart && draftEnd && draftStart > draftEnd) { setError('截止时间不能早于开始时间'); return; }
    setTimeRange(item.id, draftStart || null, draftEnd || null);
    setPanelPos(null);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(event) => { event.stopPropagation(); if (open) setPanelPos(null); else openPanel(); }}
        onDoubleClick={(event) => event.stopPropagation()}
        className={`flex h-5 shrink-0 items-center gap-1 rounded px-1 text-[10px] font-semibold transition-colors hover:bg-neutral-100 ${item.endTime ? 'text-sky-600' : 'text-neutral-300'}`}
        title={title}
        aria-label={`时间：${label}，点击修改`}
      >
        <CalendarClock className="h-3 w-3" />
        <span className="tabular-nums">{label}</span>
      </button>
      {open && panelPos ? createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={() => setPanelPos(null)} aria-label="关闭时间设置" />
          <div role="dialog" aria-label="设置任务时间" className="fixed z-[200] w-64 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xl" style={{ top: panelPos.top, left: panelPos.left }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700">任务时间</span>
              <button type="button" onClick={() => setPanelPos(null)} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100" aria-label="关闭"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2.5">
              <label className="block space-y-1"><span className="text-[10px] font-semibold text-neutral-400">开始时间（可选）</span>
                <DateTimePicker value={draftStart} onChange={(nextValue) => { setDraftStart(nextValue); setError(''); }} placeholder="选择开始时间" />
              </label>
              <label className="block space-y-1"><span className="text-[10px] font-semibold text-neutral-400">截止时间</span>
                <DateTimePicker value={draftEnd} onChange={(nextValue) => { setDraftEnd(nextValue); setError(''); }} placeholder="选择截止时间" />
              </label>
              {error ? <p className="text-[10px] text-rose-500">{error}</p> : null}
              <div className="flex items-center justify-between pt-0.5">
                <button type="button" onClick={() => { setDraftStart(''); setDraftEnd(''); setTimeRange(item.id, null, null); setPanelPos(null); }} className="h-7 rounded-md px-2 text-[10px] font-semibold text-neutral-400 hover:bg-neutral-50">清除</button>
                <button type="button" onClick={commit} className="h-7 rounded-md bg-purple-600 px-3 text-[10px] font-semibold text-white hover:bg-purple-700">保存</button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
};
