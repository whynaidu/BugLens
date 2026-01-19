"use client";

import { useRef, useEffect } from "react";
import { Arrow, Circle, Group, Transformer, Circle as KonvaCircle, Text } from "react-konva";
import type Konva from "konva";

import { denormalizeCoordinate, normalizeCoordinate } from "@/types/annotation";
import type { AnnotationShapeProps } from "./index";

export function ArrowShape({
  annotation,
  containerSize,
  isSelected,
  onSelect,
  onChange,
  onDoubleClick,
  draggable,
  hasBug = false,
}: AnnotationShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Points: [startX, startY, endX, endY] (normalized)
  const points = annotation.points || [annotation.x, annotation.y, annotation.x, annotation.y];
  const startX = denormalizeCoordinate(points[0], containerSize.width);
  const startY = denormalizeCoordinate(points[1], containerSize.height);
  const endX = denormalizeCoordinate(points[2], containerSize.width);
  const endY = denormalizeCoordinate(points[3], containerSize.height);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();

    // Reset position and update points
    node.position({ x: 0, y: 0 });

    const newPoints = [
      normalizeCoordinate(startX + dx, containerSize.width),
      normalizeCoordinate(startY + dy, containerSize.height),
      normalizeCoordinate(endX + dx, containerSize.width),
      normalizeCoordinate(endY + dy, containerSize.height),
    ];

    onChange({ points: newPoints });
  };

  const handleStartDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target;
    const newPoints = [
      normalizeCoordinate(node.x(), containerSize.width),
      normalizeCoordinate(node.y(), containerSize.height),
      points[2],
      points[3],
    ];
    onChange({ points: newPoints });
  };

  const handleEndDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target;
    const newPoints = [
      points[0],
      points[1],
      normalizeCoordinate(node.x(), containerSize.width),
      normalizeCoordinate(node.y(), containerSize.height),
    ];
    onChange({ points: newPoints });
  };

  const strokeColor = hasBug ? "#22c55e" : annotation.stroke;
  const strokeWidth = hasBug ? 3 : annotation.strokeWidth;

  return (
    <>
      <Group
        ref={groupRef}
        id={annotation.id}
        draggable={draggable && isSelected}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={onDoubleClick}
        onDblTap={onDoubleClick}
        onDragEnd={handleDragEnd}
      >
        <Arrow
          points={[startX, startY, endX, endY]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill={strokeColor}
          pointerLength={12}
          pointerWidth={10}
          hitStrokeWidth={10}
        />
        {/* Bug indicator badge */}
        {hasBug && (
          <Group x={endX + 15} y={endY - 15}>
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
        {/* Endpoint handles when selected */}
        {isSelected && (
          <>
            <Circle
              x={startX}
              y={startY}
              radius={6}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={2}
              draggable
              onDragMove={handleStartDrag}
              onDragEnd={handleStartDrag}
            />
            <Circle
              x={endX}
              y={endY}
              radius={6}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={2}
              draggable
              onDragMove={handleEndDrag}
              onDragEnd={handleEndDrag}
            />
          </>
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={[]}
          anchorSize={0}
          borderStroke="#3b82f6"
          borderDash={[4, 4]}
        />
      )}
    </>
  );
}
