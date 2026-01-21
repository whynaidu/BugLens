"use client";

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Module {
  id: string;
  name: string;
  description: string | null;
  depth: number;
  order: number;
  _count: {
    testCases: number;
    children: number;
  };
  children?: Module[];
}

interface ModuleTreeProps {
  modules: Module[];
  selectedModuleId?: string | null;
  onSelectModule: (moduleId: string) => void;
  onCreateModule: (parentId: string | null) => void;
  onEditModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  expandedIds?: Set<string>;
  onToggleExpand?: (moduleId: string) => void;
}

export function ModuleTree({
  modules,
  selectedModuleId,
  onSelectModule,
  onCreateModule,
  onEditModule,
  onDeleteModule,
  expandedIds = new Set(),
  onToggleExpand,
}: ModuleTreeProps) {
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set());

  const effectiveExpandedIds = onToggleExpand ? expandedIds : localExpandedIds;
  const effectiveToggleExpand = onToggleExpand ?? ((id: string) => {
    setLocalExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-sm font-medium text-muted-foreground">Modules</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onCreateModule(null)}
          title="Create root module"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {modules.length === 0 ? (
        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
          No modules yet. Create one to get started.
        </div>
      ) : (
        modules.map((module) => (
          <ModuleTreeItem
            key={module.id}
            module={module}
            selectedModuleId={selectedModuleId}
            onSelectModule={onSelectModule}
            onCreateModule={onCreateModule}
            onEditModule={onEditModule}
            onDeleteModule={onDeleteModule}
            expandedIds={effectiveExpandedIds}
            onToggleExpand={effectiveToggleExpand}
            depth={0}
          />
        ))
      )}
    </div>
  );
}

interface ModuleTreeItemProps {
  module: Module;
  selectedModuleId?: string | null;
  onSelectModule: (moduleId: string) => void;
  onCreateModule: (parentId: string | null) => void;
  onEditModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (moduleId: string) => void;
  depth: number;
}

function ModuleTreeItem({
  module,
  selectedModuleId,
  onSelectModule,
  onCreateModule,
  onEditModule,
  onDeleteModule,
  expandedIds,
  onToggleExpand,
  depth,
}: ModuleTreeItemProps) {
  const isExpanded = expandedIds.has(module.id);
  const hasChildren = module.children && module.children.length > 0;
  const isSelected = module.id === selectedModuleId;
  const canAddChildren = module.depth < 3; // Max depth of 3 (4 levels total)

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(module.id);
          }}
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            !hasChildren && "invisible"
          )}
        >
          <ChevronRight
            className={cn("h-4 w-4", isExpanded && "rotate-90")}
          />
        </button>

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Module name */}
        <button
          onClick={() => onSelectModule(module.id)}
          className="flex-1 truncate text-left"
        >
          {module.name}
        </button>

        {/* Test case count badge */}
        {module._count.testCases > 0 && (
          <Badge variant="secondary" className="h-5 text-xs">
            {module._count.testCases}
          </Badge>
        )}

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canAddChildren && (
              <DropdownMenuItem onClick={() => onCreateModule(module.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Add sub-module
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEditModule(module.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteModule(module.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {module.children!.map((child) => (
            <ModuleTreeItem
              key={child.id}
              module={child}
              selectedModuleId={selectedModuleId}
              onSelectModule={onSelectModule}
              onCreateModule={onCreateModule}
              onEditModule={onEditModule}
              onDeleteModule={onDeleteModule}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
