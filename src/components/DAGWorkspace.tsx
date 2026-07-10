import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  ReactFlowProvider,
  useReactFlow,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../store';
import { TaskNode } from './TaskNode';
import { ComponentHandleNode } from './ComponentHandleNode';
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

// Helper to find all connected nodes to move synchronously if the nodeId is the terminal (last) node in the relationship
const getDescendantNodeIds = (nodeId: string, edges: any[]): Set<string> => {
  const result = new Set<string>();
  
  // First, check if the node has outgoing edges (meaning it's a preceding node)
  const hasOutgoing = edges.some(e => e.source === nodeId);
  if (hasOutgoing) {
    // If it is a preceding node, its movement does not affect others
    return result;
  }
  
  // Second, check if the node has incoming edges (confirming it's connected and is indeed a terminal "last node")
  const hasIncoming = edges.some(e => e.target === nodeId);
  if (!hasIncoming) {
    // Isolated node, starts no chain, is not the "last node" of any chain
    return result;
  }
  
  // N is a "last node" - find all nodes in its connected component using undirected BFS
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    // Get all neighboring node IDs regardless of direction
    const neighbors = edges
      .filter((e) => e.source === current || e.target === current)
      .map((e) => e.source === current ? e.target : e.source);
      
    for (const neighbor of neighbors) {
      if (neighbor !== nodeId && !result.has(neighbor)) {
        result.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  
  return result;
};

// Helper to find all connected components of a goal or merged workspace
const getConnectedComponents = (nodes: any[], edges: any[]): { id: string; nodeIds: Set<string> }[] => {
  const visited = new Set<string>();
  const components: { id: string; nodeIds: Set<string> }[] = [];

  nodes.forEach((node) => {
    if (visited.has(node.id)) return;

    const componentNodeIds = new Set<string>([node.id]);
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      edges.forEach((edge) => {
        let neighbor: string | null = null;
        if (edge.source === current) {
          neighbor = edge.target;
        } else if (edge.target === current) {
          neighbor = edge.source;
        }
        if (neighbor && !visited.has(neighbor)) {
          if (nodes.some((n) => n.id === neighbor)) {
            visited.add(neighbor);
            componentNodeIds.add(neighbor);
            queue.push(neighbor);
          }
        }
      });
    }

    components.push({
      id: `cc-${node.id}`,
      nodeIds: componentNodeIds
    });
  });

  return components;
};

interface DAGInnerWorkspaceProps {
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

const DAGInnerWorkspace: React.FC<DAGInnerWorkspaceProps> = ({ onDrop, onDragOver }) => {
  const tasks = useAppStore((state) => state.tasks);
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

  // Independent Merged View state
  const mergedNodePositions = useAppStore((state) => state.mergedNodePositions);
  const mergedEdges = useAppStore((state) => state.mergedEdges);
  const mergedNodeIds = useAppStore((state) => state.mergedNodeIds);
  const updateMergedNodePositions = useAppStore((state) => state.updateMergedNodePositions);
  const addMergedEdge = useAppStore((state) => state.addMergedEdge);
  const deleteMergedEdge = useAppStore((state) => state.deleteMergedEdge);
  const addMergedNodeId = useAppStore((state) => state.addMergedNodeId);
  const deleteMergedNodeId = useAppStore((state) => state.deleteMergedNodeId);
  const clearMergedNodeIds = useAppStore((state) => state.clearMergedNodeIds);

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
    taskNode: TaskNode,
    componentHandle: ComponentHandleNode
  }), []);

  // Compute final elements dynamically with local cache
  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  const [localEdges, setLocalEdges] = useState<Edge[]>([]);

  // Calculate clean merged nodes and edges whenever underlying store state changes
  useEffect(() => {
    let computedNodes: Node[] = [];
    let computedEdges: Edge[] = [];

    if (isMergedView) {
      // 1. Populate task nodes
      const activeGoalIds = Object.keys(goals);
      activeGoalIds.forEach((gid, index) => {
        const g = goals[gid];
        if (!g || !g.nodes) return;
        const yOffset = index * 250;

        g.nodes.forEach((n) => {
          if (!n) return;
          // Only show nodes that have been pulled into the merged workspace!
          if (!mergedNodeIds.includes(n.id)) return;

          const mergedPos = mergedNodePositions[n.id];
          const finalPos = mergedPos ? mergedPos : { x: n.position.x, y: n.position.y + yOffset };
          computedNodes.push({
            id: n.id,
            type: 'taskNode',
            position: finalPos,
            data: { taskId: n.taskId, goalColor: g.color, goalTitle: g.title, goalId: gid, isMerged: true }
          });
        });
      });

      // 2. Populate edges
      // Predefined standard inner-goal edges if BOTH endpoints have been pulled
      activeGoalIds.forEach((gid) => {
        const g = goals[gid];
        if (!g || !g.edges) return;
        g.edges.forEach((e) => {
          const hasSource = computedNodes.some(n => n.id === e.source);
          const hasTarget = computedNodes.some(n => n.id === e.target);
          if (hasSource && hasTarget) {
            computedEdges.push({
              id: e.id,
              source: e.source,
              target: e.target,
              type: 'step',
              animated: false,
              style: { 
                stroke: '#94A3B8', 
                strokeWidth: 1.5,
                opacity: 0.65
              },
              interactionWidth: 25,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: '#94A3B8',
              }
            });
          }
        });
      });

      // Custom drawn merged connections (cross-goal or custom)
      mergedEdges.forEach((e) => {
        const hasSource = computedNodes.some(n => n.id === e.source);
        const hasTarget = computedNodes.some(n => n.id === e.target);
        if (hasSource && hasTarget) {
          const alreadyExistsIndex = computedEdges.findIndex(ce => ce.source === e.source && ce.target === e.target);

          const sNode = computedNodes.find(n => n.id === e.source);
          const tNode = computedNodes.find(n => n.id === e.target);
          const isCross = sNode?.data?.goalId !== tNode?.data?.goalId;

          const newEdgeObj: Edge = {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'step',
            animated: true,
            style: { 
              stroke: '#2563EB', 
              strokeWidth: 2.5,
              opacity: 1,
              strokeDasharray: isCross ? '6,6' : '0'
            },
            label: isCross ? '跨计划依赖' : undefined,
            labelStyle: { fill: '#2563EB', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' },
            interactionWidth: 25,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
              color: '#2563EB',
            }
          };

          if (alreadyExistsIndex >= 0) {
            computedEdges[alreadyExistsIndex] = newEdgeObj;
          } else {
            computedEdges.push(newEdgeObj);
          }
        }
      });

      // 3. Calculate connected components of the merged workspace's task nodes & edges, and add handles
      const components = getConnectedComponents(computedNodes, computedEdges);
      let ccIndex = 1;
      components.forEach((component) => {
        if (component.nodeIds.size >= 2) {
          const memberNodes = computedNodes.filter((n) => component.nodeIds.has(n.id));
          const xs = memberNodes.map((n) => n.position.x);
          const ys = memberNodes.map((n) => n.position.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);

          const handleX = (minX + maxX) / 2 - 50;
          const handleY = minY - 50;

          const repNode = memberNodes[0];
          const repTaskId = repNode ? (repNode.data as any)?.taskId : null;
          const repTask = repTaskId ? tasks[repTaskId] : null;
          const label = repTask ? `连通块: ${repTask.title.slice(0, 8)}...` : `连通块 #${ccIndex}`;

          // Generate stable ID for renaming
          const stableId = `cc-${Array.from(component.nodeIds).sort().join(',')}`;

          computedNodes.push({
            id: `handle-cc-${stableId}`,
            type: 'componentHandle',
            position: { x: handleX, y: handleY },
            data: {
              label: label,
              memberNodeIds: Array.from(component.nodeIds),
              stableId: stableId
            }
          });
          ccIndex++;
        }
      });

    } else if (selectedGoalId && goals[selectedGoalId]) {
      const goal = goals[selectedGoalId];
      computedNodes = (goal.nodes || []).map((n) => ({
        id: n.id,
        type: 'taskNode',
        position: n.position,
        data: { taskId: n.taskId, goalColor: goal.color, goalTitle: goal.title, goalId: selectedGoalId, isMerged: false }
      }));

      computedEdges = (goal.edges || []).map((e) => {
        if (!e) return {} as Edge;
        const isCustom = e.id.startsWith('edge-custom-');
        const strokeColor = isCustom ? '#2563EB' : '#94A3B8';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'step',
          animated: isCustom,
          style: { 
            stroke: strokeColor, 
            strokeWidth: isCustom ? 2.5 : 1.5,
            opacity: isCustom ? 1 : 0.65
          },
          interactionWidth: 25,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: strokeColor,
          }
        };
      });

      // Calculate connected components of the active goal's nodes and edges
      const components = getConnectedComponents(computedNodes, goal.edges || []);
      let ccIndex = 1;
      components.forEach((component) => {
        if (component.nodeIds.size >= 2) {
          const memberNodes = goal.nodes.filter((n) => component.nodeIds.has(n.id));
          const xs = memberNodes.map((n) => n.position.x);
          const ys = memberNodes.map((n) => n.position.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);

          const handleX = (minX + maxX) / 2 - 50;
          const handleY = minY - 50;

          // Find a representative task title to show on the handle
          const repNode = memberNodes[0];
          const repTask = repNode ? tasks[repNode.taskId] : null;
          const label = repTask ? `连通块: ${repTask.title.slice(0, 8)}...` : `连通块 #${ccIndex}`;

          // Generate stable ID for renaming
          const stableId = `cc-${Array.from(component.nodeIds).sort().join(',')}`;

          computedNodes.push({
            id: `handle-cc-${stableId}`,
            type: 'componentHandle',
            position: { x: handleX, y: handleY },
            data: {
              label: label,
              memberNodeIds: Array.from(component.nodeIds),
              stableId: stableId
            }
          });
          ccIndex++;
        }
      });
    }

    setLocalNodes(computedNodes);
    setLocalEdges(computedEdges);
  }, [isMergedView, selectedGoalId, goals, activeMergedGoalIds, crossGoalEdges, mergedNodePositions, mergedEdges, mergedNodeIds, tasks]);

  // Standard React Flow selection and state synchronization handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setLocalNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Continuous dragging of parent and all child descendants synchronously (Mind-Map style update in local state)
  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    const { id, position } = node;

    // Find previous local node layout coords
    const prevNode = localNodes.find((n) => n.id === id);
    if (!prevNode) return;

    const dx = position.x - prevNode.position.x;
    const dy = position.y - prevNode.position.y;

    if (dx !== 0 || dy !== 0) {
      if (id.startsWith('handle-cc-')) {
        // Dragging a connected component handle in either individual or merged workspace!
        const memberNodeIds: string[] = (node.data as any)?.memberNodeIds || [];
        const memberSet = new Set(memberNodeIds);
        setLocalNodes((nds) =>
          nds.map((n) => {
            if (n.id === id) {
              return { ...n, position };
            } else if (memberSet.has(n.id)) {
              return {
                ...n,
                position: {
                  x: n.position.x + dx,
                  y: n.position.y + dy,
                },
              };
            }
            return n;
          })
        );
      } else {
        // Normal dragging moves only the individual node (no other nodes moved)
        setLocalNodes((nds) =>
          nds.map((n) => (n.id === id ? { ...n, position } : n))
        );
      }
    }
  }, [localNodes]);

  // When drag is complete, compile coordinates and save them back to each corresponding goal in store
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    if (isMergedView) {
      const nextPositions: Record<string, { x: number; y: number }> = {};
      localNodes.forEach((ln) => {
        // Only persist actual task node positions, ignore helper handles
        if (ln.type === 'taskNode') {
          nextPositions[ln.id] = ln.position;
        }
      });
      updateMergedNodePositions(nextPositions);
    } else if (selectedGoalId && goals[selectedGoalId]) {
      const g = goals[selectedGoalId];
      const updatedGoalNodes = g.nodes.map((gn) => {
        const match = localNodes.find((ln) => ln.id === gn.id);
        if (match) {
          return {
            ...gn,
            position: match.position
          };
        }
        return gn;
      });
      updateGoalNodes(selectedGoalId, updatedGoalNodes);
    }
  }, [isMergedView, selectedGoalId, goals, localNodes, updateGoalNodes, updateMergedNodePositions]);

  // Handle Tab keypress to spawn a child concept node directly aligned rightwards
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Ignore keypresses if typing inside drawer text boxes
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    if (event.key === 'Tab') {
      const selectedNode = localNodes.find((n) => n.selected);
      if (!selectedNode) return;

      event.preventDefault();

      let targetGoalId = selectedGoalId;
      if (isMergedView) {
        for (const [gid, g] of Object.entries(goals)) {
          if (g && g.nodes && g.nodes.some((n) => n.id === selectedNode.id)) {
            targetGoalId = gid;
            break;
          }
        }
      }

      if (!targetGoalId || !goals[targetGoalId]) return;

      const g = goals[targetGoalId];

      const sourcePos = selectedNode.position;
      let nextX = sourcePos.x + 250;
      let nextY = sourcePos.y;

      while (g && g.nodes && g.nodes.some((n) => Math.abs(n.position.x - nextX) < 100 && Math.abs(n.position.y - nextY) < 60)) {
        nextY += 110;
      }

      const newTaskId = `t-mind-${Math.random().toString(36).substring(2, 9)}`;
      const newTaskObj: Task = {
        id: newTaskId,
        title: '',
        description: '',
        duration: 0,
        isDone: false,
        startTime: '',
        endTime: '',
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
      if (isMergedView) {
        addMergedNodeId(newNodeId);
      }

      const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
      const newEdge = {
        id: edgeId,
        source: selectedNode.id,
        target: newNodeId
      };
      if (isMergedView) {
        addMergedEdge(newEdge);
      } else {
        addEdgeToGoal(targetGoalId, newEdge);
      }

      showToast('🍀 思维子分支已生成！已建立右偏对齐连线(硬直角)！');
    }
  }, [localNodes, isMergedView, selectedGoalId, goals, addTask, addNodeToGoal, addEdgeToGoal, addMergedEdge, addMergedNodeId, showToast]);

  // Handle new dependency connections
  const onConnect = useCallback((connection: Connection) => {
    const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
    const newEdge = {
      id: edgeId,
      source: connection.source!,
      target: connection.target!,
    };

    if (isMergedView) {
      addMergedEdge(newEdge);
      showToast('已在合并工作区中创建独立拓扑连线！');
    } else if (selectedGoalId) {
      addEdgeToGoal(selectedGoalId, newEdge);
      showToast('已在当前画板中添加拓扑连线！');
    }
  }, [isMergedView, selectedGoalId, addMergedEdge, addEdgeToGoal, showToast]);

  // Double click edge to delete dependency (RESTRICTED TO CUSTOM WORKSPACE EDGES IN MERGED VIEW ONLY)
  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (isMergedView) {
      deleteMergedEdge(edge.id);
      showToast('已在合并工作区中解除相关拓扑依赖！');
    } else if (selectedGoalId) {
      deleteEdgeFromGoal(selectedGoalId, edge.id);
      showToast('已成功断开选中的拓扑连线！');
    }
  }, [isMergedView, selectedGoalId, deleteMergedEdge, deleteEdgeFromGoal, showToast]);

  // Left click backspace deletes node
  const onNodesDelete = useCallback((nodesDeleted: Node[]) => {
    nodesDeleted.forEach((node) => {
      if (isMergedView) {
        deleteMergedNodeId(node.id);
      } else if (selectedGoalId) {
        deleteNodeFromGoal(selectedGoalId, node.id);
      }
    });
  }, [isMergedView, selectedGoalId, deleteMergedNodeId, deleteNodeFromGoal]);

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
      title: '',
      description: '',
      duration: 0,
      isDone: false,
      startTime: '',
      endTime: '',
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
    if (isMergedView) {
      addMergedNodeId(newNodeId);
    }
  };

  const activeTitle = isMergedView 
    ? '多领域合并蓝图可视化画布' 
    : (selectedGoalId ? goals[selectedGoalId]?.title : '选择计划');

  const activeDescription = isMergedView
    ? '合并多套成长项目，确立跨度多维的动态跨计划拓扑依赖 (DAG) 连接，整合并排布整体甘特图。'
    : (selectedGoalId ? goals[selectedGoalId]?.description : '从具体领域类别中，选择一个目标卡片以载入并编辑前驱后继依赖拓扑关系。');

  const showEmptyMergePlaceholder = isMergedView && mergedNodeIds.length === 0;

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
                这是一个干净的可视化协同画布。请直接将左侧/原底下的 <span className="text-neutral-800 font-medium">【BOM 拓扑蓝图】</span> 中的任务组件拖拽入此工作区，来构建并连线您的多赛道合并拓扑网络！
              </p>
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
          nodes={localNodes}
          edges={localEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
  const addMergedNodeId = useAppStore((state) => state.addMergedNodeId);
  const updateMergedNodePositions = useAppStore((state) => state.updateMergedNodePositions);

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
      const orgNodeId = event.dataTransfer.getData('application/reactflow-orgnodeid');
      const orgGoalId = event.dataTransfer.getData('application/reactflow-orggoalid');
      if (!taskId) return;

      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;

      // Project native screen drop coordinates to localized canvas coordinates
      const canvasPosition = screenToFlow({
        x: event.clientX,
        y: event.clientY
      });

      if (isMergedView && orgNodeId && orgGoalId) {
        addMergedNodeId(orgNodeId);
        updateMergedNodePositions({
          [orgNodeId]: canvasPosition
        });
      } else {
        // Find which plan owns this template node task to add correctly!
        let targetGoalId = '';
        for (const [gid, g] of Object.entries(goals)) {
          if (g && g.nodes && g.nodes.some((n) => n.taskId === taskId)) {
            targetGoalId = gid;
            break;
          }
        }
        
        // Fallback if not mapped
        if (!targetGoalId) targetGoalId = selectedGoalId || Object.keys(goals)[0] || '';

        const newNodeId = `node-inst-${Math.random().toString(36).substring(2, 9)}`;
        const newGoalNode: GoalNode = {
          id: newNodeId,
          taskId: taskId,
          position: canvasPosition
        };

        if (selectedGoalId) {
          addNodeToGoal(selectedGoalId, newGoalNode);
        }
      }
    },
    [isMergedView, selectedGoalId, goals, activeMergedGoalIds, toggleActiveMergedGoalId, addNodeToGoal, addMergedNodeId, updateMergedNodePositions]
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
