import React from 'react';
import { useAppStore } from './store';
import { BOMSidebar } from './components/BOMSidebar';
import { TaskDrawer } from './components/TaskDrawer';
import { DAGWorkspace } from './components/DAGWorkspace';
import { GoalGrid } from './components/GoalGrid';
import { TimelineLayer } from './components/TimelineLayer';
import { CategoryType } from './types';
import { 
  Target, 
  Layers, 
  FolderGit2, 
  Compass, 
  ArrowLeft, 
  Layers2, 
  Sparkles, 
  Heart, 
  CheckCircle2, 
  Settings, 
  ChevronRight,
  Workflow,
  Tag,
  Plus,
  Edit,
  Trash2,
  Check,
  X
} from 'lucide-react';

export default function App() {
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const isMergedView = useAppStore((state) => state.isMergedView);
  const setCategory = useAppStore((state) => state.setCategory);
  const selectGoal = useAppStore((state) => state.selectGoal);
  const setMergedView = useAppStore((state) => state.setMergedView);
  const goals = useAppStore((state) => state.goals);
  
  const isSidebarCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const showHelp = useAppStore((state) => state.showHelp);
  const toggleHelp = useAppStore((state) => state.toggleHelp);

  const categories = useAppStore((state) => state.categories);
  const addCategory = useAppStore((state) => state.addCategory);
  const renameCategory = useAppStore((state) => state.renameCategory);
  const deleteCategory = useAppStore((state) => state.deleteCategory);
  const clearWorkspace = useAppStore((state) => state.clearWorkspace);

  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = React.useState('');
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = React.useState('');
  const [deletingCategoryId, setDeletingCategoryId] = React.useState<string | null>(null);

  const getCategoryIcon = (id: string, sizeClass = "w-4 h-4") => {
    switch (id) {
      case 'career': return <Target className={`${sizeClass} text-violet-400`} />;
      case 'health': return <Heart className={`${sizeClass} text-emerald-400`} />;
      case 'finance': return <Workflow className={`${sizeClass} text-amber-400`} />;
      case 'personal': return <FolderGit2 className={`${sizeClass} text-sky-400`} />;
      default: return <Tag className={`${sizeClass} text-indigo-400`} />;
    }
  };

  const handleSelectCategory = (catId: CategoryType) => {
    setCategory(catId);
  };

  const handleActivateMergedView = () => {
    setMergedView(true);
  };

  const activeGoalObject = selectedGoalId ? goals[selectedGoalId] : null;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 flex flex-row overflow-hidden font-sans selection:bg-blue-500/10 antialiased">
      {/* 1. Left Dock Controller Sidebar Panel */}
      <aside className={`transition-all duration-300 border-r border-neutral-200 bg-white flex flex-col justify-between shrink-0 h-screen select-none overflow-hidden relative
        ${isSidebarCollapsed ? 'w-0 border-r-0' : 'w-80'}`}
      >
        <div className="w-80 flex flex-col h-full justify-between shrink-0">
          {/* Top Scrollable Control blocks */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-5 space-y-6">
            {/* Logo Branding with collapse button */}
            <div className="flex items-center justify-between px-1 py-1 select-none">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md relative">
                  <span className="w-4 h-4 text-white rotate-12 font-black text-sm text-center flex items-center justify-center">L</span>
                  <span className="absolute -inset-0.5 rounded-lg border border-white/20 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-neutral-800 font-sans">
                    规划调度器
                  </h2>
                  <span className="text-[10px] text-neutral-450 uppercase font-mono tracking-widest block">
                    DAG 蓝图引擎
                  </span>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="p-1 px-1.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer text-[10.5px] font-mono flex items-center gap-1"
                title="收起导航工具栏"
              >
                <span>◀</span>
              </button>
            </div>
 
          {/* Special Workspace Mode - Unified Merged Canvas Selector */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-neutral-450 uppercase font-mono tracking-widest px-2 block select-none">
              统一工作区
            </span>
            <button
              onClick={handleActivateMergedView}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer text-left text-xs font-medium border
                ${isMergedView 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-800'
                }`}
            >
              <div className="flex items-center gap-2">
                <Layers2 className={`w-4 h-4 ${isMergedView ? 'text-white' : 'text-neutral-400 shrink-0'}`} />
                <span className="font-sans">合并目标工作区</span>
              </div>
              <Sparkles className={`w-3.5 h-3.5 ${isMergedView ? 'text-white' : 'text-neutral-400'}`} />
            </button>
          </div>
 
          {/* Plan Sector Groups category listings */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 select-none">
              <span className="text-[10px] font-bold text-neutral-450 uppercase font-mono tracking-widest block">
                分类
              </span>
              <button
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="p-1 rounded text-neutral-400 hover:text-blue-600 hover:bg-neutral-50 transition-all cursor-pointer"
                title="新建分类"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {isAddingCategory && (
              <div className="px-2 py-1 flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  className="w-full text-xs bg-transparent border-0 outline-none p-1 font-sans font-medium text-neutral-800"
                  placeholder="新赛道名称..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (newCategoryLabel.trim()) {
                        addCategory(newCategoryLabel.trim());
                        setNewCategoryLabel('');
                        setIsAddingCategory(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsAddingCategory(false);
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (newCategoryLabel.trim()) {
                      addCategory(newCategoryLabel.trim());
                      setNewCategoryLabel('');
                      setIsAddingCategory(false);
                    }
                  }}
                  className="p-0.5 hover:text-emerald-600 text-neutral-400 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <nav className="space-y-1">
              {/* Virtual Category mapping: 'all' */}
              {(() => {
                const isActive = selectedCategoryId === 'all' && !isMergedView;
                return (
                  <button
                    key="all"
                    onClick={() => handleSelectCategory('all')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium tracking-tight transition-all cursor-pointer text-left
                      ${isActive 
                        ? 'bg-neutral-100/80 border-l-2 border-blue-600 text-neutral-900 font-semibold shadow-2xs' 
                        : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50'
                      }`}
                  >
                    <span className={isActive ? 'text-blue-600 font-bold' : 'text-neutral-400 shrink-0'}>
                      <Compass className="w-4 h-4" />
                    </span>
                    <span className="font-sans">全部</span>
                  </button>
                );
              })()}

              {/* Dynamic Categories */}
              {categories.map((c) => {
                const isActive = selectedCategoryId === c.id && !isMergedView;
                if (editingCategoryId === c.id) {
                  return (
                    <div key={c.id} className="flex items-center gap-1 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200">
                      <input
                        type="text"
                        value={editingCategoryLabel}
                        onChange={(e) => setEditingCategoryLabel(e.target.value)}
                        className="w-full text-xs bg-transparent border-0 outline-none p-1 font-sans font-medium text-neutral-800"
                        placeholder="重命名..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingCategoryLabel.trim()) {
                              renameCategory(editingCategoryId, editingCategoryLabel.trim());
                            }
                            setEditingCategoryId(null);
                          } else if (e.key === 'Escape') {
                            setEditingCategoryId(null);
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          if (editingCategoryLabel.trim()) {
                            renameCategory(editingCategoryId, editingCategoryLabel.trim());
                          }
                          setEditingCategoryId(null);
                        }}
                        className="p-1 hover:text-emerald-600 text-neutral-400 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setEditingCategoryId(null)}
                        className="p-1 hover:text-rose-600 text-neutral-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                if (deletingCategoryId === c.id) {
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-1 bg-rose-50/80 px-2 py-1 outline-none rounded-lg border border-rose-200 animate-in fade-in duration-150">
                      <span className="text-[10px] font-bold text-rose-800 font-sans truncate flex-grow">
                        确认删除分类 &ldquo;{c.label}&rdquo;？
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button 
                          onClick={() => {
                            deleteCategory(c.id);
                            setDeletingCategoryId(null);
                          }}
                          className="p-0.5 hover:text-rose-700 text-rose-500 font-bold cursor-pointer"
                          title="确定删除分类及其下属目标"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingCategoryId(null)}
                          className="p-0.5 hover:text-neutral-600 text-neutral-400 cursor-pointer"
                          title="取消"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={c.id} className="group relative flex items-center justify-between w-full">
                    <button
                      onClick={() => handleSelectCategory(c.id)}
                      className={`flex-grow flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium tracking-tight transition-all cursor-pointer text-left
                        ${isActive 
                          ? 'bg-neutral-100/80 border-l-2 border-blue-600 text-neutral-900 font-semibold shadow-2xs' 
                          : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50'
                        }`}
                    >
                      <span className={isActive ? 'text-blue-600' : 'text-neutral-400 shrink-0'}>
                        {getCategoryIcon(c.id)}
                      </span>
                      <span className="font-sans truncate max-w-[130px]">{c.label}</span>
                    </button>

                    {/* Hover actions */}
                    <div className="absolute right-2 top-1.5 hidden group-hover:flex items-center gap-1 bg-white border border-neutral-200 rounded px-1 py-0.5 shadow-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategoryId(c.id);
                          setEditingCategoryLabel(c.label);
                        }}
                        className="p-0.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="重命名分类"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCategoryId(c.id);
                        }}
                        className="p-0.5 text-neutral-400 hover:text-rose-600 cursor-pointer"
                        title="删除分类"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
 
        {/* Reusable BOM template drag and drop index drawer built in */}
        <BOMSidebar />
        </div>
      </aside>
 
      {/* 2. Main content view block */}
      <main className="flex-grow flex flex-col h-screen overflow-hidden min-w-0 bg-neutral-50">
        
        {/* Breadcrumb Workspace Top Bar */}
        <header className="h-14 border-b border-neutral-200 bg-white px-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 animate-in fade-in duration-200">
            {isSidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 font-sans text-xs font-bold transition-all mr-2 cursor-pointer shadow-sm shrink-0"
                title="展开左侧操作栏 (Drawer)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>展开工具栏</span>
              </button>
            )}

            <span className="text-[11px] text-neutral-450 font-mono tracking-wide">
              人生工作区
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
            
            {isMergedView ? (
              <span className="text-xs font-semibold text-blue-600 font-mono flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                <Layers2 className="w-3.5 h-3.5" /> 合并工作区
              </span>
            ) : selectedGoalId && activeGoalObject ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => selectGoal(null)}
                  className="text-xs text-blue-600 hover:text-blue-500 font-mono flex items-center gap-1 cursor-pointer font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> 计划网格
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                <span className="text-xs font-bold text-neutral-700 uppercase font-mono">
                  {activeGoalObject.title.substring(0, 16)}...
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-neutral-700 uppercase font-mono">
                {selectedCategoryId === 'all' ? '所有目标看板' :
                 selectedCategoryId === 'career' ? '职业领航看板' :
                 selectedCategoryId === 'health' ? '身心健康看板' :
                 selectedCategoryId === 'finance' ? '财务自由看板' :
                 '心智成长看板'}
              </span>
            )}
          </div>
 
          <div className="flex items-center gap-3 text-xs font-mono">
            {/* Show/Hide guidelines toggle */}
            <button
              onClick={toggleHelp}
              className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs select-none
                ${showHelp 
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700' 
                  : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-600'
                }`}
              title="一键开启或闭合整站的所有规则说明、拖曳提示和警告卡片"
            >
              <Sparkles className={`w-3.5 h-3.5 ${showHelp ? 'text-blue-600 animate-pulse' : 'text-neutral-400'}`} />
              <span className="font-sans">提示: {showHelp ? '已显示' : '已隐藏'}</span>
            </button>

            {/* Clear all custom goals/plans */}
            <button
              onClick={() => {
                if (window.confirm('您确定要清空工作区中的所有计划和目标数据吗？')) {
                  clearWorkspace();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-205 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs select-none"
              title="清空所有的自定义目标与计划"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="font-sans">清空计划</span>
            </button>

            <span className="text-[11px] text-neutral-550 uppercase tracking-widest bg-neutral-100 px-2.5 py-1 rounded border border-neutral-200">
              开发纪元: 2026-Q2
            </span>
          </div>
        </header>
 
        {/* Core Workspace Switch Panel */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* If Merged View is active or a single Goal is expanded, display DAG Canvas workflow */}
          {isMergedView || selectedGoalId ? (
            <div className="flex-grow flex flex-col min-h-0">
              {/* Back to cards shortcut label bar if single goal */}
              {selectedGoalId && (
                <div className="bg-neutral-50/50 border-b border-neutral-200 py-2 px-6 flex items-center justify-between shrink-0">
                  <button 
                    onClick={() => selectGoal(null)}
                    className="text-[10.5px] hover:underline text-neutral-450 hover:text-neutral-700 cursor-pointer flex items-center gap-1 font-mono uppercase"
                  >
                    ← 退出 DAG 工作区并返回计划蓝图概览
                  </button>
                </div>
              )}
              
              <DAGWorkspace />
            </div>
          ) : (
            /* Otherwise, display standard Dashboard Cards filter view */
            <GoalGrid />
          )}

          {/* Timeline Scroll Layer (Only visible when consolidated merged workflow maps together) */}
          {isMergedView && <TimelineLayer />}
        </div>
      </main>

      {/* 3. Floating task nodes editor inspect drawer (overloaded globally) */}
      <TaskDrawer />
    </div>
  );
}
