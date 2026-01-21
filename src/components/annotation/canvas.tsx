"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { Loader2 } from "lucide-react";

import { useAnnotationStore, type Annotation as StoreAnnotation } from "@/store/annotation-store";
import type { Annotation, Size, AnnotationTool } from "@/types/annotation";
import { normalizeCoordinate } from "@/types/annotation";
import { AnnotationShape } from "./shapes";
import { AnnotationToolbar } from "./toolbar";

interface AnnotationCanvasProps {
  imageUrl: string;
  screenshotId: string;
  projectId: string;
  initialAnnotations?: Annotation[];
  annotationTestCaseMap?: Record<string, string>; // Map annotation ID to test case ID
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
}

export function AnnotationCanvas({
  imageUrl,
  projectId,
  initialAnnotations = [],
  annotationTestCaseMap = {},
  onAnnotationsChange,
  saveStatus = "idle",
  onSave,
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [containerSize, setContainerSize] = useState<Size>({ width: 800, height: 600 });
  const [imageSize, setImageSize] = useState<Size>({ width: 800, height: 600 });

  // Client-side mount check for react-konva SSR compatibility
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // History for undo/redo - initialized with initialAnnotations
  const [history, setHistory] = useState<Annotation[][]>(() => [initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const initializedRef = useRef(false);

  const {
    selectedTool,
    setTool,
    strokeColor,
    setStrokeColor,
    selectedAnnotationId,
    selectAnnotation,
    annotations,
    setAnnotations,
    updateAnnotation,
    deleteAnnotation,
    isDrawing,
    drawingAnnotation,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    zoom,
    setZoom,
    panX,
    panY,
    setPan,
    resetView,
  } = useAnnotationStore();

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

  // Initialize annotations from props - only run once
  useEffect(() => {
    if (initializedRef.current) return;
    if (initialAnnotations.length > 0) {
      initializedRef.current = true;
      // Convert to store format
      const storeAnnotations = initialAnnotations.map((a) => ({
        ...a,
        type: a.type as StoreAnnotation["type"],
      }));
      setAnnotations(storeAnnotations);
    }
  }, [initialAnnotations, setAnnotations]);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Calculate fit-to-screen dimensions
  const getScaledDimensions = useCallback(() => {
    if (!image) return { width: containerSize.width, height: containerSize.height, scale: 1 };

    const scaleX = containerSize.width / imageSize.width;
    const scaleY = containerSize.height / imageSize.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale,
      scale,
    };
  }, [image, containerSize, imageSize]);

  const { width: stageWidth, height: stageHeight } = getScaledDimensions();

  // Notify parent of annotation changes
  useEffect(() => {
    if (onAnnotationsChange) {
      onAnnotationsChange(annotations as Annotation[]);
    }
  }, [annotations, onAnnotationsChange]);

  // Add to history when annotations change (excluding during drawing)
  const pushToHistory = useCallback((newAnnotations: Annotation[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newAnnotations);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Delete handler - defined before useEffect that uses it
  const handleDelete = useCallback(() => {
    if (selectedAnnotationId) {
      const newAnnotations = annotations.filter((a) => a.id !== selectedAnnotationId);
      deleteAnnotation(selectedAnnotationId);
      pushToHistory(newAnnotations as Annotation[]);
    }
  }, [selectedAnnotationId, annotations, deleteAnnotation, pushToHistory]);

  // Undo/Redo handlers - defined before useEffect that uses them
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const storeAnnotations = history[newIndex].map((a) => ({
        ...a,
        type: a.type as StoreAnnotation["type"],
      }));
      setAnnotations(storeAnnotations);
    }
  }, [historyIndex, history, setAnnotations]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const storeAnnotations = history[newIndex].map((a) => ({
        ...a,
        type: a.type as StoreAnnotation["type"],
      }));
      setAnnotations(storeAnnotations);
    }
  }, [historyIndex, history, setAnnotations]);

  // Zoom handlers - defined before useEffect that uses them
  const handleZoomIn = useCallback(() => setZoom(zoom * 1.2), [setZoom, zoom]);
  const handleZoomOut = useCallback(() => setZoom(zoom / 1.2), [setZoom, zoom]);
  const handleZoomReset = useCallback(() => resetView(), [resetView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "r":
          setTool("rectangle");
          break;
        case "c":
          setTool("circle");
          break;
        case "a":
          setTool("arrow");
          break;
        case "delete":
        case "backspace":
          if (selectedAnnotationId) {
            handleDelete();
          }
          break;
        case "escape":
          if (isDrawing) {
            cancelDrawing();
          } else {
            selectAnnotation(null);
          }
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            e.preventDefault();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            handleRedo();
            e.preventDefault();
          }
          break;
        case "=":
        case "+":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "0":
          handleZoomReset();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedAnnotationId,
    isDrawing,
    setTool,
    selectAnnotation,
    cancelDrawing,
    handleDelete,
    handleUndo,
    handleRedo,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  ]);

  // Drawing handlers
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (selectedTool === "select") return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Adjust for zoom and pan
    const x = (pos.x - panX) / zoom;
    const y = (pos.y - panY) / zoom;

    const id = crypto.randomUUID();
    const normalizedX = normalizeCoordinate(x, stageWidth);
    const normalizedY = normalizeCoordinate(y, stageHeight);

    const newAnnotation: StoreAnnotation = {
      id,
      type: selectedTool as StoreAnnotation["type"],
      x: normalizedX,
      y: normalizedY,
      width: 0,
      height: 0,
      points: selectedTool === "arrow" ? [normalizedX, normalizedY, normalizedX, normalizedY] : undefined,
      stroke: strokeColor,
      strokeWidth: 2,
    };

    startDrawing(newAnnotation);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !drawingAnnotation) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const x = (pos.x - panX) / zoom;
    const y = (pos.y - panY) / zoom;

    const startX = drawingAnnotation.x * stageWidth;
    const startY = drawingAnnotation.y * stageHeight;

    if (selectedTool === "arrow") {
      updateDrawing({
        points: [
          drawingAnnotation.x,
          drawingAnnotation.y,
          normalizeCoordinate(x, stageWidth),
          normalizeCoordinate(y, stageHeight),
        ],
      });
    } else {
      const width = x - startX;
      const height = y - startY;

      updateDrawing({
        width: normalizeCoordinate(Math.abs(width), stageWidth),
        height: normalizeCoordinate(Math.abs(height), stageHeight),
        x: width < 0 ? normalizeCoordinate(x, stageWidth) : drawingAnnotation.x,
        y: height < 0 ? normalizeCoordinate(y, stageHeight) : drawingAnnotation.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawingAnnotation) return;

    // Check if shape has valid size
    const hasSize =
      drawingAnnotation.type === "arrow"
        ? drawingAnnotation.points &&
          drawingAnnotation.points.length >= 4 &&
          (drawingAnnotation.points[0] !== drawingAnnotation.points[2] ||
            drawingAnnotation.points[1] !== drawingAnnotation.points[3])
        : (drawingAnnotation.width || 0) > 0.01 && (drawingAnnotation.height || 0) > 0.01;

    if (hasSize) {
      const finished = finishDrawing();
      if (finished) {
        pushToHistory([...annotations, finished] as Annotation[]);
      }
    } else {
      cancelDrawing();
    }
  };

  // Stage click handler for deselection
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only deselect if clicking on empty stage area
    if (e.target === e.target.getStage()) {
      selectAnnotation(null);
    }
  };

  // Annotation update handler
  const handleAnnotationChange = (id: string, updates: Partial<Annotation>) => {
    updateAnnotation(id, updates);
    // Push to history after transform/drag ends
    const updatedAnnotations = annotations.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );
    pushToHistory(updatedAnnotations as Annotation[]);
  };

  // Double-click handler (placeholder for future functionality)
  const handleAnnotationDoubleClick = useCallback((annotationId: string) => {
    // In the new architecture, annotations belong to screenshots which belong to test cases
    // Double-click could be used for viewing annotation details or editing
    console.log("Annotation double-clicked:", annotationId);
  }, []);

  // Wheel handler for zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = zoom;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // Get pointer position
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Calculate new pan to zoom towards pointer
    const mousePointTo = {
      x: (pointer.x - panX) / oldScale,
      y: (pointer.y - panY) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setZoom(newScale);
    setPan(newPos.x, newPos.y);
  };

  // Render current annotation being drawn
  const renderDrawingAnnotation = () => {
    if (!isDrawing || !drawingAnnotation) return null;

    return (
      <AnnotationShape
        annotation={drawingAnnotation as Annotation}
        containerSize={{ width: stageWidth, height: stageHeight }}
        isSelected={false}
        onSelect={() => {}}
        onChange={() => {}}
        draggable={false}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      <AnnotationToolbar
        selectedTool={selectedTool as AnnotationTool}
        onToolChange={(tool) => setTool(tool)}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        hasSelection={!!selectedAnnotationId}
        onDelete={handleDelete}
        canUndo={historyIndex > 0}
        onUndo={handleUndo}
        canRedo={historyIndex < history.length - 1}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        saveStatus={saveStatus}
        onSave={onSave}
      />

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted/50 flex items-center justify-center"
      >
        {!isMounted ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            scaleX={zoom}
            scaleY={zoom}
            x={panX}
            y={panY}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleStageClick}
            onWheel={handleWheel}
            style={{
              cursor: selectedTool === "select" ? "default" : "crosshair",
            }}
          >
            <Layer>
              {/* Background image */}
              {image && (
                <KonvaImage
                  image={image}
                  width={stageWidth}
                  height={stageHeight}
                  x={(containerSize.width / zoom - stageWidth) / 2}
                  y={(containerSize.height / zoom - stageHeight) / 2}
                />
              )}
            </Layer>

            <Layer
              offsetX={-(containerSize.width / zoom - stageWidth) / 2}
              offsetY={-(containerSize.height / zoom - stageHeight) / 2}
            >
              {/* Existing annotations */}
              {annotations.map((annotation) => (
                <AnnotationShape
                  key={annotation.id}
                  annotation={annotation as Annotation}
                  containerSize={{ width: stageWidth, height: stageHeight }}
                  isSelected={selectedAnnotationId === annotation.id}
                  onSelect={() => selectAnnotation(annotation.id)}
                  onChange={(updates) => handleAnnotationChange(annotation.id, updates)}
                  onDoubleClick={() => handleAnnotationDoubleClick(annotation.id)}
                  draggable={selectedTool === "select"}
                  hasTestCase={!!annotationTestCaseMap[annotation.id]}
                />
              ))}

              {/* Currently drawing annotation */}
              {renderDrawingAnnotation()}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
