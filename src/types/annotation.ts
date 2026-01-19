// Annotation types for frontend (lowercase)
export type AnnotationType = "rectangle" | "circle" | "arrow" | "freehand";

// Prisma enum types (uppercase)
export type PrismaAnnotationType = "RECTANGLE" | "CIRCLE" | "ARROW" | "FREEHAND";

// Conversion utilities
export function toPrismaAnnotationType(type: AnnotationType): PrismaAnnotationType {
  return type.toUpperCase() as PrismaAnnotationType;
}

export function fromPrismaAnnotationType(type: PrismaAnnotationType | string): AnnotationType {
  return type.toLowerCase() as AnnotationType;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  // Normalized coordinates (0-1 range)
  x: number;
  y: number;
  // Dimensions (normalized, for rectangle)
  width?: number;
  height?: number;
  // Radius (normalized, for circle)
  radius?: number;
  // Points for arrow: [startX, startY, endX, endY] (normalized)
  points?: number[];
  // Styling
  stroke: string;
  strokeWidth: number;
  fill?: string;
  // Relations
  bugId?: string;
  screenshotId?: string;
  // Metadata
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Shape drawing state
export interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentAnnotation: Partial<Annotation> | null;
}

// Canvas coordinate systems
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Coordinate conversion utilities
export function normalizeCoordinate(value: number, dimension: number): number {
  return Math.max(0, Math.min(1, value / dimension));
}

export function denormalizeCoordinate(value: number, dimension: number): number {
  return value * dimension;
}

export function normalizePoint(point: Point, containerSize: Size): Point {
  return {
    x: normalizeCoordinate(point.x, containerSize.width),
    y: normalizeCoordinate(point.y, containerSize.height),
  };
}

export function denormalizePoint(point: Point, containerSize: Size): Point {
  return {
    x: denormalizeCoordinate(point.x, containerSize.width),
    y: denormalizeCoordinate(point.y, containerSize.height),
  };
}

export function normalizeBounds(bounds: Bounds, containerSize: Size): Bounds {
  return {
    x: normalizeCoordinate(bounds.x, containerSize.width),
    y: normalizeCoordinate(bounds.y, containerSize.height),
    width: normalizeCoordinate(bounds.width, containerSize.width),
    height: normalizeCoordinate(bounds.height, containerSize.height),
  };
}

export function denormalizeBounds(bounds: Bounds, containerSize: Size): Bounds {
  return {
    x: denormalizeCoordinate(bounds.x, containerSize.width),
    y: denormalizeCoordinate(bounds.y, containerSize.height),
    width: denormalizeCoordinate(bounds.width, containerSize.width),
    height: denormalizeCoordinate(bounds.height, containerSize.height),
  };
}

// Default styles
export const DEFAULT_STROKE_COLOR = "#EF4444"; // Red
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FILL = "transparent";

// Tool types
export type AnnotationTool = "select" | "rectangle" | "circle" | "arrow" | "freehand";

// Undo/Redo action types
export type AnnotationAction =
  | { type: "add"; annotation: Annotation }
  | { type: "update"; annotationId: string; before: Partial<Annotation>; after: Partial<Annotation> }
  | { type: "delete"; annotation: Annotation };
