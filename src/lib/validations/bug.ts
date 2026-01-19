import { z } from "zod";

// Bug status enum matching Prisma
export const bugStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "WONT_FIX",
]);

// Bug severity enum matching Prisma
export const bugSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// Bug priority enum matching Prisma
export const bugPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// Browser info schema
export const browserInfoSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  os: z.string().optional(),
}).optional().nullable();

// Screen size schema
export const screenSizeSchema = z.object({
  width: z.number(),
  height: z.number(),
}).optional().nullable();

// Create bug schema
export const createBugSchema = z.object({
  projectId: z.string().cuid(),
  annotationId: z.string().cuid().optional(), // Link to annotation
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z.string().max(10000, "Description must be 10000 characters or less").default(""),
  severity: bugSeveritySchema.default("MEDIUM"),
  priority: bugPrioritySchema.default("MEDIUM"),
  assigneeId: z.string().cuid().optional().nullable(),
  browserInfo: browserInfoSchema,
  screenSize: screenSizeSchema,
  url: z.string().url().optional().nullable(),
});

// Update bug schema
export const updateBugSchema = z.object({
  bugId: z.string().cuid(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  description: z.string().max(10000).optional(),
  severity: bugSeveritySchema.optional(),
  priority: bugPrioritySchema.optional(),
  assigneeId: z.string().cuid().optional().nullable(),
});

// Update status schema with validation for allowed transitions
export const updateStatusSchema = z.object({
  bugId: z.string().cuid(),
  status: bugStatusSchema,
});

// Get bug by ID
export const getBugByIdSchema = z.object({
  bugId: z.string().cuid(),
});

// Get bugs by project with filters
export const getBugsByProjectSchema = z.object({
  projectId: z.string().cuid(),
  status: z.array(bugStatusSchema).optional(),
  severity: z.array(bugSeveritySchema).optional(),
  priority: z.array(bugPrioritySchema).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  creatorId: z.string().cuid().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "status", "severity", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Delete bug schema
export const deleteBugSchema = z.object({
  bugId: z.string().cuid(),
});

// Assign bug schema
export const assignBugSchema = z.object({
  bugId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable(),
});

// Bulk status update
export const bulkUpdateStatusSchema = z.object({
  bugIds: z.array(z.string().cuid()).min(1),
  status: bugStatusSchema,
});

// Bulk assign
export const bulkAssignSchema = z.object({
  bugIds: z.array(z.string().cuid()).min(1),
  assigneeId: z.string().cuid().nullable(),
});

// Status transition rules
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["OPEN", "IN_REVIEW", "RESOLVED"],
  IN_REVIEW: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CLOSED"],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[from];
  return allowedTransitions?.includes(to) ?? false;
}

// Types
export type BugStatus = z.infer<typeof bugStatusSchema>;
export type BugSeverity = z.infer<typeof bugSeveritySchema>;
export type BugPriority = z.infer<typeof bugPrioritySchema>;
export type CreateBugInput = z.infer<typeof createBugSchema>;
export type UpdateBugInput = z.infer<typeof updateBugSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type GetBugByIdInput = z.infer<typeof getBugByIdSchema>;
export type GetBugsByProjectInput = z.infer<typeof getBugsByProjectSchema>;
export type DeleteBugInput = z.infer<typeof deleteBugSchema>;
export type AssignBugInput = z.infer<typeof assignBugSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
