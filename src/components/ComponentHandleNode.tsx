import React, { useState, useEffect } from 'react';
import { GripHorizontal, Edit2, Check } from 'lucide-react';
import { useAppStore } from '../store';

interface ComponentHandleNodeData {
  label: string;
  memberNodeIds: string[];
  stableId: string;
}

export const ComponentHandleNode: React.FC<{ id: string; data: ComponentHandleNodeData }> = ({ data }) => {
  const componentNames = useAppStore((state) => state.componentNames);
  const updateComponentName = useAppStore((state) => state.updateComponentName);
  
  const customName = componentNames[data.stableId] || '';
  const displayName = customName || data.label || '连通块';

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(displayName);

  // Sync display state when name from store changes
  useEffect(() => {
    setInputValue(displayName);
  }, [displayName]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = (e?: React.FormEvent | React.FocusEvent) => {
    if (e) e.preventDefault();
    if (inputValue.trim()) {
      updateComponentName(data.stableId, inputValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent React Flow canvas key triggers
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(displayName);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white border border-blue-500 shadow-lg text-[11px] font-sans tracking-wide font-medium cursor-grab active:cursor-grabbing hover:bg-blue-700 transition-colors group"
      style={{ pointerEvents: 'all' }}
    >
      <GripHorizontal className="w-3.5 h-3.5 shrink-0 text-blue-100" />
      
      {isEditing ? (
        <form onSubmit={handleSave} className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            className="px-1.5 py-0.5 rounded bg-blue-700 text-white border border-blue-400 focus:outline-none focus:border-white text-[11px] w-28 nodrag"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => handleSave()}
            autoFocus
          />
          <button 
            type="submit" 
            className="p-0.5 hover:bg-blue-500 rounded text-blue-100 hover:text-white"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Check className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{displayName}</span>
          <button 
            onClick={handleStartEdit} 
            className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-blue-500 rounded text-blue-200 hover:text-white transition-opacity duration-150 shrink-0"
            title="编辑名称"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      )}

      <span className="px-1.5 py-0.5 rounded-full bg-blue-700 text-blue-100 text-[9px] font-mono leading-none">
        {data.memberNodeIds?.length || 0} 节点
      </span>
    </div>
  );
};
