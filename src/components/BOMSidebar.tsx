import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { BOMTreeItem, Task, GoalNode } from '../types';
import { Folder, FolderOpen, GripVertical, FileText, Plus, BookOpen, Layers } from 'lucide-react';

export const BOMSidebar: React.FC = () => {
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const addTask = useAppStore((state) => state.addTask);
  const addNodeToGoal = useAppStore((state) => state.addNodeToGoal);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const isMergedView = useAppStore((state) => state.isMergedView);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const showHelp = useAppStore((state) => state.showHelp);
  const toggleHelp = useAppStore((state) => state.toggleHelp);

  // Keep track of which folders are expanded (defaults to false / collapsed)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // State to add customized element
  const [isAddingToFolder, setIsAddingToFolder] = useState<string | null>(null);
  const [newBOMTitle, setNewBOMTitle] = useState('');
  const [newBOMDesc, setNewBOMDesc] = useState('');

  // Generate BOM tree items dynamically based on Goals and their child Tasks
  const dynamicBOMTree = useMemo(() => {
    const goalsToUse = Object.values(goals).filter((g) => {
      if (isMergedView) {
        return true;
      }
      if (selectedCategoryId === 'all') {
        return true;
      }
      return g.category === selectedCategoryId;
    });

    return goalsToUse.map((goal) => {
      const children: BOMTreeItem[] = (goal.nodes || [])
        .map((node): BOMTreeItem | null => {
          const associatedTask = tasks[node.taskId];
          if (!associatedTask) return null;
          return {
            id: `bom-task-${goal.id}-${node.id}`,
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
  }, [goals, tasks, selectedCategoryId, isMergedView]);

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
      description: newBOMDesc || '自定义阶段任务描述。',
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
                <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
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
              title="添加可复用的蓝图到类别"
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
              <h5 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">创建蓝图模板</h5>
              <input
                type="text"
                placeholder="模板标题..."
                value={newBOMTitle}
                onChange={(e) => setNewBOMTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="快速说明..."
                value={newBOMDesc}
                onChange={(e) => setNewBOMDesc(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-[10px] text-neutral-500 placeholder-neutral-400 focus:outline-hidden focus:border-blue-500"
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
                  className="px-2 py-0.5 rounded text-[10px] bg-blue-600 text-white hover:bg-blue-500 cursor-pointer font-mono"
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
            }
          }}
          className={`group flex items-center justify-between py-1.5 px-2.5 mx-1.5 rounded-lg border text-xs font-mono transition-all text-neutral-500
            ${isDisabled 
              ? 'border-transparent bg-neutral-100/50 cursor-not-allowed opacity-40' 
              : 'border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300 cursor-grab active:cursor-grabbing shadow-2xs'
            }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          title={isDisabled ? "要在拖动模板前选择一个目标 DAG 拓扑工作区" : "拖入启用的 DAG 画布中以实例化其内容"}
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
      {/* Description Headers */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <Layers className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-bold text-neutral-800 tracking-wider font-mono uppercase">
              BOM 拓扑蓝图库
            </h4>
          </div>
          <button
            onClick={toggleHelp}
            className={`text-[9px] font-bold font-sans px-1.5 py-0.5 rounded cursor-pointer transition-all border
              ${showHelp 
                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                : 'bg-neutral-150 text-neutral-500 border-neutral-200 hover:bg-neutral-200'}`}
            title="快捷控制整站操作说明卡片"
          >
            <span>提示:{showHelp ? '显示' : '隐藏'}</span>
          </button>
        </div>
        {showHelp && (
          <p className="text-[10px] text-neutral-400 leading-normal font-sans animate-in fade-in duration-250">
            按住并直接将可复用组件拖动到上方的 DAG 拓扑流画布上以实例化。
          </p>
        )}
      </div>

      {/* Actual Tree Containers */}
      <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
        {dynamicBOMTree.length === 0 ? (
          <div className="text-[10px] text-neutral-400 italic text-center py-6 font-mono">
            当前分类下尚无目标计划（BOM无根目录文件夹）
          </div>
        ) : (
          dynamicBOMTree.map((topNode) => renderTreeItem(topNode))
        )}
      </div>

      {/* Guide notice info */}
      {showHelp && (
        <div className="p-3 bg-neutral-100/70 border border-neutral-200 rounded-xl space-y-1 select-none animate-in fade-in duration-250">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wide">拓扑规则手册</span>
          </div>
          <p className="text-[9px] text-neutral-400 leading-relaxed font-sans font-medium">
            BOM 对象使用标准全局<span className="text-neutral-500 font-bold">参考引用</span>。修改已生成的节点会自动同步更新所有关联的目标实例。
          </p>
        </div>
      )}
    </div>
  );
};
