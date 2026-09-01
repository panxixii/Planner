import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { Check, CopyPlus, GripVertical, Network, PanelRightOpen, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { Goal, GoalEdge, GoalNode, Task, TodoItem, TodoLane, WorkspaceComponent, WorkspaceDirectory } from '../types';
import { getComponentLabel, getDirectoryDescendantTaskIds, getWorkspaceGraph } from '../workspaceComponents';

const ITEM_WIDTH = 108;
const ITEM_GAP = 28;
const ROW_HEIGHT = 84;
const DOT_CENTER_Y = 16;
const SYNC_ITEM_PREFIX = 'todo-sync-';

const todoCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  if (collisions.length === 0) return collisions;
  const getContainer = (id: string | number) => args.droppableContainers.find((container) => container.id === id);
  const pointerY = args.pointerCoordinates?.y;
  const laneUnderPointer = collisions.find((collision) => {
    if (!String(collision.id).startsWith('todo-lane-') || pointerY === undefined) return false;
    const rect = getContainer(collision.id)?.rect.current;
    return Boolean(rect && pointerY >= rect.top && pointerY <= rect.bottom);
  });
  const preciseCollisions = collisions.filter((collision) => !String(collision.id).startsWith('todo-lane-'));
  if (laneUnderPointer) {
    const laneId = (getContainer(laneUnderPointer.id)?.data.current as { laneId?: string } | undefined)?.laneId;
    const preciseInLane = preciseCollisions.filter((collision) => (
      (getContainer(collision.id)?.data.current as { laneId?: string } | undefined)?.laneId === laneId
    ));
    return preciseInLane.length > 0 ? preciseInLane : [laneUnderPointer];
  }
  return preciseCollisions.length > 0 ? preciseCollisions : collisions;
};

const snapOverlayCenterToCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (
    !activatorEvent
    || !activeNodeRect
    || !overlayNodeRect
    || !('clientX' in activatorEvent)
    || !('clientY' in activatorEvent)
  ) {
    return transform;
  }

  return {
    ...transform,
    x: transform.x + Number(activatorEvent.clientX) - activeNodeRect.left - overlayNodeRect.width / 2,
    y: transform.y + Number(activatorEvent.clientY) - activeNodeRect.top - overlayNodeRect.height / 2,
  };
};

const getDropData = (event: DragEndEvent) => event.over?.data.current as {
  kind?: 'lane' | 'before' | 'child';
  laneId?: string;
  itemId?: string;
  parentItemId?: string | null;
} | undefined;

const TodoDot: React.FC<{ task: Task; isDone?: boolean; active?: boolean }> = ({ task, isDone = task.isDone, active = false }) => (
  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-sm transition-all ${isDone ? 'border-emerald-400 bg-emerald-400 text-white shadow-emerald-200' : 'border-neutral-300 bg-white text-neutral-300'} ${active ? 'scale-110 shadow-lg' : ''}`}>
    {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
  </div>
);

const DraggableTodoNode: React.FC<{
  item: TodoItem;
  task: Task;
  x: number;
  y: number;
  lanes: TodoLane[];
  components: WorkspaceComponent[];
  isSynced: boolean;
  acceptsChildren: boolean;
  onOpenDetails: () => void;
  onToggleAssignment: (componentId: string) => void;
  onDuplicate: (laneId: string) => void;
  onDuplicateToNewLane: () => void;
  onRemove: () => void;
  onToggle: () => void;
  onRename: (title: string) => void;
}> = ({ item, task, x, y, lanes, components, isSynced, acceptsChildren, onOpenDetails, onToggleAssignment, onDuplicate, onDuplicateToNewLane, onRemove, onToggle, onRename }) => {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [isDuplicateMenuOpen, setIsDuplicateMenuOpen] = useState(false);
  const [isAssignmentMenuOpen, setIsAssignmentMenuOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const effectiveIsDone = isSynced ? task.isDone : item.isDone;
  const draggable = useDraggable({ id: `todo-drag-${item.id}`, data: { itemId: item.id, taskId: item.taskId, isSynced, isDone: effectiveIsDone } });
  const childDrop = useDroppable({ id: `todo-child-${item.id}`, data: { kind: 'child', laneId: item.laneId, itemId: item.id }, disabled: !acceptsChildren });
  const style: React.CSSProperties = {
    left: x,
    top: y,
    visibility: draggable.isDragging ? 'hidden' : 'visible',
  };

  useEffect(() => {
    if (!isEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    if (!showActions && !isEditing) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (nodeRef.current?.contains(target) || portalMenuRef.current?.contains(target)) return;
      setShowActions(false);
      setIsDuplicateMenuOpen(false);
      setIsAssignmentMenuOpen(false);
      if (isEditing) {
        const nextTitle = draftTitle.trim() || '未命名任务';
        if (nextTitle !== task.title) onRename(nextTitle);
        setIsEditing(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [draftTitle, isEditing, onRename, showActions, task.title]);

  const startEditing = () => {
    setShowActions(false);
    setIsDuplicateMenuOpen(false);
    setIsAssignmentMenuOpen(false);
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  const commitTitle = () => {
    const nextTitle = draftTitle.trim() || '未命名任务';
    if (nextTitle !== task.title) onRename(nextTitle);
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isDuplicateMenuOpen && !isAssignmentMenuOpen) return;
    const updatePosition = () => {
      const rect = actionBarRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = isAssignmentMenuOpen ? 176 : 160;
      const estimatedHeight = isAssignmentMenuOpen ? Math.min(260, 48 + components.length * 32) : Math.min(260, 76 + lanes.length * 28);
      const opensUpward = rect.bottom + 6 + estimatedHeight > window.innerHeight - 8;
      setMenuPosition({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left)),
        top: Math.max(8, opensUpward ? rect.top - estimatedHeight - 6 : rect.bottom + 6),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [components.length, isAssignmentMenuOpen, isDuplicateMenuOpen, lanes.length]);

  useEffect(() => {
    if (!isDuplicateMenuOpen && !isAssignmentMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (actionBarRef.current?.contains(target) || portalMenuRef.current?.contains(target)) return;
      setIsDuplicateMenuOpen(false);
      setIsAssignmentMenuOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isAssignmentMenuOpen, isDuplicateMenuOpen]);

  const portalMenu = typeof document === 'undefined' ? null : createPortal(
    isAssignmentMenuOpen ? (
      <div ref={portalMenuRef} className="custom-scrollbar fixed z-[10050] max-h-[260px] w-44 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 shadow-xl" style={menuPosition} onPointerDown={(event) => event.stopPropagation()}>
        <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400">工作区归属</div>
        {components.length === 0 ? <div className="px-2 py-2 text-[11px] text-neutral-400">暂无联通块</div> : null}
        {components.map((component, index) => {
          const isAssigned = (task.componentIds || []).includes(component.id);
          return <button key={component.id} type="button" onClick={() => onToggleAssignment(component.id)} className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] ${isAssigned ? 'bg-purple-50 font-semibold text-purple-700' : 'text-neutral-600 hover:bg-neutral-50'}`} title={getComponentLabel(component, index)}><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: component.color }} /><span className="min-w-0 flex-1 truncate">{getComponentLabel(component, index)}</span>{isAssigned ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}</button>;
        })}
      </div>
    ) : isDuplicateMenuOpen ? (
      <div ref={portalMenuRef} className="custom-scrollbar fixed z-[10050] max-h-[260px] w-40 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 shadow-xl" style={menuPosition} onPointerDown={(event) => event.stopPropagation()}>
        <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400">分身到</div>
        {lanes.map((lane) => <button key={lane.id} type="button" onClick={() => { onDuplicate(lane.id); setIsDuplicateMenuOpen(false); }} className="flex h-7 w-full items-center truncate rounded px-2 text-left text-[11px] text-neutral-600 hover:bg-purple-50 hover:text-purple-700" title={lane.name}><span className="truncate">{lane.name}{lane.id === item.laneId ? '（当前）' : ''}</span></button>)}
        <button type="button" onClick={() => { onDuplicateToNewLane(); setIsDuplicateMenuOpen(false); }} className="mt-1 flex h-7 w-full items-center gap-1 border-t border-neutral-100 px-2 text-left text-[11px] font-semibold text-sky-600 hover:bg-sky-50"><Plus className="h-3 w-3" />新建分线</button>
      </div>
    ) : null,
    document.body,
  );

  return (
    <div
      ref={(element) => {
        draggable.setNodeRef(element);
        nodeRef.current = element;
      }}
      data-todo-node="true"
      style={style}
      className={`absolute z-10 flex w-[108px] flex-col items-center hover:z-40 focus-within:z-40 ${showActions ? 'z-40' : ''}`}
      onClick={(event) => {
        if (event.detail > 1 || isEditing) return;
        event.stopPropagation();
        setIsDuplicateMenuOpen(false);
        setIsAssignmentMenuOpen(false);
        setShowActions((open) => !open);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startEditing();
      }}
      title="单击显示节点操作，双击编辑标题"
    >
      <div className="group relative">
        <button
          ref={childDrop.setNodeRef}
          type="button"
          {...draggable.listeners}
          {...draggable.attributes}
          className={`cursor-grab rounded-full outline-none active:cursor-grabbing ${childDrop.isOver ? 'ring-4 ring-purple-200' : ''}`}
          title="拖动调整顺序；单击显示操作；将其他任务拖到这里可设为子任务"
        >
          <TodoDot task={task} isDone={effectiveIsDone} />
        </button>
        <div
          ref={actionBarRef}
          className={`absolute left-9 top-0 z-30 flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5 shadow-md transition-opacity ${showActions ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onToggle} className={`flex h-6 w-6 items-center justify-center rounded ${effectiveIsDone ? 'bg-emerald-50 text-emerald-600' : 'text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600'}`} title={effectiveIsDone ? '标记为未完成' : '标记为完成'} aria-label={effectiveIsDone ? '标记为未完成' : '标记为完成'}><Check className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onOpenDetails} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title="打开任务详情" aria-label="打开任务详情"><PanelRightOpen className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { setIsAssignmentMenuOpen((open) => !open); setIsDuplicateMenuOpen(false); }} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title="设置工作区归属" aria-label="设置工作区归属" aria-expanded={isAssignmentMenuOpen}><Network className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { setIsDuplicateMenuOpen((open) => !open); setIsAssignmentMenuOpen(false); }} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-sky-50 hover:text-sky-600" title="创建分身" aria-label="创建分身" aria-expanded={isDuplicateMenuOpen}><CopyPlus className="h-3.5 w-3.5" /></button>
          {!isSynced ? <button type="button" onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-500" title="从当前分线移除" aria-label="从当前分线移除"><X className="h-3.5 w-3.5" /></button> : null}
        </div>
      </div>
      {portalMenu}
      <div className="mt-1.5 flex max-w-full items-center gap-0.5 text-center text-[10px] font-semibold leading-3.5 text-neutral-700">
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-neutral-300" />
        {isEditing ? (
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setDraftTitle(task.title);
                setIsEditing(false);
              }
            }}
            className="w-[90px] rounded border border-purple-200 bg-white px-1 py-0.5 text-center text-[10px] font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-purple-100"
            aria-label="任务标题"
          />
        ) : (
          <span className={`line-clamp-2 ${effectiveIsDone ? 'text-emerald-600' : ''}`}>{task.title || '未命名任务'}</span>
        )}
      </div>
    </div>
  );
};

const BeforeDrop: React.FC<{ laneId: string; parentItemId: string | null; itemId: string; x: number; y: number }> = ({ laneId, parentItemId, itemId, x, y }) => {
  const drop = useDroppable({ id: `todo-before-${itemId}`, data: { kind: 'before', laneId, parentItemId, itemId } });
  return <div ref={drop.setNodeRef} className={`absolute z-20 h-14 w-5 -translate-x-1/2 rounded-full transition-colors ${drop.isOver ? 'bg-purple-200/80' : 'bg-transparent'}`} style={{ left: x, top: y }} />;
};

interface LayoutNode {
  item: TodoItem;
  x: number;
  y: number;
}

const buildLaneLayout = (items: TodoItem[]) => {
  const childrenByParent = new Map<string | null, TodoItem[]>();
  items.forEach((item) => {
    const siblings = childrenByParent.get(item.parentItemId) || [];
    siblings.push(item);
    childrenByParent.set(item.parentItemId, siblings);
  });
  childrenByParent.forEach((siblings) => siblings.sort((a, b) => a.order - b.order));

  const nodes: LayoutNode[] = [];
  const edges: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  let nextColumn = 0;

  const visit = (item: TodoItem, depth: number): number => {
    const children = childrenByParent.get(item.id) || [];
    let x: number;
    if (children.length === 0) {
      x = nextColumn * (ITEM_WIDTH + ITEM_GAP);
      nextColumn += 1;
    } else {
      const childXs = children.map((child) => visit(child, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
      nextColumn = Math.max(nextColumn, Math.ceil(x / (ITEM_WIDTH + ITEM_GAP)) + 1);
    }
    const y = depth * ROW_HEIGHT;
    nodes.push({ item, x, y });
    children.forEach((child) => {
      const childNode = nodes.find((node) => node.item.id === child.id);
      if (childNode) edges.push({ fromX: x + ITEM_WIDTH / 2, fromY: y + DOT_CENTER_Y, toX: childNode.x + ITEM_WIDTH / 2, toY: childNode.y + DOT_CENTER_Y });
    });
    return x;
  };

  const roots = childrenByParent.get(null) || [];
  roots.forEach((root) => visit(root, 0));
  const rootNodes = roots.map((root) => nodes.find((node) => node.item.id === root.id)).filter(Boolean) as LayoutNode[];
  rootNodes.slice(1).forEach((node, index) => edges.push({ fromX: rootNodes[index].x + ITEM_WIDTH / 2, fromY: DOT_CENTER_Y, toX: node.x + ITEM_WIDTH / 2, toY: DOT_CENTER_Y }));
  return { nodes, edges, width: Math.max(600, nextColumn * (ITEM_WIDTH + ITEM_GAP) + 60), height: Math.max(110, (Math.max(0, ...nodes.map((node) => node.y)) + ROW_HEIGHT)) };
};

const buildSyncedTodoItems = (
  lane: TodoLane,
  tasks: Record<string, Task>,
  directories: WorkspaceDirectory[],
  goals: Record<string, Goal>,
  workspaceNodes: GoalNode[],
  mergedEdges: GoalEdge[],
  mergedNodePositions: Record<string, { x: number; y: number }>,
): TodoItem[] => {
  if (lane.type !== 'category-sync' || !lane.directoryId) return [];
  const directory = directories.find((item) => item.id === lane.directoryId);
  if (!directory) return [];
  const graph = getWorkspaceGraph(goals, workspaceNodes, mergedEdges, {
    ...mergedNodePositions,
    ...Object.fromEntries(directories.map((item) => [item.id, mergedNodePositions[item.id] || item.position])),
  });
  const taskIds = getDirectoryDescendantTaskIds(directory.id, directories, graph);
  const nodeIdByTaskId = new Map<string, string>();
  graph.nodeTaskIds.forEach((taskId, nodeId) => { if (taskIds.has(taskId) && !nodeIdByTaskId.has(taskId)) nodeIdByTaskId.set(taskId, nodeId); });
  const positions = new Map<string, { x: number; y: number }>();
  nodeIdByTaskId.forEach((nodeId, taskId) => { const position = graph.nodePositions.get(nodeId); if (position) positions.set(taskId, position); });
  const parentByTaskId = new Map<string, string>();
  graph.edges.forEach((edge) => {
    const sourceTaskId = graph.nodeTaskIds.get(edge.source);
    const targetTaskId = graph.nodeTaskIds.get(edge.target);
    const sourcePosition = graph.nodePositions.get(edge.source);
    const targetPosition = graph.nodePositions.get(edge.target);
    if (!sourceTaskId || !targetTaskId || !sourcePosition || !targetPosition || !taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) return;
    const parentId = sourcePosition.x <= targetPosition.x ? sourceTaskId : targetTaskId;
    const childId = parentId === sourceTaskId ? targetTaskId : sourceTaskId;
    if (!parentByTaskId.has(childId)) parentByTaskId.set(childId, parentId);
  });
  taskIds.forEach((taskId) => {
    const visited = new Set([taskId]);
    let ancestorId = parentByTaskId.get(taskId);
    while (ancestorId) {
      if (visited.has(ancestorId)) {
        parentByTaskId.delete(taskId);
        break;
      }
      visited.add(ancestorId);
      ancestorId = parentByTaskId.get(ancestorId);
    }
  });
  const itemIdByTaskId = new Map(Array.from(taskIds).map((taskId) => [taskId, `${SYNC_ITEM_PREFIX}${lane.id}-${taskId}`]));
  const siblingOrder = new Map<string | null, string[]>();
  taskIds.forEach((taskId) => {
    const parentId = parentByTaskId.get(taskId) || null;
    const siblings = siblingOrder.get(parentId) || [];
    siblings.push(taskId);
    siblingOrder.set(parentId, siblings);
  });
  siblingOrder.forEach((siblings) => siblings.sort((left, right) => {
    const leftPosition = positions.get(left) || { x: 0, y: 0 };
    const rightPosition = positions.get(right) || { x: 0, y: 0 };
    return leftPosition.y - rightPosition.y || leftPosition.x - rightPosition.x;
  }));
  return Array.from(taskIds).flatMap((taskId) => tasks[taskId] ? [{
    id: itemIdByTaskId.get(taskId)!,
    taskId,
    laneId: lane.id,
    parentItemId: parentByTaskId.has(taskId) ? itemIdByTaskId.get(parentByTaskId.get(taskId)!) || null : null,
    order: (siblingOrder.get(parentByTaskId.get(taskId) || null) || []).indexOf(taskId),
    isDone: tasks[taskId].isDone,
  }] : []);
};

const TodoLaneGraph: React.FC<{ lane: TodoLane; isMain: boolean; isDragging: boolean; isDragOver: boolean; onLaneDragStart: (event: React.DragEvent<HTMLElement>) => void; onLaneDragOver: (event: React.DragEvent<HTMLElement>) => void; onLaneDrop: (event: React.DragEvent<HTMLElement>) => void; onLaneDragEnd: () => void }> = ({ lane, isMain, isDragging, isDragOver, onLaneDragStart, onLaneDragOver, onLaneDrop, onLaneDragEnd }) => {
  const tasks = useAppStore((state) => state.tasks);
  const allItems = useAppStore((state) => state.todoItems);
  const lanes = useAppStore((state) => state.todoLanes);
  const components = useAppStore((state) => state.workspaceComponents);
  const directories = useAppStore((state) => state.workspaceDirectories);
  const goals = useAppStore((state) => state.goals);
  const workspaceNodes = useAppStore((state) => state.workspaceNodes);
  const mergedEdges = useAppStore((state) => state.mergedEdges);
  const mergedNodePositions = useAppStore((state) => state.mergedNodePositions);
  const setLaneDirectory = useAppStore((state) => state.setTodoLaneDirectory);
  const renameLane = useAppStore((state) => state.renameTodoLane);
  const deleteLane = useAppStore((state) => state.deleteTodoLane);
  const addLane = useAppStore((state) => state.addTodoLane);
  const createTodoTask = useAppStore((state) => state.createTodoTask);
  const toggleTodoTaskComponent = useAppStore((state) => state.toggleTodoTaskComponent);
  const duplicateItem = useAppStore((state) => state.duplicateTodoItem);
  const removeItem = useAppStore((state) => state.removeTodoItem);
  const copyTaskToLane = useAppStore((state) => state.copyTaskToTodoLane);
  const toggleItemDone = useAppStore((state) => state.toggleTodoItemDone);
  const selectTask = useAppStore((state) => state.selectTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const isSynced = lane.type === 'category-sync';
  const items = useMemo(() => isSynced
    ? buildSyncedTodoItems(lane, tasks, directories, goals, workspaceNodes, mergedEdges, mergedNodePositions)
    : allItems.filter((item) => item.laneId === lane.id && tasks[item.taskId]),
  [allItems, directories, goals, isSynced, lane, mergedEdges, mergedNodePositions, tasks, workspaceNodes]);
  const layout = useMemo(() => buildLaneLayout(items), [items]);
  const laneDrop = useDroppable({ id: `todo-lane-${lane.id}`, data: { kind: 'lane', laneId: lane.id }, disabled: isSynced });

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-todo-node="true"], button, input, select')) return;
    if (isSynced) return;
    const taskId = createTodoTask(lane.id);
    if (taskId) selectTask(taskId);
  };

  return (
    <section onDragOver={onLaneDragOver} onDrop={onLaneDrop} className={`rounded-2xl border bg-white/85 shadow-sm transition-all ${isDragOver ? 'border-purple-400 ring-2 ring-purple-100' : 'border-neutral-200'} ${isDragging ? 'opacity-45' : ''}`}>
      <header draggable={lane.type === 'custom'} onDragStart={onLaneDragStart} onDragEnd={onLaneDragEnd} className={`flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 px-5 py-2 ${lane.type === 'custom' ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <div className="flex min-w-0 items-center gap-3"><GripVertical className={`h-4 w-4 shrink-0 ${lane.type === 'custom' ? 'text-neutral-300' : 'text-neutral-200'}`} /><span className={`h-2.5 w-2.5 rounded-full ${isMain ? 'bg-purple-500' : isSynced ? 'bg-emerald-400' : 'bg-sky-400'}`} />{lane.type === 'custom' ? <input value={lane.name} draggable={false} onClick={(event) => event.stopPropagation()} onFocus={beginHistoryGroup} onChange={(event) => renameLane(lane.id, event.target.value)} onBlur={endHistoryGroup} className="min-w-0 bg-transparent text-sm font-bold text-neutral-800 outline-none" aria-label="Todo 分类名称" /> : <span className="truncate text-sm font-bold text-neutral-800">{lane.name}</span>}</div>
        <div className="flex shrink-0 items-center gap-2">{isSynced ? <label draggable={false} className="flex items-center gap-2 text-[11px] font-medium text-neutral-500"><span>查看目录</span><select value={lane.directoryId || ''} onChange={(event) => setLaneDirectory(lane.id, event.target.value || null)} onPointerDown={(event) => event.stopPropagation()} className="h-8 max-w-52 rounded-lg border border-neutral-200 bg-white px-2 text-[11px] outline-none focus:border-purple-300"><option value="">请选择目录</option>{directories.map((directory) => <option key={directory.id} value={directory.id}>{directory.name || '未命名目录'}</option>)}</select></label> : null}{lane.type === 'custom' ? <button type="button" onClick={() => deleteLane(lane.id)} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-neutral-400 hover:bg-rose-50 hover:text-rose-500" title="删除分线并移回主线"><Trash2 className="h-3.5 w-3.5" />删除分线</button> : null}</div>
      </header>
      <div ref={laneDrop.setNodeRef} onDoubleClick={handleCanvasDoubleClick} className={`min-h-[158px] overflow-x-auto p-6 custom-scrollbar ${laneDrop.isOver ? 'bg-purple-50/40 ring-2 ring-inset ring-purple-200' : ''}`} title="双击空白处创建任务">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {items.length === 0 ? <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">{isSynced && !lane.directoryId ? '请选择要同步查看的目录' : '暂无任务'}</div> : null}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {layout.edges.map((edge, index) => <path key={`${edge.fromX}-${edge.toX}-${index}`} d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`} fill="none" stroke="#aeb6c5" strokeWidth="2.5" strokeLinecap="round" />)}
          </svg>
          {layout.nodes.map((node) => <React.Fragment key={node.item.id}>{!isSynced ? <BeforeDrop laneId={lane.id} parentItemId={node.item.parentItemId} itemId={node.item.id} x={node.x - 8} y={node.y - 11} /> : null}<DraggableTodoNode item={node.item} task={tasks[node.item.taskId]} x={node.x} y={node.y} lanes={lanes.filter((targetLane) => targetLane.type !== 'category-sync')} components={components} isSynced={isSynced} acceptsChildren={!isSynced} onOpenDetails={() => selectTask(node.item.taskId)} onToggleAssignment={(componentId) => toggleTodoTaskComponent(node.item.taskId, componentId)} onDuplicate={(targetLaneId) => isSynced ? copyTaskToLane(node.item.taskId, targetLaneId) : duplicateItem(node.item.id, targetLaneId)} onDuplicateToNewLane={() => { const targetLaneId = addLane(`${tasks[node.item.taskId].title || '任务'}分线`); if (isSynced) copyTaskToLane(node.item.taskId, targetLaneId); else duplicateItem(node.item.id, targetLaneId); }} onRemove={() => removeItem(node.item.id)} onToggle={() => isSynced ? updateTask(node.item.taskId, { isDone: !tasks[node.item.taskId].isDone }) : toggleItemDone(node.item.id)} onRename={(title) => updateTask(node.item.taskId, { title })} /></React.Fragment>)}
        </div>
      </div>
    </section>
  );
};

export const TodoPage: React.FC = () => {
  const lanes = useAppStore((state) => state.todoLanes);
  const tasks = useAppStore((state) => state.tasks);
  const addLane = useAppStore((state) => state.addTodoLane);
  const moveLane = useAppStore((state) => state.moveTodoLane);
  const moveItem = useAppStore((state) => state.moveTodoItem);
  const copyTaskToLane = useAppStore((state) => state.copyTaskToTodoLane);
  const [activeItem, setActiveItem] = useState<{ taskId: string; isDone: boolean } | null>(null);
  const [draggedLaneId, setDraggedLaneId] = useState<string | null>(null);
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const source = event.active.data.current as { taskId?: string; isDone?: boolean } | undefined;
    setActiveItem(source?.taskId ? { taskId: source.taskId, isDone: Boolean(source.isDone) } : null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const source = event.active.data.current as { itemId?: string; taskId?: string; isSynced?: boolean } | undefined;
    const itemId = source?.itemId;
    const target = getDropData(event);
    setActiveItem(null);
    if (!itemId || !target?.laneId) return;
    const targetLane = lanes.find((lane) => lane.id === target.laneId);
    if (!targetLane || targetLane.type === 'category-sync') return;
    if (source?.isSynced && source.taskId) {
      if (target.kind === 'child' && target.itemId) copyTaskToLane(source.taskId, target.laneId, target.itemId);
      else if (target.kind === 'before') copyTaskToLane(source.taskId, target.laneId, target.parentItemId || null, target.itemId);
      else copyTaskToLane(source.taskId, target.laneId);
      return;
    }
    if (target.kind === 'child' && target.itemId) moveItem(itemId, target.laneId, target.itemId);
    else if (target.kind === 'before') moveItem(itemId, target.laneId, target.parentItemId || null, target.itemId);
    else if (target.kind === 'lane') moveItem(itemId, target.laneId, null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={todoCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveItem(null)}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-6 custom-scrollbar">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-neutral-800">Todo</h2><button type="button" onClick={() => addLane()} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Plus className="h-4 w-4" />新增分线</button></div>
          {lanes.map((lane) => <TodoLaneGraph key={lane.id} lane={lane} isMain={lane.id === 'todo-main'} isDragging={draggedLaneId === lane.id} isDragOver={dragOverLaneId === lane.id && draggedLaneId !== lane.id} onLaneDragStart={(event) => { if (lane.type !== 'custom') { event.preventDefault(); return; } setDraggedLaneId(lane.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', lane.id); }} onLaneDragOver={(event) => { if (!draggedLaneId || draggedLaneId === lane.id || lane.type !== 'custom') return; event.preventDefault(); setDragOverLaneId(lane.id); }} onLaneDrop={(event) => { event.preventDefault(); if (draggedLaneId && draggedLaneId !== lane.id && lane.type === 'custom') moveLane(draggedLaneId, lane.id); setDraggedLaneId(null); setDragOverLaneId(null); }} onLaneDragEnd={() => { setDraggedLaneId(null); setDragOverLaneId(null); }} />)}
        </div>
      </div>
      <DragOverlay modifiers={[snapOverlayCenterToCursor]}>{activeItem && tasks[activeItem.taskId] ? <TodoDot task={tasks[activeItem.taskId]} isDone={activeItem.isDone} active /> : null}</DragOverlay>
    </DndContext>
  );
};
