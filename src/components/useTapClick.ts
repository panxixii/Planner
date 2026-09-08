import React, { useCallback, useEffect, useRef } from 'react';

export const TAP_DELAY = 230;

export const useTapClick = (onSingleClick: (element: HTMLElement) => void) => {
  const timer = useRef<number | null>(null);
  const clear = useCallback(() => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } }, []);
  useEffect(() => clear, [clear]);
  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.detail > 1) { clear(); return; }
    const element = event.currentTarget;
    clear();
    timer.current = window.setTimeout(() => { timer.current = null; onSingleClick(element); }, TAP_DELAY);
  }, [clear, onSingleClick]);
  const cancel = useCallback(() => clear(), [clear]);
  return { handleClick, cancel };
};
