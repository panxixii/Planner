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
  ConnectionLineType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '../store';
import { TaskNode } from './TaskNode';
import { ComponentHandleNode } from './ComponentHandleNode';
import { 
  Layers2, 
  Sparkles, 
  MousePointerClick,
  ZoomIn, 
  ZoomOut, 
  Maximize
} from 'lucide-react';
import { Task, GoalNode } from '../types';

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

const DAGInnerWorkspace: React.FC = () => {
  const tasks = useAppStore((state) => state.tasks);
  const isMergedView = useAppStore((state) => state.isMergedView);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const goals = useAppStore((state) => state.goals);
  const updateGoalNodes = useAppStore((state) => state.updateGoalNodes);
  const addEdgeToGoal = useAppStore((state) => state.addEdgeToGoal);
  const deleteEdgeFromGoal = useAppStore((state) => state.deleteEdgeFromGoal);
  const deleteNodeFromGoal = useAppStore((state) => state.deleteNodeFromGoal);
  const addTask = useAppStore((state) => state.addTask);
  const addNodeToGoal = useAppStore((state) => state.addNodeToGoal);
  const workspaceCategoryFilter = useAppStore((state) => state.workspaceCategoryFilter);
  const categories = useAppStore((state) => state.categories);

  // Independent Merged View state
  const mergedNodePositions = useAppStore((state) => state.mergedNodePositions);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const mergedEdges = useAppStore((state) => state.mergedEdges);
  const updateMergedNodePositions = useAppStore((state) => state.updateMergedNodePositions);
  const addWorkspaceNode = useAppStore((state) => state.addWorkspaceNode);
  const addMergedEdge = useAppStore((state) => state.addMergedEdge);
  const removeEdgeFromWorkspace = useAppStore((state) => state.removeEdgeFromWorkspace);
  const deleteMergedNodeId = useAppStore((state) => state.deleteMergedNodeId);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isConnectingRef = useRef(false);
  const suppressPaneClickUntilRef = useRef(0);

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
      const visibleTaskIds = new Set<string>();
      const activeGoalIds = Object.keys(goals).filter((goalId) => {
        const goal = goals[goalId];
        return goal && (workspaceCategoryFilter === null || workspaceCategoryFilter.includes(goal.category));
      });
      activeGoalIds.forEach((gid, index) => {
        const g = goals[gid];
        if (!g || !g.nodes) return;
        const yOffset = index * 250;

        g.nodes.forEach((n) => {
          if (!n || visibleTaskIds.has(n.taskId)) return;
          visibleTaskIds.add(n.taskId);
          const mergedPos = mergedNodePositions[n.id];
          const finalPos = mergedPos ? mergedPos : { x: n.position.x, y: n.position.y + yOffset };
          computedNodes.push({
            id: n.id,
            type: 'taskNode',
            position: finalPos,
            data: {
              taskId: n.taskId,
              goalColor: g.color,
              goalTitle: g.title,
              goalId: gid,
              isMerged: true,
              categoryIds: Array.from(new Set([g.category, ...(tasks[n.taskId]?.categoryIds || [])])),
            }
          });
        });
      });

      workspaceNodes.forEach((node) => {
        const task = tasks[node.taskId];
        if (!task || visibleTaskIds.has(task.id)) return;
        const isVisible = workspaceCategoryFilter === null
          || task.categoryIds?.some((categoryId) => workspaceCategoryFilter.includes(categoryId));
        if (!isVisible) return;

        visibleTaskIds.add(task.id);
        computedNodes.push({
          id: node.id,
          type: 'taskNode',
          position: mergedNodePositions[node.id] || node.position,
          data: {
            taskId: node.taskId,
            goalColor: task.color || 'indigo',
            goalTitle: '',
            goalId: null,
            isMerged: true,
            categoryIds: task.categoryIds || [],
          },
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
              type: 'bezier',
              animated: false,
              style: { 
                stroke: '#a9aec5', 
                strokeWidth: 2,
                opacity: 0.65
              },
              interactionWidth: 28,
            });
          }
        });
      });

      // Custom drawn merged connections (cross-goal or custom)
      mergedEdges.forEach((e) => {
        const isVisibleInWorkspace = workspaceCategoryFilter === null
          || e.categoryIds === undefined
          || e.categoryIds.some((categoryId) => workspaceCategoryFilter.includes(categoryId));
        if (!isVisibleInWorkspace) return;

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
            type: 'bezier',
            animated: false,
            style: { 
              stroke: '#8d78d5', 
              strokeWidth: 2.25,
              opacity: 1,
              strokeDasharray: isCross ? '6,6' : '0'
            },
            label: isCross ? '跨计划依赖' : undefined,
            labelStyle: { fill: '#8d78d5', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' },
            interactionWidth: 28,
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
        data: {
          taskId: n.taskId,
          goalColor: goal.color,
          goalTitle: goal.title,
          goalId: selectedGoalId,
          isMerged: false,
          categoryIds: [goal.category],
        }
      }));

      computedEdges = (goal.edges || []).map((e) => {
        if (!e) return {} as Edge;
        const isCustom = e.id.startsWith('edge-custom-');
        const strokeColor = isCustom ? '#8d78d5' : '#a9aec5';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'bezier',
          animated: false,
          style: { 
            stroke: strokeColor, 
            strokeWidth: isCustom ? 2.25 : 2,
            opacity: isCustom ? 1 : 0.65
          },
          interactionWidth: 28,
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
  }, [isMergedView, selectedGoalId, goals, mergedNodePositions, workspaceNodes, mergedEdges, tasks, workspaceCategoryFilter]);

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
      const parentTaskId = (selectedNode.data as { taskId?: string }).taskId;
      const parentTask = parentTaskId ? tasks[parentTaskId] : undefined;
      if (!parentTask) return;

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

      const targetGoal = targetGoalId ? goals[targetGoalId] : undefined;
      if (targetGoalId && !targetGoal) return;

      const sourcePos = selectedNode.position;
      let nextX = sourcePos.x + 210;
      let nextY = sourcePos.y;

      while (targetGoal?.nodes.some((n) => Math.abs(n.position.x - nextX) < 100 && Math.abs(n.position.y - nextY) < 60)) {
        nextY += 110;
      }

      const newTaskId = `t-mind-${Math.random().toString(36).substring(2, 9)}`;
      const newTaskObj: Task = {
        id: newTaskId,
        title: '',
        description: '',
        duration: 0,
        isDone: false,
        categoryIds: targetGoal
          ? [targetGoal.category]
          : (parentTask.categoryIds || []),
        startTime: '',
        endTime: '',
        color: parentTask.color || 'sky'
      };
      addTask(newTaskObj);

      const newNodeId = `node-mind-${Math.random().toString(36).substring(2, 9)}`;
      const newGoalNode: GoalNode = {
        id: newNodeId,
        taskId: newTaskId,
        position: { x: nextX, y: nextY }
      };

      if (targetGoalId) {
        addNodeToGoal(targetGoalId, newGoalNode);
      } else {
        addWorkspaceNode(newGoalNode);
      }

      const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
      const newEdge = {
        id: edgeId,
        source: selectedNode.id,
        target: newNodeId,
        categoryIds: (isMergedView || !targetGoalId)
          ? (newTaskObj.categoryIds || [])
          : undefined,
      };
      if (isMergedView || !targetGoalId) {
        addMergedEdge(newEdge);
      } else {
        addEdgeToGoal(targetGoalId, newEdge);
      }

      showToast('已创建思维子节点');
    }
  }, [localNodes, isMergedView, selectedGoalId, goals, tasks, workspaceCategoryFilter, addTask, addNodeToGoal, addWorkspaceNode, addEdgeToGoal, addMergedEdge, showToast]);

  // Handle new dependency connections
  const onConnect = useCallback((connection: Connection) => {
    const edgeId = `edge-custom-${Math.random().toString(36).substring(2, 9)}`;
    const sourceCategoryIds = (localNodes.find((node) => node.id === connection.source)?.data as { categoryIds?: string[] } | undefined)?.categoryIds || [];
    const targetCategoryIds = (localNodes.find((node) => node.id === connection.target)?.data as { categoryIds?: string[] } | undefined)?.categoryIds || [];
    const targetCategoryIdSet = new Set(targetCategoryIds);
    const sharedCategoryIds = sourceCategoryIds.filter((categoryId) => targetCategoryIdSet.has(categoryId));
    const newEdge = {
      id: edgeId,
      source: connection.source!,
      target: connection.target!,
      categoryIds: isMergedView ? sharedCategoryIds : undefined,
    };

    if (isMergedView) {
      addMergedEdge(newEdge);
      showToast('已添加跨计划连线');
    } else if (selectedGoalId) {
      addEdgeToGoal(selectedGoalId, newEdge);
      showToast('已添加连线');
    }
  }, [isMergedView, selectedGoalId, localNodes, addMergedEdge, addEdgeToGoal, showToast]);

  const onConnectStart = useCallback(() => {
    isConnectingRef.current = true;
  }, []);

  const onConnectEnd = useCallback(() => {
    isConnectingRef.current = false;
    suppressPaneClickUntilRef.current = Date.now() + 250;
  }, []);

  // Double click edge to delete dependency (RESTRICTED TO CUSTOM WORKSPACE EDGES IN MERGED VIEW ONLY)
  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (isMergedView) {
      removeEdgeFromWorkspace(edge.id, workspaceCategoryFilter);
      showToast('已移除跨计划连线');
    } else if (selectedGoalId) {
      deleteEdgeFromGoal(selectedGoalId, edge.id);
      showToast('已移除连线');
    }
  }, [isMergedView, selectedGoalId, workspaceCategoryFilter, removeEdgeFromWorkspace, deleteEdgeFromGoal, showToast]);

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

  // Create a blank task exactly where the user clicks the empty canvas.
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (isConnectingRef.current || Date.now() < suppressPaneClickUntilRef.current) {
      return;
    }

    const selectedCategoryIds = workspaceCategoryFilter === null
      ? categories.map((category) => category.id)
      : workspaceCategoryFilter;

    if (selectedCategoryIds.length === 0) {
      showToast('请先勾选至少一个任务分类');
      return;
    }

    const newTaskId = `t-quick-${Math.random().toString(36).substring(2, 9)}`;
    const targetGoal = !isMergedView && selectedGoalId ? goals[selectedGoalId] : undefined;
    const newTaskObj: Task = {
      id: newTaskId,
      title: '',
      description: '',
      duration: 0,
      isDone: false,
      categoryIds: targetGoal ? [targetGoal.category] : [...selectedCategoryIds],
      startTime: '',
      endTime: '',
      color: 'indigo'
    };
    addTask(newTaskObj);

    const newNodeId = `node-qk-${Math.random().toString(36).substring(2, 9)}`;
    const clickedPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const newGoalNode: GoalNode = {
      id: newNodeId,
      taskId: newTaskId,
      position: {
        x: clickedPosition.x - 56,
        y: clickedPosition.y - 20,
      },
    };

    if (targetGoal && selectedGoalId) {
      addNodeToGoal(selectedGoalId, newGoalNode);
    } else {
      addWorkspaceNode(newGoalNode);
    }
  }, [workspaceCategoryFilter, categories, isMergedView, selectedGoalId, goals, addTask, addNodeToGoal, addWorkspaceNode, screenToFlowPosition, showToast]);

  const activeTitle = isMergedView 
    ? '合并画布' 
    : (selectedGoalId ? goals[selectedGoalId]?.title : '选择计划');

  const activeDescription = selectedGoalId ? goals[selectedGoalId]?.description : '';
  const showEmptyPlaceholder = !localNodes.some((node) => node.type === 'taskNode');

  return (
    <div className="flex-1 flex flex-col min-h-0 relative select-none">
      {showEmptyPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white/95 px-4 py-3 text-neutral-600 shadow-lg backdrop-blur-xs">
            <MousePointerClick className="h-5 w-5 shrink-0 text-purple-600" />
            <span className="text-sm font-semibold">单击空白处创建节点</span>
          </div>
        </div>
      ) : null}

      {/* 2. Topology Left Info Board & Checklist */}
      <div className="absolute top-5 left-5 z-20 max-w-xs bg-white/95 border border-neutral-200 rounded-2xl shadow-lg p-4 pointer-events-auto space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-1.5 min-w-0">
              {isMergedView ? (
                <Layers2 className="w-4 h-4 text-purple-600 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 animate-pulse" />
              )}
              <h2 className="text-xs font-bold text-neutral-800 font-sans uppercase tracking-wider truncate max-w-[140px]">
                {activeTitle}
              </h2>
            </div>
          </div>
          {activeDescription && (
            <p className="text-[10.5px] text-neutral-500 leading-relaxed font-sans">
              {activeDescription}
            </p>
          )}
        </div>
      </div>

      {/* 5. Apple Style Highly Prominent Zoom Control Panel with Button labels */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 bg-white border-2 border-purple-600/30 p-2 rounded-2xl shadow-xl pointer-events-auto select-none">
        <button 
          onClick={() => zoomIn()}
          className="flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-purple-600 hover:text-white text-neutral-700 transition-all cursor-pointer font-bold gap-1 shadow-sm group"
          title="放大画布 (Zoom In)"
        >
          <ZoomIn className="w-4 h-4 text-purple-600 group-hover:text-white" />
          <span className="text-[11px] px-0.5">放大</span>
        </button>
        <button 
          onClick={() => zoomOut()}
          className="flex items-center justify-center p-2 rounded-xl bg-neutral-100 hover:bg-purple-600 hover:text-white text-neutral-700 transition-all cursor-pointer font-bold gap-1 shadow-sm group"
          title="缩小画布 (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4 text-purple-600 group-hover:text-white" />
          <span className="text-[11px] px-0.5">缩小</span>
        </button>
        <div className="w-px h-6 bg-neutral-200 mx-1.5" />
        <button 
          onClick={() => fitView({ padding: 0.25, duration: 500 })}
          className="flex items-center justify-center py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-600 transition-all cursor-pointer font-extrabold text-xs gap-1 shadow-sm"
          title="重置缩放以展示所有节点 (Fit View)"
        >
          <Maximize className="w-4 h-4 animate-in" />
          <span>适应全屏</span>
        </button>
      </div>

      {/* 6. Real React Flow Canvas */}
      <div
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
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ stroke: '#8d78d5', strokeWidth: 2.25 }}
          connectionRadius={28}
          zoomOnDoubleClick={false}
          onPaneClick={handlePaneClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodesDelete={onNodesDelete}
          nodesDeletable={!isMergedView}
          fitView
          minZoom={0.15}
          maxZoom={1.5}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            color="#d9ddea" 
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
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
      <ReactFlowProvider>
        <DAGInnerWorkspace />
      </ReactFlowProvider>
    </div>
  );
};
