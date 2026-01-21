import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import crypto from "crypto";
import {
  createTRPCRouter,
  protectedProcedure,
  orgProcedure,
  adminProcedure,
} from "../trpc";
import {
  inviteSchema,
  updateRoleSchema,
  removeMemberSchema,
  acceptInviteSchema,
  cancelInviteSchema,
  resendInviteSchema,
  getMembersSchema,
  getPendingInvitesSchema,
  createInviteLinkSchema,
  acceptInviteCodeSchema,
  revokeInviteLinkSchema,
  getInviteLinksSchema,
} from "@/lib/validations/member";
import { sendInvitationEmail } from "../services/email";

const INVITATION_EXPIRY_DAYS = 7;

export const membersRouter = createTRPCRouter({
  /**
   * Get all members of an organization
   */
  getByOrganization: orgProcedure
    .input(getMembersSchema)
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.member.findMany({
        where: { organizationId: input.organizationId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      });

      return members;
    }),

  /**
   * Get pending invitations for an organization
   */
  getPendingInvites: orgProcedure
    .input(getPendingInvitesSchema)
    .query(async ({ ctx, input }) => {
      const invitations = await ctx.db.invitation.findMany({
        where: {
          organizationId: input.organizationId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      return invitations;
    }),

  /**
   * Invite a new member to the organization
   */
  invite: adminProcedure
    .input(inviteSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, email, role } = input;

      // Check if user is already a member
      const existingUser = await ctx.db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        const existingMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId,
            },
          },
        });

        if (existingMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This user is already a member of the organization",
          });
        }
      }

      // Check for existing pending invitation
      const existingInvite = await ctx.db.invitation.findUnique({
        where: {
          email_organizationId: {
            email: email.toLowerCase(),
            organizationId,
          },
        },
      });

      if (existingInvite && existingInvite.expiresAt > new Date()) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation has already been sent to this email",
        });
      }

      // Delete expired invitation if exists
      if (existingInvite) {
        await ctx.db.invitation.delete({
          where: { id: existingInvite.id },
        });
      }

      // Create invitation
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      const invitation = await ctx.db.invitation.create({
        data: {
          email: email.toLowerCase(),
          organizationId,
          role,
          token,
          expiresAt,
        },
      });

      // Get inviter and organization info for email
      const inviter = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { name: true, email: true },
      });

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: email.toLowerCase(),
          inviterName: inviter?.name || inviter?.email || "A team member",
          organizationName: ctx.organization.name,
          role: role.replace("_", " ").toLowerCase(),
          token,
        });
      } catch {
        // Delete invitation if email fails
        await ctx.db.invitation.delete({
          where: { id: invitation.id },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send invitation email",
        });
      }

      return invitation;
    }),

  /**
   * Accept an invitation and join the organization
   */
  acceptInvite: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: { organization: true },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired invitation",
        });
      }

      if (invitation.expiresAt < new Date()) {
        await ctx.db.invitation.delete({
          where: { id: invitation.id },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has expired",
        });
      }

      // Verify the invitation is for this user's email (if email-based invite)
      if (invitation.email && invitation.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation was sent to a different email address",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (existingMember) {
        // Delete the invitation since they're already a member
        await ctx.db.invitation.delete({
          where: { id: invitation.id },
        });
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this organization",
        });
      }

      // Create membership and delete invitation in transaction
      const member = await ctx.db.$transaction(async (tx) => {
        const newMember = await tx.member.create({
          data: {
            userId: ctx.user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });

        await tx.invitation.delete({
          where: { id: invitation.id },
        });

        return newMember;
      });

      return {
        member,
        organization: invitation.organization,
      };
    }),

  /**
   * Update a member's role (admin only)
   */
  updateRole: adminProcedure
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, memberId, role } = input;

      const member = await ctx.db.member.findUnique({
        where: { id: memberId },
      });

      if (!member || member.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Can't change your own role
      if (member.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        });
      }

      // Ensure there's at least one admin
      if (member.role === Role.ADMIN && role !== Role.ADMIN) {
        const adminCount = await ctx.db.member.count({
          where: {
            organizationId,
            role: Role.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization must have at least one admin",
          });
        }
      }

      const updatedMember = await ctx.db.member.update({
        where: { id: memberId },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return updatedMember;
    }),

  /**
   * Remove a member from the organization (admin only)
   */
  remove: adminProcedure
    .input(removeMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, memberId } = input;

      const member = await ctx.db.member.findUnique({
        where: { id: memberId },
      });

      if (!member || member.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Can't remove yourself
      if (member.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself. Use 'Leave organization' instead.",
        });
      }

      // Ensure there's at least one admin
      if (member.role === Role.ADMIN) {
        const adminCount = await ctx.db.member.count({
          where: {
            organizationId,
            role: Role.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last admin",
          });
        }
      }

      await ctx.db.member.delete({
        where: { id: memberId },
      });

      return { success: true };
    }),

  /**
   * Leave an organization
   */
  leave: orgProcedure
    .input(getMembersSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = input;

      // Can't leave if you're the only admin
      if (ctx.member.role === Role.ADMIN) {
        const adminCount = await ctx.db.member.count({
          where: {
            organizationId,
            role: Role.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "You are the only admin. Transfer admin role to another member before leaving.",
          });
        }
      }

      await ctx.db.member.delete({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Cancel a pending invitation (admin only)
   */
  cancelInvite: adminProcedure
    .input(cancelInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (
        !invitation ||
        invitation.organizationId !== input.organizationId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      await ctx.db.invitation.delete({
        where: { id: input.invitationId },
      });

      return { success: true };
    }),

  /**
   * Resend an invitation email (admin only)
   */
  resendInvite: adminProcedure
    .input(resendInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (
        !invitation ||
        invitation.organizationId !== input.organizationId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (!invitation.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot resend email for invite link",
        });
      }

      // Generate new token and extend expiry
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      await ctx.db.invitation.update({
        where: { id: input.invitationId },
        data: { token, expiresAt },
      });

      // Get inviter info for email
      const inviter = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { name: true, email: true },
      });

      // Resend email
      await sendInvitationEmail({
        to: invitation.email,
        inviterName: inviter?.name || inviter?.email || "A team member",
        organizationName: ctx.organization.name,
        role: invitation.role.replace("_", " ").toLowerCase(),
        token,
      });

      return { success: true };
    }),

  /**
   * Create a shareable invite link (admin only)
   */
  createInviteLink: adminProcedure
    .input(createInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, role, maxUses, expiresInDays } = input;

      const token = crypto.randomUUID();
      const inviteCode = crypto.randomUUID().slice(0, 12);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invitation = await ctx.db.invitation.create({
        data: {
          organizationId,
          role,
          token,
          inviteCode,
          maxUses,
          expiresAt,
        },
      });

      return invitation;
    }),

  /**
   * Get active invite links for an organization (admin only)
   */
  getInviteLinks: adminProcedure
    .input(getInviteLinksSchema)
    .query(async ({ ctx, input }) => {
      const inviteLinks = await ctx.db.invitation.findMany({
        where: {
          organizationId: input.organizationId,
          inviteCode: { not: null },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      return inviteLinks;
    }),

  /**
   * Revoke an invite link (admin only)
   */
  revokeInviteLink: adminProcedure
    .input(revokeInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (
        !invitation ||
        invitation.organizationId !== input.organizationId ||
        !invitation.inviteCode
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite link not found",
        });
      }

      await ctx.db.invitation.delete({
        where: { id: input.invitationId },
      });

      return { success: true };
    }),

  /**
   * Accept an invite via invite code
   */
  acceptInviteCode: protectedProcedure
    .input(acceptInviteCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { inviteCode: input.code },
        include: { organization: true },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invite code",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has expired",
        });
      }

      if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has reached its maximum uses",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this organization",
        });
      }

      // Create membership and update invite count in transaction
      const member = await ctx.db.$transaction(async (tx) => {
        const newMember = await tx.member.create({
          data: {
            userId: ctx.user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { usedCount: { increment: 1 } },
        });

        return newMember;
      });

      return {
        member,
        organization: invitation.organization,
      };
    }),
});
