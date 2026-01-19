import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const auditLogsRouter = createTRPCRouter({
  /**
   * Get audit logs for a bug with pagination
   */
  getByBug: protectedProcedure
    .input(
      z.object({
        bugId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { bugId, limit, cursor } = input;

      // First verify the bug exists and user has access
      const bug = await ctx.db.bug.findUnique({
        where: { id: bugId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                    select: { role: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      const membership = bug.project.organization.members[0];
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this bug",
        });
      }

      // Fetch audit logs with pagination
      const auditLogs = await ctx.db.auditLog.findMany({
        where: { bugId },
        take: limit + 1, // Get one extra to check if there's more
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
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

      let nextCursor: string | undefined = undefined;
      if (auditLogs.length > limit) {
        const nextItem = auditLogs.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: auditLogs,
        nextCursor,
      };
    }),

  /**
   * Get recent activity across all bugs in a project
   */
  getByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, limit } = input;

      // Verify project access
      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: ctx.session.user.id },
                select: { role: true },
              },
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const membership = project.organization.members[0];
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      // Get recent activity for bugs in this project
      const auditLogs = await ctx.db.auditLog.findMany({
        where: {
          bug: {
            projectId,
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          bug: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return auditLogs;
    }),
});
