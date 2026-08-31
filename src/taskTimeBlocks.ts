import type { Task, TaskTimeBlock } from './types';

export const parseTaskTime = (value: string, endOfDate = false) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    return endOfDate ? timestamp + 24 * 60 * 60 * 1000 : timestamp;
  }
  return new Date(value).getTime();
};

export const formatLocalDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getTaskTimeBlocks = (task: Task): TaskTimeBlock[] => {
  const validBlocks = (task.timeBlocks || []).filter((block) => block.startTime && block.endTime);
  if (validBlocks.length > 0) return validBlocks;
  if (!task.startTime || !task.endTime) return [];
  return [{ id: `legacy-${task.id}`, startTime: task.startTime, endTime: task.endTime }];
};

export const normalizeTaskTimeBlocks = (task: Task, blocks: TaskTimeBlock[]): Partial<Task> => {
  const firstBlock = blocks[0];
  return {
    timeBlocks: blocks,
    startTime: firstBlock?.startTime,
    endTime: firstBlock?.endTime,
  };
};

export const getTaskBlockTimestamps = (block: TaskTimeBlock, fallbackDurationHours = 1) => {
  let start = parseTaskTime(block.startTime);
  let end = parseTaskTime(block.endTime, true);
  if (!Number.isFinite(start)) start = Date.now();
  if (!Number.isFinite(end) || end <= start) {
    end = start + Math.max(fallbackDurationHours, 1 / 60) * 3_600_000;
  }
  return { start, end };
};

export const taskOccursOnDay = (task: Task, day: Date) => {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return getTaskTimeBlocks(task).some((block) => {
    const range = getTaskBlockTimestamps(block, task.duration);
    return range.start < dayEnd && range.end > dayStart;
  });
};
