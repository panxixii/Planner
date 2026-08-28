import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const pad = (value: number) => String(value).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTES = Array.from({ length: 60 }, (_, minute) => pad(minute));
const formatValue = (date: Date, time: string) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time || '00:00'}`;
const getParts = (value: string) => {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return { date, time: value.includes('T') ? value.slice(11, 16) : '00:00' };
};

interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ id, value, onChange, placeholder = '选择日期和时间' }) => {
  const initial = getParts(value);
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(initial.date.getFullYear(), initial.date.getMonth(), 1));
  const [draftDate, setDraftDate] = useState(initial.date);
  const [draftTime, setDraftTime] = useState(initial.time);
  const [isTimeOpen, setIsTimeOpen] = useState(false);

  const calendarDays = useMemo(() => {
    const firstWeekday = displayMonth.getDay();
    const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
    const previousDays = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const dayOffset = index - firstWeekday + 1;
      if (dayOffset < 1) return { date: new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, previousDays + dayOffset), muted: true };
      if (dayOffset > daysInMonth) return { date: new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, dayOffset - daysInMonth), muted: true };
      return { date: new Date(displayMonth.getFullYear(), displayMonth.getMonth(), dayOffset), muted: false };
    });
  }, [displayMonth]);

  const openPicker = () => {
    const parts = getParts(value);
    setDraftDate(parts.date);
    setDraftTime(parts.time);
    setDisplayMonth(new Date(parts.date.getFullYear(), parts.date.getMonth(), 1));
    setIsTimeOpen(false);
    setIsOpen(true);
  };

  const [draftHour = '00', draftMinute = '00'] = draftTime.split(':');
  const selectToday = () => {
    const today = new Date();
    setDraftDate(today);
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };
  const selectNow = () => {
    const now = new Date();
    setDraftDate(now);
    setDisplayMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setDraftTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  };

  return (
    <div className="relative">
      <button id={id} type="button" onClick={openPicker} className="flex h-10 w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-700 outline-none transition-colors hover:border-purple-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100">
        <span className={value ? '' : 'text-neutral-400'}>{value ? value.replace('T', ' ') : placeholder}</span><CalendarDays className="h-4 w-4 text-purple-400" />
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-[120] mt-2 w-[330px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><button type="button" onClick={() => setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-purple-50"><ChevronLeft className="h-4 w-4" /></button><div className="flex items-center gap-2"><span className="text-sm font-bold text-neutral-700">{displayMonth.getFullYear()} 年 {displayMonth.getMonth() + 1} 月</span><button type="button" onClick={selectToday} className="h-7 rounded-md bg-purple-50 px-2 text-[10px] font-semibold text-purple-600">今天</button></div><button type="button" onClick={() => setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-purple-50"><ChevronRight className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-7 gap-1">{WEEKDAYS.map((day) => <span key={day} className="flex h-7 items-center justify-center text-[10px] font-semibold text-neutral-400">{day}</span>)}{calendarDays.map(({ date, muted }) => { const selected = date.toDateString() === draftDate.toDateString(); return <button key={date.toISOString()} type="button" onClick={() => setDraftDate(date)} className={`flex h-8 items-center justify-center rounded-lg text-xs transition-colors ${selected ? 'bg-purple-600 font-bold text-white shadow-sm' : muted ? 'text-neutral-300 hover:bg-neutral-50' : 'text-neutral-600 hover:bg-purple-50 hover:text-purple-600'}`}>{date.getDate()}</button>; })}</div>
          <div className="relative mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
            <Clock3 className="h-4 w-4 text-purple-400" />
            <button type="button" onClick={() => setIsTimeOpen((open) => !open)} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white font-mono text-sm font-semibold text-neutral-700 hover:border-purple-200"><span>{draftHour}</span><span className="animate-pulse text-purple-400">:</span><span>{draftMinute}</span></button>
            <button type="button" onClick={selectNow} className="h-9 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-[10px] font-semibold text-purple-600">此刻</button>
            <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:bg-neutral-50" title="清除"><X className="h-4 w-4" /></button>
            {isTimeOpen ? (
              <div className="absolute bottom-11 left-6 z-10 w-[238px] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-neutral-400"><span>小时</span><span>分钟</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="max-h-44 snap-y snap-mandatory space-y-1 overflow-y-auto pr-1 custom-scrollbar">{HOURS.map((hour) => <button key={hour} type="button" onClick={() => setDraftTime(`${hour}:${draftMinute}`)} className={`flex h-9 w-full snap-center items-center justify-center rounded-md font-mono text-xs font-semibold ${draftHour === hour ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-500 hover:bg-purple-50 hover:text-purple-600'}`}>{hour}</button>)}</div>
                  <div className="max-h-44 snap-y snap-mandatory space-y-1 overflow-y-auto pr-1 custom-scrollbar">{MINUTES.map((minute) => <button key={minute} type="button" onClick={() => setDraftTime(`${draftHour}:${minute}`)} className={`flex h-9 w-full snap-center items-center justify-center rounded-md font-mono text-xs font-semibold ${draftMinute === minute ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-500 hover:bg-purple-50 hover:text-purple-600'}`}>{minute}</button>)}</div>
                </div>
                <button type="button" onClick={() => setIsTimeOpen(false)} className="mt-3 h-8 w-full rounded-lg bg-purple-50 text-xs font-semibold text-purple-600">完成</button>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setIsOpen(false)} className="h-9 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-500">取消</button><button type="button" onClick={() => { onChange(formatValue(draftDate, draftTime)); setIsOpen(false); }} className="h-9 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white">确定</button></div>
        </div>
      ) : null}
    </div>
  );
};
