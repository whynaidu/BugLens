import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  createBugSchema,
  updateBugSchema,
  updateStatusSchema,
  getBugByIdSchema,
  getBugsByProjectSchema,
  deleteBugSchema,
  assignBugSchema,
  bulkUpdateStatusSchema,
  bulkAssignSchema,
  isValidStatusTransition,
} from "@/lib/validations/bug";
import { generateDownloadUrl } from "../services/s3";

/**
 * Helper to verify user has access to a project
 */
async function verifyProjectAccess(
  db: PrismaClient,
  projectId: string,
  userId: string
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      organization: {
        include: {
          members: {
            where: { userId },
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

  return project;
}

/**
 * Helper to verify user has access to a bug
 */
async function verifyBugAccess(
  db: PrismaClient,
  bugId: string,
  userId: string
) {
  const bug = await db.bug.findUnique({
    where: { id: bugId },
    include: {
      project: {
        include: {
          organization: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });

  if (!bug || bug.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Bug not found",
    });
  }

  return bug;
}

export const bugsRouter = createTRPCRouter({
  /**
   * Create a new bug
   */
  create: protectedProcedure
    .input(createBugSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        projectId,
        annotationId,
        title,
        description,
        severity,
        priority,
        assigneeId,
        browserInfo,
        screenSize,
        url,
      } = input;

      // Verify access to the project
      const project = await verifyProjectAccess(ctx.db, projectId, ctx.session.user.id);

      // Verify assignee is a member of the organization (if provided)
      if (assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: assigneeId,
              organizationId: project.organizationId,
            },
          },
        });

        if (!assigneeMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee must be a member of the organization",
          });
        }
      }

      // Create bug in a transaction
      const bug = await ctx.db.$transaction(async (tx) => {
        const createdBug = await tx.bug.create({
          data: {
            projectId,
            creatorId: ctx.session.user.id,
            title,
            description,
            severity,
            priority,
            assigneeId,
            browserInfo: browserInfo ?? undefined,
            screenSize: screenSize ?? undefined,
            url,
            // Connect to annotation if provided (many-to-many relationship)
            annotations: annotationId
              ? { connect: { id: annotationId } }
              : undefined,
          },
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            bugId: createdBug.id,
            userId: ctx.session.user.id,
            action: "CREATED",
            details: {
              title,
              severity,
              priority,
              annotationId,
            },
          },
        });

        return createdBug;
      });

      return bug;
    }),

  /**
   * Update bug details
   */
  update: protectedProcedure
    .input(updateBugSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugId, ...updates } = input;

      // Verify access
      const existingBug = await verifyBugAccess(ctx.db, bugId, ctx.session.user.id);

      // Verify assignee if provided
      if (updates.assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: updates.assigneeId,
              organizationId: existingBug.project.organizationId,
            },
          },
        });

        if (!assigneeMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee must be a member of the organization",
          });
        }
      }

      // Build update data - only include fields that were provided
      const updateData: Record<string, unknown> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.severity !== undefined) updateData.severity = updates.severity;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;

      const bug = await ctx.db.$transaction(async (tx) => {
        const updatedBug = await tx.bug.update({
          where: { id: bugId },
          data: updateData,
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            bugId,
            userId: ctx.session.user.id,
            action: "UPDATED",
            details: {
              changes: updates,
              before: {
                title: existingBug.title,
                description: existingBug.description,
                severity: existingBug.severity,
                priority: existingBug.priority,
                assigneeId: existingBug.assigneeId,
              },
            },
          },
        });

        return updatedBug;
      });

      return bug;
    }),

  /**
   * Update bug status with transition validation
   */
  updateStatus: protectedProcedure
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugId, status } = input;

      // Verify access
      const existingBug = await verifyBugAccess(ctx.db, bugId, ctx.session.user.id);

      // Validate status transition
      if (!isValidStatusTransition(existingBug.status, status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${existingBug.status} to ${status}`,
        });
      }

      // Determine additional fields to update based on status
      const additionalData: Record<string, unknown> = {};
      if (status === "RESOLVED") {
        additionalData.resolvedAt = new Date();
      } else if (status === "CLOSED") {
        additionalData.closedAt = new Date();
      } else if (status === "REOPENED") {
        additionalData.resolvedAt = null;
        additionalData.closedAt = null;
      }

      const bug = await ctx.db.$transaction(async (tx) => {
        const updatedBug = await tx.bug.update({
          where: { id: bugId },
          data: {
            status,
            ...additionalData,
          },
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            bugId,
            userId: ctx.session.user.id,
            action: "STATUS_CHANGED",
            details: {
              from: existingBug.status,
              to: status,
            },
          },
        });

        return updatedBug;
      });

      return bug;
    }),

  /**
   * Assign bug to a user
   */
  assign: protectedProcedure
    .input(assignBugSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugId, assigneeId } = input;

      // Verify access
      const existingBug = await verifyBugAccess(ctx.db, bugId, ctx.session.user.id);

      // Verify assignee if provided
      if (assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: assigneeId,
              organizationId: existingBug.project.organizationId,
            },
          },
        });

        if (!assigneeMember) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee must be a member of the organization",
          });
        }
      }

      const bug = await ctx.db.$transaction(async (tx) => {
        const updatedBug = await tx.bug.update({
          where: { id: bugId },
          data: { assigneeId },
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            bugId,
            userId: ctx.session.user.id,
            action: assigneeId ? "ASSIGNED" : "UNASSIGNED",
            details: {
              from: existingBug.assigneeId,
              to: assigneeId,
            },
          },
        });

        return updatedBug;
      });

      return bug;
    }),

  /**
   * Delete a bug
   */
  delete: protectedProcedure
    .input(deleteBugSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugId } = input;

      // Verify access
      await verifyBugAccess(ctx.db, bugId, ctx.session.user.id);

      // Delete bug (cascade will delete annotations link, comments, audit logs)
      await ctx.db.bug.delete({
        where: { id: bugId },
      });

      return { success: true };
    }),

  /**
   * Get bug by ID with all relations
   */
  getById: protectedProcedure
    .input(getBugByIdSchema)
    .query(async ({ ctx, input }) => {
      const { bugId } = input;

      const bug = await ctx.db.bug.findUnique({
        where: { id: bugId },
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
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          annotations: {
            include: {
              screenshot: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  originalUrl: true,
                  flow: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          auditLogs: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!bug || bug.project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      // Generate presigned URLs for screenshots in annotations
      const annotationsWithUrls = await Promise.all(
        bug.annotations.map(async (annotation) => {
          if (annotation.screenshot) {
            // We need the s3Key to generate proper URLs
            // The originalUrl and thumbnailUrl stored in DB are unsigned CDN URLs
            const fullScreenshot = await ctx.db.screenshot.findUnique({
              where: { id: annotation.screenshot.id },
              select: { s3Key: true },
            });

            if (fullScreenshot?.s3Key) {
              const presignedUrl = await generateDownloadUrl(fullScreenshot.s3Key);
              // Use original URL for all fields since thumbnails aren't generated yet
              return {
                ...annotation,
                screenshot: {
                  ...annotation.screenshot,
                  originalUrl: presignedUrl,
                  thumbnailUrl: presignedUrl,
                },
              };
            }
          }
          return annotation;
        })
      );

      return {
        ...bug,
        annotations: annotationsWithUrls,
      };
    }),

  /**
   * Get bugs by project with filters and pagination
   */
  getByProject: protectedProcedure
    .input(getBugsByProjectSchema)
    .query(async ({ ctx, input }) => {
      const {
        projectId,
        status,
        severity,
        priority,
        assigneeId,
        creatorId,
        search,
        page,
        pageSize,
        sortBy,
        sortOrder,
      } = input;

      // Verify access to the project
      await verifyProjectAccess(ctx.db, projectId, ctx.session.user.id);

      // Build where clause
      const where: Record<string, unknown> = { projectId };

      if (status && status.length > 0) {
        where.status = { in: status };
      }
      if (severity && severity.length > 0) {
        where.severity = { in: severity };
      }
      if (priority && priority.length > 0) {
        where.priority = { in: priority };
      }
      if (assigneeId !== undefined) {
        where.assigneeId = assigneeId;
      }
      if (creatorId) {
        where.creatorId = creatorId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count for pagination
      const totalCount = await ctx.db.bug.count({ where });

      // Get bugs
      const bugs = await ctx.db.bug.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { annotations: true, comments: true },
          },
        },
      });

      return {
        bugs,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      };
    }),

  /**
   * Get all bugs for an organization
   */
  getByOrganization: protectedProcedure
    .input(
      getBugsByProjectSchema.omit({ projectId: true }).extend({
        orgSlug: getBugsByProjectSchema.shape.projectId.optional().transform(() => undefined),
      }).transform((val) => ({ ...val, orgSlug: undefined }))
    )
    .query(async ({ ctx, input }) => {
      const {
        status,
        severity,
        priority,
        assigneeId,
        search,
        page = 1,
        pageSize = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = input;

      // Get org slug from referer or use a workaround
      // For now, get all bugs from projects the user has access to
      const userOrgs = await ctx.db.member.findMany({
        where: { userId: ctx.session.user.id },
        include: {
          organization: {
            include: {
              projects: {
                select: { id: true },
              },
            },
          },
        },
      });

      const projectIds = userOrgs.flatMap((m) =>
        m.organization.projects.map((p) => p.id)
      );

      if (projectIds.length === 0) {
        return { bugs: [], pagination: { page, pageSize, totalCount: 0, totalPages: 0, hasMore: false } };
      }

      // Build where clause
      const where: Record<string, unknown> = { projectId: { in: projectIds } };

      if (status && status.length > 0) {
        where.status = { in: status };
      }
      if (severity && severity.length > 0) {
        where.severity = { in: severity };
      }
      if (priority && priority.length > 0) {
        where.priority = { in: priority };
      }
      if (assigneeId !== undefined) {
        where.assigneeId = assigneeId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const totalCount = await ctx.db.bug.count({ where });

      const bugs = await ctx.db.bug.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: {
            select: { id: true, name: true, slug: true },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { annotations: true, comments: true },
          },
        },
      });

      return {
        bugs,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: page * pageSize < totalCount,
        },
      };
    }),

  /**
   * Bulk update status
   */
  bulkUpdateStatus: protectedProcedure
    .input(bulkUpdateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugIds, status } = input;

      // Verify access to all bugs
      const bugs = await ctx.db.bug.findMany({
        where: { id: { in: bugIds } },
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

      // Filter to only bugs the user has access to
      const accessibleBugs = bugs.filter(
        (bug) => bug.project.organization.members.length > 0
      );

      if (accessibleBugs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No accessible bugs found",
        });
      }

      // Update each bug
      await ctx.db.$transaction(
        accessibleBugs.map((bug) => {
          const additionalData: Record<string, unknown> = {};
          if (status === "RESOLVED") additionalData.resolvedAt = new Date();
          else if (status === "CLOSED") additionalData.closedAt = new Date();
          else if (status === "REOPENED") {
            additionalData.resolvedAt = null;
            additionalData.closedAt = null;
          }

          return ctx.db.bug.update({
            where: { id: bug.id },
            data: { status, ...additionalData },
          });
        })
      );

      // Create audit logs
      await ctx.db.auditLog.createMany({
        data: accessibleBugs.map((bug) => ({
          bugId: bug.id,
          userId: ctx.session.user.id,
          action: "STATUS_CHANGED" as const,
          details: { from: bug.status, to: status },
        })),
      });

      return { updated: accessibleBugs.length };
    }),

  /**
   * Bulk assign
   */
  bulkAssign: protectedProcedure
    .input(bulkAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugIds, assigneeId } = input;

      // Verify access to all bugs
      const bugs = await ctx.db.bug.findMany({
        where: { id: { in: bugIds } },
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

      // Filter to only bugs the user has access to
      const accessibleBugs = bugs.filter(
        (bug) => bug.project.organization.members.length > 0
      );

      if (accessibleBugs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No accessible bugs found",
        });
      }

      // Verify assignee if provided
      if (assigneeId) {
        // Get unique org IDs
        const orgIds = [...new Set(accessibleBugs.map((b) => b.project.organizationId))];

        for (const orgId of orgIds) {
          const assigneeMember = await ctx.db.member.findUnique({
            where: {
              userId_organizationId: {
                userId: assigneeId,
                organizationId: orgId,
              },
            },
          });

          if (!assigneeMember) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Assignee must be a member of all relevant organizations",
            });
          }
        }
      }

      // Update all bugs
      await ctx.db.bug.updateMany({
        where: { id: { in: accessibleBugs.map((b) => b.id) } },
        data: { assigneeId },
      });

      // Create audit logs
      const auditAction = assigneeId ? "ASSIGNED" : "UNASSIGNED";
      await ctx.db.auditLog.createMany({
        data: accessibleBugs.map((bug) => ({
          bugId: bug.id,
          userId: ctx.session.user.id,
          action: auditAction as "ASSIGNED" | "UNASSIGNED",
          details: { from: bug.assigneeId, to: assigneeId },
        })),
      });

      return { updated: accessibleBugs.length };
    }),

  /**
   * Get project members for assignee dropdown
   */
  getProjectMembers: protectedProcedure
    .input(getBugsByProjectSchema.pick({ projectId: true }))
    .query(async ({ ctx, input }) => {
      const { projectId } = input;

      // Verify access
      const project = await verifyProjectAccess(ctx.db, projectId, ctx.session.user.id);

      // Get all members of the organization
      const members = await ctx.db.member.findMany({
        where: { organizationId: project.organizationId },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { user: { name: "asc" } },
      });

      return members.map((m) => ({
        ...m.user,
        role: m.role,
      }));
    }),
});
