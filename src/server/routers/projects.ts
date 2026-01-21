import { TRPCError } from "@trpc/server";
import { TestCaseStatus } from "@prisma/client";
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
      const { organizationId, name, code, description, color } = input;

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
          code: code || "",
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
      const { organizationId, projectId, name, code, description, color } = input;

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
      if (code !== undefined) updateData.code = code;
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
        // Delete modules, test cases, screenshots, annotations
        const modules = await tx.module.findMany({
          where: { projectId },
          select: { id: true },
        });

        for (const module of modules) {
          const testCases = await tx.testCase.findMany({
            where: { moduleId: module.id },
            select: { id: true },
          });

          for (const testCase of testCases) {
            await tx.annotation.deleteMany({
              where: { screenshot: { testCaseId: testCase.id } },
            });
            await tx.screenshot.deleteMany({
              where: { testCaseId: testCase.id },
            });
            await tx.comment.deleteMany({ where: { testCaseId: testCase.id } });
            await tx.attachment.deleteMany({ where: { testCaseId: testCase.id } });
            await tx.auditLog.deleteMany({ where: { testCaseId: testCase.id } });
          }

          await tx.testCase.deleteMany({ where: { moduleId: module.id } });
        }

        await tx.module.deleteMany({ where: { projectId } });

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
              modules: true,
            },
          },
        },
        orderBy: [{ isArchived: "asc" }, { updatedAt: "desc" }],
      });

      // Get test case status counts for each project
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          // Get total test case count through modules
          const testCaseCount = await ctx.db.testCase.count({
            where: { module: { projectId: project.id } },
          });

          const testCaseStats = await ctx.db.testCase.groupBy({
            by: ["status"],
            where: { module: { projectId: project.id } },
            _count: { status: true },
          });

          const statusCounts = {
            passed: 0,
            failed: 0,
            pending: 0,
            total: testCaseCount,
          };

          testCaseStats.forEach((stat: { status: TestCaseStatus; _count: { status: number } }) => {
            if (stat.status === TestCaseStatus.PASSED) {
              statusCounts.passed += stat._count.status;
            } else if (stat.status === TestCaseStatus.FAILED) {
              statusCounts.failed += stat._count.status;
            } else if (stat.status === TestCaseStatus.PENDING || stat.status === TestCaseStatus.DRAFT) {
              statusCounts.pending += stat._count.status;
            }
          });

          return {
            ...project,
            _count: {
              ...project._count,
              testCases: testCaseCount,
            },
            testCaseStats: statusCounts,
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
              modules: true,
            },
          },
          modules: {
            where: { parentId: null }, // Only root modules
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: {
                  testCases: true,
                  children: true,
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

      // Get test case statistics
      const testCaseStats = await ctx.db.testCase.groupBy({
        by: ["status"],
        where: { module: { projectId } },
        _count: { status: true },
      });

      const testCaseCount = await ctx.db.testCase.count({
        where: { module: { projectId } },
      });

      const statusCounts = {
        passed: 0,
        failed: 0,
        pending: 0,
        total: testCaseCount,
      };

      testCaseStats.forEach((stat: { status: TestCaseStatus; _count: { status: number } }) => {
        if (stat.status === TestCaseStatus.PASSED) {
          statusCounts.passed += stat._count.status;
        } else if (stat.status === TestCaseStatus.FAILED) {
          statusCounts.failed += stat._count.status;
        } else if (stat.status === TestCaseStatus.PENDING || stat.status === TestCaseStatus.DRAFT) {
          statusCounts.pending += stat._count.status;
        }
      });

      // Get recent test cases
      const recentTestCases = await ctx.db.testCase.findMany({
        where: { module: { projectId } },
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
        where: { testCase: { module: { projectId } } },
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
          testCase: {
            select: { id: true, title: true },
          },
        },
      });

      return {
        ...project,
        _count: {
          ...project._count,
          testCases: testCaseCount,
        },
        testCaseStats: statusCounts,
        recentTestCases,
        recentActivity,
      };
    }),
});
