import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Compass,
  Edit3,
  Folder,
  GripVertical,
  Plus,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '../store';
import { AppCategory } from '../types';

interface CategoryNode {
  category: AppCategory;
  children: CategoryNode[];
}

interface TaskCategoriesPageProps {
  onOpenCategory: (categoryId: string) => void;
}

type DropPosition = 'before' | 'after' | 'inside';

const buildCategoryTree = (categories: AppCategory[]) => {
  const nodeMap = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  categories.forEach((category) => {
    nodeMap.set(category.id, { category, children: [] });
  });

  categories.forEach((category) => {
    const node = nodeMap.get(category.id);
    if (!node) return;

    const parent = category.parentId ? nodeMap.get(category.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const getDescendantIds = (categories: AppCategory[], categoryId: string) => {
  const descendants = new Set<string>();
  const queue = [categoryId];

  while (queue.length > 0) {
    const parentId = queue.shift();
    categories.forEach((category) => {
      if (category.parentId === parentId && !descendants.has(category.id)) {
        descendants.add(category.id);
        queue.push(category.id);
      }
    });
  }

  return descendants;
};

export const TaskCategoriesPage: React.FC<TaskCategoriesPageProps> = ({ onOpenCategory }) => {
  const categories = useAppStore((state) => state.categories);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const setCategory = useAppStore((state) => state.setCategory);
  const addCategory = useAppStore((state) => state.addCategory);
  const renameCategory = useAppStore((state) => state.renameCategory);
  const deleteCategory = useAppStore((state) => state.deleteCategory);
  const moveCategory = useAppStore((state) => state.moveCategory);

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newParentId, setNewParentId] = useState('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingParentId, setEditingParentId] = useState('none');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: DropPosition } | null>(null);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const handleOpenCategory = (categoryId: string) => {
    setCategory(categoryId);
    onOpenCategory(categoryId);
  };

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) return;

    addCategory(label, newParentId === 'none' ? undefined : newParentId);
    setNewLabel('');
    setNewParentId('none');
    setIsAdding(false);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingLabel.trim()) return;

    renameCategory(editingId, editingLabel.trim(), editingParentId);
    setEditingId(null);
  };

  const startEditing = (category: AppCategory) => {
    setDeletingId(null);
    setEditingId(category.id);
    setEditingLabel(category.label);
    setEditingParentId(category.parentId || 'none');
  };

  const renderCategoryNode = (node: CategoryNode, depth = 0): React.ReactNode => {
    const category = node.category;
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded[category.id] !== false;
    const isActive = selectedCategoryId === category.id;
    const isDragged = draggedId === category.id;
    const dropState = dragOver?.id === category.id ? dragOver.position : null;

    if (editingId === category.id) {
      const excludedParentIds = getDescendantIds(categories, category.id);
      excludedParentIds.add(category.id);

      return (
        <div key={category.id} className="py-1" style={{ paddingLeft: depth * 20 }}>
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-purple-200 bg-purple-50/50 p-2">
            <input
              value={editingLabel}
              onChange={(event) => setEditingLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveEdit();
                if (event.key === 'Escape') setEditingId(null);
              }}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-purple-500 focus:outline-hidden"
              autoFocus
            />
            <select
              value={editingParentId}
              onChange={(event) => setEditingParentId(event.target.value)}
              className="w-44 rounded-md border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-600 focus:border-purple-500 focus:outline-hidden"
            >
              <option value="none">无父分类</option>
              {categories
                .filter((candidate) => !excludedParentIds.has(candidate.id))
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                ))}
            </select>
            <button
              onClick={handleSaveEdit}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
              title="保存分类"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-white hover:text-neutral-700"
              title="取消编辑"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={category.id}>
        <div className="py-1" style={{ paddingLeft: depth * 20 }}>
          <div
            draggable
            onDragStart={(event) => {
              setDraggedId(category.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', category.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOver(null);
            }}
            onDragOver={(event) => {
              if (draggedId === category.id) return;
              event.preventDefault();
              event.stopPropagation();

              const rect = event.currentTarget.getBoundingClientRect();
              const relativeY = event.clientY - rect.top;
              const position: DropPosition = relativeY < rect.height * 0.25
                ? 'before'
                : relativeY > rect.height * 0.75
                  ? 'after'
                  : 'inside';
              setDragOver({ id: category.id, position });
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const sourceId = event.dataTransfer.getData('text/plain') || draggedId;
              if (sourceId && sourceId !== category.id) {
                moveCategory(sourceId, category.id, dragOver?.position || 'inside');
              }
              setDragOver(null);
            }}
            className={`group relative flex min-h-11 items-center rounded-md border transition-all ${
              isDragged ? 'opacity-35' : ''
            } ${
              isActive
                ? 'border-purple-200 bg-purple-50'
                : 'border-transparent hover:border-neutral-200 hover:bg-white'
            } ${dropState === 'inside' ? 'border-dashed border-blue-400 bg-blue-50' : ''} ${
              dropState === 'before' ? 'border-t-2 border-t-blue-500' : ''
            } ${dropState === 'after' ? 'border-b-2 border-b-blue-500' : ''}`}
          >
            <button
              onClick={() => handleOpenCategory(category.id)}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-neutral-300 group-hover:text-neutral-500" />
              {hasChildren ? (
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpanded((current) => ({ ...current, [category.id]: !isExpanded }));
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </span>
              ) : (
                <span className="h-6 w-6 shrink-0" />
              )}
              <Folder className="h-4 w-4 shrink-0 text-[#79bfd5]" />
              <span className="truncate text-sm font-medium text-neutral-700">{category.label}</span>
            </button>

            {deletingId === category.id ? (
              <div className="flex shrink-0 items-center gap-1 pr-2">
                <span className="mr-1 text-xs font-medium text-rose-700">删除分类及所属计划？</span>
                <button
                  onClick={() => {
                    deleteCategory(category.id);
                    setDeletingId(null);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-rose-600 hover:bg-rose-50"
                  title="确认删除"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  title="取消删除"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEditing(category)}
                  className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-purple-50 hover:text-purple-600"
                  title="编辑分类"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setDeletingId(category.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                  title="删除分类"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div>{node.children.map((child) => renderCategoryNode(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-6 py-6 select-none">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex min-h-10 items-center justify-between gap-4 border-b border-neutral-200 pb-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Tags className="h-5 w-5 shrink-0 text-purple-600" />
            <h2 className="truncate text-xl font-semibold text-neutral-800">分类结构</h2>
          </div>
          <button
            onClick={() => setIsAdding((current) => !current)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 shadow-2xs hover:bg-neutral-50"
          >
            <Plus className="h-4 w-4 text-purple-600" />
            新建分类
          </button>
        </div>

        {isAdding ? (
          <div className="flex items-center gap-2 border-b border-neutral-200 py-4">
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate();
                if (event.key === 'Escape') setIsAdding(false);
              }}
              placeholder="分类名称"
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-purple-500 focus:outline-hidden"
              autoFocus
            />
            <select
              value={newParentId}
              onChange={(event) => setNewParentId(event.target.value)}
              className="w-44 rounded-md border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-600 focus:border-purple-500 focus:outline-hidden"
            >
              <option value="none">无父分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-purple-600 text-white hover:bg-purple-500"
              title="创建分类"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewLabel('');
                setNewParentId('none');
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 hover:text-neutral-700"
              title="取消创建"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div
          className={`mt-4 min-h-64 ${dragOver?.id === 'all' ? 'rounded-md bg-blue-50/60' : ''}`}
          onDragOver={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault();
              setDragOver({ id: 'all', position: 'inside' });
            }
          }}
          onDragLeave={() => {
            if (dragOver?.id === 'all') setDragOver(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData('text/plain') || draggedId;
            if (sourceId) moveCategory(sourceId, 'all', 'inside');
            setDragOver(null);
          }}
        >
          <button
            onClick={() => handleOpenCategory('all')}
            className={`mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors ${
              selectedCategoryId === 'all'
                ? 'border-purple-200 bg-purple-50 text-neutral-800'
                : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-white'
            }`}
          >
            <span className="h-4 w-4 shrink-0" />
            <span className="h-6 w-6 shrink-0" />
            <Compass className="h-4 w-4 shrink-0 text-[#9b8ae4]" />
            <span>全部</span>
          </button>

          {categoryTree.map((node) => renderCategoryNode(node))}
        </div>
      </div>
    </div>
  );
};
