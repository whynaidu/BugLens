"use client";

import { useRef, useEffect } from "react";
import { Ellipse, Transformer, Group, Circle as KonvaCircle, Text } from "react-konva";
import type Konva from "konva";

import {
  denormalizeCoordinate,
  normalizeCoordinate,
} from "@/types/annotation";
import type { AnnotationShapeProps } from "./index";

export function CircleShape({
  annotation,
  containerSize,
  isSelected,
  onSelect,
  onChange,
  onDoubleClick,
  draggable,
  hasBug = false,
}: AnnotationShapeProps) {
  const shapeRef = useRef<Konva.Ellipse>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Convert normalized coordinates to pixel coordinates
  // For circle, we store x, y as center and width/height as diameters
  const centerX = denormalizeCoordinate(annotation.x, containerSize.width);
  const centerY = denormalizeCoordinate(annotation.y, containerSize.height);
  const radiusX = denormalizeCoordinate((annotation.width || 0) / 2, containerSize.width);
  const radiusY = denormalizeCoordinate((annotation.height || 0) / 2, containerSize.height);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange({
      x: normalizeCoordinate(node.x(), containerSize.width),
      y: normalizeCoordinate(node.y(), containerSize.height),
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    const newRadiusX = Math.max(5, node.radiusX() * scaleX);
    const newRadiusY = Math.max(5, node.radiusY() * scaleY);

    onChange({
      x: normalizeCoordinate(node.x(), containerSize.width),
      y: normalizeCoordinate(node.y(), containerSize.height),
      width: normalizeCoordinate(newRadiusX * 2, containerSize.width),
      height: normalizeCoordinate(newRadiusY * 2, containerSize.height),
    });
  };

  return (
    <>
      <Group>
        <Ellipse
          ref={shapeRef}
          id={annotation.id}
          x={centerX}
          y={centerY}
          radiusX={radiusX}
          radiusY={radiusY}
          stroke={hasBug ? "#22c55e" : annotation.stroke}
          strokeWidth={hasBug ? 3 : annotation.strokeWidth}
          fill="transparent"
          draggable={draggable && isSelected}
          onClick={onSelect}
          onTap={onSelect}
          onDblClick={onDoubleClick}
          onDblTap={onDoubleClick}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
          hitStrokeWidth={10}
        />
        {/* Bug indicator badge */}
        {hasBug && (
          <Group x={centerX + radiusX - 8} y={centerY - radiusY - 8}>
            <KonvaCircle
              radius={10}
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth={2}
            />
            <Text
              text="B"
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
