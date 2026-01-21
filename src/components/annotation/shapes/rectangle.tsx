"use client";

import { useRef, useEffect } from "react";
import { Rect, Transformer, Group, Circle as KonvaCircle, Text } from "react-konva";
import type Konva from "konva";

import { denormalizeBounds, normalizeBounds } from "@/types/annotation";
import type { AnnotationShapeProps } from "./index";

export function RectangleShape({
  annotation,
  containerSize,
  isSelected,
  onSelect,
  onChange,
  onDoubleClick,
  draggable,
  hasTestCase = false,
}: AnnotationShapeProps) {
  const shapeRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Convert normalized coordinates to pixel coordinates
  const bounds = denormalizeBounds(
    {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width || 0,
      height: annotation.height || 0,
    },
    containerSize
  );

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const normalized = normalizeBounds(
      {
        x: node.x(),
        y: node.y(),
        width: bounds.width,
        height: bounds.height,
      },
      containerSize
    );

    onChange({
      x: normalized.x,
      y: normalized.y,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(5, node.width() * scaleX);
    const newHeight = Math.max(5, node.height() * scaleY);

    const normalized = normalizeBounds(
      {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight,
      },
      containerSize
    );

    onChange({
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
    });
  };

  return (
    <>
      <Group>
        <Rect
          ref={shapeRef}
          id={annotation.id}
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          stroke={hasTestCase ? "#22c55e" : annotation.stroke}
          strokeWidth={hasTestCase ? 3 : annotation.strokeWidth}
          fill="transparent"
          draggable={draggable && isSelected}
          onClick={onSelect}
          onTap={onSelect}
          onDblClick={onDoubleClick}
          onDblTap={onDoubleClick}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
          // Visual feedback
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
          hitStrokeWidth={10} // Easier to click
        />
        {/* Test case indicator badge */}
        {hasTestCase && (
          <Group x={bounds.x + bounds.width - 8} y={bounds.y - 8}>
            <KonvaCircle
              radius={10}
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth={2}
            />
            <Text
              text="T"
              fontSize={10}
              fontStyle="bold"
              fill="#ffffff"
              x={-4}
              y={-5}
            />
          </Group>
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize to minimum size
            const minSize = 10;
            if (newBox.width < minSize || newBox.height < minSize) {
              return oldBox;
            }
            return newBox;
          }}
          rotateEnabled={false}
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
          anchorSize={8}
          anchorCornerRadius={2}
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          anchorFill="#ffffff"
        />
      )}
    </>
  );
}
