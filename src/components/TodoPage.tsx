import React, { useMemo, useState } from 'react';
import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { Check, CopyPlus, GripVertical, Network, PanelRightOpen, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { Task, TodoItem, TodoLane, WorkspaceComponent } from '../types';
import { getComponentLabel } from '../workspaceComponents';

const ITEM_WIDTH = 108;
const ITEM_GAP = 28;
const ROW_HEIGHT = 84;
const DOT_CENTER_Y = 16;

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

const TodoDot: React.FC<{ task: Task; active?: boolean }> = ({ task, active = false }) => (
  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-sm transition-all ${task.isDone ? 'border-emerald-400 bg-emerald-400 text-white shadow-emerald-200' : 'border-neutral-300 bg-white text-neutral-300'} ${active ? 'scale-110 shadow-lg' : ''}`}>
    {task.isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
  </div>
);

const DraggableTodoNode: React.FC<{
  item: TodoItem;
  task: Task;
  x: number;
  y: number;
  lanes: TodoLane[];
  components: WorkspaceComponent[];
  onOpenDetails: () => void;
  onToggleAssignment: (componentId: string) => void;
  onDuplicate: (laneId: string) => void;
  onDuplicateToNewLane: () => void;
  onRemove: () => void;
  onToggle: () => void;
}> = ({ item, task, x, y, lanes, components, onOpenDetails, onToggleAssignment, onDuplicate, onDuplicateToNewLane, onRemove, onToggle }) => {
  const [isDuplicateMenuOpen, setIsDuplicateMenuOpen] = useState(false);
  const [isAssignmentMenuOpen, setIsAssignmentMenuOpen] = useState(false);
  const draggable = useDraggable({ id: `todo-drag-${item.id}`, data: { itemId: item.id, taskId: item.taskId } });
  const childDrop = useDroppable({ id: `todo-child-${item.id}`, data: { kind: 'child', laneId: item.laneId, itemId: item.id } });
  const style: React.CSSProperties = {
    left: x,
    top: y,
    visibility: draggable.isDragging ? 'hidden' : 'visible',
  };

  return (
    <div ref={draggable.setNodeRef} data-todo-node="true" style={style} className="absolute z-10 flex w-[108px] flex-col items-center hover:z-40 focus-within:z-40">
      <div className="group relative">
        <button
          ref={childDrop.setNodeRef}
          type="button"
          {...draggable.listeners}
          {...draggable.attributes}
          onClick={onToggle}
          className={`cursor-grab rounded-full outline-none active:cursor-grabbing ${childDrop.isOver ? 'ring-4 ring-purple-200' : ''}`}
          title="拖动调整顺序；将其他任务拖到这里可设为子任务"
        >
          <TodoDot task={task} />
        </button>
        <div
          className={`absolute left-9 top-0 z-30 flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5 shadow-md transition-opacity ${isDuplicateMenuOpen || isAssignmentMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={onOpenDetails} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title="打开任务详情" aria-label="打开任务详情"><PanelRightOpen className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { setIsAssignmentMenuOpen((open) => !open); setIsDuplicateMenuOpen(false); }} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600" title="设置工作区归属" aria-label="设置工作区归属" aria-expanded={isAssignmentMenuOpen}><Network className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => { setIsDuplicateMenuOpen((open) => !open); setIsAssignmentMenuOpen(false); }} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-sky-50 hover:text-sky-600" title="创建分身" aria-label="创建分身" aria-expanded={isDuplicateMenuOpen}><CopyPlus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-500" title="从当前分线移除" aria-label="从当前分线移除"><X className="h-3.5 w-3.5" /></button>
          {isAssignmentMenuOpen ? (
            <div className="absolute left-0 top-8 z-50 w-44 rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400">工作区归属</div>
              {components.length === 0 ? <div className="px-2 py-2 text-[11px] text-neutral-400">暂无联通块</div> : null}
              {components.map((component, index) => {
                const isAssigned = (task.componentIds || []).includes(component.id);
                return (
                  <button key={component.id} type="button" onClick={() => onToggleAssignment(component.id)} className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] ${isAssigned ? 'bg-purple-50 font-semibold text-purple-700' : 'text-neutral-600 hover:bg-neutral-50'}`} title={getComponentLabel(component, index)}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: component.color }} />
                    <span className="min-w-0 flex-1 truncate">{getComponentLabel(component, index)}</span>
                    {isAssigned ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {isDuplicateMenuOpen ? (
            <div className="absolute left-0 top-8 z-50 w-40 rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400">分身到</div>
              {lanes.map((lane) => (
                <button key={lane.id} type="button" onClick={() => { onDuplicate(lane.id); setIsDuplicateMenuOpen(false); }} className="flex h-7 w-full items-center truncate rounded px-2 text-left text-[11px] text-neutral-600 hover:bg-purple-50 hover:text-purple-700" title={lane.name}>
                  <span className="truncate">{lane.name}{lane.id === item.laneId ? '（当前）' : ''}</span>
                </button>
              ))}
              <button type="button" onClick={() => { onDuplicateToNewLane(); setIsDuplicateMenuOpen(false); }} className="mt-1 flex h-7 w-full items-center gap-1 rounded border-t border-neutral-100 px-2 text-left text-[11px] font-semibold text-sky-600 hover:bg-sky-50"><Plus className="h-3 w-3" />新建分线</button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex max-w-full items-center gap-0.5 text-center text-[10px] font-semibold leading-3.5 text-neutral-700">
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-neutral-300" />
        <span className={`line-clamp-2 ${task.isDone ? 'text-emerald-600' : ''}`}>{task.title || '未命名任务'}</span>
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

const TodoLaneGraph: React.FC<{ lane: TodoLane; isMain: boolean }> = ({ lane, isMain }) => {
  const tasks = useAppStore((state) => state.tasks);
  const allItems = useAppStore((state) => state.todoItems);
  const lanes = useAppStore((state) => state.todoLanes);
  const components = useAppStore((state) => state.workspaceComponents);
  const renameLane = useAppStore((state) => state.renameTodoLane);
  const deleteLane = useAppStore((state) => state.deleteTodoLane);
  const addLane = useAppStore((state) => state.addTodoLane);
  const createTodoTask = useAppStore((state) => state.createTodoTask);
  const toggleTodoTaskComponent = useAppStore((state) => state.toggleTodoTaskComponent);
  const duplicateItem = useAppStore((state) => state.duplicateTodoItem);
  const removeItem = useAppStore((state) => state.removeTodoItem);
  const selectTask = useAppStore((state) => state.selectTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const beginHistoryGroup = useAppStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useAppStore((state) => state.endHistoryGroup);
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id && tasks[item.taskId]), [allItems, lane.id, tasks]);
  const layout = useMemo(() => buildLaneLayout(items), [items]);
  const laneDrop = useDroppable({ id: `todo-lane-${lane.id}`, data: { kind: 'lane', laneId: lane.id } });

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-todo-node="true"], button, input')) return;
    const taskId = createTodoTask(lane.id);
    if (taskId) selectTask(taskId);
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/85 shadow-sm">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 px-5">
        <div className="flex min-w-0 items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${isMain ? 'bg-purple-500' : 'bg-sky-400'}`} /><input value={lane.name} onFocus={beginHistoryGroup} onChange={(event) => renameLane(lane.id, event.target.value)} onBlur={endHistoryGroup} className="min-w-0 bg-transparent text-sm font-bold text-neutral-800 outline-none" aria-label="Todo 分类名称" /></div>
        {!isMain ? <button type="button" onClick={() => deleteLane(lane.id)} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-neutral-400 hover:bg-rose-50 hover:text-rose-500" title="删除分线并移回主线"><Trash2 className="h-3.5 w-3.5" />删除分线</button> : null}
      </header>
      <div ref={laneDrop.setNodeRef} onDoubleClick={handleCanvasDoubleClick} className={`min-h-[158px] overflow-x-auto p-6 custom-scrollbar ${laneDrop.isOver ? 'bg-purple-50/40 ring-2 ring-inset ring-purple-200' : ''}`} title="双击空白处创建任务">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {items.length === 0 ? <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">暂无任务</div> : null}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {layout.edges.map((edge, index) => <path key={`${edge.fromX}-${edge.toX}-${index}`} d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`} fill="none" stroke="#aeb6c5" strokeWidth="2.5" strokeLinecap="round" />)}
          </svg>
          {layout.nodes.map((node) => <React.Fragment key={node.item.id}><BeforeDrop laneId={lane.id} parentItemId={node.item.parentItemId} itemId={node.item.id} x={node.x - 8} y={node.y - 11} /><DraggableTodoNode item={node.item} task={tasks[node.item.taskId]} x={node.x} y={node.y} lanes={lanes} components={components} onOpenDetails={() => selectTask(node.item.taskId)} onToggleAssignment={(componentId) => toggleTodoTaskComponent(node.item.taskId, componentId)} onDuplicate={(targetLaneId) => duplicateItem(node.item.id, targetLaneId)} onDuplicateToNewLane={() => { const targetLaneId = addLane(`${tasks[node.item.taskId].title || '任务'}分线`); duplicateItem(node.item.id, targetLaneId); }} onRemove={() => removeItem(node.item.id)} onToggle={() => updateTask(node.item.taskId, { isDone: !tasks[node.item.taskId].isDone })} /></React.Fragment>)}
        </div>
      </div>
    </section>
  );
};

export const TodoPage: React.FC = () => {
  const lanes = useAppStore((state) => state.todoLanes);
  const tasks = useAppStore((state) => state.tasks);
  const addLane = useAppStore((state) => state.addTodoLane);
  const moveItem = useAppStore((state) => state.moveTodoItem);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => setActiveTaskId((event.active.data.current as { taskId?: string } | undefined)?.taskId || null);
  const handleDragEnd = (event: DragEndEvent) => {
    const itemId = (event.active.data.current as { itemId?: string } | undefined)?.itemId;
    const target = getDropData(event);
    setActiveTaskId(null);
    if (!itemId || !target?.laneId) return;
    if (target.kind === 'child' && target.itemId) moveItem(itemId, target.laneId, target.itemId);
    else if (target.kind === 'before') moveItem(itemId, target.laneId, target.parentItemId || null, target.itemId);
    else if (target.kind === 'lane') moveItem(itemId, target.laneId, null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={todoCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTaskId(null)}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-6 custom-scrollbar">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-neutral-800">Todo 执行路线</h2><button type="button" onClick={() => addLane()} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Plus className="h-4 w-4" />新增分线</button></div>
          {lanes.map((lane, index) => <TodoLaneGraph key={lane.id} lane={lane} isMain={index === 0} />)}
        </div>
      </div>
      <DragOverlay modifiers={[snapOverlayCenterToCursor]}>{activeTaskId && tasks[activeTaskId] ? <TodoDot task={tasks[activeTaskId]} active /> : null}</DragOverlay>
    </DndContext>
  );
};
