import React, { useMemo, useState } from 'react';
import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { Task, TodoItem, TodoLane } from '../types';

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
  taskId?: string;
  parentTaskId?: string | null;
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
  onRemove: () => void;
  onToggle: () => void;
}> = ({ item, task, x, y, onRemove, onToggle }) => {
  const draggable = useDraggable({ id: `todo-drag-${item.taskId}`, data: { taskId: item.taskId } });
  const childDrop = useDroppable({ id: `todo-child-${item.taskId}`, data: { kind: 'child', laneId: item.laneId, taskId: item.taskId } });
  const style: React.CSSProperties = {
    left: x,
    top: y,
    visibility: draggable.isDragging ? 'hidden' : 'visible',
  };

  return (
    <div ref={draggable.setNodeRef} style={style} className="absolute z-10 flex w-[108px] flex-col items-center">
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
        <button type="button" onClick={onRemove} className="absolute -right-5 -top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-neutral-300 opacity-0 shadow-sm transition-opacity hover:text-rose-500 group-hover:opacity-100" title="从 Todo 移除"><X className="h-2.5 w-2.5" /></button>
      </div>
      <div className="mt-1.5 flex max-w-full items-center gap-0.5 text-center text-[10px] font-semibold leading-3.5 text-neutral-700">
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-neutral-300" />
        <span className={`line-clamp-2 ${task.isDone ? 'text-emerald-600' : ''}`}>{task.title || '未命名任务'}</span>
      </div>
    </div>
  );
};

const BeforeDrop: React.FC<{ laneId: string; parentTaskId: string | null; taskId: string; x: number; y: number }> = ({ laneId, parentTaskId, taskId, x, y }) => {
  const drop = useDroppable({ id: `todo-before-${taskId}`, data: { kind: 'before', laneId, parentTaskId, taskId } });
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
    const siblings = childrenByParent.get(item.parentTaskId) || [];
    siblings.push(item);
    childrenByParent.set(item.parentTaskId, siblings);
  });
  childrenByParent.forEach((siblings) => siblings.sort((a, b) => a.order - b.order));

  const nodes: LayoutNode[] = [];
  const edges: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  let nextColumn = 0;

  const visit = (item: TodoItem, depth: number): number => {
    const children = childrenByParent.get(item.taskId) || [];
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
      const childNode = nodes.find((node) => node.item.taskId === child.taskId);
      if (childNode) edges.push({ fromX: x + ITEM_WIDTH / 2, fromY: y + DOT_CENTER_Y, toX: childNode.x + ITEM_WIDTH / 2, toY: childNode.y + DOT_CENTER_Y });
    });
    return x;
  };

  const roots = childrenByParent.get(null) || [];
  roots.forEach((root) => visit(root, 0));
  const rootNodes = roots.map((root) => nodes.find((node) => node.item.taskId === root.taskId)).filter(Boolean) as LayoutNode[];
  rootNodes.slice(1).forEach((node, index) => edges.push({ fromX: rootNodes[index].x + ITEM_WIDTH / 2, fromY: DOT_CENTER_Y, toX: node.x + ITEM_WIDTH / 2, toY: DOT_CENTER_Y }));
  return { nodes, edges, width: Math.max(600, nextColumn * (ITEM_WIDTH + ITEM_GAP) + 60), height: Math.max(110, (Math.max(0, ...nodes.map((node) => node.y)) + ROW_HEIGHT)) };
};

const TodoLaneGraph: React.FC<{ lane: TodoLane; isMain: boolean }> = ({ lane, isMain }) => {
  const tasks = useAppStore((state) => state.tasks);
  const allItems = useAppStore((state) => state.todoItems);
  const renameLane = useAppStore((state) => state.renameTodoLane);
  const deleteLane = useAppStore((state) => state.deleteTodoLane);
  const removeTask = useAppStore((state) => state.removeTaskFromTodo);
  const updateTask = useAppStore((state) => state.updateTask);
  const items = useMemo(() => allItems.filter((item) => item.laneId === lane.id && tasks[item.taskId]), [allItems, lane.id, tasks]);
  const layout = useMemo(() => buildLaneLayout(items), [items]);
  const laneDrop = useDroppable({ id: `todo-lane-${lane.id}`, data: { kind: 'lane', laneId: lane.id } });

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/85 shadow-sm">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 px-5">
        <div className="flex min-w-0 items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${isMain ? 'bg-purple-500' : 'bg-sky-400'}`} /><input value={lane.name} onChange={(event) => renameLane(lane.id, event.target.value)} className="min-w-0 bg-transparent text-sm font-bold text-neutral-800 outline-none" aria-label="Todo 分类名称" /></div>
        {!isMain ? <button type="button" onClick={() => deleteLane(lane.id)} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-neutral-400 hover:bg-rose-50 hover:text-rose-500" title="删除分线并移回主线"><Trash2 className="h-3.5 w-3.5" />删除分线</button> : null}
      </header>
      <div ref={laneDrop.setNodeRef} className={`min-h-[158px] overflow-x-auto p-6 custom-scrollbar ${laneDrop.isOver ? 'bg-purple-50/40 ring-2 ring-inset ring-purple-200' : ''}`}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {items.length === 0 ? <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">把任务拖到这里，或从工作区加入 Todo</div> : null}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {layout.edges.map((edge, index) => <path key={`${edge.fromX}-${edge.toX}-${index}`} d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`} fill="none" stroke="#aeb6c5" strokeWidth="2.5" strokeLinecap="round" />)}
          </svg>
          {layout.nodes.map((node) => <React.Fragment key={node.item.taskId}><BeforeDrop laneId={lane.id} parentTaskId={node.item.parentTaskId} taskId={node.item.taskId} x={node.x - 8} y={node.y - 11} /><DraggableTodoNode item={node.item} task={tasks[node.item.taskId]} x={node.x} y={node.y} onRemove={() => removeTask(node.item.taskId)} onToggle={() => updateTask(node.item.taskId, { isDone: !tasks[node.item.taskId].isDone })} /></React.Fragment>)}
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
    const taskId = (event.active.data.current as { taskId?: string } | undefined)?.taskId;
    const target = getDropData(event);
    setActiveTaskId(null);
    if (!taskId || !target?.laneId) return;
    if (target.kind === 'child' && target.taskId) moveItem(taskId, target.laneId, target.taskId);
    else if (target.kind === 'before') moveItem(taskId, target.laneId, target.parentTaskId || null, target.taskId);
    else if (target.kind === 'lane') moveItem(taskId, target.laneId, null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={todoCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTaskId(null)}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-6 custom-scrollbar">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-neutral-800">Todo 执行路线</h2><p className="mt-1 text-xs text-neutral-500">拖到其他主线或分线的空白区域即可转移；拖到圆点成为子任务，拖到圆点前调整顺序。</p></div><button type="button" onClick={() => addLane()} className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600"><Plus className="h-4 w-4" />新增分线</button></div>
          {lanes.map((lane, index) => <TodoLaneGraph key={lane.id} lane={lane} isMain={index === 0} />)}
        </div>
      </div>
      <DragOverlay modifiers={[snapOverlayCenterToCursor]}>{activeTaskId && tasks[activeTaskId] ? <TodoDot task={tasks[activeTaskId]} active /> : null}</DragOverlay>
    </DndContext>
  );
};
