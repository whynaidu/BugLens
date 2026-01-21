import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";

export const getUploadUrlSchema = z.object({
  testCaseId: z.string().cuid(),
  fileName: z.string().min(1, "File name is required"),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: "Invalid file type. Allowed types: PNG, JPEG, WebP",
  }),
  fileSize: z
    .number()
    .max(MAX_FILE_SIZE, `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`),
});

export const createScreenshotSchema = z.object({
  testCaseId: z.string().cuid(),
  s3Key: z.string().min(1, "S3 key is required"),
  title: z.string().max(200, "Title must be less than 200 characters").optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
});

export const updateScreenshotSchema = z.object({
  screenshotId: z.string().cuid(),
  title: z.string().max(200, "Title must be less than 200 characters").optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .nullable(),
});

export const deleteScreenshotSchema = z.object({
  screenshotId: z.string().cuid(),
});

export const reorderScreenshotsSchema = z.object({
  testCaseId: z.string().cuid(),
  screenshotIds: z.array(z.string().cuid()).min(1, "At least one screenshot ID is required"),
});

export const getScreenshotsByTestCaseSchema = z.object({
  testCaseId: z.string().cuid(),
});

export const getScreenshotByIdSchema = z.object({
  screenshotId: z.string().cuid(),
});

export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>;
export type CreateScreenshotInput = z.infer<typeof createScreenshotSchema>;
export type UpdateScreenshotInput = z.infer<typeof updateScreenshotSchema>;
export type DeleteScreenshotInput = z.infer<typeof deleteScreenshotSchema>;
export type ReorderScreenshotsInput = z.infer<typeof reorderScreenshotsSchema>;
export type GetScreenshotsByTestCaseInput = z.infer<typeof getScreenshotsByTestCaseSchema>;
export type GetScreenshotByIdInput = z.infer<typeof getScreenshotByIdSchema>;
