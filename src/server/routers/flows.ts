import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  createFlowSchema,
  updateFlowSchema,
  deleteFlowSchema,
  reorderFlowsSchema,
  getFlowsSchema,
  getFlowByIdSchema,
} from "@/lib/validations/flow";
import { generateDownloadUrl } from "../services/s3";

export const flowsRouter = createTRPCRouter({
  /**
   * Create a new flow in a project
   */
  create: protectedProcedure
    .input(createFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, name, description } = input;

      // Verify project exists and user has access
      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: ctx.session.user.id },
              },
            },
          },
        },
      });

      if (!project || project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get the highest order number
      const lastFlow = await ctx.db.flow.findFirst({
        where: { projectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const order = (lastFlow?.order ?? -1) + 1;

      const flow = await ctx.db.flow.create({
        data: {
          projectId,
          name,
          description,
          order,
        },
      });

      return flow;
    }),

  /**
   * Update flow details
   */
  update: protectedProcedure
    .input(updateFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, flowId, name, description } = input;

      // Verify access
      const flow = await ctx.db.flow.findUnique({
        where: { id: flowId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                  },
                },
              },
            },
          },
        },
      });

      if (
        !flow ||
        flow.projectId !== projectId ||
        flow.project.organization.members.length === 0
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const updatedFlow = await ctx.db.flow.update({
        where: { id: flowId },
        data: updateData,
      });

      return updatedFlow;
    }),

  /**
   * Delete a flow and its contents
   */
  delete: protectedProcedure
    .input(deleteFlowSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, flowId } = input;

      // Verify access
      const flow = await ctx.db.flow.findUnique({
        where: { id: flowId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                  },
                },
              },
            },
          },
        },
      });

      if (
        !flow ||
        flow.projectId !== projectId ||
        flow.project.organization.members.length === 0
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      // Delete in transaction
      await ctx.db.$transaction(async (tx) => {
        // Delete annotations for screenshots in this flow
        await tx.annotation.deleteMany({
          where: { screenshot: { flowId } },
        });

        // Delete screenshots
        await tx.screenshot.deleteMany({
          where: { flowId },
        });

        // Delete the flow
        await tx.flow.delete({
          where: { id: flowId },
        });
      });

      return { success: true };
    }),

  /**
   * Reorder flows
   */
  reorder: protectedProcedure
    .input(reorderFlowsSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, flowIds } = input;

      // Verify project access
      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: ctx.session.user.id },
              },
            },
          },
        },
      });

      if (!project || project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Update order for each flow
      await ctx.db.$transaction(
        flowIds.map((flowId, index) =>
          ctx.db.flow.update({
            where: { id: flowId },
            data: { order: index },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Get all flows for a project
   */
  getByProject: protectedProcedure
    .input(getFlowsSchema)
    .query(async ({ ctx, input }) => {
      const { projectId } = input;

      // Verify project access
      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: ctx.session.user.id },
              },
            },
          },
        },
      });

      if (!project || project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const flows = await ctx.db.flow.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: { screenshots: true },
          },
        },
      });

      // Get bug counts for each flow
      const flowsWithBugCounts = await Promise.all(
        flows.map(async (flow) => {
          const bugCount = await ctx.db.bug.count({
            where: {
              annotations: {
                some: {
                  screenshot: { flowId: flow.id },
                },
              },
            },
          });

          return {
            ...flow,
            bugCount,
          };
        })
      );

      return flowsWithBugCounts;
    }),

  /**
   * Get a single flow by ID with screenshots
   */
  getById: protectedProcedure
    .input(getFlowByIdSchema)
    .query(async ({ ctx, input }) => {
      const { projectId, flowId } = input;

      const flow = await ctx.db.flow.findUnique({
        where: { id: flowId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                  },
                },
              },
            },
          },
          screenshots: {
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: { annotations: true },
              },
            },
          },
        },
      });

      if (
        !flow ||
        flow.projectId !== projectId ||
        flow.project.organization.members.length === 0
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Flow not found",
        });
      }

      // Generate presigned URLs for screenshots
      const screenshotsWithUrls = await Promise.all(
        flow.screenshots.map(async (screenshot) => {
          const presignedUrl = await generateDownloadUrl(screenshot.s3Key);
          // Use original URL for all fields since thumbnails aren't generated yet
          return {
            ...screenshot,
            originalUrl: presignedUrl,
            thumbnailUrl: presignedUrl,
            previewUrl: presignedUrl,
          };
        })
      );

      return {
        ...flow,
        screenshots: screenshotsWithUrls,
      };
    }),
});
