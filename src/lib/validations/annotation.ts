import { z } from "zod";

// Annotation types matching Prisma enum (uppercase in DB, lowercase in frontend)
export const annotationTypeSchema = z.enum(["rectangle", "circle", "arrow", "freehand"]);

// Convert frontend type to Prisma enum
export function toPrismaAnnotationType(type: string): "RECTANGLE" | "CIRCLE" | "ARROW" | "FREEHAND" {
  return type.toUpperCase() as "RECTANGLE" | "CIRCLE" | "ARROW" | "FREEHAND";
}

// Convert Prisma enum to frontend type
export function fromPrismaAnnotationType(type: string): "rectangle" | "circle" | "arrow" | "freehand" {
  return type.toLowerCase() as "rectangle" | "circle" | "arrow" | "freehand";
}

// Base annotation schema for shared fields
// Note: Bug links are managed via many-to-many relationship (bugs.create connects to annotation)
const annotationBaseSchema = z.object({
  type: annotationTypeSchema,
  x: z.number().min(0).max(1), // Normalized 0-1
  y: z.number().min(0).max(1), // Normalized 0-1
  stroke: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "Invalid hex color" }).default("#EF4444"),
  strokeWidth: z.number().min(1).max(10).default(2),
  fill: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// Rectangle annotation
export const rectangleAnnotationSchema = annotationBaseSchema.extend({
  type: z.literal("rectangle"),
  width: z.number().min(0).max(1), // Normalized
  height: z.number().min(0).max(1), // Normalized
});

// Circle annotation
export const circleAnnotationSchema = annotationBaseSchema.extend({
  type: z.literal("circle"),
  width: z.number().min(0).max(1), // Diameter X (normalized)
  height: z.number().min(0).max(1), // Diameter Y (normalized)
  radius: z.number().min(0).max(1).optional(), // Legacy field
});

// Arrow annotation - points: [startX, startY, endX, endY]
export const arrowAnnotationSchema = annotationBaseSchema.extend({
  type: z.literal("arrow"),
  points: z.array(z.number().min(0).max(1)).length(4),
});

// Freehand annotation - points: [x1, y1, x2, y2, ...]
export const freehandAnnotationSchema = annotationBaseSchema.extend({
  type: z.literal("freehand"),
  points: z.array(z.number().min(0).max(1)).min(4), // At least 2 points
});

// Union schema for any annotation
export const annotationSchema = z.discriminatedUnion("type", [
  rectangleAnnotationSchema,
  circleAnnotationSchema,
  arrowAnnotationSchema,
  freehandAnnotationSchema,
]);

// Create annotation input (without id)
export const createAnnotationSchema = z.object({
  screenshotId: z.string().cuid(),
  annotations: z.array(annotationSchema),
});

// Update annotation input
// Note: Bug links are managed via many-to-many relationship
export const updateAnnotationSchema = z.object({
  id: z.string().cuid(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  radius: z.number().min(0).max(1).optional(),
  points: z.array(z.number()).optional(),
  stroke: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  strokeWidth: z.number().min(1).max(10).optional(),
  fill: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// Batch update annotations for a screenshot
// Note: Bug links are managed via many-to-many relationship
export const batchUpdateAnnotationsSchema = z.object({
  screenshotId: z.string().cuid(),
  annotations: z.array(
    z.object({
      id: z.string().optional(), // No id = create, with id = update
      type: annotationTypeSchema,
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1).optional(),
      height: z.number().min(0).max(1).optional(),
      radius: z.number().min(0).max(1).optional(),
      points: z.array(z.number()).optional(),
      stroke: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#EF4444"),
      strokeWidth: z.number().min(1).max(10).default(2),
      fill: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
    })
  ),
});

// Delete annotation input
export const deleteAnnotationSchema = z.object({
  id: z.string().cuid(),
});

// Get annotations by screenshot
export const getAnnotationsByScreenshotSchema = z.object({
  screenshotId: z.string().cuid(),
});

// Link annotation to bug
export const linkAnnotationToBugSchema = z.object({
  annotationId: z.string().cuid(),
  bugId: z.string().cuid().nullable(),
});

// Types
export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type BatchUpdateAnnotationsInput = z.infer<typeof batchUpdateAnnotationsSchema>;
export type DeleteAnnotationInput = z.infer<typeof deleteAnnotationSchema>;
export type GetAnnotationsByScreenshotInput = z.infer<typeof getAnnotationsByScreenshotSchema>;
export type LinkAnnotationToBugInput = z.infer<typeof linkAnnotationToBugSchema>;
