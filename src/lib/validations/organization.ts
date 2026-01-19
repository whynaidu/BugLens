import { z } from "zod";

/**
 * Generate a URL-friendly slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

export const createOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  slug: z
    .string()
    .max(50, "Slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable().or(z.literal("")),
});

export const updateOrgSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable().or(z.literal("")),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const getOrgBySlugSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
});

export const deleteOrgSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type GetOrgBySlugInput = z.infer<typeof getOrgBySlugSchema>;
export type DeleteOrgInput = z.infer<typeof deleteOrgSchema>;
