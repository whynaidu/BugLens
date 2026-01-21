import { z } from "zod";

// Test case status enum matching Prisma
export const testCaseStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "PASSED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
]);

// Severity enum (shared with old Bug)
export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// Priority enum (shared with old Bug)
export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// Browser info schema
export const browserInfoSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    os: z.string().optional(),
  })
  .optional()
  .nullable();

// Screen size schema
export const screenSizeSchema = z
  .object({
    width: z.number(),
    height: z.number(),
  })
  .optional()
  .nullable();

// Reference ID schema (used in multiple places)
export const referenceIdSchema = z
  .string()
  .max(100, "Reference ID must be 100 characters or less")
  .optional()
  .nullable()
  .transform((val) => (val === "" ? null : val));

// Create test case schema (referenceId is auto-generated, not accepted from input)
export const createTestCaseSchema = z.object({
  moduleId: z.string().cuid(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .max(10000, "Description must be 10000 characters or less")
    .default(""),
  stepsToReproduce: z
    .string()
    .max(20000, "Steps must be 20000 characters or less")
    .optional()
    .nullable(),
  expectedResult: z
    .string()
    .max(5000, "Expected result must be 5000 characters or less")
    .optional()
    .nullable(),
  actualResult: z
    .string()
    .max(5000, "Actual result must be 5000 characters or less")
    .optional()
    .nullable(),
  severity: severitySchema.default("MEDIUM"),
  priority: prioritySchema.default("MEDIUM"),
  assigneeId: z.string().cuid().optional().nullable(),
  browserInfo: browserInfoSchema,
  screenSize: screenSizeSchema,
  url: z.string().url().optional().nullable().or(z.literal("")),
});

// Update test case schema (referenceId is read-only, cannot be changed)
export const updateTestCaseSchema = z.object({
  testCaseId: z.string().cuid(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  description: z.string().max(10000).optional(),
  stepsToReproduce: z.string().max(20000).optional().nullable(),
  expectedResult: z.string().max(5000).optional().nullable(),
  actualResult: z.string().max(5000).optional().nullable(),
  severity: severitySchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
});

// Update status schema
export const updateTestCaseStatusSchema = z.object({
  testCaseId: z.string().cuid(),
  status: testCaseStatusSchema,
});

// Get test case by ID
export const getTestCaseByIdSchema = z.object({
  testCaseId: z.string().cuid(),
});

// Get test cases by module
export const getTestCasesByModuleSchema = z.object({
  moduleId: z.string().cuid(),
  status: z.array(testCaseStatusSchema).optional(),
  severity: z.array(severitySchema).optional(),
  priority: z.array(prioritySchema).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "status", "severity", "priority", "executedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Get test cases by project (across all modules)
export const getTestCasesByProjectSchema = z.object({
  projectId: z.string().cuid(),
  moduleId: z.string().cuid().optional(), // Optional filter by specific module
  status: z.array(testCaseStatusSchema).optional(),
  severity: z.array(severitySchema).optional(),
  priority: z.array(prioritySchema).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  creatorId: z.string().cuid().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "status", "severity", "priority", "executedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Get test cases by organization (user has access to)
export const getTestCasesByOrganizationSchema = z.object({
  orgSlug: z.string(),
  projectId: z.string().cuid().optional(), // Filter by project
  moduleId: z.string().cuid().optional(), // Filter by module (includes sub-modules)
  status: z.array(testCaseStatusSchema).optional(),
  severity: z.array(severitySchema).optional(),
  priority: z.array(prioritySchema).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  assignedToMe: z.boolean().optional(),
  creatorId: z.string().cuid().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "status", "severity", "priority", "executedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Delete test case schema
export const deleteTestCaseSchema = z.object({
  testCaseId: z.string().cuid(),
});

// Assign test case schema
export const assignTestCaseSchema = z.object({
  testCaseId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable(),
});

// Bulk status update
export const bulkUpdateTestCaseStatusSchema = z.object({
  testCaseIds: z.array(z.string().cuid()).min(1),
  status: testCaseStatusSchema,
});

// Bulk assign
export const bulkAssignTestCasesSchema = z.object({
  testCaseIds: z.array(z.string().cuid()).min(1),
  assigneeId: z.string().cuid().nullable(),
});

// Status transition rules (testing workflow)
// More flexible than bug workflow - can transition to most states
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING", "SKIPPED"],
  PENDING: ["DRAFT", "PASSED", "FAILED", "BLOCKED", "SKIPPED"],
  PASSED: ["PENDING", "FAILED"],
  FAILED: ["PENDING", "PASSED", "BLOCKED"],
  BLOCKED: ["PENDING", "SKIPPED"],
  SKIPPED: ["DRAFT", "PENDING"],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  // Allow any transition for flexibility in testing workflows
  // The STATUS_TRANSITIONS map is for suggested/recommended transitions
  return true;
}

// Bulk import row schema (for CSV/Excel import)
export const bulkImportRowSchema = z.object({
  referenceId: z.string().max(100, "Reference ID must be 100 characters or less").optional().nullable(),
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(10000, "Description must be 10000 characters or less").optional().default(""),
  stepsToReproduce: z.string().max(20000, "Steps must be 20000 characters or less").optional().nullable(),
  expectedResult: z.string().max(5000, "Expected result must be 5000 characters or less").optional().nullable(),
  actualResult: z.string().max(5000, "Actual result must be 5000 characters or less").optional().nullable(),
  severity: severitySchema.optional().default("MEDIUM"),
  priority: prioritySchema.optional().default("MEDIUM"),
  url: z.string().url("Invalid URL format").optional().nullable().or(z.literal("")),
});

// Bulk import schema
export const bulkImportSchema = z.object({
  moduleId: z.string().cuid(),
  testCases: z.array(bulkImportRowSchema).min(1, "At least one test case is required").max(500, "Maximum 500 test cases per import"),
});

// Types
export type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>;
export type UpdateTestCaseStatusInput = z.infer<typeof updateTestCaseStatusSchema>;
export type GetTestCaseByIdInput = z.infer<typeof getTestCaseByIdSchema>;
export type GetTestCasesByModuleInput = z.infer<typeof getTestCasesByModuleSchema>;
export type GetTestCasesByProjectInput = z.infer<typeof getTestCasesByProjectSchema>;
export type GetTestCasesByOrganizationInput = z.infer<typeof getTestCasesByOrganizationSchema>;
export type DeleteTestCaseInput = z.infer<typeof deleteTestCaseSchema>;
export type AssignTestCaseInput = z.infer<typeof assignTestCaseSchema>;
export type BulkUpdateTestCaseStatusInput = z.infer<typeof bulkUpdateTestCaseStatusSchema>;
export type BulkAssignTestCasesInput = z.infer<typeof bulkAssignTestCasesSchema>;
export type BulkImportRowInput = z.infer<typeof bulkImportRowSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
