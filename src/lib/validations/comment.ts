import { z } from "zod";

/**
 * Schema for creating a comment
 */
export const createCommentSchema = z.object({
  bugId: z.string().min(1, "Bug ID is required"),
  content: z.string().min(1, "Comment cannot be empty").max(10000, "Comment is too long"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/**
 * Schema for updating a comment
 */
export const updateCommentSchema = z.object({
  id: z.string().min(1, "Comment ID is required"),
  content: z.string().min(1, "Comment cannot be empty").max(10000, "Comment is too long"),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

/**
 * Schema for deleting a comment
 */
export const deleteCommentSchema = z.object({
  id: z.string().min(1, "Comment ID is required"),
});

export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;

/**
 * Schema for getting comments by bug
 */
export const getCommentsByBugSchema = z.object({
  bugId: z.string().min(1, "Bug ID is required"),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type GetCommentsByBugInput = z.infer<typeof getCommentsByBugSchema>;

/**
 * Helper to extract mentions from comment content
 * Matches @username patterns
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))]; // Remove @ and deduplicate
}
