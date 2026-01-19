"use client";

import type { Annotation, Size } from "@/types/annotation";
import { RectangleShape } from "./rectangle";
import { CircleShape } from "./circle";
import { ArrowShape } from "./arrow";

export interface AnnotationShapeProps {
  annotation: Annotation;
  containerSize: Size;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<Annotation>) => void;
  onDoubleClick?: () => void;
  draggable: boolean;
  hasBug?: boolean;
}

export function AnnotationShape(props: AnnotationShapeProps) {
  const { annotation } = props;

  switch (annotation.type) {
    case "rectangle":
      return <RectangleShape {...props} />;
    case "circle":
      return <CircleShape {...props} />;
    case "arrow":
      return <ArrowShape {...props} />;
    default:
      return null;
  }
}

export { RectangleShape } from "./rectangle";
export { CircleShape } from "./circle";
export { ArrowShape } from "./arrow";
