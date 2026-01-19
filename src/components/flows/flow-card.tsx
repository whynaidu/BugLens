"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Trash2, Image, Bug } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FlowCardProps {
  flow: {
    id: string;
    name: string;
    description: string | null;
    order: number;
    _count?: {
      screenshots: number;
    };
    bugCount?: number;
  };
  onEdit: (flow: FlowCardProps["flow"]) => void;
  onDelete: (flow: FlowCardProps["flow"]) => void;
  onClick: () => void;
  isDragging?: boolean;
}

export function FlowCard({ flow, onEdit, onDelete, onClick, isDragging }: FlowCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: flow.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <CardHeader className="flex flex-row items-center gap-2 p-4">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <CardTitle className="text-base truncate">{flow.name}</CardTitle>
          {flow.description && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {flow.description}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(flow)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(flow)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0" onClick={onClick}>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            <span>{flow._count?.screenshots ?? 0} screenshots</span>
          </div>
          <div className="flex items-center gap-1">
            <Bug className="h-4 w-4" />
            <span>{flow.bugCount ?? 0} bugs</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
