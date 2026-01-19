import { TRPCError } from "@trpc/server";
import { BugStatus } from "@prisma/client";
import {
  createTRPCRouter,
  orgProcedure,
  adminProcedure,
} from "../trpc";
import {
  createProjectSchema,
  updateProjectSchema,
  archiveProjectSchema,
  deleteProjectSchema,
  getProjectsSchema,
  getProjectByIdSchema,
} from "@/lib/validations/project";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

export const projectsRouter = createTRPCRouter({
  /**
   * Create a new project in an organization
   */
  create: orgProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, name, description, color } = input;

      // Generate unique slug
      let slug = generateSlug(name);
      let slugExists = await ctx.db.project.findUnique({
        where: {
          organizationId_slug: { organizationId, slug },
        },
      });

      let counter = 1;
      const baseSlug = slug;
      while (slugExists) {
        slug = `${baseSlug}-${counter}`;
        slugExists = await ctx.db.project.findUnique({
          where: {
            organizationId_slug: { organizationId, slug },
          },
        });
        counter++;
      }

      const project = await ctx.db.project.create({
        data: {
          organizationId,
          name,
          slug,
          description,
          color,
        },
      });

      return project;
    }),

  /**
   * Update project details
   */
  update: orgProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, projectId, name, description, color } = input;

      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;

      const updatedProject = await ctx.db.project.update({
        where: { id: projectId },
        data: updateData,
      });

      return updatedProject;
    }),

  /**
   * Archive or unarchive a project
   */
  archive: orgProcedure
    .input(archiveProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, projectId, isArchived } = input;

      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const updatedProject = await ctx.db.project.update({
        where: { id: projectId },
        data: { isArchived },
      });

      return updatedProject;
    }),

  /**
   * Delete a project (admin only)
   */
  delete: adminProcedure
    .input(deleteProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, projectId } = input;

      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Delete in transaction - cascading deletes are handled by Prisma
      await ctx.db.$transaction(async (tx) => {
        // Delete flows, screenshots, annotations
        const flows = await tx.flow.findMany({
          where: { projectId },
          select: { id: true },
        });

        for (const flow of flows) {
          await tx.annotation.deleteMany({
            where: { screenshot: { flowId: flow.id } },
          });
          await tx.screenshot.deleteMany({
            where: { flowId: flow.id },
          });
        }

        await tx.flow.deleteMany({ where: { projectId } });

        // Delete bugs and related data
        const bugs = await tx.bug.findMany({
          where: { projectId },
          select: { id: true },
        });

        for (const bug of bugs) {
          await tx.comment.deleteMany({ where: { bugId: bug.id } });
          await tx.attachment.deleteMany({ where: { bugId: bug.id } });
          await tx.auditLog.deleteMany({ where: { bugId: bug.id } });
          await tx.annotation.deleteMany({ where: { bugId: bug.id } });
        }

        await tx.bug.deleteMany({ where: { projectId } });

        // Finally delete the project
        await tx.project.delete({ where: { id: projectId } });
      });

      return { success: true };
    }),

  /**
   * Get all projects for an organization
   */
  getByOrganization: orgProcedure
    .input(getProjectsSchema)
    .query(async ({ ctx, input }) => {
      const { organizationId, includeArchived, search } = input;

      const projects = await ctx.db.project.findMany({
        where: {
          organizationId,
          ...(includeArchived ? {} : { isArchived: false }),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          _count: {
            select: {
              flows: true,
              bugs: true,
            },
          },
        },
        orderBy: [{ isArchived: "asc" }, { updatedAt: "desc" }],
      });

      // Get bug status counts for each project
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          const bugStats = await ctx.db.bug.groupBy({
            by: ["status"],
            where: { projectId: project.id },
            _count: { status: true },
          });

          const statusCounts = {
            open: 0,
            inProgress: 0,
            resolved: 0,
            total: 0,
          };

          bugStats.forEach((stat) => {
            statusCounts.total += stat._count.status;
            if (stat.status === BugStatus.OPEN || stat.status === BugStatus.REOPENED) {
              statusCounts.open += stat._count.status;
            } else if (stat.status === BugStatus.IN_PROGRESS || stat.status === BugStatus.IN_REVIEW) {
              statusCounts.inProgress += stat._count.status;
            } else {
              statusCounts.resolved += stat._count.status;
            }
          });

          return {
            ...project,
            bugStats: statusCounts,
          };
        })
      );

      return projectsWithStats;
    }),

  /**
   * Get a single project by ID with stats
   */
  getById: orgProcedure
    .input(getProjectByIdSchema)
    .query(async ({ ctx, input }) => {
      const { organizationId, projectId } = input;

      const project = await ctx.db.project.findUnique({
        where: { id: projectId },
        include: {
          _count: {
            select: {
              flows: true,
              bugs: true,
            },
          },
          flows: {
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: {
                  screenshots: true,
                },
              },
            },
          },
        },
      });

      if (!project || project.organizationId !== organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get bug statistics
      const bugStats = await ctx.db.bug.groupBy({
        by: ["status"],
        where: { projectId },
        _count: { status: true },
      });

      const statusCounts = {
        open: 0,
        inProgress: 0,
        resolved: 0,
        total: 0,
      };

      bugStats.forEach((stat) => {
        statusCounts.total += stat._count.status;
        if (stat.status === BugStatus.OPEN || stat.status === BugStatus.REOPENED) {
          statusCounts.open += stat._count.status;
        } else if (stat.status === BugStatus.IN_PROGRESS || stat.status === BugStatus.IN_REVIEW) {
          statusCounts.inProgress += stat._count.status;
        } else {
          statusCounts.resolved += stat._count.status;
        }
      });

      // Get recent bugs
      const recentBugs = await ctx.db.bug.findMany({
        where: { projectId },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
          assignee: {
            select: { name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Get recent activity
      const recentActivity = await ctx.db.auditLog.findMany({
        where: { bug: { projectId } },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          user: {
            select: { name: true, email: true, avatarUrl: true },
          },
          bug: {
            select: { id: true, title: true },
          },
        },
      });

      return {
        ...project,
        bugStats: statusCounts,
        recentBugs,
        recentActivity,
      };
    }),
});
