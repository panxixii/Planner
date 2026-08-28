import React from 'react';
import { GripHorizontal, PanelRightOpen } from 'lucide-react';
import { useAppStore } from '../store';

interface ComponentHandleNodeData {
  label: string;
  memberNodeIds: string[];
  componentId: string;
  color: string;
}

export const ComponentHandleNode: React.FC<{ data: ComponentHandleNodeData }> = ({ data }) => {
  const openComponentDetails = useAppStore((state) => state.openComponentDetails);

  return (
    <button
      type="button"
      onDoubleClick={(event) => {
        event.stopPropagation();
        openComponentDetails(data.componentId);
      }}
      className="group flex cursor-grab items-center gap-1.5 rounded-full border border-white/50 px-3 py-1.5 text-[11px] font-medium text-white shadow-md transition-opacity hover:opacity-90 active:cursor-grabbing"
      style={{ pointerEvents: 'all', backgroundColor: data.color }}
      title="双击打开联通块详情"
    >
      <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-white/80" />
      <span className="max-w-32 truncate font-semibold">{data.label}</span>
      <span className="rounded-full bg-black/15 px-1.5 py-0.5 font-mono text-[9px] leading-none text-white/90">{data.memberNodeIds.length} 节点</span>
      <PanelRightOpen className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
};
