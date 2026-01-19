import { TRPCError } from "@trpc/server";
import { Role, BugStatus } from "@prisma/client";
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
} from "@/lib/validations/organization";

export const organizationsRouter = createTRPCRouter({
  /**
   * Create a new organization
   * The creator becomes an ADMIN member automatically
   */
  create: protectedProcedure
    .input(createOrgSchema)
    .mutation(async ({ ctx, input }) => {
      const { name, logoUrl } = input;
      let slug = input.slug || generateSlug(name);

      // Ensure slug is unique
      let slugExists = await ctx.db.organization.findUnique({
        where: { slug },
      });

      let counter = 1;
      const baseSlug = slug;
      while (slugExists) {
        slug = `${baseSlug}-${counter}`;
        slugExists = await ctx.db.organization.findUnique({
          where: { slug },
        });
        counter++;
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
          // Delete flows and screenshots
          const flows = await tx.flow.findMany({
            where: { projectId: project.id },
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

          await tx.flow.deleteMany({
            where: { projectId: project.id },
          });

          // Delete bugs and related
          const bugs = await tx.bug.findMany({
            where: { projectId: project.id },
            select: { id: true },
          });

          for (const bug of bugs) {
            await tx.comment.deleteMany({ where: { bugId: bug.id } });
            await tx.attachment.deleteMany({ where: { bugId: bug.id } });
            await tx.auditLog.deleteMany({ where: { bugId: bug.id } });
            // Note: Annotation-Bug links are cleared automatically via implicit many-to-many
          }

          await tx.bug.deleteMany({
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
        totalBugs,
        openBugs,
        inProgressBugs,
        resolvedBugs,
        recentBugs,
        recentActivity,
      ] = await Promise.all([
        ctx.db.project.count({
          where: { organizationId },
        }),
        ctx.db.member.count({
          where: { organizationId },
        }),
        ctx.db.bug.count({
          where: { project: { organizationId } },
        }),
        ctx.db.bug.count({
          where: {
            project: { organizationId },
            status: BugStatus.OPEN,
          },
        }),
        ctx.db.bug.count({
          where: {
            project: { organizationId },
            status: BugStatus.IN_PROGRESS,
          },
        }),
        ctx.db.bug.count({
          where: {
            project: { organizationId },
            status: { in: [BugStatus.RESOLVED, BugStatus.CLOSED] },
          },
        }),
        ctx.db.bug.findMany({
          where: { project: { organizationId } },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            createdAt: true,
            project: {
              select: { name: true, slug: true },
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
          where: { bug: { project: { organizationId } } },
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
        }),
      ]);

      return {
        stats: {
          totalProjects,
          totalMembers,
          totalBugs,
          openBugs,
          inProgressBugs,
          resolvedBugs,
        },
        recentBugs,
        recentActivity,
      };
    }),
});
