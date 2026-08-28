import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MarkerType,
  Node,
  NodeChange,
  ReactFlow,
  ReactFlowProvider,
  Viewport,
  applyNodeChanges,
  useOnViewportChange,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Eraser, FilePlus2, MousePointer2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { DraftStroke, DraftStrokePoint, GoalNode, Task } from '../types';
import { ColorPicker } from './ColorPicker';
import { DraftNode } from './DraftNode';

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const distanceToSegment = (point: DraftStrokePoint, start: DraftStrokePoint, end: DraftStrokePoint) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + progress * dx), point.y - (start.y + progress * dy));
};

const eraseStrokeSegment = (
  strokes: DraftStroke[],
  eraserStart: DraftStrokePoint,
  eraserEnd: DraftStrokePoint,
  eraserRadius: number,
  zoom: number,
): DraftStroke[] => strokes.flatMap((stroke) => {
  if (stroke.points.length < 2) return [];
  const sampleSpacing = Math.max(0.75 / zoom, eraserRadius / 4);
  const sampledPoints: DraftStrokePoint[] = [];

  stroke.points.forEach((point, index) => {
    if (index === 0) {
      sampledPoints.push(point);
      return;
    }
    const previous = stroke.points[index - 1];
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / sampleSpacing));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      sampledPoints.push({
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
      });
    }
  });

  const effectiveRadius = eraserRadius + stroke.width / 2 / zoom;
  const erased = sampledPoints.map((point) => distanceToSegment(point, eraserStart, eraserEnd) <= effectiveRadius);
  if (!erased.some(Boolean)) return [stroke];

  const remainingParts: DraftStrokePoint[][] = [];
  let currentPart: DraftStrokePoint[] = [];
  sampledPoints.forEach((point, index) => {
    if (!erased[index]) {
      currentPart.push(point);
      return;
    }
    if (currentPart.length >= 2) remainingParts.push(currentPart);
    currentPart = [];
  });
  if (currentPart.length >= 2) remainingParts.push(currentPart);

  return remainingParts.map((points, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : makeId(`${stroke.id}-part`),
    points,
  }));
});

interface DraftCanvasProps {
  draftId: string;
}

const DraftCanvas: React.FC<DraftCanvasProps> = ({ draftId }) => {
  const draft = useAppStore((state) => state.drafts.find((item) => item.id === draftId));
  const tasks = useAppStore((state) => state.tasks);
  const addTask = useAppStore((state) => state.addTask);
  const addDraftNode = useAppStore((state) => state.addDraftNode);
  const updateDraftNodes = useAppStore((state) => state.updateDraftNodes);
  const removeDraftNode = useAppStore((state) => state.removeDraftNode);
  const addDraftEdge = useAppStore((state) => state.addDraftEdge);
  const removeDraftEdge = useAppStore((state) => state.removeDraftEdge);
  const addDraftStroke = useAppStore((state) => state.addDraftStroke);
  const replaceDraftStrokes = useAppStore((state) => state.replaceDraftStrokes);
  const undoDraftStroke = useAppStore((state) => state.undoDraftStroke);
  const clearDraftStrokes = useAppStore((state) => state.clearDraftStrokes);
  const { screenToFlowPosition } = useReactFlow();
  const [mode, setMode] = useState<'select' | 'draw' | 'erase'>('select');
  const [penColor, setPenColor] = useState('#8D78D5');
  const [penWidth, setPenWidth] = useState(4);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [activePoints, setActivePoints] = useState<DraftStrokePoint[]>([]);
  const activePointsRef = useRef<DraftStrokePoint[]>([]);
  const drawingPointerRef = useRef<number | null>(null);
  const eraserPointRef = useRef<DraftStrokePoint | null>(null);
  const erasedStrokesRef = useRef<DraftStroke[]>([]);
  const [eraserPoint, setEraserPoint] = useState<DraftStrokePoint | null>(null);
  const [erasedStrokesPreview, setErasedStrokesPreview] = useState<DraftStroke[] | null>(null);
  const nodeTypes = useMemo(() => ({ draftNode: DraftNode }), []);

  useOnViewportChange({ onChange: setViewport, onEnd: setViewport });

  useEffect(() => {
    if (!draft) return;
    setNodes(draft.nodes.flatMap((node): Node[] => tasks[node.taskId] ? [{
      id: node.id,
      type: 'draftNode',
      position: node.position,
      data: { draftId, taskId: node.taskId },
    }] : []));
  }, [draft, draftId, tasks]);

  const edges = useMemo<Edge[]>(() => (draft?.edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'bezier',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    interactionWidth: 28,
  })), [draft?.edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const createNode = useCallback((event: React.MouseEvent) => {
    if (!draft || mode !== 'select') return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const taskId = makeId('task-draft');
    const nodeId = makeId('node-draft');
    const task: Task = {
      id: taskId,
      title: '',
      description: '',
      duration: 0,
      isDone: false,
      statusId: 'status-not-started',
      componentIds: [],
      color: 'indigo',
    };
    const node: GoalNode = { id: nodeId, taskId, position: { x: position.x - 56, y: position.y - 20 } };
    addTask(task);
    addDraftNode(draft.id, node);
  }, [addDraftNode, addTask, draft, mode, screenToFlowPosition]);

  const finishNodeDrag = useCallback((_event: React.MouseEvent, changedNode: Node) => {
    if (!draft) return;
    updateDraftNodes(draft.id, draft.nodes.map((node) => node.id === changedNode.id ? { ...node, position: changedNode.position } : node));
  }, [draft, updateDraftNodes]);

  const connectNodes = useCallback((connection: Connection) => {
    if (!draft || !connection.source || !connection.target || connection.source === connection.target) return;
    if (draft.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return;
    addDraftEdge(draft.id, { id: makeId('edge-draft'), source: connection.source, target: connection.target });
  }, [addDraftEdge, draft]);

  const pointFromPointer = useCallback((event: React.PointerEvent<SVGSVGElement>) => (
    screenToFlowPosition({ x: event.clientX, y: event.clientY })
  ), [screenToFlowPosition]);

  const eraseToPoint = useCallback((point: DraftStrokePoint) => {
    const previousPoint = eraserPointRef.current || point;
    const nextStrokes = eraseStrokeSegment(erasedStrokesRef.current, previousPoint, point, 10 / viewport.zoom, viewport.zoom);
    eraserPointRef.current = point;
    erasedStrokesRef.current = nextStrokes;
    setEraserPoint(point);
    setErasedStrokesPreview(nextStrokes);
  }, [viewport.zoom]);

  const beginStroke = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!draft || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointerRef.current = event.pointerId;
    const firstPoint = pointFromPointer(event);
    if (mode === 'erase') {
      erasedStrokesRef.current = draft.strokes;
      eraserPointRef.current = firstPoint;
      setErasedStrokesPreview(draft.strokes);
      eraseToPoint(firstPoint);
      return;
    }
    const points = [firstPoint];
    activePointsRef.current = points;
    setActivePoints(points);
  }, [draft, eraseToPoint, mode, pointFromPointer]);

  const extendStroke = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointFromPointer(event);
    if (drawingPointerRef.current !== event.pointerId) {
      if (mode === 'erase') setEraserPoint(point);
      return;
    }
    if (mode === 'erase') {
      eraseToPoint(point);
      return;
    }
    const previous = activePointsRef.current.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5 / viewport.zoom) return;
    const nextPoints = [...activePointsRef.current, point];
    activePointsRef.current = nextPoints;
    setActivePoints(nextPoints);
  }, [eraseToPoint, mode, pointFromPointer, viewport.zoom]);

  const finishStroke = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!draft || drawingPointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (mode === 'erase') {
      replaceDraftStrokes(draft.id, erasedStrokesRef.current);
      erasedStrokesRef.current = [];
      eraserPointRef.current = null;
      setErasedStrokesPreview(null);
      setEraserPoint(null);
      drawingPointerRef.current = null;
      return;
    }
    const points = activePointsRef.current;
    if (points.length > 1) addDraftStroke(draft.id, { id: makeId('stroke'), color: penColor, width: penWidth, points });
    drawingPointerRef.current = null;
    activePointsRef.current = [];
    setActivePoints([]);
  }, [addDraftStroke, draft, mode, penColor, penWidth, replaceDraftStrokes]);

  if (!draft) return null;

  const makePath = (points: DraftStrokePoint[]) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
      <div className="absolute left-5 top-5 z-40 flex max-w-[calc(100%-2.5rem)] items-start gap-2 rounded-xl border border-neutral-200 bg-white/95 p-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-1 rounded-lg bg-neutral-100/70 p-1">
          <button type="button" onClick={() => setMode('select')} className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${mode === 'select' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-500'}`}><MousePointer2 className="h-3.5 w-3.5" />选择</button>
          <button type="button" onClick={() => setMode('draw')} className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${mode === 'draw' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-500'}`}><Pencil className="h-3.5 w-3.5" />画笔</button>
          <button type="button" onClick={() => setMode('erase')} className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${mode === 'erase' ? 'bg-white text-purple-600 shadow-sm' : 'text-neutral-500'}`}><Eraser className="h-3.5 w-3.5" />橡皮擦</button>
        </div>
        {mode === 'draw' ? (
          <>
            <div className="w-48"><ColorPicker value={penColor} onChange={setPenColor} label="画笔颜色" /></div>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-1">
              {[2, 4, 8].map((width) => <button key={width} type="button" onClick={() => setPenWidth(width)} className={`flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[10px] font-bold ${penWidth === width ? 'bg-purple-100 text-purple-600' : 'text-neutral-400 hover:bg-neutral-50'}`} title={`${width}px`}><span className="rounded-full bg-current" style={{ width: Math.max(4, width), height: Math.max(4, width) }} /></button>)}
            </div>
            <button type="button" disabled={draft.strokes.length === 0} onClick={() => undoDraftStroke(draft.id)} className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-500 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />撤销</button>
            <button type="button" disabled={draft.strokes.length === 0} onClick={() => window.confirm('确定清空当前草稿的全部笔迹吗？') && clearDraftStrokes(draft.id)} className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-500 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />清空笔迹</button>
          </>
        ) : mode === 'erase' ? (
          <span className="self-center px-1 text-[10px] text-neutral-400">橡皮擦经过哪里，就只擦除哪里的笔迹</span>
        ) : <span className="self-center px-1 text-[10px] text-neutral-400">单击空白处创建节点，双击节点设置归属</span>}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={finishNodeDrag}
        onNodesDelete={(deletedNodes) => deletedNodes.forEach((node) => removeDraftNode(draft.id, node.id))}
        onEdgesDelete={(deletedEdges) => deletedEdges.forEach((edge) => removeDraftEdge(draft.id, edge.id))}
        onEdgeDoubleClick={(_event, edge) => removeDraftEdge(draft.id, edge.id)}
        onConnect={connectNodes}
        onPaneClick={createNode}
        nodesDraggable={mode === 'select'}
        nodesConnectable={mode === 'select'}
        elementsSelectable={mode === 'select'}
        panOnDrag={mode === 'select'}
        zoomOnDoubleClick={false}
        fitView
        minZoom={0.15}
        maxZoom={2}
        connectionLineStyle={{ stroke: '#8d78d5', strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} color="#d9ddea" gap={24} size={1.5} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      <svg
        className={`absolute inset-0 z-20 h-full w-full touch-none ${mode === 'draw' || mode === 'erase' ? `${mode === 'erase' ? 'cursor-cell' : 'cursor-crosshair'} pointer-events-auto` : 'pointer-events-none'}`}
        onPointerDown={beginStroke}
        onPointerMove={extendStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={() => { if (drawingPointerRef.current === null) setEraserPoint(null); }}
      >
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {(erasedStrokesPreview || draft.strokes).map((stroke) => <path key={stroke.id} d={makePath(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
          {activePoints.length > 1 ? <path d={makePath(activePoints)} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
          {mode === 'erase' && eraserPoint ? <circle cx={eraserPoint.x} cy={eraserPoint.y} r={10 / viewport.zoom} fill="rgba(255,255,255,0.78)" stroke="#8d78d5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
        </g>
      </svg>
    </div>
  );
};

export const DraftsPage: React.FC = () => {
  const drafts = useAppStore((state) => state.drafts);
  const addDraft = useAppStore((state) => state.addDraft);
  const renameDraft = useAppStore((state) => state.renameDraft);
  const deleteDraft = useAppStore((state) => state.deleteDraft);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => drafts[0]?.id || null);
  const [newDraftName, setNewDraftName] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);

  useEffect(() => {
    if (activeDraftId && drafts.some((draft) => draft.id === activeDraftId)) return;
    setActiveDraftId(drafts[0]?.id || null);
  }, [activeDraftId, drafts]);

  const createDraft = () => {
    const id = addDraft(newDraftName);
    setActiveDraftId(id);
    setNewDraftName('');
  };

  return (
    <div className="flex min-h-0 flex-1 bg-neutral-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white p-4">
        <div className="flex gap-2">
          <input value={newDraftName} onChange={(event) => setNewDraftName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createDraft()} placeholder="草稿名称（可留空）" className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs outline-none focus:border-purple-300" />
          <button type="button" onClick={createDraft} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm" title="新建草稿"><FilePlus2 className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
          {drafts.map((draft) => (
            <div key={draft.id} className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 ${draft.id === activeDraftId ? 'border-purple-200 bg-purple-50' : 'border-transparent hover:bg-neutral-50'}`}>
              {editingDraftId === draft.id ? (
                <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onBlur={() => { renameDraft(draft.id, editingName.trim() || draft.name); setEditingDraftId(null); }} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-neutral-700 outline-none" />
              ) : (
                <button type="button" onClick={() => setActiveDraftId(draft.id)} onDoubleClick={() => { setEditingName(draft.name); setEditingDraftId(draft.id); }} className="min-w-0 flex-1 truncate px-1 text-left text-xs font-semibold text-neutral-600" title="双击重命名">{draft.name}</button>
              )}
              <button type="button" onClick={() => { if (window.confirm(`确定删除草稿“${draft.name}”吗？草稿中的画笔和布局将无法恢复。`)) deleteDraft(draft.id); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100" title="删除草稿"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-neutral-400">草稿节点可连接、自由排布。双击节点即可把它归属到已有联通块。</p>
      </aside>

      {activeDraft ? (
        <div key={activeDraft.id} className="flex min-w-0 flex-1">
          <ReactFlowProvider><DraftCanvas draftId={activeDraft.id} /></ReactFlowProvider>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center p-8">
          <div className="max-w-sm rounded-2xl border border-dashed border-purple-200 bg-white/80 p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600"><FilePlus2 className="h-5 w-5" /></div>
            <h2 className="mt-4 text-sm font-bold text-neutral-700">创建第一张草稿</h2>
            <p className="mt-2 text-xs leading-5 text-neutral-400">用节点梳理想法，也可以直接在画板上书写和勾画。</p>
          </div>
        </div>
      )}
    </div>
  );
};
