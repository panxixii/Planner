import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  ListTodo,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useAppStore } from './store';
import { DataTransferControls } from './components/DataTransferControls';
import { WelcomeScreen } from './components/WelcomeScreen';

const TodoPage = lazy(() => import('./components/TodoPage').then((module) => ({ default: module.TodoPage })));
const TimeTemplatesPage = lazy(() => import('./components/TimeTemplatesPage').then((module) => ({ default: module.TimeTemplatesPage })));
const DraftsPage = lazy(() => import('./components/DraftsPage').then((module) => ({ default: module.DraftsPage })));

type MenuId = 'task-pool' | 'drafts' | 'time-templates' | 'statistics';

const menuItems = [
  { id: 'task-pool' as const, label: 'Todo', icon: ListTodo },
  { id: 'drafts' as const, label: '草稿', icon: FilePenLine },
  { id: 'time-templates' as const, label: '时间模版', icon: Clock3 },
  { id: 'statistics' as const, label: '统计', icon: BarChart3 },
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuId>('task-pool');
  const [todoNavOpen, setTodoNavOpen] = useState(false);
  const showWelcome = useAppStore((state) => state.showWelcome);
  const dismissWelcome = useAppStore((state) => state.dismissWelcome);
  const allTodoLanes = useAppStore((state) => state.todoLanes);
  const todoLanes = useMemo(() => allTodoLanes.filter((lane) => lane.id === 'todo-main' || lane.type === 'custom'), [allTodoLanes]);
  const bandDeleteZoneActive = useAppStore((state) => state.bandDeleteZoneActive);
  const focusLane = useAppStore((state) => state.focusLane);
  const selectTask = useAppStore((state) => state.selectTask);
  const isSidebarCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const canUndo = useAppStore((state) => state.canUndo);
  const canRedo = useAppStore((state) => state.canRedo);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);

  const activeMenuLabel = menuItems.find((item) => item.id === activeMenu)?.label || 'Todo';

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [redo, undo]);

  const handleMenuChange = (menuId: MenuId) => {
    setActiveMenu(menuId);
    selectTask(null);
  };

  if (showWelcome) return <WelcomeScreen onStart={dismissWelcome} />;

  return (
    <div className="flex min-h-screen flex-row overflow-hidden bg-neutral-100 font-sans text-neutral-800 antialiased selection:bg-blue-500/10">
      <aside
        className={`relative flex h-screen shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white transition-all duration-300 ${
          isSidebarCollapsed ? 'w-0 border-r-0' : 'w-72'
        }`}
      >
        <div className="flex h-full w-72 shrink-0 flex-col p-5">
          <div className="flex items-center justify-between px-1 py-1 select-none">
            <div className="flex min-w-0 items-center gap-3">
              <div className="group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-tr from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] shadow-md">
                <div className="pointer-events-none absolute -left-1/2 -top-1/2 h-full w-full rounded-full bg-white/10 blur-[1px]" />
                <Check className="h-5 w-5 stroke-[3.5] text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.3)] transition-transform duration-200 group-hover:scale-110" />
              </div>
              <h1 className="truncate text-sm font-bold tracking-tight text-neutral-800">
                Planner
              </h1>
            </div>

            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              title="收起导航栏"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-8 space-y-1.5" aria-label="主导航">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              const isTodo = item.id === 'task-pool';

              return (
                <div key={item.id}>
                  <button
                    onClick={() => { handleMenuChange(item.id); if (isTodo) setTodoNavOpen((open) => !open); }}
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={isTodo ? todoNavOpen : undefined}
                    className={`flex h-11 w-full items-center gap-3 rounded-lg border px-3.5 text-left text-sm font-semibold transition-all ${
                      isActive
                        ? 'border-purple-200 bg-purple-50 text-neutral-800 shadow-xs'
                        : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-purple-600' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                    {isTodo ? (
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 text-neutral-300 transition-transform ${todoNavOpen ? 'rotate-180' : ''}`} />
                    ) : null}
                  </button>
                  {isTodo && todoNavOpen ? (
                    <div className="custom-scrollbar mt-1 max-h-64 space-y-0.5 overflow-y-auto pl-3.5" aria-label="分线导航">
                      {todoLanes.map((lane) => (
                        <button
                          key={lane.id}
                          onClick={() => { handleMenuChange('task-pool'); focusLane(lane.id); }}
                          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
                          title={lane.name}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lane.type === 'main' ? 'bg-purple-500' : 'bg-sky-400'}`} />
                          <span className="truncate">{lane.name}</span>
                        </button>
                      ))}
                      {todoLanes.length === 0 ? <p className="px-2.5 py-1.5 text-[11px] text-neutral-300">暂无分线</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex h-screen min-w-0 flex-grow flex-col overflow-hidden bg-neutral-50">
        <header data-app-header className={`relative flex h-14 shrink-0 items-center justify-between border-b px-6 select-none transition-colors ${bandDeleteZoneActive ? 'border-rose-400 bg-rose-50' : 'border-neutral-200 bg-white'}`}>
          {bandDeleteZoneActive ? (
            <div className="pointer-events-none absolute inset-x-3 inset-y-1.5 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-rose-400 bg-rose-50/90">
              <span className="rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white">松手后确认删除</span>
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            {isSidebarCollapsed ? (
              <button
                onClick={toggleSidebar}
                className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
                title="展开导航栏"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}

            <span className="shrink-0 text-xs font-bold text-neutral-700">
              {activeMenuLabel}
            </span>

          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
              <button type="button" disabled={!canUndo} onClick={undo} className="flex h-7 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white hover:text-purple-600 disabled:cursor-default disabled:opacity-30" title="撤销（Ctrl/Cmd + Z）" aria-label="撤销"><Undo2 className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={!canRedo} onClick={redo} className="flex h-7 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white hover:text-purple-600 disabled:cursor-default disabled:opacity-30" title="重做（Ctrl/Cmd + Shift + Z）" aria-label="重做"><Redo2 className="h-3.5 w-3.5" /></button>
            </div>
            {activeMenu === 'task-pool' ? (
              <DataTransferControls />
            ) : null}
          </div>
        </header>

        {activeMenu === 'task-pool' ? (
          <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-neutral-400">正在加载 Todo…</div>}>
            <TodoPage />
          </Suspense>
        ) : activeMenu === 'time-templates' ? (
          <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-neutral-400">正在加载时间模版…</div>}>
            <TimeTemplatesPage />
          </Suspense>
        ) : activeMenu === 'drafts' ? (
          <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-neutral-400">正在加载草稿…</div>}>
            <DraftsPage />
          </Suspense>
        ) : (
          <div className="min-h-0 flex-1 bg-neutral-50" aria-label={`${activeMenuLabel}页面`} />
        )}
      </main>

    </div>
  );
}
