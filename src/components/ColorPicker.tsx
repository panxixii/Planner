import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pipette, Star, X } from 'lucide-react';
import { useAppStore } from '../store';

const QUICK_COLORS = ['#9387D1', '#67C8BD', '#79BFD5', '#D78FB5', '#D9B958', '#9B8AE4', '#334155', '#F97316'];
const NAMED_COLORS: Record<string, string> = {
  indigo: '#9387D1', emerald: '#67C8BD', sky: '#79BFD5', rose: '#D78FB5', amber: '#D9B958', violet: '#9B8AE4',
};

const normalizeHex = (value: string) => {
  const cleaned = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(cleaned)) return `#${cleaned.split('').map((character) => character + character).join('').toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  return null;
};

const normalizeColor = (value: string) => normalizeHex(value) || NAMED_COLORS[value] || null;

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex) || '#9387D1';
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const rgbToHsv = (r: number, g: number, b: number) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: hue < 0 ? hue + 360 : hue, s: max === 0 ? 0 : delta / max, v: max };
};

const hsvToHex = (h: number, s: number, v: number) => {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const match = v - chroma;
  const [red, green, blue] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHex((red + match) * 255, (green + match) * 255, (blue + match) * 255);
};

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label = '颜色' }) => {
  const favorites = useAppStore((state) => state.favoriteColors);
  const addFavorite = useAppStore((state) => state.addFavoriteColor);
  const removeFavorite = useAppStore((state) => state.removeFavoriteColor);
  const currentValue = normalizeColor(value) || '#9387D1';
  const [isOpen, setIsOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(currentValue);
  const normalizedValue = normalizeColor(draftColor) || currentValue;
  const [hexDraft, setHexDraft] = useState(currentValue);
  const rgb = useMemo(() => hexToRgb(normalizedValue), [normalizedValue]);
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb]);

  useEffect(() => {
    setDraftColor(currentValue);
    setHexDraft(currentValue);
  }, [currentValue]);

  const setRgbChannel = (channel: 'r' | 'g' | 'b', nextValue: string) => {
    const nextRgb = { ...rgb, [channel]: Number(nextValue) || 0 };
    setDraftColor(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const updateSaturationValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const brightness = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    setDraftColor(hsvToHex(hsv.h, saturation, brightness));
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => { setDraftColor(currentValue); setHexDraft(currentValue); setIsOpen((open) => !open); }} className="flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 hover:border-purple-200" aria-expanded={isOpen}>
        <span className="flex items-center gap-2"><span className="h-5 w-5 rounded-md border border-black/10 shadow-inner" style={{ backgroundColor: currentValue }} /><span>{label}</span></span>
        <span className="font-mono text-[10px] text-neutral-400">{currentValue}</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-[120] mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold text-neutral-700"><Pipette className="h-3.5 w-3.5 text-purple-500" />选择颜色</span><button type="button" onClick={() => setIsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"><X className="h-3.5 w-3.5" /></button></div>

          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-neutral-500">完整色卡</span>
            <div
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateSaturationValue(event); }}
              onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturationValue(event); }}
              onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
              className="relative h-28 touch-none cursor-crosshair overflow-hidden rounded-lg border border-neutral-200"
              style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
            >
              <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
            </div>
            <input type="range" min="0" max="359" value={Math.round(hsv.h)} onChange={(event) => setDraftColor(hsvToHex(Number(event.target.value), hsv.s, hsv.v))} className="planner-hue-slider h-3 w-full cursor-ew-resize appearance-none rounded-full" aria-label="色相" />
          </div>

          <div className="mt-3"><div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold text-neutral-500">快捷颜色</span><span className="text-[9px] text-neutral-400">双击常用色可移除</span></div><div className="flex flex-wrap gap-2">{[...favorites, ...QUICK_COLORS.filter((color) => !favorites.includes(color))].map((color, index) => <button key={`${color}-${index}`} type="button" onClick={() => setDraftColor(color)} onDoubleClick={() => favorites.includes(color) && removeFavorite(color)} className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: color }} title={favorites.includes(color) ? `${color}（双击移除常用）` : color}>{normalizedValue === color ? <Check className="h-3.5 w-3.5 text-white drop-shadow" /> : null}</button>)}</div></div>

          <div className="mt-4 grid grid-cols-[1.3fr_repeat(3,1fr)] gap-2">
            <label className="space-y-1"><span className="text-[9px] font-bold text-neutral-400">HEX</span><input value={hexDraft} onChange={(event) => { setHexDraft(event.target.value); const color = normalizeHex(event.target.value); if (color) setDraftColor(color); }} onBlur={() => setHexDraft(normalizedValue)} className="h-8 w-full rounded-md border border-neutral-200 px-2 font-mono text-[10px] outline-none focus:border-purple-300" /></label>
            {(['r', 'g', 'b'] as const).map((channel) => <label key={channel} className="space-y-1"><span className="text-[9px] font-bold uppercase text-neutral-400">{channel}</span><input type="number" min="0" max="255" value={rgb[channel]} onChange={(event) => setRgbChannel(channel, event.target.value)} className="h-8 w-full rounded-md border border-neutral-200 px-2 text-[10px] outline-none focus:border-purple-300" /></label>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { onChange(normalizedValue); setIsOpen(false); }} className="h-9 rounded-lg bg-purple-600 px-3 text-xs font-semibold text-white">保存颜色</button>
            <button type="button" onClick={() => favorites.includes(normalizedValue) ? removeFavorite(normalizedValue) : addFavorite(normalizedValue)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Star className={`h-3.5 w-3.5 ${favorites.includes(normalizedValue) ? 'fill-current' : ''}`} />{favorites.includes(normalizedValue) ? '取消常用' : '设为常用'}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
