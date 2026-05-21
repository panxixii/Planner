import React, { useCallback, useMemo, useRef, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  ReactFlowProvider,
  useReactFlow,
  Connection,
  Edge,
  Node,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../store';
import { TaskNode } from './TaskNode';
import { 
  Layers2, 
  Sparkles, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  BookOpen, 
  FileCode, 
  ChevronRight,
  HelpCircle,
  Inbox
} from 'lucide-react';
import { Task, GoalNode } from '../types';

// Helper to find all downstream children in the DAG path for Mind Map movement
const getDescendantNodeIds = (nodeId: string, edges: any[]): Set<string> => {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = edges.filter((e) => e.source === current).map((e) => e.target);
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
};

interface DAGInnerWorkspaceProps {
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

const DAGInnerWorkspace: React.FC<DAGInnerWorkspaceProps> = ({ onDrop, onDragOver }) => {
  const isMergedView = useAppStore((state) => state.isMergedView);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const goals = useAppStore((state) => state.goals);
  const crossGoalEdges = useAppStore((state) => state.crossGoalEdges);
  const updateGoalNodes = useAppStore((state) => state.updateGoalNodes);
  const addEdgeToGoal = useAppStore((state) => state.addEdgeToGoal);
  const addCrossGoalEdge = useAppStore((state) => state.addCrossGoalEdge);
  const deleteEdgeFromGoal = useAppStore((state) => state.deleteEdgeFromGoal);
  const deleteCrossGoalEdge = useAppStore((state) => state.deleteCrossGoalEdge);
  const deleteNodeFromGoal = useAppStore((state) => state.deleteNodeFromGoal);
  const addTask = useAppStore((state) => state.addTask);
  const addNodeToGoal = useAppStore((state) => state.addNodeToGoal);
  const activeMergedGoalIds = useAppStore((state) => state.activeMergedGoalIds);
  const toggleActiveMergedGoalId = useAppStore((state) => state.toggleActiveMergedGoalId);

  const showHelp = useAppStore((state) => state.showHelp);
  const toggleHelp = useAppStore((state) => state.toggleHelp);

  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => curr === msg ? null : curr);
    }, 3500);
  }, []);

  // Register Custom Task Node
  const nodeTypes = useMemo(() => ({
    taskNode: TaskNode
  }), []);

  // Compute final elements
  const nodes: Node[] = useMemo(() => {
    if (isMergedView) {
      const allNodes: Node[] = [];
      Object.entries(goals).forEach(([gid, g]) => {
        // ONLY include if this goal ID has been pulled/loaded into workspace!
        if (!activeMergedGoalIds.includes(gid)) return;

        let yOffset = 0;
        if (gid === 'goal-health-marathon') yOffset = 250;
        if (gid === 'goal-personal-book') yOffset = 500;

        g.nodes.forEach((n) => {
          allNodes.push({
            id: n.id,
            type: 'taskNode',
            position: { x: n.position.x, y: n.position.y + yOffset },
            data: { taskId: n.taskId, goalColor: g.color, goalTitle: g.title, isMerged: true }
          });
        });
      });
      return allNodes;
    } else if (selectedGoalId && goals[selectedGoalId]) {
      const goal = goals[selectedGoalId];
      return goal.nodes.map((n) => ({
        id: n.id,
        type: 'taskNode',
        position: n.position,
        data: { taskId: n.taskId, goalColor: goal.color, goalTitle: goal.title, isMerged: false }
      }));
    }
    return [];
  }, [isMergedView, selectedGoalId, goals, activeMergedGoalIds]);

  const edges: Edge[] = useMemo(() => {
    if (isMergedView) {
      const allEdges: Edge[] = [];
      Object.keys(goals).forEach((gid) => {
        // ONLY render structural edges of loaded goals
        if (!activeMergedGoalIds.includes(gid)) return;

        const g = goals[gid];
        g.edges.forEach((e) => {
          const isCustom = e.id.startsWith('edge-custom-');
          allEdges.push({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'step', // Ensure hard orthogonal step connections
            animated: isCustom,
            style: { 
              stroke: isCustom ? '#2563EB' : '#94A3B8', 
              strokeWidth: isCustom ? 2.5 : 1.5,
              opacity: isCustom ? 1 : 0.65
            },
            interactionWidth: 25 // Enlarge hitbox for easy double-clicking to delete!
          });
        });
      });

      // Overlay cross-goal connections, ONLY if both source and target nodes exist in our visible node list
      crossGoalEdges.forEach((e) => {
        const hasSource = nodes.some(n => n.id === e.source);
        const hasTarget = nodes.some(n => n.id === e.target);
        if (hasSource && hasTarget) {
          const isCustom = e.id.startsWith('edge-custom-');
          allEdges.push({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'step', // Ensure hard orthogonal step connections
            animated: isCustom,
            style: { 
              stroke: isCustom ? '#2563EB' : '#94A3B8', 
              strokeWidth: isCustom ? 2.5 : 1.5,
              opacity: isCustom ? 1 : 0.65,
              strokeDasharray: isCustom ? '6,6' : '0'
            },
            label: isCustom ? '自订跨赛道依赖' : '同构默认依赖',
            labelStyle: { fill: isCustom ? '#2563EB' : '#94A3B8', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' },
            interactionWidth: 25 // Enlarge hitbox for easy double-clicking to delete!
          });
        }
      });

      return allEdges;
    } else if (selectedGoalId && goals[selectedGoalId]) {
      const goal = goals[selectedGoalId];
      return goal.edges.map((e) => {
        const isCustom = e.id.startsWith('edge-custom-');
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'step', // Ensure hard orthogonal step connections
          animated: isCustom,
          style: { 
            stroke: isCustom ? '#2563EB' : '#94A3B8', 
            strokeWidth: isCustom ? 2.5 : 1.5,
            opacity: isCustom ? 1 : 0.65
          },
          interactionWidth: 25 // Enlarge hitbox for easy double-clicking to delete!
        };
      });
    }
    return [];
  }, [isMergedView, selectedGoalId, goals, crossGoalEdges, activeMergedGoalIds, nodes]);

  // Continuous dragging of parent and all child descendants simultaneously (Mind-Map style)
  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    const { id, position } = node;

    if (isMergedView) {
      for (const [gid, g] of Object.entries(goals)) {
        const matchIdx = g.nodes.findIndex((n) => n.id === id);
        if (matchIdx !== -1) {
          const prevPosition = g.nodes[matchIdx].position;
          let yOffset = 0;
          if (gid === 'goal-health-marathon') yOffset = 250;
          if (gid === 'goal-personal-book') yOffset = 500;

          const targetX = position.x;
          const targetY = position.y - yOffset;

          const dx = targetX - prevPosition.x;
          const dy = targetY - prevPosition.y;

          if (dx !== 0 || dy !== 0) {
            const descIds = getDescendantNodeIds(id, g.edges);
            const updatedNodes = g.nodes.map((n) => {
              if (n.id === id) {
                return { ...n, position: { x: targetX, y: targetY } };
              } else if (descIds.has(n.id)) {
                return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
              }
              return n;
            });
            updateGoalNodes(gid, updatedNodes);
          }
          break;
        }
      }
    } else if (selectedGoalId && goals[selectedGoalId]) {
      const g = goals[selectedGoalId];
      const matchIdx = g.nodes.findIndex((n) => n.id === id);
      if (matchIdx !== -1) {
        const prevPosition = g.nodes[matchIdx].position;
        const dx = position.x - prevPosition.x;
        const dy = position.y - prevPosition.y;

        if (dx !== 0 || dy !== 0) {
          const descIds = getDescendantNodeIds(id, g.edges);
          const updatedNodes = g.nodes.map((n) => {
            if (n.id === id) {
              return { ...n, position: { x: position.x, y: position.y } };
            } else if (descIds.has(n.id)) {
              return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
            }
            return n;
          });
          updateGoalNodes(selectedGoalId, updatedNodes);
        }
      }
    }
  }, [isMergedView, selectedGoalId, goals, updateGoalNodes]);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeDrag(_event, node);
  }, [onNodeDrag]);

  // Handle Tab keypress to spawn a child concept node directly aligned rightwards
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Ignore keypresses if typing inside drawer text boxes
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    if (event.key === 'Tab') {
      // Find the currently selected element on the reactive landscape
      const selectedNode = nodes.find((n) => n.selected);
      if (!selectedNode) return;

      // Disable tab list navigation default layout cycling
      event.preventDefault();

      let targetGoalId = selectedGoalId;
      if (isMergedView) {
        for (const [gid, g] of Object.entries(goals)) {
          if (g.nodes.some((n) => n.id === selectedNode.id)) {
            targetGoalId = gid;
            break;
          }
        }
      }

      if (!targetGoalId || !goals[targetGoalId]) return;

      const g = goals[targetGoalId];

      // Standard child offset positioning (Mind map horizontal branches flow)
      const sourcePos = selectedNode.position;
      let nextX = sourcePos.x + 250;
      let nextY = sourcePos.y;

      // Safe collision check - Never overlapping nodes!
      while (g.nodes.some((n) => Math.abs(n.position.x - nextX) < 100 && Math.abs(n.position.y - nextY) < 60)) {
        nextY += 110;
      }

      const newTaskId = `t-mind-${Math.random().toString(36).substring(2, 9)}`;
      const newTaskObj: Task = {
        id: newTaskId,
        title: '新分支里程碑子步骤',
        description: '这是通过 Tab 键盘生成的子拓扑约束节点。双击节点可以定制所有任务细则并调配起止日期。',
        duration: 4,
        isDone: false,
        startTime: '2026-05-24',
        endTime: '2026-05-26',
        color: 'sky'
      };
      addTask(newTaskObj);

      const newNodeId = `node-mind-${Math.random().toString(36).substring(2, 9)}`;
      const newGoalNode: GoalNode = {
        id: newNodeId,
        taskId: newTaskId,
        position: { x: nextX, y: nextY }
      };

      addNodeToGoal(targetGoalId, newGoalNode);

      // Create a sharp orthogonal visual connector line
      const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
      const newEdge = {
        id: edgeId,
        source: selectedNode.id,
        target: newNodeId
      };
      addEdgeToGoal(targetGoalId, newEdge);

      showToast('🍀 思维子分支已生成！已建立右偏对齐连线(硬直角)！');
    }
  }, [nodes, isMergedView, selectedGoalId, goals, addTask, addNodeToGoal, addEdgeToGoal, showToast]);

  // Handle new dependency connections
  const onConnect = useCallback((connection: Connection) => {
    const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
    
    if (isMergedView) {
      // Cross-goal dependency
      const isCross = nodes.find(n => n.id === connection.source)?.data?.goalTitle !==
                      nodes.find(n => n.id === connection.target)?.data?.goalTitle;
      
      const newEdge = {
        id: edgeId,
        source: connection.source!,
        target: connection.target!,
      };

      if (isCross) {
        addCrossGoalEdge(newEdge);
      } else {
        for (const [gid, g] of Object.entries(goals)) {
          if (g.nodes.some(n => n.id === connection.source)) {
            addEdgeToGoal(gid, newEdge);
            break;
          }
        }
      }
    } else if (selectedGoalId) {
      const newEdge = {
        id: edgeId,
        source: connection.source!,
        target: connection.target!,
      };
      addEdgeToGoal(selectedGoalId, newEdge);
    }
  }, [isMergedView, selectedGoalId, nodes, goals, addCrossGoalEdge, addEdgeToGoal]);

  // Double click edge to delete dependency (RESTRICTED TO CUSTOM WORKSPACE EDGES IN MERGED VIEW ONLY)
  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (isMergedView) {
      const isCustom = edge.id.startsWith('edge-custom-');
      if (!isCustom) {
        showToast('⚠️ 固有拓扑机制：合并视图下无法删除系统预设的默认前后依赖线。');
        return;
      }

      const isCross = crossGoalEdges.some((e) => e.id === edge.id);
      if (isCross) {
        deleteCrossGoalEdge(edge.id);
        showToast('已断开自主规划的跨赛道拓扑依赖连线！');
      } else {
        for (const [gid, g] of Object.entries(goals)) {
          if (g.edges.some((e) => e.id === edge.id)) {
            deleteEdgeFromGoal(gid, edge.id);
            showToast(`已断开计划 “${g.title}” 内部的自主预设/连线！`);
            break;
          }
        }
      }
    } else if (selectedGoalId) {
      deleteEdgeFromGoal(selectedGoalId, edge.id);
      showToast('已成功断开选中的拓扑连线！');
    }
  }, [isMergedView, selectedGoalId, goals, crossGoalEdges, deleteCrossGoalEdge, deleteEdgeFromGoal, showToast]);

  // Left click backspace deletes node
  const onNodesDelete = useCallback((nodesDeleted: Node[]) => {
    nodesDeleted.forEach((node) => {
      if (isMergedView) {
        for (const [gid, g] of Object.entries(goals)) {
          if (g.nodes.some(n => n.id === node.id)) {
            deleteNodeFromGoal(gid, node.id);
            break;
          }
        }
      } else if (selectedGoalId) {
        deleteNodeFromGoal(selectedGoalId, node.id);
      }
    });
  }, [isMergedView, selectedGoalId, goals, deleteNodeFromGoal]);

  // Add brand new quick task direct to canvas
  const handleAddNewQuickTask = () => {
    const activeGoalId = selectedGoalId || activeMergedGoalIds[0] || Object.keys(goals)[0];
    if (!activeGoalId) return;

    // Direct active to activeMergedGoalIds if currently empty
    if (isMergedView && !activeMergedGoalIds.includes(activeGoalId)) {
      toggleActiveMergedGoalId(activeGoalId);
    }

    const newTaskId = `t-quick-${Math.random().toString(36).substring(2, 9)}`;
    const newTaskObj: Task = {
      id: newTaskId,
      title: '随性目标阶段性里程碑',
      description: '双击拓扑节点以呼出详细属性查阅/控制编辑侧抽屉。',
      duration: 6,
      isDone: false,
      startTime: '2026-05-24',
      endTime: '2026-05-26',
      color: 'indigo'
    };
    addTask(newTaskObj);

    const newNodeId = `node-qk-${Math.random().toString(36).substring(2, 9)}`;
    const newGoalNode: GoalNode = {
      id: newNodeId,
      taskId: newTaskId,
      position: { x: 220, y: 150 }
    };

    addNodeToGoal(activeGoalId, newGoalNode);
  };

  const activeTitle = isMergedView 
    ? '多领域合并蓝图可视化画布' 
    : (selectedGoalId ? goals[selectedGoalId]?.title : '选择计划');

  const activeDescription = isMergedView
    ? '合并多套成长项目，确立跨度多维的动态跨计划拓扑依赖 (DAG) 连接，整合并排布整体甘特图。'
    : (selectedGoalId ? goals[selectedGoalId]?.description : '从具体领域类别中，选择一个目标卡片以载入并编辑前驱后继依赖拓扑关系。');

  const showEmptyMergePlaceholder = isMergedView && activeMergedGoalIds.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative select-none">
      
      {/* 1. Empty Workspace Overlay Placeholder */}
      {showEmptyMergePlaceholder && (
        <div className="absolute inset-0 bg-neutral-100/60 z-10 flex flex-col items-center justify-center p-8 text-center select-none backdrop-blur-3xs">
          <div className="max-w-md bg-white p-8 rounded-3xl border border-neutral-200/80 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs border border-blue-100">
              <Layers2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-neutral-800 tracking-tight">合并工作区当前为空</h3>
              <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                这是一个干净的可视化协同画布。请在左侧仪表板中 <span className="text-neutral-800 font-medium">勾选载入计划书</span>，或者直接将下方的 <span className="text-neutral-800 font-medium">【BOM 拓扑蓝图】</span> 组件拖入此工作区来载入生涯规划的拓扑网络！
              </p>
            </div>
            
            <div className="pt-3 border-t border-neutral-100 space-y-2.5">
              <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block font-mono">一键精选载入项目：</span>
              <div className="flex flex-col gap-1.5">
                {Object.entries(goals).map(([gid, g]) => {
                  const colorClasses: Record<string, string> = {
                    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
                    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                    sky: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  };
                  const colorClass = colorClasses[g.color] || colorClasses.indigo;
                  return (
                    <button
                      key={gid}
                      onClick={() => toggleActiveMergedGoalId(gid)}
                      className={`text-[11px] font-medium border rounded-xl py-2 px-3 text-left transition-colors cursor-pointer flex items-center justify-between ${colorClass}`}
                    >
                      <span>➕ {g.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Topology Left Info Board & Checklist */}
      <div className="absolute top-5 left-5 z-20 max-w-xs bg-white/95 border border-neutral-200 rounded-2xl shadow-lg p-4 pointer-events-auto space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-1.5 min-w-0">
              {isMergedView ? (
                <Layers2 className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
              )}
              <h2 className="text-xs font-bold text-neutral-800 font-sans uppercase tracking-wider truncate max-w-[140px]">
                {activeTitle}
              </h2>
            </div>
            <button
              onClick={toggleHelp}
              className={`text-[9px] font-bold font-sans px-1.5 py-0.5 rounded cursor-pointer transition-all border shrink-0
                ${showHelp 
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
                  : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'}`}
              title="隐藏/显示画布底部的拓扑连线手册"
            >
              <span>提示:{showHelp ? '显示' : '隐藏'}</span>
            </button>
          </div>
          <p className="text-[10.5px] text-neutral-500 leading-relaxed font-sans">
            {activeDescription}
          </p>
        </div>
        
        {/* Floating Contextual Instruction Helpers */}
        {showHelp && (
          <div className="flex flex-col gap-1 text-[10px] text-neutral-450 font-mono border-t border-neutral-100 pt-2.5 animate-in fade-in duration-200">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 拖曳圆圈点：创建前驱后继依赖键
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 双击连接线：断开/解除对齐约束
            </span>
            {isMergedView && (
              <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-sans text-[10px] font-semibold border border-blue-100 mt-1">
                <Sparkles className="w-3 shrink-0" /> 支持跨计划跨赛道进行合并拓扑
              </span>
            )}
          </div>
        )}

        {/* 3. Merged Workspace Active Goal Controls */}
        {isMergedView && (
          <div className="pt-3 border-t border-neutral-150 space-y-2">
            <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block font-mono">加载的生涯规划表：</span>
            <div className="space-y-1">
              {Object.entries(goals).map(([gid, g]) => {
                const isActive = activeMergedGoalIds.includes(gid);
                
                const dotColorClass = g.color === 'emerald' ? 'bg-emerald-500' :
                                      g.color === 'sky' ? 'bg-blue-400' : 'bg-indigo-500';
                                      
                return (
                  <button
                    key={gid}
                    onClick={() => toggleActiveMergedGoalId(gid)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-[11px] font-sans transition-all cursor-pointer text-left
                      ${isActive 
                        ? 'bg-neutral-50 border-neutral-200 text-neutral-800 font-medium shadow-2xs' 
                        : 'bg-white border-transparent text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColorClass}`} />
                      <span className="truncate pr-1">{g.title}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'border-neutral-200 bg-white'}`}
                    >
                      {isActive && <span className="text-[9px] font-extrabold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Top Right Quick Canvas Controls (Plus milestone) */}
      <div className="absolute top-5 right-5 z-20 flex gap-2 pointer-events-auto">
        <button
          onClick={handleAddNewQuickTask}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all shadow-blue-500/10"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建约束节点</span>
        </button>
      </div>

      {/* 5. Apple Style Highly Prominent Zoom Control Panel with Button labels */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 bg-white border-2 border-blue-600/30 p-2 rounded-2xl shadow-xl pointer-events-auto select-none">
        <span className="text-[10px] font-bold text-blue-600 font-mono tracking-wider px-2.5 uppercase border-r border-neutral-200">
          画布控制
        </span>
        <button 
          onClick={() => zoomIn()}
          className="flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-blue-600 hover:text-white text-neutral-700 transition-all cursor-pointer font-bold gap-1 shadow-sm"
          title="放大画布 (Zoom In)"
        >
          <ZoomIn className="w-4 h-4 text-blue-600 group-hover:text-white" />
          <span className="text-[11px] px-0.5">放大</span>
        </button>
        <button 
          onClick={() => zoomOut()}
          className="flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-blue-600 hover:text-white text-neutral-700 transition-all cursor-pointer font-bold gap-1 shadow-sm"
          title="缩小画布 (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4 text-blue-600 group-hover:text-white" />
          <span className="text-[11px] px-0.5">缩小</span>
        </button>
        <div className="w-px h-6 bg-neutral-200 mx-1.5" />
        <button 
          onClick={() => fitView({ padding: 0.25, duration: 500 })}
          className="flex items-center justify-center py-2 px-3 rounded-xl bg-blue-105 hover:bg-blue-600 hover:text-white text-blue-600 transition-all cursor-pointer font-extrabold text-xs gap-1 shadow-sm"
          title="重置缩放以展示所有节点 (Fit View)"
        >
          <Maximize className="w-4 h-4" />
          <span>适应全屏</span>
        </button>
      </div>

      {/* 6. Real React Flow Canvas */}
      <div 
        onDrop={onDrop}
        onDragOver={onDragOver}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className="flex-1 min-h-0 bg-neutral-50/50 cursor-grab active:cursor-grabbing text-neutral-800 outline-none"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodesDelete={onNodesDelete}
          fitView
          minZoom={0.15}
          maxZoom={1.5}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            color="#DCDCDC" 
            gap={24} 
            size={1.5} 
          />
        </ReactFlow>
      </div>

      {/* Sleek Sandy/Neutral Modern Toast Alert */}
      {toastMessage && (
        <div className="absolute bottom-6 left-6 z-30 flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-2xl shadow-xl pointer-events-none select-none max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-sans font-medium text-neutral-100">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export const DAGWorkspace: React.FC = () => {
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const isMergedView = useAppStore((state) => state.isMergedView);
  const addNodeToGoal = useAppStore((state) => state.addNodeToGoal);
  const goals = useAppStore((state) => state.goals);
  const activeMergedGoalIds = useAppStore((state) => state.activeMergedGoalIds);
  const toggleActiveMergedGoalId = useAppStore((state) => state.toggleActiveMergedGoalId);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Drop Event mapping BOM sidebar coordinates logic
  const handleOuterDrop = useCallback(
    (event: React.DragEvent, screenToFlow: (pos: { x: number; y: number }) => { x: number; y: number }) => {
      event.preventDefault();

      const taskId = event.dataTransfer.getData('application/reactflow-taskid');
      if (!taskId) return;

      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;

      // Project native screen drop coordinates to localized canvas coordinates
      const canvasPosition = screenToFlow({
        x: event.clientX,
        y: event.clientY
      });

      // Find which plan owns this template node task to add correctly!
      let targetGoalId = '';
      for (const [gid, g] of Object.entries(goals)) {
        if (g.nodes.some((n) => n.taskId === taskId)) {
          targetGoalId = gid;
          break;
        }
      }
      
      // Fallback if not mapped
      if (!targetGoalId) targetGoalId = selectedGoalId || Object.keys(goals)[0] || '';

      // Auto load plan to workspace if dragged in while empty
      if (isMergedView && !activeMergedGoalIds.includes(targetGoalId)) {
        toggleActiveMergedGoalId(targetGoalId);
      }

      const newNodeId = `node-inst-${Math.random().toString(36).substring(2, 9)}`;
      const newGoalNode: GoalNode = {
        id: newNodeId,
        taskId: taskId,
        position: canvasPosition
      };

      if (isMergedView) {
        addNodeToGoal(targetGoalId, newGoalNode);
      } else if (selectedGoalId) {
        addNodeToGoal(selectedGoalId, newGoalNode);
      }
    },
    [isMergedView, selectedGoalId, goals, activeMergedGoalIds, toggleActiveMergedGoalId, addNodeToGoal]
  );

  return (
    <div 
      ref={reactFlowWrapper} 
      className="flex-1 flex flex-col min-h-0 bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs relative"
    >
      <ReactFlowProvider>
        <FlowWrapperHelper 
          onDragOver={onDragOver} 
          onDropHelper={handleOuterDrop} 
        />
      </ReactFlowProvider>
    </div>
  );
};

// Isolated logic component to bypass screenToFlowPosition requirement of a Parent Provider wrapper
interface FlowWrapperHelperProps {
  onDragOver: (event: React.DragEvent) => void;
  onDropHelper: (
    event: React.DragEvent, 
    screenToFlow: (pos: { x: number; y: number }) => { x: number; y: number }
  ) => void;
}

const FlowWrapperHelper: React.FC<FlowWrapperHelperProps> = ({ onDragOver, onDropHelper }) => {
  const { screenToFlowPosition } = useReactFlow();

  const handleDrop = (event: React.DragEvent) => {
    onDropHelper(event, screenToFlowPosition);
  };

  return (
    <DAGInnerWorkspace 
      onDragOver={onDragOver} 
      onDrop={handleDrop} 
    />
  );
};
