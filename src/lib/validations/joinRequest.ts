import { z } from "zod";
import { Role, JoinRequestStatus } from "@prisma/client";

export const createJoinRequestSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  message: z
    .string()
    .max(500, "Message must be less than 500 characters")
    .optional(),
});

export const reviewJoinRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  status: z.enum([JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED]),
  role: z.nativeEnum(Role).optional(),
});

export const cancelJoinRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
});

export const getJoinRequestsSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;
export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestSchema>;
export type CancelJoinRequestInput = z.infer<typeof cancelJoinRequestSchema>;
export type GetJoinRequestsInput = z.infer<typeof getJoinRequestsSchema>;
