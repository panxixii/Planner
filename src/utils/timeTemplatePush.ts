import type { TimeTemplateBlock } from '../types';

export const normalizeCycleMinute = (minutes: number, cycleMinutes: number) => (
  ((minutes % cycleMinutes) + cycleMinutes) % cycleMinutes
);

export const circularDistance = (from: number, to: number, cycleMinutes: number) => (
  normalizeCycleMinute(to - from, cycleMinutes)
);

export const getBlockDuration = (block: Pick<TimeTemplateBlock, 'startMinute' | 'endMinute'>, cycleMinutes: number) => (
  Math.max(1, Math.min(cycleMinutes, block.endMinute - block.startMinute))
);

const intervalsOverlap = (aStart: number, aDuration: number, bStart: number, bDuration: number, cycleMinutes: number) => (
  circularDistance(aStart, bStart, cycleMinutes) < aDuration
  || circularDistance(bStart, aStart, cycleMinutes) < bDuration
);

export const moveBlocksWithPush = (
  blocks: TimeTemplateBlock[],
  movedId: string,
  nextStart: number,
  cycleMinutes: number,
  direction: 1 | -1,
  snapMinutes: number,
  nextDuration?: number,
): TimeTemplateBlock[] | null => {
  const snap = (value: number) => normalizeCycleMinute(Math.round(value / snapMinutes) * snapMinutes, cycleMinutes);
  const items = blocks.map((block) => ({
    id: block.id,
    start: snap(block.id === movedId ? nextStart : block.startMinute),
    duration: Math.max(
      snapMinutes,
      Math.round((block.id === movedId && nextDuration !== undefined ? nextDuration : getBlockDuration(block, cycleMinutes)) / snapMinutes) * snapMinutes,
    ),
    block,
  }));
  const moved = items.find((item) => item.id === movedId);
  if (!moved) return null;
  if (items.reduce((sum, item) => sum + item.duration, 0) > cycleMinutes) return null;

  for (let pass = 0; pass < items.length; pass += 1) {
    let changed = false;
    for (const other of items) {
      if (other.id === movedId) continue;
      for (const source of items) {
        if (source.id === other.id) continue;
        if (!intervalsOverlap(source.start, source.duration, other.start, other.duration, cycleMinutes)) continue;
        if (direction > 0) {
          if (circularDistance(source.start, other.start, cycleMinutes) >= source.duration) continue;
          const dest = normalizeCycleMinute(source.start + source.duration, cycleMinutes);
          if (dest === other.start) continue;
          other.start = dest;
          changed = true;
        } else {
          if (circularDistance(other.start, source.start, cycleMinutes) >= other.duration) continue;
          const dest = normalizeCycleMinute(source.start - other.duration, cycleMinutes);
          if (dest === other.start) continue;
          other.start = dest;
          changed = true;
        }
      }
    }
    if (!changed) break;
    const packed = items.reduce((sum, item) => sum + item.duration, 0);
    if (packed > cycleMinutes) return null;
  }

  const stillOverlap = items.some((left, index) => items.slice(index + 1).some((right) => (
    intervalsOverlap(left.start, left.duration, right.start, right.duration, cycleMinutes)
  )));
  if (stillOverlap) return null;

  return items.map((item) => ({
    ...item.block,
    startMinute: item.start,
    endMinute: item.start + item.duration,
  }));
};
