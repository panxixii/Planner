import React, { useEffect, useRef, useState } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { withAlpha } from '../colorUtils';
import { ColorPicker } from './ColorPicker';
import { Check, Trash2 } from 'lucide-react';

export interface ZoneNodeData extends Record<string, unknown> { zoneId: string }

const ZoneToolbarHost: React.FC<{
  zoneId: string;
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
}> = ({ zoneId, open, anchor, onClose }) => {
  const zone = useAppStore((state) => state.todoZones.find((candidate) => candidate.id === zoneId));
  const updateZone = useAppStore((state) => state.updateTodoZone);
  const deleteZone = useAppStore((state) => state.deleteTodoZone);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  useEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    setPos({ top: Math.max(8, rect.top - 56), left: Math.max(130, Math.min(x, window.innerWidth - 130)) });
  }, [open, anchor]);

  if (!open || !pos || !zone) return null;

  return createPortal(
    <>
      <button type="button" className="fixed inset-0 z-[190] cursor-default" onClick={onClose} aria-label="关闭分区操作" />
      <div role="toolbar" aria-label="分区操作" className="fixed z-[200] flex w-56 -translate-x-1/2 flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg" style={{ top: pos.top, left: pos.left }}>
        <ColorPicker label="颜色" value={zone.color} onChange={(color) => updateZone(zoneId, { color })} />
        <button
          type="button"
          onClick={() => {
            if (confirmDelete) { onClose(); deleteZone(zoneId); return; }
            setConfirmDelete(true);
          }}
          onMouseLeave={() => setConfirmDelete(false)}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors ${confirmDelete ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
          aria-label={confirmDelete ? '确认删除分区' : '删除分区'}
          title={confirmDelete ? '再次点击确认删除（仅删除色块，保留内部节点）' : '删除分区'}
        >
          {confirmDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          <span>{confirmDelete ? '确认' : '删除'}</span>
        </button>
      </div>
    </>,
    document.body,
  );
};

export const ZoneNode = React.memo(({ data }: NodeProps<Node<ZoneNodeData>>) => {
  const { zoneId } = data;
  const zone = useAppStore((state) => state.todoZones.find((candidate) => candidate.id === zoneId));
  const updateZone = useAppStore((state) => state.updateTodoZone);
  const nodeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  if (!zone) return null;

  const startEditing = () => {
    if (isEditing) return;
    setDraftName(zone.name);
    setIsEditing(true);
  };
  const commitName = () => {
    const name = draftName.trim();
    if (name !== zone.name) updateZone(zoneId, { name });
    setIsEditing(false);
  };

  return (
    <div
      ref={nodeRef}
      className="h-full w-full rounded-xl"
      style={{ backgroundColor: withAlpha(zone.color, 0.18), border: `1px solid ${withAlpha(zone.color, 0.6)}` }}
      onClick={(event) => {
        if (isEditing) return;
        if ((event.target as HTMLElement).closest('.planner-zone-badge, [role="toolbar"]')) return;
        setToolbarOpen((open) => !open);
      }}
    >
      <div
        className="planner-zone-badge nodrag nopan absolute left-2 top-2 flex items-center rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: zone.color }}
        onClick={(event) => { event.stopPropagation(); if (!isEditing) startEditing(); }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={draftName}
            aria-label="分区名称"
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => { if (skipBlurCommitRef.current) { skipBlurCommitRef.current = false; return; } commitName(); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitName(); event.currentTarget.blur(); }
              else if (event.key === 'Escape') { event.preventDefault(); skipBlurCommitRef.current = true; setDraftName(zone.name); setIsEditing(false); event.currentTarget.blur(); }
            }}
            className="nodrag nopan w-24 cursor-text bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-white/60"
            placeholder="分区"
          />
        ) : (
          <span className={zone.name ? '' : 'text-white/70'}>{zone.name || '分区'}</span>
        )}
      </div>
      <ZoneToolbarHost zoneId={zoneId} open={toolbarOpen} anchor={nodeRef.current} onClose={() => setToolbarOpen(false)} />
    </div>
  );
});

ZoneNode.displayName = 'ZoneNode';
