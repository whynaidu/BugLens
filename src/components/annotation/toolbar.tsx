"use client";

import {
  MousePointer2,
  Square,
  Circle,
  ArrowRight,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnnotationTool } from "@/types/annotation";
import { ANNOTATION_COLORS } from "@/lib/constants";

interface AnnotationToolbarProps {
  selectedTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  hasSelection: boolean;
  onDelete: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
}

export function AnnotationToolbar({
  selectedTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  hasSelection,
  onDelete,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  saveStatus = "idle",
  onSave,
}: AnnotationToolbarProps) {
  const tools = [
    { value: "select" as const, icon: MousePointer2, label: "Select", shortcut: "V" },
    { value: "rectangle" as const, icon: Square, label: "Rectangle", shortcut: "R" },
    { value: "circle" as const, icon: Circle, label: "Circle", shortcut: "C" },
    { value: "arrow" as const, icon: ArrowRight, label: "Arrow", shortcut: "A" },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2 p-2 bg-background border-b">
        {/* Drawing Tools */}
        <ToggleGroup
          type="single"
          value={selectedTool}
          onValueChange={(value) => value && onToolChange(value as AnnotationTool)}
          className="flex-shrink-0"
        >
          {tools.map((tool) => (
            <Tooltip key={tool.value}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={tool.value}
                  aria-label={tool.label}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-8 w-8 sm:h-9 sm:w-9"
                >
                  <tool.icon className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{tool.label} ({tool.shortcut})</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* Color Picker - show fewer colors on mobile */}
        <div className="flex items-center gap-1">
          {ANNOTATION_COLORS.slice(0, 3).map((color) => (
            <Tooltip key={color}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    strokeColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onStrokeColorChange(color)}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Color</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {/* Additional colors hidden on mobile */}
          {ANNOTATION_COLORS.slice(3, 5).map((color) => (
            <Tooltip key={color}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`hidden sm:block h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    strokeColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onStrokeColorChange(color)}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Color</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={!hasSelection}
              className="h-7 w-7 sm:h-8 sm:w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Delete (Del)</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* Undo/Redo - hidden on very small screens */}
        <div className="hidden xs:flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Redo (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        {/* Save Status */}
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSave}
                  className="h-6 px-2 text-destructive"
                >
                  Retry
                </Button>
              </>
            )}
          </div>
        )}

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomOut}
                disabled={zoom <= 0.25}
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom Out (-)</p>
            </TooltipContent>
          </Tooltip>

          <span className="text-xs sm:text-sm text-muted-foreground w-10 sm:w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomIn}
                disabled={zoom >= 4}
                className="h-7 w-7 sm:h-8 sm:w-8"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom In (+)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomReset}
                className="hidden sm:flex h-8 w-8"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Fit to Screen (0)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
