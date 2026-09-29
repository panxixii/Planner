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

/**
 * Move ONLY the dragged block (no pushing of connected blocks). The block
 * slides from `currentStart` toward the pointer target along `direction`, but
 * STOPS flush against the first neighbouring block in its path — it never
 * passes through, wraps past, or collapses onto another block. Resizing keeps
 * the target size; a pure move keeps the block's own duration. Returns the
 * updated list, or null when nothing can change (already blocked / would not
 * fit). Used by the ring view.
 */
export const moveSingleBlock = (
  blocks: TimeTemplateBlock[],
  movedId: string,
  currentStart: number,
  nextStart: number,
  cycleMinutes: number,
  direction: 1 | -1,
  snapMinutes: number,
  nextDuration?: number,
): TimeTemplateBlock[] | null => {
  const snap = (value: number) => normalizeCycleMinute(Math.round(value / snapMinutes) * snapMinutes, cycleMinutes);
  const from = snap(currentStart);
  const target = snap(nextStart);
  const duration = Math.max(
    snapMinutes,
    Math.round((nextDuration !== undefined ? nextDuration : getBlockDuration(
      blocks.find((block) => block.id === movedId) || { startMinute: 0, endMinute: snapMinutes },
      cycleMinutes,
    )) / snapMinutes) * snapMinutes,
  );
  if (duration > cycleMinutes) return null;

  // How far the pointer wants to travel along `direction` (positive minutes).
  const desired = direction > 0
    ? circularDistance(from, target, cycleMinutes)
    : circularDistance(target, from, cycleMinutes);
  if (desired === 0) return null;

  // For each other block, the max travel before this block's leading edge would
  // hit that neighbour. Clamp the desired travel to the tightest limit.
  const others = blocks.filter((block) => block.id !== movedId);
  let allowed = desired;
  for (const other of others) {
    const otherStart = normalizeCycleMinute(other.startMinute, cycleMinutes);
    const otherDuration = getBlockDuration(other, cycleMinutes);
    // Gap ahead of the moving block's leading edge, in the travel direction.
    const gap = direction > 0
      ? circularDistance(normalizeCycleMinute(from + duration, cycleMinutes), otherStart, cycleMinutes)
      : circularDistance(normalizeCycleMinute(otherStart + otherDuration, cycleMinutes), from, cycleMinutes);
    allowed = Math.min(allowed, gap);
  }
  allowed = Math.max(0, Math.floor(allowed / snapMinutes) * snapMinutes);
  if (allowed === 0) return null;

  const start = direction > 0
    ? normalizeCycleMinute(from + allowed, cycleMinutes)
    : normalizeCycleMinute(from - allowed, cycleMinutes);

  // Safety: never emit an overlapping layout.
  const overlaps = others.some((block) => intervalsOverlap(
    start, duration, normalizeCycleMinute(block.startMinute, cycleMinutes), getBlockDuration(block, cycleMinutes), cycleMinutes,
  ));
  if (overlaps) return null;

  return blocks.map((block) => (
    block.id === movedId ? { ...block, startMinute: start, endMinute: start + duration } : block
  ));
};

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
