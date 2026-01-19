"use client";

import { useRef, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Annotation } from "@/store/annotation-store";

interface KonvaCanvasProps {
  containerSize: { width: number; height: number };
  image: HTMLImageElement | null;
  imageSize: { width: number; height: number };
  panX: number;
  panY: number;
  totalScale: number;
  annotations: Annotation[];
  drawingAnnotation: Annotation | null;
  selectedAnnotationId: string | null;
  onMouseDown: (e: unknown) => void;
  onMouseMove: (e: unknown) => void;
  onMouseUp: () => void;
  onWheel: (e: unknown) => void;
  onSelectAnnotation: (id: string | null) => void;
  onAnnotationUpdate?: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
}

// Store for dynamically loaded Konva components
// Using any to avoid complex type issues with dynamic imports
interface KonvaComponents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Stage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Layer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Image: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Rect: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Circle: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Arrow: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Line: any;
}

export function KonvaCanvas(props: KonvaCanvasProps) {
  const [konvaComponents, setKonvaComponents] = useState<KonvaComponents | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load react-konva dynamically after mount
  useEffect(() => {
    let mounted = true;

    const loadKonva = async () => {
      try {
        // Dynamic import - only executes on client after mount
        const konva = await import("react-konva");
        if (mounted) {
          setKonvaComponents({
            Stage: konva.Stage,
            Layer: konva.Layer,
            Image: konva.Image,
            Rect: konva.Rect,
            Circle: konva.Ellipse, // Use Ellipse for circle/ellipse shapes
            Arrow: konva.Arrow,
            Line: konva.Line,
          });
        }
      } catch (err) {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : "Failed to load canvas");
          console.error("Failed to load react-konva:", err);
        }
      }
    };

    loadKonva();

    return () => {
      mounted = false;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        <p>Failed to load canvas: {loadError}</p>
      </div>
    );
  }

  if (!konvaComponents) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <KonvaCanvasInner {...props} konva={konvaComponents} />;
}

// Inner component that uses the loaded Konva components
function KonvaCanvasInner({
  containerSize,
  image,
  imageSize,
  panX,
  panY,
  totalScale,
  annotations,
  drawingAnnotation,
  selectedAnnotationId,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onSelectAnnotation,
  onAnnotationUpdate,
  onAnnotationClick,
  konva,
}: KonvaCanvasProps & { konva: KonvaComponents }) {
  const stageRef = useRef(null);
  const { Stage, Layer, Image: KonvaImage, Rect, Circle, Arrow, Line } = konva;

  // Render annotation shape
  const renderAnnotation = (annotation: Annotation, isDrawingMode = false) => {
    const isSelected = selectedAnnotationId === annotation.id && !isDrawingMode;

    const handleClick = () => {
      if (isDrawingMode) return;
      onSelectAnnotation(annotation.id);
      onAnnotationClick?.(annotation);
    };

    const props = {
      key: annotation.id,
      stroke: annotation.stroke,
      strokeWidth: annotation.strokeWidth,
      onClick: handleClick,
      onTap: handleClick,
      draggable: isSelected,
      onDragEnd: (e: { target: { x: () => number; y: () => number } }) => {
        const node = e.target;
        onAnnotationUpdate?.(annotation.id, {
          x: node.x(),
          y: node.y(),
        });
      },
    };

    switch (annotation.type) {
      case "rectangle":
        return (
          <Rect
            {...props}
            x={annotation.x}
            y={annotation.y}
            width={annotation.width || 0}
            height={annotation.height || 0}
            fill="transparent"
            shadowColor={isSelected ? "blue" : undefined}
            shadowBlur={isSelected ? 10 : 0}
          />
        );
      case "circle":
        const rx = Math.abs((annotation.width || 0) / 2);
        const ry = Math.abs((annotation.height || 0) / 2);
        return (
          <Circle
            {...props}
            x={annotation.x + rx}
            y={annotation.y + ry}
            radiusX={rx || 1}
            radiusY={ry || 1}
            fill="transparent"
            shadowColor={isSelected ? "blue" : undefined}
            shadowBlur={isSelected ? 10 : 0}
          />
        );
      case "arrow":
        const arrowPts = annotation.points || [annotation.x, annotation.y, annotation.x, annotation.y];
        return (
          <Arrow
            {...props}
            points={arrowPts}
            pointerLength={10}
            pointerWidth={10}
            fill={annotation.stroke}
            hitStrokeWidth={20}
            shadowColor={isSelected ? "blue" : undefined}
            shadowBlur={isSelected ? 10 : 0}
          />
        );
      case "freehand":
        return (
          <Line
            {...props}
            points={annotation.points || []}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={20}
            shadowColor={isSelected ? "blue" : undefined}
            shadowBlur={isSelected ? 10 : 0}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={containerSize.width}
      height={containerSize.height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
    >
      {/* Image layer */}
      <Layer>
        {image && (
          <KonvaImage
            image={image}
            x={panX}
            y={panY}
            width={imageSize.width * totalScale}
            height={imageSize.height * totalScale}
          />
        )}
      </Layer>

      {/* Annotations layer */}
      <Layer>
        {annotations.map((annotation) => renderAnnotation(annotation))}
        {drawingAnnotation && renderAnnotation(drawingAnnotation, true)}
      </Layer>
    </Stage>
  );
}

export default KonvaCanvas;
