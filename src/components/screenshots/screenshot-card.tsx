"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MoreHorizontal,
  Eye,
  Trash2,
  Pencil,
  Bug,
  Image as ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export interface Screenshot {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  _count?: {
    annotations: number;
  };
}

interface ScreenshotCardProps {
  screenshot: Screenshot;
  onView: () => void;
  onDelete: () => void;
  onTitleChange: (title: string) => void;
  isDragging?: boolean;
}

export function ScreenshotCard({
  screenshot,
  onView,
  onDelete,
  onTitleChange,
  isDragging,
}: ScreenshotCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(screenshot.title || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: screenshot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTitleSubmit = () => {
    if (editTitle.trim() && editTitle !== screenshot.title) {
      onTitleChange(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSubmit();
    } else if (e.key === "Escape") {
      setEditTitle(screenshot.title || "");
      setIsEditing(false);
    }
  };

  const annotationCount = screenshot._count?.annotations ?? 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden group transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {screenshot.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshot.thumbnailUrl}
            alt={screenshot.title || "Screenshot"}
            className="w-full h-full object-cover cursor-pointer"
            onClick={onView}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer"
            onClick={onView}
          >
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}

        {/* Drag Handle */}
        <button
          type="button"
          className="absolute top-2 left-2 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Annotation Count Badge */}
        {annotationCount > 0 && (
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 gap-1"
          >
            <Bug className="h-3 w-3" />
            {annotationCount}
          </Badge>
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={onView}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <p
                className="text-sm font-medium truncate cursor-pointer hover:text-primary"
                onClick={() => setIsEditing(true)}
                title="Click to edit"
              >
                {screenshot.title || "Untitled"}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScreenshotCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video" />
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-7 w-7" />
        </div>
      </CardContent>
    </Card>
  );
}
