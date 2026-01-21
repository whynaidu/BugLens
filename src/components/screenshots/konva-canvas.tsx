"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Transformer: any;
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
            Transformer: konva.Transformer,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformerRef = useRef<any>(null);
  // Store refs for each annotation shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapeRefs = useRef<Map<string, any>>(new Map());

  const { Stage, Layer, Image: KonvaImage, Rect, Circle, Arrow, Line, Transformer } = konva;

  // Update transformer when selection changes
  useEffect(() => {
    if (transformerRef.current) {
      if (selectedAnnotationId) {
        const selectedNode = shapeRefs.current.get(selectedAnnotationId);
        if (selectedNode) {
          transformerRef.current.nodes([selectedNode]);
          transformerRef.current.getLayer()?.batchDraw();
        }
      } else {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedAnnotationId]);

  // Store ref for a shape
  const setShapeRef = useCallback((id: string, node: unknown) => {
    if (node) {
      shapeRefs.current.set(id, node);
    } else {
      shapeRefs.current.delete(id);
    }
  }, []);

  // Render annotation shape
  const renderAnnotation = (annotation: Annotation, isDrawingMode = false) => {
    const isSelected = selectedAnnotationId === annotation.id && !isDrawingMode;

    const handleClick = () => {
      if (isDrawingMode) return;
      onSelectAnnotation(annotation.id);
      onAnnotationClick?.(annotation);
    };

    // Common props for all shapes
    const commonProps = {
      key: annotation.id,
      stroke: annotation.stroke,
      strokeWidth: annotation.strokeWidth,
      onClick: handleClick,
      onTap: handleClick,
      draggable: isSelected,
      shadowColor: isSelected ? "blue" : undefined,
      shadowBlur: isSelected ? 10 : 0,
    };

    // Type for transform event
    type TransformEvent = {
      target: {
        x: () => number;
        y: () => number;
        width: () => number;
        height: () => number;
        scaleX: () => number;
        scaleY: () => number;
        rotation: () => number;
        setAttrs: (attrs: Record<string, unknown>) => void;
        position: (pos: { x: number; y: number }) => void;
      };
    };

    switch (annotation.type) {
      case "rectangle":
        return (
          <Rect
            {...commonProps}
            ref={(node: unknown) => !isDrawingMode && setShapeRef(annotation.id, node)}
            x={annotation.x}
            y={annotation.y}
            width={annotation.width || 0}
            height={annotation.height || 0}
            fill="transparent"
            onDragEnd={(e: { target: { x: () => number; y: () => number } }) => {
              const node = e.target;
              onAnnotationUpdate?.(annotation.id, {
                x: node.x(),
                y: node.y(),
              });
            }}
            onTransformEnd={(e: TransformEvent) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Reset scale and apply to width/height
              node.setAttrs({
                scaleX: 1,
                scaleY: 1,
                width: Math.max(5, node.width() * scaleX),
                height: Math.max(5, node.height() * scaleY),
              });

              onAnnotationUpdate?.(annotation.id, {
                x: node.x(),
                y: node.y(),
                width: node.width() * scaleX,
                height: node.height() * scaleY,
              });
            }}
          />
        );
      case "circle":
        const rx = Math.abs((annotation.width || 0) / 2);
        const ry = Math.abs((annotation.height || 0) / 2);
        return (
          <Circle
            {...commonProps}
            ref={(node: unknown) => !isDrawingMode && setShapeRef(annotation.id, node)}
            x={annotation.x + rx}
            y={annotation.y + ry}
            radiusX={rx || 1}
            radiusY={ry || 1}
            fill="transparent"
            onDragEnd={(e: { target: { x: () => number; y: () => number } }) => {
              const node = e.target;
              // Circle is centered, so we need to adjust back to top-left corner
              onAnnotationUpdate?.(annotation.id, {
                x: node.x() - rx,
                y: node.y() - ry,
              });
            }}
            onTransformEnd={(e: TransformEvent) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Get the new radii after scaling
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const nodeAny = node as any;
              const newRadiusX = Math.max(5, (nodeAny.radiusX?.() || rx) * scaleX);
              const newRadiusY = Math.max(5, (nodeAny.radiusY?.() || ry) * scaleY);

              // Reset scale
              node.setAttrs({
                scaleX: 1,
                scaleY: 1,
              });

              // Calculate new top-left corner from center position
              const centerX = node.x();
              const centerY = node.y();

              onAnnotationUpdate?.(annotation.id, {
                x: centerX - newRadiusX,
                y: centerY - newRadiusY,
                width: newRadiusX * 2,
                height: newRadiusY * 2,
              });
            }}
          />
        );
      case "arrow":
        const arrowPts = annotation.points || [annotation.x, annotation.y, annotation.x, annotation.y];
        return (
          <Arrow
            {...commonProps}
            ref={(node: unknown) => !isDrawingMode && setShapeRef(annotation.id, node)}
            points={arrowPts}
            pointerLength={10}
            pointerWidth={10}
            fill={annotation.stroke}
            hitStrokeWidth={20}
            onDragEnd={(e: { target: { x: () => number; y: () => number; position: (pos: { x: number; y: number }) => void } }) => {
              const node = e.target;
              // For lines/arrows, the node position is the drag offset
              const dx = node.x();
              const dy = node.y();
              // Reset node position and update points with the delta
              node.position({ x: 0, y: 0 });
              const newPoints = arrowPts.map((val, idx) =>
                idx % 2 === 0 ? val + dx : val + dy
              );
              onAnnotationUpdate?.(annotation.id, {
                points: newPoints,
              });
            }}
            onTransformEnd={(e: TransformEvent) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Reset scale
              node.setAttrs({
                scaleX: 1,
                scaleY: 1,
              });

              // Scale all points relative to the shape's position
              const offsetX = node.x();
              const offsetY = node.y();
              node.position({ x: 0, y: 0 });

              const newPoints = arrowPts.map((val, idx) => {
                if (idx % 2 === 0) {
                  return (val - arrowPts[0]) * scaleX + arrowPts[0] + offsetX;
                } else {
                  return (val - arrowPts[1]) * scaleY + arrowPts[1] + offsetY;
                }
              });

              onAnnotationUpdate?.(annotation.id, {
                points: newPoints,
              });
            }}
          />
        );
      case "freehand":
        const freehandPts = annotation.points || [];
        return (
          <Line
            {...commonProps}
            ref={(node: unknown) => !isDrawingMode && setShapeRef(annotation.id, node)}
            points={freehandPts}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={20}
            onDragEnd={(e: { target: { x: () => number; y: () => number; position: (pos: { x: number; y: number }) => void } }) => {
              const node = e.target;
              // For lines, the node position is the drag offset
              const dx = node.x();
              const dy = node.y();
              // Reset node position and update points with the delta
              node.position({ x: 0, y: 0 });
              const newPoints = freehandPts.map((val, idx) =>
                idx % 2 === 0 ? val + dx : val + dy
              );
              onAnnotationUpdate?.(annotation.id, {
                points: newPoints,
              });
            }}
            onTransformEnd={(e: TransformEvent) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // Reset scale
              node.setAttrs({
                scaleX: 1,
                scaleY: 1,
              });

              // Find bounding box of original points
              let minX = Infinity, minY = Infinity;
              for (let i = 0; i < freehandPts.length; i += 2) {
                minX = Math.min(minX, freehandPts[i]);
                minY = Math.min(minY, freehandPts[i + 1]);
              }

              // Scale all points relative to the min point
              const offsetX = node.x();
              const offsetY = node.y();
              node.position({ x: 0, y: 0 });

              const newPoints = freehandPts.map((val, idx) => {
                if (idx % 2 === 0) {
                  return (val - minX) * scaleX + minX + offsetX;
                } else {
                  return (val - minY) * scaleY + minY + offsetY;
                }
              });

              onAnnotationUpdate?.(annotation.id, {
                points: newPoints,
              });
            }}
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
        {/* Transformer for resize handles */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          boundBoxFunc={(oldBox: { x: number; y: number; width: number; height: number }, newBox: { x: number; y: number; width: number; height: number }) => {
            // Limit minimum size
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
              return oldBox;
            }
            return newBox;
          }}
        />
      </Layer>
    </Stage>
  );
}

export default KonvaCanvas;
