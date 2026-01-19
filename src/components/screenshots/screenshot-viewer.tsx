"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Square,
  CircleIcon,
  ArrowRight,
  Pencil,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useAnnotationStore,
  type Annotation,
  type AnnotationTool,
} from "@/store/annotation-store";
import { ANNOTATION_COLORS } from "@/lib/constants";

// Dynamically import the Konva canvas to avoid SSR issues with react-konva
const KonvaCanvas = dynamic(
  () => import("./konva-canvas").then((mod) => mod.KonvaCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Normalized annotation type for database storage (coordinates 0-1)
// NormalizedAnnotation is for drawing/storage - doesn't include bug links
// Bug links are managed via many-to-many relationship separately
export interface NormalizedAnnotation {
  id?: string;
  type: "rectangle" | "circle" | "arrow" | "freehand";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  stroke: string;
  strokeWidth: number;
}

interface ScreenshotViewerProps {
  imageUrl: string;
  annotations: Annotation[];
  onAnnotationCreate?: (annotation: NormalizedAnnotation) => Promise<Annotation | null>;
  onAnnotationUpdate?: (id: string, updates: Partial<NormalizedAnnotation>) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationSelect?: (annotation: Annotation) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ScreenshotViewer({
  imageUrl,
  annotations: initialAnnotations,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationSelect,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: ScreenshotViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const {
    selectedTool,
    strokeColor,
    strokeWidth,
    selectedAnnotationId,
    annotations,
    isDrawing,
    drawingAnnotation,
    zoom,
    panX,
    panY,
    setTool,
    setStrokeColor,
    selectAnnotation,
    setAnnotations,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    setZoom,
    setPan: _setPan,
    resetView,
  } = useAnnotationStore();

  // setPan will be used when implementing drag-to-pan functionality
  void _setPan;

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      setImageSize({ width: img.width, height: img.height });
    };
  }, [imageUrl]);

  // Denormalize coordinates from 0-1 range to screen pixels
  const denormalizeAnnotation = useCallback((annotation: Annotation, imgWidth: number, imgHeight: number, scale: number, offsetX: number, offsetY: number): Annotation => {
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    const denormalized: Annotation = {
      ...annotation,
      x: annotation.x * scaledWidth + offsetX,
      y: annotation.y * scaledHeight + offsetY,
    };

    // Denormalize width/height for rectangles and circles
    if (annotation.width !== undefined) {
      denormalized.width = annotation.width * scaledWidth;
    }
    if (annotation.height !== undefined) {
      denormalized.height = annotation.height * scaledHeight;
    }

    // Denormalize points for arrows and freehand
    if (annotation.points && annotation.points.length > 0) {
      denormalized.points = annotation.points.map((val, idx) => {
        if (idx % 2 === 0) {
          // X coordinate
          return val * scaledWidth + offsetX;
        } else {
          // Y coordinate
          return val * scaledHeight + offsetY;
        }
      });
    }

    return denormalized;
  }, []);

  // Track which annotation IDs we've synced to detect changes
  const lastSyncedIdsRef = useRef<string>("");

  // Sync annotations from props to store when they change
  useEffect(() => {
    if (imageSize.width > 0 && imageSize.height > 0) {
      // Create a key from annotation IDs to detect changes
      const currentIds = initialAnnotations.map(a => a.id).sort().join(",");

      // Only re-sync if the annotations have changed (different IDs)
      if (currentIds !== lastSyncedIdsRef.current) {
        lastSyncedIdsRef.current = currentIds;

        // Denormalize initial annotations from 0-1 to screen coordinates
        const scale = Math.min(containerSize.width / imageSize.width, containerSize.height / imageSize.height, 1) * zoom;
        const denormalized = initialAnnotations.map((a) =>
          denormalizeAnnotation(a, imageSize.width, imageSize.height, scale, panX, panY)
        );
        setAnnotations(denormalized);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSize.width, imageSize.height, initialAnnotations]); // Re-run when annotations change

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "v":
        case "V":
          setTool("select");
          break;
        case "r":
        case "R":
          setTool("rectangle");
          break;
        case "c":
        case "C":
          setTool("circle");
          break;
        case "a":
        case "A":
          setTool("arrow");
          break;
        case "p":
        case "P":
          setTool("freehand");
          break;
        case "Escape":
          cancelDrawing();
          selectAnnotation(null);
          break;
        case "Delete":
        case "Backspace":
          if (selectedAnnotationId) {
            onAnnotationDelete?.(selectedAnnotationId);
          }
          break;
        case "ArrowLeft":
          if (hasPrevious) onPrevious?.();
          break;
        case "ArrowRight":
          if (hasNext) onNext?.();
          break;
        case "0":
          resetView();
          break;
        case "+":
        case "=":
          setZoom(zoom + 0.25);
          break;
        case "-":
          setZoom(zoom - 0.25);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setTool,
    cancelDrawing,
    selectAnnotation,
    selectedAnnotationId,
    onAnnotationDelete,
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    resetView,
    zoom,
    setZoom,
  ]);

  // Calculate scale to fit image in container
  const getScale = useCallback(() => {
    if (!imageSize.width || !imageSize.height) return 1;
    const scaleX = containerSize.width / imageSize.width;
    const scaleY = containerSize.height / imageSize.height;
    return Math.min(scaleX, scaleY, 1);
  }, [containerSize, imageSize]);

  const baseScale = getScale();
  const totalScale = baseScale * zoom;

  // Handle mouse events for drawing
  // Using unknown type to avoid importing Konva types directly
  const handleMouseDown = useCallback((e: unknown) => {
    if (selectedTool === "select") return;

    const event = e as { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } };
    const stage = event.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Use screen coordinates directly
    const x = pos.x;
    const y = pos.y;

    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      type: selectedTool === "freehand" ? "freehand" : selectedTool,
      x,
      y,
      stroke: strokeColor,
      strokeWidth,
      ...(selectedTool === "freehand" && { points: [x, y] }),
      ...(selectedTool === "arrow" && { points: [x, y, x, y] }),
    };

    startDrawing(newAnnotation);
  }, [selectedTool, strokeColor, strokeWidth, startDrawing]);

  const handleMouseMove = useCallback((e: unknown) => {
    if (!isDrawing || !drawingAnnotation) return;

    const event = e as { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } };
    const stage = event.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Use screen coordinates directly
    const x = pos.x;
    const y = pos.y;

    if (drawingAnnotation.type === "freehand") {
      updateDrawing({
        points: [...(drawingAnnotation.points || []), x, y],
      });
    } else if (drawingAnnotation.type === "arrow") {
      const pts = drawingAnnotation.points || [drawingAnnotation.x, drawingAnnotation.y, x, y];
      updateDrawing({ points: [pts[0], pts[1], x, y] });
    } else {
      updateDrawing({
        width: x - drawingAnnotation.x,
        height: y - drawingAnnotation.y,
      });
    }
  }, [isDrawing, drawingAnnotation, updateDrawing]);

  // Normalize screen coordinates to 0-1 range relative to image
  const normalizeCoordinate = useCallback((screenX: number, screenY: number) => {
    const scaledWidth = imageSize.width * totalScale;
    const scaledHeight = imageSize.height * totalScale;

    // Convert from screen position to position relative to scaled image
    const relX = (screenX - panX) / scaledWidth;
    const relY = (screenY - panY) / scaledHeight;

    // Clamp to 0-1 range
    return {
      x: Math.max(0, Math.min(1, relX)),
      y: Math.max(0, Math.min(1, relY)),
    };
  }, [imageSize, totalScale, panX, panY]);

  // Normalize an entire annotation for database storage
  const normalizeAnnotation = useCallback((annotation: Annotation): NormalizedAnnotation => {
    const { x: normX, y: normY } = normalizeCoordinate(annotation.x, annotation.y);
    const scaledWidth = imageSize.width * totalScale;
    const scaledHeight = imageSize.height * totalScale;

    const normalized: NormalizedAnnotation = {
      type: annotation.type,
      x: normX,
      y: normY,
      stroke: annotation.stroke,
      strokeWidth: annotation.strokeWidth,
      // Note: Bug links are managed via many-to-many, not included here
    };

    // Normalize width/height for rectangles and circles
    if (annotation.width !== undefined) {
      normalized.width = Math.abs(annotation.width) / scaledWidth;
    }
    if (annotation.height !== undefined) {
      normalized.height = Math.abs(annotation.height) / scaledHeight;
    }

    // Normalize points for arrows and freehand
    if (annotation.points && annotation.points.length > 0) {
      normalized.points = annotation.points.map((val, idx) => {
        if (idx % 2 === 0) {
          // X coordinate
          return Math.max(0, Math.min(1, (val - panX) / scaledWidth));
        } else {
          // Y coordinate
          return Math.max(0, Math.min(1, (val - panY) / scaledHeight));
        }
      });
    }

    return normalized;
  }, [normalizeCoordinate, imageSize, totalScale, panX, panY]);

  const handleMouseUp = useCallback(async () => {
    if (!isDrawing) return;

    const annotation = finishDrawing();
    if (annotation && onAnnotationCreate) {
      // Normalize coordinates before saving to database
      const normalizedAnnotation = normalizeAnnotation(annotation);

      // Save to database and get back the annotation with database ID
      const savedAnnotation = await onAnnotationCreate(normalizedAnnotation);

      // If we got back a saved annotation, replace the local ID with the database ID
      if (savedAnnotation && savedAnnotation.id !== annotation.id) {
        const { replaceAnnotationId } = useAnnotationStore.getState();
        replaceAnnotationId(annotation.id, savedAnnotation.id);
      }
    }
  }, [isDrawing, finishDrawing, onAnnotationCreate, normalizeAnnotation]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: unknown) => {
    const event = e as { evt: { preventDefault: () => void; deltaY: number } };
    event.evt.preventDefault();
    const scaleBy = 1.1;
    const newZoom = event.evt.deltaY > 0 ? zoom / scaleBy : zoom * scaleBy;
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const tools: { tool: AnnotationTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { tool: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select", shortcut: "V" },
    { tool: "rectangle", icon: <Square className="h-4 w-4" />, label: "Rectangle", shortcut: "R" },
    { tool: "circle", icon: <CircleIcon className="h-4 w-4" />, label: "Circle", shortcut: "C" },
    { tool: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow", shortcut: "A" },
    { tool: "freehand", icon: <Pencil className="h-4 w-4" />, label: "Freehand", shortcut: "P" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {tools.map((t) => (
              <Tooltip key={t.tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === t.tool ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTool(t.tool)}
                  >
                    {t.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t.label} ({t.shortcut})</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Color picker */}
          <div className="flex items-center gap-1">
            {ANNOTATION_COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  strokeColor === color ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setStrokeColor(color)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider
              value={[zoom]}
              min={0.25}
              max={4}
              step={0.25}
              className="w-24"
              onValueChange={(values: number[]) => setZoom(values[0])}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom + 0.25)}
              disabled={zoom >= 4}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={resetView}
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNext}
              disabled={!hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted/50"
        style={{ cursor: selectedTool === "select" ? "default" : "crosshair" }}
      >
        <KonvaCanvas
          containerSize={containerSize}
          image={image}
          imageSize={imageSize}
          panX={panX}
          panY={panY}
          totalScale={totalScale}
          annotations={annotations}
          drawingAnnotation={drawingAnnotation}
          selectedAnnotationId={selectedAnnotationId}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onSelectAnnotation={selectAnnotation}
          onAnnotationUpdate={onAnnotationUpdate}
          onAnnotationClick={onAnnotationSelect}
        />
      </div>
    </div>
  );
}
