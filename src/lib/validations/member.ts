import { z } from "zod";
import { Role } from "@prisma/client";

export const inviteSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  role: z.nativeEnum(Role).default(Role.TESTER),
});

export const updateRoleSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  memberId: z.string().min(1, "Member ID is required"),
  role: z.nativeEnum(Role),
});

export const removeMemberSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  memberId: z.string().min(1, "Member ID is required"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export const cancelInviteSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  invitationId: z.string().min(1, "Invitation ID is required"),
});

export const resendInviteSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  invitationId: z.string().min(1, "Invitation ID is required"),
});

export const getMembersSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export const getPendingInvitesSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export const createInviteLinkSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  role: z.nativeEnum(Role).default(Role.TESTER),
  maxUses: z.number().int().positive().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const acceptInviteCodeSchema = z.object({
  code: z.string().min(1, "Invite code is required"),
});

export const revokeInviteLinkSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  invitationId: z.string().min(1, "Invitation ID is required"),
});

export const getInviteLinksSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type CancelInviteInput = z.infer<typeof cancelInviteSchema>;
export type ResendInviteInput = z.infer<typeof resendInviteSchema>;
export type GetMembersInput = z.infer<typeof getMembersSchema>;
export type GetPendingInvitesInput = z.infer<typeof getPendingInvitesSchema>;
export type CreateInviteLinkInput = z.infer<typeof createInviteLinkSchema>;
export type AcceptInviteCodeInput = z.infer<typeof acceptInviteCodeSchema>;
export type RevokeInviteLinkInput = z.infer<typeof revokeInviteLinkSchema>;
export type GetInviteLinksInput = z.infer<typeof getInviteLinksSchema>;
