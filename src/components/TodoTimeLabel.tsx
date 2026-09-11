import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, X } from 'lucide-react';
import { useAppStore } from '../store';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
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
    ? (item.startTime ? `${formatDate(item.startTime)} → ${formatDate(item.endTime)}` : `截止 ${formatDate(item.endTime)}`)
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
    if (!draftEnd && draftStart) { setError('请选择截止日期，或清除开始日期'); return; }
    if (draftStart && draftEnd && draftStart > draftEnd) { setError('截止日期不能早于开始日期'); return; }
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
          <div role="dialog" aria-label="设置任务时间" className="fixed z-[200] w-56 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xl" style={{ top: panelPos.top, left: panelPos.left }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700">任务时间</span>
              <button type="button" onClick={() => setPanelPos(null)} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100" aria-label="关闭"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2.5">
              <label className="block space-y-1"><span className="text-[10px] font-semibold text-neutral-400">开始日期（可选）</span>
                <input type="date" value={draftStart} onChange={(event) => { setDraftStart(event.target.value); setError(''); }} className="h-8 w-full rounded-md border border-neutral-200 px-2 text-xs outline-none focus:border-purple-300" />
              </label>
              <label className="block space-y-1"><span className="text-[10px] font-semibold text-neutral-400">截止日期</span>
                <input type="date" value={draftEnd} onChange={(event) => { setDraftEnd(event.target.value); setError(''); }} className="h-8 w-full rounded-md border border-neutral-200 px-2 text-xs outline-none focus:border-purple-300" />
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
