import { z } from "zod";

export const MAX_MODULE_DEPTH = 3; // 0-indexed, so 4 levels total

export const createModuleSchema = z.object({
  projectId: z.string().cuid(),
  parentId: z.string().cuid().optional().nullable(),
  name: z
    .string()
    .min(1, "Module name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  code: z
    .string()
    .max(10, "Code must be 10 characters or less")
    .regex(/^[A-Z0-9]*$/, "Code must be uppercase letters and numbers only")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .nullable(),
});

export const updateModuleSchema = z.object({
  moduleId: z.string().cuid(),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional(),
  code: z
    .string()
    .max(10, "Code must be 10 characters or less")
    .regex(/^[A-Z0-9]*$/, "Code must be uppercase letters and numbers only")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .nullable(),
});

export const deleteModuleSchema = z.object({
  moduleId: z.string().cuid(),
});

export const getModulesSchema = z.object({
  projectId: z.string().cuid(),
});

export const getModuleByIdSchema = z.object({
  moduleId: z.string().cuid(),
});

export const reorderModulesSchema = z.object({
  parentId: z.string().cuid().optional().nullable(), // null = root level
  moduleIds: z.array(z.string().cuid()).min(1, "At least one module ID is required"),
});

export const moveModuleSchema = z.object({
  moduleId: z.string().cuid(),
  newParentId: z.string().cuid().optional().nullable(), // null = move to root
});

// Validate that module depth doesn't exceed max
export function validateModuleDepth(parentDepth: number | null): boolean {
  if (parentDepth === null) return true; // Creating at root level
  return parentDepth < MAX_MODULE_DEPTH;
}

// Calculate new depth based on parent
export function calculateModuleDepth(parentDepth: number | null): number {
  if (parentDepth === null) return 0;
  return parentDepth + 1;
}

// Types
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type DeleteModuleInput = z.infer<typeof deleteModuleSchema>;
export type GetModulesInput = z.infer<typeof getModulesSchema>;
export type GetModuleByIdInput = z.infer<typeof getModuleByIdSchema>;
export type ReorderModulesInput = z.infer<typeof reorderModulesSchema>;
export type MoveModuleInput = z.infer<typeof moveModuleSchema>;
