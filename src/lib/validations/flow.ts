import { z } from "zod";

export const createFlowSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z
    .string()
    .min(1, "Flow name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

export const updateFlowSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  flowId: z.string().min(1, "Flow ID is required"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .nullable(),
});

export const deleteFlowSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  flowId: z.string().min(1, "Flow ID is required"),
});

export const reorderFlowsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  flowIds: z.array(z.string()).min(1, "At least one flow ID is required"),
});

export const getFlowsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export const getFlowByIdSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  flowId: z.string().min(1, "Flow ID is required"),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type DeleteFlowInput = z.infer<typeof deleteFlowSchema>;
export type ReorderFlowsInput = z.infer<typeof reorderFlowsSchema>;
export type GetFlowsInput = z.infer<typeof getFlowsSchema>;
export type GetFlowByIdInput = z.infer<typeof getFlowByIdSchema>;
