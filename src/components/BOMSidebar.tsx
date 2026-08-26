import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { BOMTreeItem, Task, GoalNode } from '../types';
import { Folder, FolderOpen, GripVertical, FileText, Plus, Layers } from 'lucide-react';

export const BOMSidebar: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const addTask = useAppStore((state) => state.addTask);
  const addNodeToGoal = useAppStore((state) => state.addNodeToGoal);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const isMergedView = useAppStore((state) => state.isMergedView);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const mergedNodeIds = useAppStore((state) => state.mergedNodeIds);

  // Keep track of which folders are expanded (defaults to false / collapsed)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // State to add customized element
  const [isAddingToFolder, setIsAddingToFolder] = useState<string | null>(null);
  const [newBOMTitle, setNewBOMTitle] = useState('');
  const [newBOMDesc, setNewBOMDesc] = useState('');

  // Generate BOM tree items dynamically based on Goals and their child Tasks
  const dynamicBOMTree = useMemo(() => {
    const goalsToUse = Object.values(goals);

    return goalsToUse.map((goal) => {
      const children: BOMTreeItem[] = (goal.nodes || [])
        .map((node): BOMTreeItem | null => {
          const associatedTask = tasks[node.taskId];
          if (!associatedTask) return null;

          // If we are in merged view, filter based on topological dependencies
          if (isMergedView) {
            const incomingEdges = (goal.edges || []).filter((e) => e.target === node.id);
            if (incomingEdges.length > 0) {
              const allPredecessorsValid = incomingEdges.every((edge) => {
                const sourceNode = (goal.nodes || []).find((gn) => gn.id === edge.source);
                if (!sourceNode) return false;
                const sourceTask = tasks[sourceNode.taskId];
                const isDone = sourceTask?.isDone || false;
                const isPulled = mergedNodeIds.includes(sourceNode.id);
                return isDone || isPulled;
              });

              if (!allPredecessorsValid) {
                return null;
              }
            }
          }

          return {
            id: `bom-task___${goal.id}___${node.id}`,
            title: associatedTask.title,
            type: 'task',
            taskId: node.taskId,
          };
        })
        .filter((item): item is BOMTreeItem => item !== null);

      return {
        id: `bom-goal-dir-${goal.id}`,
        title: goal.title,
        type: 'category' as const,
        children,
      };
    });
  }, [goals, tasks, selectedCategoryId, isMergedView, mergedNodeIds]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('application/reactflow-taskid', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCreateBOMItem = (parentId: string) => {
    if (!newBOMTitle.trim()) return;

    const newTaskId = `t-bom-${Math.random().toString(36).substring(2, 9)}`;
    const targetGoalId = parentId.replace('bom-goal-dir-', '');
    
    // 1. Create task entry in unified tasks resource pool
    const newTask: Task = {
      id: newTaskId,
      title: newBOMTitle,
      description: newBOMDesc || '暂无描述',
      duration: 4,
      isDone: false,
      color: 'indigo',
    };
    addTask(newTask);

    // 2. Insert into the target goal directly on the canvas
    const newGoalNode: GoalNode = {
      id: `node-${Math.random().toString(36).substring(2, 9)}`,
      taskId: newTaskId,
      position: { x: 150, y: 150 }, // standard starting position
    };
    addNodeToGoal(targetGoalId, newGoalNode);

    // Reset inputs
    setNewBOMTitle('');
    setNewBOMDesc('');
    setIsAddingToFolder(null);
  };

  const renderTreeItem = (node: BOMTreeItem, depth = 0) => {
    const isFolder = node.type === 'category';
    const isExpanded = !!expandedNodes[node.id];
    
    if (isFolder) {
      return (
        <div key={node.id} className="space-y-1">
          <div
            onClick={() => toggleExpand(node.id)}
            className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 transition-all text-xs font-medium group cursor-pointer select-none"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleExpand(node.id);
              }
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              )}
              <span className="truncate tracking-tight font-sans text-neutral-700 group-hover:text-neutral-900">{node.title}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingToFolder(isAddingToFolder === node.id ? null : node.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 transition-all cursor-pointer"
              title="添加任务"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline creation modal */}
          {isAddingToFolder === node.id && (
            <div 
              style={{ marginLeft: `${(depth + 1) * 12 + 8}px` }}
              className="p-3 bg-white border border-neutral-200 shadow-xs rounded-xl space-y-2 mt-1 mb-2"
            >
              <h5 className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-mono">添加任务</h5>
              <input
                type="text"
                placeholder="模板标题..."
                value={newBOMTitle}
                onChange={(e) => setNewBOMTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="描述"
                value={newBOMDesc}
                onChange={(e) => setNewBOMDesc(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-[10px] text-neutral-500 placeholder-neutral-400 focus:outline-hidden focus:border-purple-500"
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  onClick={() => setIsAddingToFolder(null)}
                  className="px-2 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-600 hover:bg-neutral-200 cursor-pointer font-mono"
                >
                  取消
                </button>
                <button
                  onClick={() => handleCreateBOMItem(node.id)}
                  className="px-2 py-0.5 rounded text-[10px] bg-gradient-to-r from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] text-white hover:opacity-90 cursor-pointer font-mono border-0"
                >
                  保存项
                </button>
              </div>
            </div>
          )}

          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      // Reusable Task Leaf Node (Draggable)
      const associatedTask = node.taskId ? tasks[node.taskId] : null;
      if (!associatedTask) return null;

      const isDisabled = !selectedGoalId && !isMergedView;

      return (
        <div
          key={node.id}
          draggable={!isDisabled}
          onDragStart={(e) => {
            if (associatedTask) {
              handleDragStart(e, associatedTask.id);
              if (node.id.startsWith('bom-task___')) {
                const parts = node.id.split('___');
                const dragGoalId = parts[1];
                const dragNodeId = parts[2];
                e.dataTransfer.setData('application/reactflow-orgnodeid', dragNodeId);
                e.dataTransfer.setData('application/reactflow-orggoalid', dragGoalId);
              }
            }
          }}
          className={`group flex items-center justify-between py-1.5 px-2.5 mx-1.5 rounded-lg border text-xs font-mono transition-all text-neutral-500
            ${isDisabled 
              ? 'border-transparent bg-neutral-100/50 cursor-not-allowed opacity-40' 
              : 'border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300 cursor-grab active:cursor-grabbing shadow-2xs'
            }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          title={isDisabled ? "请先打开一个计划或合并画布" : "拖入画布"}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <GripVertical className="w-3 h-3 text-neutral-300 group-hover:text-neutral-400 shrink-0" />
            <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">{associatedTask?.title || node.title}</span>
          </div>

          <span className="text-[9px] text-neutral-500 px-1.5 py-0.2 rounded bg-neutral-100 font-mono border border-neutral-200 shrink-0 select-none">
            {associatedTask.duration}h
          </span>
        </div>
      );
    }
  };

  return (
    <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 space-y-4">
      {/* Task library header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <Layers className="w-4 h-4 text-purple-500" />
            <h4 className="text-xs font-bold text-neutral-800 tracking-wider font-mono uppercase">
              任务库
            </h4>
          </div>
        </div>
      </div>

      {/* Actual Tree Containers */}
      <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
        {dynamicBOMTree.length === 0 ? (
          <div className="text-[10px] text-neutral-400 italic text-center py-6 font-mono">
            暂无任务
          </div>
        ) : (
          dynamicBOMTree.map((topNode) => renderTreeItem(topNode))
        )}
      </div>

    </div>
  );
};
