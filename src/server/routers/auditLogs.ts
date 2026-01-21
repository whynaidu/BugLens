import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const auditLogsRouter = createTRPCRouter({
  /**
   * Get audit logs for a test case with pagination
   */
  getByTestCase: protectedProcedure
    .input(
      z.object({
        testCaseId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { testCaseId, limit, cursor } = input;

      // First verify the test case exists and user has access
      const testCase = await ctx.db.testCase.findUnique({
        where: { id: testCaseId },
        include: {
          module: {
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
          },
        },
      });

      if (!testCase) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case not found",
        });
      }

      const membership = testCase.module.project.organization.members[0];
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this test case",
        });
      }

      // Fetch audit logs with pagination
      const auditLogs = await ctx.db.auditLog.findMany({
        where: { testCaseId },
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
   * Get recent activity across all test cases in a project
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

      // Get recent activity for test cases in this project
      const auditLogs = await ctx.db.auditLog.findMany({
        where: {
          testCase: {
            module: {
              projectId,
            },
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
          testCase: {
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
