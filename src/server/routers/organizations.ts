import { TRPCError } from "@trpc/server";
import { Role, TestCaseStatus } from "@prisma/client";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  orgProcedure,
} from "../trpc";
import {
  createOrgSchema,
  updateOrgSchema,
  getOrgBySlugSchema,
  deleteOrgSchema,
  generateSlug,
  checkSlugSchema,
  searchOrganizationsSchema,
} from "@/lib/validations/organization";

export const organizationsRouter = createTRPCRouter({
  /**
   * Check if an organization slug is available
   */
  checkSlugAvailability: protectedProcedure
    .input(checkSlugSchema)
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
      });

      return { available: !existing };
    }),

  /**
   * Search for organizations by name or slug (for join request flow)
   * Excludes organizations the user is already a member of
   */
  searchPublic: protectedProcedure
    .input(searchOrganizationsSchema)
    .query(async ({ ctx, input }) => {
      // Get user's current org memberships
      const userMemberships = await ctx.db.member.findMany({
        where: { userId: ctx.user.id },
        select: { organizationId: true },
      });

      const memberOrgIds = userMemberships.map((m) => m.organizationId);

      // Search organizations excluding user's current orgs
      const organizations = await ctx.db.organization.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: input.query, mode: "insensitive" } },
                { slug: { contains: input.query, mode: "insensitive" } },
              ],
            },
            { id: { notIn: memberOrgIds } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          _count: { select: { members: true } },
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      return organizations;
    }),

  /**
   * Create a new organization
   * The creator becomes an ADMIN member automatically
   */
  create: protectedProcedure
    .input(createOrgSchema)
    .mutation(async ({ ctx, input }) => {
      const { name, logoUrl } = input;
      const slug = input.slug || generateSlug(name);

      // Check if slug is taken
      const existing = await ctx.db.organization.findUnique({
        where: { slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This URL is already taken. Please choose a different one.",
        });
      }

      // Create organization and add creator as admin in a transaction
      const organization = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name,
            slug,
            logoUrl,
            settings: {},
          },
        });

        // Add creator as admin
        await tx.member.create({
          data: {
            userId: ctx.user.id,
            organizationId: org.id,
            role: Role.ADMIN,
          },
        });

        return org;
      });

      return organization;
    }),

  /**
   * Update organization details (admin only)
   */
  update: adminProcedure
    .input(updateOrgSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, name, logoUrl, settings } = input;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (settings !== undefined) updateData.settings = settings;

      const organization = await ctx.db.organization.update({
        where: { id: organizationId },
        data: updateData,
      });

      return organization;
    }),

  /**
   * Get organization by slug
   */
  getBySlug: protectedProcedure
    .input(getOrgBySlugSchema)
    .query(async ({ ctx, input }) => {
      const organization = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Check if user is a member
      const membership = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: organization.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      return {
        ...organization,
        membership,
      };
    }),

  /**
   * Get all organizations the user belongs to
   */
  getUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.member.findMany({
      where: { userId: ctx.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }),

  /**
   * Get organization by ID with membership check
   */
  getById: protectedProcedure
    .input(deleteOrgSchema) // Reusing schema since it just needs organizationId
    .query(async ({ ctx, input }) => {
      const organization = await ctx.db.organization.findUnique({
        where: { id: input.organizationId },
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Check if user is a member
      const membership = await ctx.db.member.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: organization.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      return {
        ...organization,
        membership,
      };
    }),

  /**
   * Delete organization (admin only)
   * This is a soft delete - we could also do hard delete
   */
  delete: adminProcedure
    .input(deleteOrgSchema)
    .mutation(async ({ ctx, input }) => {
      // Check member count - prevent deletion if there are other members
      const memberCount = await ctx.db.member.count({
        where: { organizationId: input.organizationId },
      });

      if (memberCount > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete organization with other members. Remove all members first.",
        });
      }

      // Delete in transaction
      await ctx.db.$transaction(async (tx) => {
        // Delete all related data
        await tx.member.deleteMany({
          where: { organizationId: input.organizationId },
        });

        await tx.invitation.deleteMany({
          where: { organizationId: input.organizationId },
        });

        await tx.integration.deleteMany({
          where: { organizationId: input.organizationId },
        });

        // Delete projects and their related data
        const projects = await tx.project.findMany({
          where: { organizationId: input.organizationId },
          select: { id: true },
        });

        for (const project of projects) {
          // Delete modules and test cases
          const modules = await tx.module.findMany({
            where: { projectId: project.id },
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

          await tx.module.deleteMany({
            where: { projectId: project.id },
          });
        }

        await tx.project.deleteMany({
          where: { organizationId: input.organizationId },
        });

        // Finally delete the organization
        await tx.organization.delete({
          where: { id: input.organizationId },
        });
      });

      return { success: true };
    }),

  /**
   * Get dashboard statistics for an organization
   */
  getDashboardStats: orgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = input;

      // Get counts in parallel
      const [
        totalProjects,
        totalMembers,
        totalTestCases,
        passedTestCases,
        failedTestCases,
        pendingTestCases,
        recentTestCases,
        recentActivity,
      ] = await Promise.all([
        ctx.db.project.count({
          where: { organizationId },
        }),
        ctx.db.member.count({
          where: { organizationId },
        }),
        ctx.db.testCase.count({
          where: { module: { project: { organizationId } } },
        }),
        ctx.db.testCase.count({
          where: {
            module: { project: { organizationId } },
            status: TestCaseStatus.PASSED,
          },
        }),
        ctx.db.testCase.count({
          where: {
            module: { project: { organizationId } },
            status: TestCaseStatus.FAILED,
          },
        }),
        ctx.db.testCase.count({
          where: {
            module: { project: { organizationId } },
            status: { in: [TestCaseStatus.PENDING, TestCaseStatus.DRAFT] },
          },
        }),
        ctx.db.testCase.findMany({
          where: { module: { project: { organizationId } } },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            createdAt: true,
            module: {
              select: {
                name: true,
                project: {
                  select: { name: true, slug: true },
                },
              },
            },
            creator: {
              select: { name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { name: true, email: true, avatarUrl: true },
            },
          },
        }),
        ctx.db.auditLog.findMany({
          where: { testCase: { module: { project: { organizationId } } } },
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
        }),
      ]);

      return {
        stats: {
          totalProjects,
          totalMembers,
          totalTestCases,
          passedTestCases,
          failedTestCases,
          pendingTestCases,
        },
        recentTestCases,
        recentActivity,
      };
    }),
});
