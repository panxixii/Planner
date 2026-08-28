import { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers2,
  ListTodo,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useAppStore } from './store';
import { TaskDrawer } from './components/TaskDrawer';
import { DAGWorkspace } from './components/DAGWorkspace';
import { TimelineLayer } from './components/TimelineLayer';
import { WorkspaceFilterBar } from './components/WorkspaceFilterBar';
import { ComponentDetailsDrawer } from './components/ComponentDetailsDrawer';
import { DataTransferControls } from './components/DataTransferControls';

type MenuId = 'task-pool' | 'workspace' | 'statistics';

const menuItems = [
  { id: 'task-pool' as const, label: 'Todo', icon: ListTodo },
  { id: 'workspace' as const, label: '工作区', icon: Workflow },
  { id: 'statistics' as const, label: '统计', icon: BarChart3 },
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuId>('workspace');
  const isMergedView = useAppStore((state) => state.isMergedView);
  const setMergedView = useAppStore((state) => state.setMergedView);
  const selectTask = useAppStore((state) => state.selectTask);
  const clearWorkspace = useAppStore((state) => state.clearWorkspace);
  const isSidebarCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const activeMenuLabel = menuItems.find((item) => item.id === activeMenu)?.label || '工作区';

  useEffect(() => {
    if (activeMenu === 'workspace' && !isMergedView) {
      setMergedView(true);
    }
  }, [activeMenu, isMergedView, setMergedView]);

  const handleMenuChange = (menuId: MenuId) => {
    setActiveMenu(menuId);
    if (menuId === 'workspace') {
      setMergedView(true);
    } else {
      selectTask(null);
    }
  };

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

              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-11 w-full items-center gap-3 rounded-lg border px-3.5 text-left text-sm font-semibold transition-all ${
                    isActive
                      ? 'border-purple-200 bg-purple-50 text-neutral-800 shadow-xs'
                      : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-purple-600' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex h-screen min-w-0 flex-grow flex-col overflow-hidden bg-neutral-50">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 select-none">
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

            {activeMenu === 'workspace' && isMergedView ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                <span className="flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-600">
                  <Layers2 className="h-3.5 w-3.5" />
                  合并工作区
                </span>
              </>
            ) : null}

          </div>

          {activeMenu === 'workspace' ? (
            <div className="flex shrink-0 items-center gap-2">
              <DataTransferControls />
              <button
                onClick={() => {
                  if (window.confirm('您确定要清空工作区中的所有计划和目标数据吗？')) {
                    clearWorkspace();
                  }
                }}
                className="planner-danger-button flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold shadow-2xs transition-all"
                title="清空所有自定义计划与任务"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>清空计划</span>
              </button>
            </div>
          ) : null}
        </header>

        {activeMenu === 'workspace' ? (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <WorkspaceFilterBar />
            <div className="flex min-h-0 flex-grow flex-col">
              <DAGWorkspace />
            </div>
            <TimelineLayer />
          </div>
        ) : (
          <div className="min-h-0 flex-1 bg-neutral-50" aria-label={`${activeMenuLabel}页面`} />
        )}
      </main>

      {activeMenu === 'workspace' ? <TaskDrawer /> : null}
      {activeMenu === 'workspace' ? <ComponentDetailsDrawer /> : null}
    </div>
  );
}
