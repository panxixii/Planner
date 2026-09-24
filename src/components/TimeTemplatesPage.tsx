import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Circle, Clock3, Copy, Minus, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { TimeTemplate, TimeTemplateBlock } from '../types';
import { ColorPicker } from './ColorPicker';
import { circularDistance, getBlockDuration, moveBlocksWithPush, normalizeCycleMinute } from '../utils/timeTemplatePush';

const DAILY_WIDTH = 1536;
const WEEKLY_WIDTH = 1260;
const TRACK_HEIGHT = 120;
const DAY_MINUTES = 1440;
const WEEK_MINUTES = DAY_MINUTES * 7;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DEFAULT_COLORS = ['#8d78d5', '#67c8bd', '#79bfd5', '#d78fb5', '#d9b958', '#9b8ae4'];
const MIN_BLOCK_MINUTES = 1;
const RING_SIZE = 560;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 205;
const KNOB_RADIUS = 118;

const getCycleMinutes = (type: TimeTemplate['type']) => type === 'daily' ? DAY_MINUTES : WEEK_MINUTES;
const getTimelineWidth = (type: TimeTemplate['type']) => type === 'daily' ? DAILY_WIDTH : WEEKLY_WIDTH;
const getSnapMinutes = (type: TimeTemplate['type']) => type === 'daily' ? 5 : 15;
const getBlockColorAtMinute = (blocks: TimeTemplateBlock[], minute: number, cycleMinutes: number) => (
  blocks.find((block) => {
    const duration = getBlockDuration(block, cycleMinutes);
    if (duration >= cycleMinutes) return true;
    const start = normalizeCycleMinute(block.startMinute, cycleMinutes);
    return normalizeCycleMinute(minute - start, cycleMinutes) < duration;
  })?.color
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
  mode: 'linear' | 'circular';
  startX: number;
  startY: number;
  startMinute: number;
  endMinute: number;
  type: TimeTemplate['type'];
  moved: boolean;
  activated: boolean;
  ringCenterX?: number;
  ringCenterY?: number;
  lastAngle?: number;
  accumulatedAngle?: number;
  grabOffsetMinutes?: number;
  layout: TimeTemplateBlock[];
};

type BlockRingRotationAction = {
  pointerId: number;
  templateId: string;
  type: TimeTemplate['type'];
  centerX: number;
  centerY: number;
  lastAngle: number;
  accumulatedMinutes: number;
  currentOffset: number;
  initialInnerRotation: number;
  blocks: TimeTemplateBlock[];
  activated: boolean;
  startX: number;
  startY: number;
};

type RingCreateAction = {
  pointerId: number;
  templateId: string;
  type: TimeTemplate['type'];
  centerX: number;
  centerY: number;
  startMinute: number;
  startX: number;
  startY: number;
  activated: boolean;
  blockId: string | null;
};

const pointOnRing = (minute: number, cycleMinutes: number, radius: number, rotationMinutes = 0) => {
  const angle = ((minute + rotationMinutes) / cycleMinutes) * Math.PI * 2 - Math.PI / 2;
  return {
    x: RING_CENTER + Math.cos(angle) * radius,
    y: RING_CENTER + Math.sin(angle) * radius,
  };
};

const ringArcPath = (startMinute: number, duration: number, cycleMinutes: number, radius = RING_RADIUS, rotationMinutes = 0) => {
  const safeDuration = Math.min(duration, cycleMinutes - 0.001);
  const start = pointOnRing(startMinute, cycleMinutes, radius, rotationMinutes);
  const end = pointOnRing(startMinute + safeDuration, cycleMinutes, radius, rotationMinutes);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${safeDuration > cycleMinutes / 2 ? 1 : 0} 1 ${end.x} ${end.y}`;
};

const pointerAngle = (clientX: number, clientY: number, centerX: number, centerY: number) => (
  Math.atan2(clientY - centerY, clientX - centerX)
);

const minutesFromPointer = (clientX: number, clientY: number, centerX: number, centerY: number, cycleMinutes: number) => (
  normalizeCycleMinute(((pointerAngle(clientX, clientY, centerX, centerY) + Math.PI / 2) / (Math.PI * 2)) * cycleMinutes, cycleMinutes)
);

const signedAngleDelta = (current: number, previous: number) => {
  let delta = current - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
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
  const [confirmDeleteBlockId, setConfirmDeleteBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'linear' | 'circular'>('linear');
  const [innerRotationMinutes, setInnerRotationMinutes] = useState(0);
  const pointerActionRef = useRef<PointerAction | null>(null);
  const blockRingRotationRef = useRef<BlockRingRotationAction | null>(null);
  const ringCreateRef = useRef<RingCreateAction | null>(null);

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
    setInnerRotationMinutes(0);
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
    const nextBlocks = selectedTemplate.blocks.map((block) => (
      block.id === detailsBlock.id ? { ...block, startMinute, endMinute: startMinute + duration } : block
    ));
    const packed = moveBlocksWithPush(nextBlocks, detailsBlock.id, startMinute, cycleMinutes, 1, getSnapMinutes(selectedTemplate.type));
    if (packed) commitBlockTimes(selectedTemplate.id, packed);
  };

  const commitBlockTimes = (templateId: string, nextBlocks: TimeTemplateBlock[]) => {
    nextBlocks.forEach((block) => {
      updateBlock(templateId, block.id, { startMinute: block.startMinute, endMinute: block.endMinute });
    });
  };

  const createTemplateBlock = (template: TimeTemplate, startMinute: number, duration: number) => {
    const snapMinutes = getSnapMinutes(template.type);
    const cycle = getCycleMinutes(template.type);
    const snappedStart = normalizeCycleMinute(Math.round(startMinute / snapMinutes) * snapMinutes, cycle);
    const snappedDuration = Math.max(snapMinutes, Math.round(duration / snapMinutes) * snapMinutes);
    const payload = {
      startMinute: snappedStart,
      endMinute: snappedStart + snappedDuration,
      label: '新时间段',
      color: DEFAULT_COLORS[template.blocks.length % DEFAULT_COLORS.length],
    };
    const blockId = addBlock(template.id, payload);
    const currentBlocks = useAppStore.getState().timeTemplates.find((item) => item.id === template.id)?.blocks || [...template.blocks, { id: blockId, ...payload }];
    const packed = moveBlocksWithPush(currentBlocks, blockId, snappedStart, cycle, 1, snapMinutes);
    if (packed) commitBlockTimes(template.id, packed);
    return blockId;
  };

  const handleTrackDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedTemplate || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawStart = ((event.clientX - rect.left) / rect.width) * cycleMinutes;
    const snapMinutes = getSnapMinutes(selectedTemplate.type);
    const defaultDuration = selectedTemplate.type === 'daily' ? 60 : DAY_MINUTES;
    createTemplateBlock(selectedTemplate, Math.floor(rawStart / snapMinutes) * snapMinutes, defaultDuration);
    setDetailsBlockId(null);
  };

  const handlePointerStart = (event: React.PointerEvent<HTMLDivElement>, block: TimeTemplateBlock, kind: PointerAction['kind']) => {
    if (!selectedTemplate || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerActionRef.current = {
      pointerId: event.pointerId,
      templateId: selectedTemplate.id,
      blockId: block.id,
      kind,
      mode: 'linear',
      startX: event.clientX,
      startY: event.clientY,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      type: selectedTemplate.type,
      moved: false,
      activated: false,
      layout: selectedTemplate.blocks.map((item) => ({ ...item })),
    };
  };

  const handleRingPointerStart = (event: React.PointerEvent<SVGElement>, block: TimeTemplateBlock, kind: PointerAction['kind'] = 'move') => {
    if (!selectedTemplate || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const cycle = getCycleMinutes(selectedTemplate.type);
    const pointerMinute = minutesFromPointer(event.clientX, event.clientY, centerX, centerY, cycle);
    pointerActionRef.current = {
      pointerId: event.pointerId,
      templateId: selectedTemplate.id,
      blockId: block.id,
      kind,
      mode: 'circular',
      startX: event.clientX,
      startY: event.clientY,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      type: selectedTemplate.type,
      moved: false,
      activated: false,
      ringCenterX: centerX,
      ringCenterY: centerY,
      lastAngle: pointerAngle(event.clientX, event.clientY, centerX, centerY),
      accumulatedAngle: 0,
      grabOffsetMinutes: circularDistance(block.startMinute, pointerMinute, cycle),
      layout: selectedTemplate.blocks.map((item) => ({ ...item })),
    };
  };

  const handleRingCreateStart = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!selectedTemplate || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const snapMinutes = getSnapMinutes(selectedTemplate.type);
    ringCreateRef.current = {
      pointerId: event.pointerId,
      templateId: selectedTemplate.id,
      type: selectedTemplate.type,
      centerX,
      centerY,
      startMinute: normalizeCycleMinute(Math.round(minutesFromPointer(event.clientX, event.clientY, centerX, centerY, cycleMinutes) / snapMinutes) * snapMinutes, cycleMinutes),
      startX: event.clientX,
      startY: event.clientY,
      activated: false,
      blockId: null,
    };
  };

  const handleBlockRingPointerStart = (event: React.PointerEvent<Element>) => {
    if (!selectedTemplate || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    blockRingRotationRef.current = {
      pointerId: event.pointerId,
      templateId: selectedTemplate.id,
      type: selectedTemplate.type,
      centerX,
      centerY,
      lastAngle: pointerAngle(event.clientX, event.clientY, centerX, centerY),
      accumulatedMinutes: 0,
      currentOffset: 0,
      initialInnerRotation: innerRotationMinutes,
      blocks: selectedTemplate.blocks.map((block) => ({ ...block })),
      activated: false,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  useEffect(() => {
    const hasActiveGesture = (pointerId: number) => (
      pointerActionRef.current?.pointerId === pointerId
      || blockRingRotationRef.current?.pointerId === pointerId
      || ringCreateRef.current?.pointerId === pointerId
    );

    const clearGesture = (pointerId: number, allowOpenDetails: boolean) => {
      if (!hasActiveGesture(pointerId)) return;
      const pointerAction = pointerActionRef.current;
      const ringAction = blockRingRotationRef.current;
      const createAction = ringCreateRef.current;
      pointerActionRef.current = null;
      blockRingRotationRef.current = null;
      ringCreateRef.current = null;
      if (pointerAction?.activated || ringAction?.activated || createAction?.activated) endHistoryGroup();
      if (createAction && !createAction.activated && allowOpenDetails) {
        const template = useAppStore.getState().timeTemplates.find((item) => item.id === createAction.templateId);
        if (template) {
          createTemplateBlock(template, createAction.startMinute, template.type === 'daily' ? 60 : DAY_MINUTES);
        }
      }
      if (allowOpenDetails && pointerAction && !pointerAction.activated && pointerAction.kind === 'move') {
        setDetailsBlockId(pointerAction.blockId);
      }
    };

    const onMove = (event: PointerEvent) => {
      if ((event.buttons & 1) === 0) {
        const pendingCreate = ringCreateRef.current;
        if (pendingCreate && !pendingCreate.activated && pendingCreate.pointerId === event.pointerId) return;
        if (
          pointerActionRef.current?.activated
          || blockRingRotationRef.current?.activated
          || ringCreateRef.current?.activated
        ) return;
        clearGesture(event.pointerId, false);
        return;
      }
      const pointerAction = pointerActionRef.current;
      if (pointerAction && pointerAction.pointerId === event.pointerId) {
        const actionCycle = getCycleMinutes(pointerAction.type);
        const snapMinutes = getSnapMinutes(pointerAction.type);
        if (!pointerAction.activated) {
          if (Math.hypot(event.clientX - pointerAction.startX, event.clientY - pointerAction.startY) < 10) return;
          pointerAction.activated = true;
          pointerAction.moved = true;
          beginHistoryGroup();
        }
        const duration = getBlockDuration(pointerAction, actionCycle);
        let nextStart = normalizeCycleMinute(pointerAction.startMinute, actionCycle);
        let nextDuration = duration;
        if (pointerAction.mode === 'circular' && pointerAction.ringCenterX !== undefined && pointerAction.ringCenterY !== undefined) {
          const radius = Math.hypot(event.clientX - pointerAction.ringCenterX, event.clientY - pointerAction.ringCenterY);
          if (radius < 36) return;
          const pointerMinute = minutesFromPointer(event.clientX, event.clientY, pointerAction.ringCenterX, pointerAction.ringCenterY, actionCycle);
          const snappedPointer = normalizeCycleMinute(Math.round(pointerMinute / snapMinutes) * snapMinutes, actionCycle);
          if (pointerAction.kind === 'move') {
            nextStart = normalizeCycleMinute(snappedPointer - (pointerAction.grabOffsetMinutes || 0), actionCycle);
          } else if (pointerAction.kind === 'start') {
            nextStart = snappedPointer;
            nextDuration = Math.max(snapMinutes, circularDistance(nextStart, normalizeCycleMinute(pointerAction.endMinute, actionCycle), actionCycle) || snapMinutes);
          } else {
            nextStart = normalizeCycleMinute(pointerAction.startMinute, actionCycle);
            nextDuration = Math.max(snapMinutes, circularDistance(nextStart, snappedPointer, actionCycle) || snapMinutes);
          }
        } else {
          const rawDelta = ((event.clientX - pointerAction.startX) / getTimelineWidth(pointerAction.type)) * actionCycle;
          const delta = Math.round(rawDelta / snapMinutes) * snapMinutes;
          if (pointerAction.kind === 'move') nextStart = normalizeCycleMinute(pointerAction.startMinute + delta, actionCycle);
          else if (pointerAction.kind === 'start') {
            nextDuration = Math.max(snapMinutes, Math.min(actionCycle, duration - delta));
            nextStart = normalizeCycleMinute(pointerAction.endMinute - nextDuration, actionCycle);
          } else {
            nextDuration = Math.max(snapMinutes, Math.min(actionCycle, duration + delta));
          }
        }
        const current = pointerAction.layout.find((block) => block.id === pointerAction.blockId);
        const currentStart = current ? normalizeCycleMinute(current.startMinute, actionCycle) : nextStart;
        const currentDuration = current ? getBlockDuration(current, actionCycle) : duration;
        const forward = circularDistance(currentStart, nextStart, actionCycle);
        const back = circularDistance(nextStart, currentStart, actionCycle);
        const direction: 1 | -1 = nextDuration !== currentDuration
          ? (nextDuration > currentDuration ? (pointerAction.kind === 'start' ? -1 : 1) : (pointerAction.kind === 'start' ? 1 : -1))
          : (back > 0 && back < forward ? -1 : 1);
        const nextBlocks = moveBlocksWithPush(pointerAction.layout, pointerAction.blockId, nextStart, actionCycle, direction, snapMinutes, nextDuration);
        if (nextBlocks) {
          pointerAction.layout = nextBlocks;
          commitBlockTimes(pointerAction.templateId, nextBlocks);
        }
        return;
      }

      const createAction = ringCreateRef.current;
      if (createAction && createAction.pointerId === event.pointerId) {
        const cycle = getCycleMinutes(createAction.type);
        const snapMinutes = getSnapMinutes(createAction.type);
        const currentMinute = normalizeCycleMinute(
          Math.round(minutesFromPointer(event.clientX, event.clientY, createAction.centerX, createAction.centerY, cycle) / snapMinutes) * snapMinutes,
          cycle,
        );
        if (!createAction.activated) {
          if (Math.hypot(event.clientX - createAction.startX, event.clientY - createAction.startY) < 10) return;
          createAction.activated = true;
          beginHistoryGroup();
          const template = useAppStore.getState().timeTemplates.find((item) => item.id === createAction.templateId);
          if (!template) return;
          createAction.blockId = createTemplateBlock(template, createAction.startMinute, snapMinutes);
        }
        if (!createAction.blockId) return;
        const clockwise = circularDistance(createAction.startMinute, currentMinute, cycle);
        const counter = circularDistance(currentMinute, createAction.startMinute, cycle);
        const growClockwise = clockwise <= counter;
        const nextStart = growClockwise ? createAction.startMinute : currentMinute;
        const nextDuration = Math.max(snapMinutes, growClockwise ? clockwise : counter);
        const currentBlocks = useAppStore.getState().timeTemplates.find((template) => template.id === createAction.templateId)?.blocks || [];
        const resized = currentBlocks.map((block) => (
          block.id === createAction.blockId ? { ...block, startMinute: nextStart, endMinute: nextStart + nextDuration } : block
        ));
        const nextBlocks = moveBlocksWithPush(resized, createAction.blockId, nextStart, cycle, growClockwise ? 1 : -1, snapMinutes);
        if (nextBlocks) commitBlockTimes(createAction.templateId, nextBlocks);
        return;
      }

      const ringAction = blockRingRotationRef.current;
      if (!ringAction || ringAction.pointerId !== event.pointerId) return;
      if (!ringAction.activated) {
        if (Math.hypot(event.clientX - ringAction.startX, event.clientY - ringAction.startY) < 10) return;
        ringAction.activated = true;
        beginHistoryGroup();
      }
      const angle = pointerAngle(event.clientX, event.clientY, ringAction.centerX, ringAction.centerY);
      const cycle = getCycleMinutes(ringAction.type);
      ringAction.accumulatedMinutes += (signedAngleDelta(angle, ringAction.lastAngle) / (Math.PI * 2)) * cycle;
      ringAction.lastAngle = angle;
      const snapMinutes = getSnapMinutes(ringAction.type);
      const nextOffset = Math.round(ringAction.accumulatedMinutes / snapMinutes) * snapMinutes;
      const delta = nextOffset - ringAction.currentOffset;
      if (delta === 0) return;
      ringAction.blocks = ringAction.blocks.map((block) => {
        const duration = getBlockDuration(block, cycle);
        const startMinute = normalizeCycleMinute(block.startMinute + delta, cycle);
        return { ...block, startMinute, endMinute: startMinute + duration };
      });
      ringAction.currentOffset = nextOffset;
      commitBlockTimes(ringAction.templateId, ringAction.blocks);
      setInnerRotationMinutes(ringAction.initialInnerRotation + nextOffset);
    };

    const onUp = (event: PointerEvent) => {
      clearGesture(event.pointerId, event.type === 'pointerup');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [beginHistoryGroup, endHistoryGroup, updateBlock]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-2">
          <button type="button" onClick={() => handleCreateTemplate('daily')} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700"><Plus className="h-3.5 w-3.5" />24 小时</button>
          <button type="button" onClick={() => handleCreateTemplate('weekly')} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-purple-200 bg-purple-50 text-xs font-semibold text-purple-600 hover:bg-purple-100"><Plus className="h-3.5 w-3.5" />周</button>
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
                <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                  <button type="button" onClick={() => setViewMode('linear')} className={`flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold ${viewMode === 'linear' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><Minus className="h-3.5 w-3.5" />线性</button>
                  <button type="button" onClick={() => setViewMode('circular')} className={`flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold ${viewMode === 'circular' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><Circle className="h-3.5 w-3.5" />环形</button>
                </div>
                <button type="button" onClick={() => setActiveTemplate(selectedTemplate.type, activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? null : selectedTemplate.id)} className={`h-9 rounded-lg border px-3 text-xs font-semibold ${activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-purple-200 bg-purple-50 text-purple-600'}`}>{activeTemplateIds[selectedTemplate.type] === selectedTemplate.id ? '已应用 · 点击停用' : '应用到工作区'}</button>
                <button type="button" onClick={handleDuplicateTemplate} className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50" title="复制当前模版及其全部时间块"><Copy className="h-3.5 w-3.5" />创建副本</button>
                <button type="button" onClick={() => { if (window.confirm(`确定删除“${selectedTemplate.name || '未命名模版'}”吗？`)) deleteTemplate(selectedTemplate.id); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />删除模版</button>
              </div>
            </header>
            {viewMode === 'linear' ? (
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
                        <div key={`${block.id}-${index}`} onPointerDown={(event) => handlePointerStart(event, block, 'move')} style={{ left: segment.startMinute / cycleMinutes * timelineWidth, width: Math.max(4, segment.duration / cycleMinutes * timelineWidth), backgroundColor: block.color }} className="group absolute top-9 flex h-11 touch-none cursor-grab items-center justify-center overflow-visible rounded-md border border-white/50 px-3 text-[10px] font-semibold text-white shadow-md active:cursor-grabbing" title={`${block.label} · ${rangeLabel}`}>
                          {segment.hasStartHandle ? <div onPointerDown={(event) => handlePointerStart(event, block, 'start')} className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-r bg-white/50" /> : null}
                          {index === labelSegmentIndex ? <span className="truncate">{block.label}</span> : null}
                          {segment.hasEndHandle ? <div onPointerDown={(event) => handlePointerStart(event, block, 'end')} className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-l bg-white/50" /> : null}
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (confirmDeleteBlockId === block.id) { deleteBlock(selectedTemplate.id, block.id); setConfirmDeleteBlockId(null); setDetailsBlockId(null); return; }
                              setConfirmDeleteBlockId(block.id);
                            }}
                            onMouseLeave={() => setConfirmDeleteBlockId((current) => (current === block.id ? null : current))}
                            className={`absolute -right-2 -top-2 z-30 flex h-5 items-center justify-center rounded-full border px-1.5 text-[9px] font-bold shadow-sm transition-all ${confirmDeleteBlockId === block.id ? 'w-auto border-rose-500 bg-rose-600 text-white opacity-100' : 'w-5 border-rose-200 bg-white text-rose-500 opacity-0 group-hover:opacity-100'}`}
                            title={confirmDeleteBlockId === block.id ? '再次点击确认删除' : '删除时间块'}
                          >{confirmDeleteBlockId === block.id ? '确认' : <Trash2 className="h-3 w-3" />}</button>
                        </div>
                      ));
                    })}
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
                  <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="aspect-square w-full max-w-[620px] select-none overflow-visible" aria-label="环形时间模版">
                    <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke="#f1f2f4" strokeWidth="38" className="touch-none cursor-pointer" onPointerDown={handleRingCreateStart} />
                    <g>
                      {selectedTemplate.type === 'daily' ? Array.from({ length: DAY_MINUTES / 5 }, (_, index) => {
                        if (index % 12 === 0) return null;
                        const minute = index * 5;
                        const isQuarterHour = index % 3 === 0;
                        const blockColor = getBlockColorAtMinute(selectedTemplate.blocks, minute, cycleMinutes);
                        const tickStart = pointOnRing(minute, cycleMinutes, RING_RADIUS + 18);
                        const tickEnd = pointOnRing(minute, cycleMinutes, RING_RADIUS + (isQuarterHour ? 26 : 23));
                        return <line key={minute} x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y} stroke={blockColor || (isQuarterHour ? '#c9cbd2' : '#e3e4e8')} strokeWidth={blockColor ? 2 : isQuarterHour ? 1.5 : 1} />;
                      }) : null}
                      {(selectedTemplate.type === 'daily' ? dailyHeaders : WEEKDAYS.map((_, index) => index)).map((marker, index, markers) => {
                        const minute = (index / markers.length) * cycleMinutes;
                        const blockColor = getBlockColorAtMinute(selectedTemplate.blocks, minute, cycleMinutes);
                        const tickStart = pointOnRing(minute, cycleMinutes, RING_RADIUS + 18);
                        const tickEnd = pointOnRing(minute, cycleMinutes, RING_RADIUS + 28);
                        const labelPoint = pointOnRing(minute, cycleMinutes, RING_RADIUS + 44);
                        const label = selectedTemplate.type === 'daily' ? String(marker).padStart(2, '0') : WEEKDAYS[index];
                        return (
                          <g key={index}>
                            <line x1={tickStart.x} y1={tickStart.y} x2={tickEnd.x} y2={tickEnd.y} stroke={blockColor || '#d7d9df'} strokeWidth={blockColor ? 3 : 2} />
                            <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" fill={blockColor || '#a3a3a3'} className="text-[11px] font-semibold">{label}</text>
                          </g>
                        );
                      })}
                    </g>
                    {selectedTemplate.blocks.flatMap((block) => {
                      const segments = getBlockSegments(block, cycleMinutes);
                      const fullCycle = getBlockDuration(block, cycleMinutes) >= cycleMinutes;
                      const labelSegmentIndex = segments.reduce((widestIndex, segment, index) => (
                        segment.duration > segments[widestIndex].duration ? index : widestIndex
                      ), 0);
                      return segments.flatMap((segment, index) => {
                        const startHandle = pointOnRing(segment.startMinute, cycleMinutes, RING_RADIUS);
                        const endHandle = pointOnRing(segment.startMinute + segment.duration, cycleMinutes, RING_RADIUS);
                        const midMinute = segment.startMinute + segment.duration / 2;
                        const labelPos = pointOnRing(midMinute, cycleMinutes, RING_RADIUS);
                        const rotate = (midMinute / cycleMinutes) * 360;
                        const labelRotate = labelPos.y > RING_CENTER ? rotate + 180 : rotate;
                        const nameLabel = (fullCycle || index === labelSegmentIndex) && block.label ? (
                          <text
                            key={`${block.id}-${index}-label`}
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#ffffff"
                            transform={`rotate(${labelRotate} ${labelPos.x} ${labelPos.y})`}
                            className="pointer-events-none text-[10px] font-semibold"
                            style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.28)', strokeWidth: 2.5 }}
                          >{block.label}</text>
                        ) : null;
                        const body = fullCycle ? (
                          <circle
                            key={`${block.id}-${index}`}
                            cx={RING_CENTER}
                            cy={RING_CENTER}
                            r={RING_RADIUS}
                            fill="none"
                            stroke={block.color}
                            strokeWidth={detailsBlockId === block.id ? 42 : 34}
                            className="touch-none cursor-grab drop-shadow-sm active:cursor-grabbing"
                            onPointerDown={(event) => handleRingPointerStart(event, block)}
                          />
                        ) : (
                          <path
                            key={`${block.id}-${index}`}
                            d={ringArcPath(segment.startMinute, segment.duration, cycleMinutes)}
                            fill="none"
                            stroke={block.color}
                            strokeWidth={detailsBlockId === block.id ? 42 : 34}
                            strokeLinecap="butt"
                            className="touch-none cursor-grab drop-shadow-sm active:cursor-grabbing"
                            onPointerDown={(event) => handleRingPointerStart(event, block)}
                          />
                        );
                        if (fullCycle) return [body, nameLabel];
                        return [
                          body,
                          nameLabel,
                          segment.hasStartHandle ? (
                            <circle
                              key={`${block.id}-${index}-start`}
                              cx={startHandle.x}
                              cy={startHandle.y}
                              r="8"
                              fill="#ffffff"
                              stroke={block.color}
                              strokeWidth="3"
                              className="touch-none cursor-ew-resize"
                              onPointerDown={(event) => handleRingPointerStart(event, block, 'start')}
                            />
                          ) : null,
                          segment.hasEndHandle ? (
                            <circle
                              key={`${block.id}-${index}-end`}
                              cx={endHandle.x}
                              cy={endHandle.y}
                              r="8"
                              fill="#ffffff"
                              stroke={block.color}
                              strokeWidth="3"
                              className="touch-none cursor-ew-resize"
                              onPointerDown={(event) => handleRingPointerStart(event, block, 'end')}
                            />
                          ) : null,
                        ];
                      });
                    })}
                    {(() => {
                      const indicator = pointOnRing(0, cycleMinutes, KNOB_RADIUS - 16, innerRotationMinutes);
                      const indicatorInner = pointOnRing(0, cycleMinutes, KNOB_RADIUS - 38, innerRotationMinutes);
                      return (
                        <g
                          className="touch-none cursor-grab active:cursor-grabbing"
                          onPointerDown={handleBlockRingPointerStart}
                        >
                          <circle cx={RING_CENTER} cy={RING_CENTER} r={KNOB_RADIUS} fill="#f4f2f8" stroke="#ddd6ee" strokeWidth="10" />
                          <circle cx={RING_CENTER} cy={RING_CENTER} r={KNOB_RADIUS - 14} fill="#ffffff" stroke="#ece8f5" strokeWidth="2" />
                          <circle cx={RING_CENTER + 18} cy={RING_CENTER - 22} r={KNOB_RADIUS - 48} fill="#ffffff" opacity="0.45" />
                          <line x1={indicatorInner.x} y1={indicatorInner.y} x2={indicator.x} y2={indicator.y} stroke="#8d78d5" strokeWidth="6" strokeLinecap="round" />
                          <circle cx={indicator.x} cy={indicator.y} r="7" fill="#ffffff" stroke="#8d78d5" strokeWidth="3" />
                        </g>
                      );
                    })()}
                    <text x={RING_CENTER} y={RING_CENTER - 4} textAnchor="middle" className="pointer-events-none fill-neutral-700 text-[16px] font-bold">{selectedTemplate.name || '未命名模版'}</text>
                    <text x={RING_CENTER} y={RING_CENTER + 18} textAnchor="middle" className="pointer-events-none fill-neutral-400 text-[11px]">{selectedTemplate.type === 'daily' ? '24 小时循环 · 5 分钟精度' : '7 天循环'}</text>
                  </svg>
                </div>
              </section>
            )}
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
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
