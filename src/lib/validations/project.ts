import { z } from "zod";

// Preset colors for projects
export const PROJECT_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0ea5e9", // Sky
  "#3b82f6", // Blue
  "#6b7280", // Gray
] as const;

export const createProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z
    .string()
    .min(1, "Project name is required")
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
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .default("#6366f1"),
});

export const updateProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
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
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional(),
});

export const archiveProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  isArchived: z.boolean(),
});

export const deleteProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
});

export const getProjectsSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  includeArchived: z.boolean().default(false),
  search: z.string().optional(),
});

export const getProjectByIdSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ArchiveProjectInput = z.infer<typeof archiveProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
export type GetProjectsInput = z.infer<typeof getProjectsSchema>;
export type GetProjectByIdInput = z.infer<typeof getProjectByIdSchema>;
