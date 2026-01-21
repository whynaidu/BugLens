import { TRPCError } from "@trpc/server";
import { Role, JoinRequestStatus } from "@prisma/client";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "../trpc";
import {
  createJoinRequestSchema,
  reviewJoinRequestSchema,
  cancelJoinRequestSchema,
  getJoinRequestsSchema,
} from "@/lib/validations/joinRequest";

export const joinRequestsRouter = createTRPCRouter({
  /**
   * Create a join request to an organization
   */
  create: protectedProcedure
    .input(createJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, message } = input;

      // Check if organization exists
      const organization = await ctx.db.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId,
          },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this organization",
        });
      }

      // Check for existing pending request
      const existingRequest = await ctx.db.joinRequest.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId,
          },
        },
      });

      if (existingRequest) {
        if (existingRequest.status === JoinRequestStatus.PENDING) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have a pending request for this organization",
          });
        }

        if (existingRequest.status === JoinRequestStatus.REJECTED) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your previous request was rejected. Please contact the organization admin.",
          });
        }
      }

      // Create the join request
      const joinRequest = await ctx.db.joinRequest.create({
        data: {
          userId: ctx.user.id,
          organizationId,
          message,
        },
        include: {
          organization: {
            select: { name: true, slug: true },
          },
        },
      });

      return joinRequest;
    }),

  /**
   * Get user's pending join requests
   */
  getMyRequests: protectedProcedure.query(async ({ ctx }) => {
    const requests = await ctx.db.joinRequest.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }),

  /**
   * Cancel a pending join request
   */
  cancel: protectedProcedure
    .input(cancelJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.joinRequest.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Join request not found",
        });
      }

      if (request.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only cancel your own requests",
        });
      }

      if (request.status !== JoinRequestStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been processed",
        });
      }

      await ctx.db.joinRequest.delete({
        where: { id: input.requestId },
      });

      return { success: true };
    }),

  /**
   * Get pending join requests for an organization (admin only)
   */
  getForOrganization: adminProcedure
    .input(getJoinRequestsSchema)
    .query(async ({ ctx, input }) => {
      const requests = await ctx.db.joinRequest.findMany({
        where: {
          organizationId: input.organizationId,
          status: JoinRequestStatus.PENDING,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return requests;
    }),

  /**
   * Review (approve/reject) a join request (admin only)
   */
  review: adminProcedure
    .input(reviewJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { requestId, status, role } = input;

      const request = await ctx.db.joinRequest.findUnique({
        where: { id: requestId },
        include: { organization: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Join request not found",
        });
      }

      // Verify admin is from the same org
      if (request.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only review requests for your organization",
        });
      }

      if (request.status !== JoinRequestStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been processed",
        });
      }

      // Transaction to update request and create membership if approved
      const result = await ctx.db.$transaction(async (tx) => {
        const updatedRequest = await tx.joinRequest.update({
          where: { id: requestId },
          data: {
            status,
            reviewedBy: ctx.session.user.id,
            reviewedAt: new Date(),
          },
        });

        if (status === JoinRequestStatus.APPROVED) {
          // Create membership
          const member = await tx.member.create({
            data: {
              userId: request.userId,
              organizationId: request.organizationId,
              role: role || Role.TESTER,
            },
          });

          return { request: updatedRequest, member };
        }

        return { request: updatedRequest, member: null };
      });

      return result;
    }),
});
