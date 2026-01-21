import { TRPCError } from "@trpc/server";
import type { PrismaClient, Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  createTestCaseSchema,
  updateTestCaseSchema,
  updateTestCaseStatusSchema,
  getTestCaseByIdSchema,
  getTestCasesByModuleSchema,
  getTestCasesByProjectSchema,
  getTestCasesByOrganizationSchema,
  deleteTestCaseSchema,
  assignTestCaseSchema,
  bulkUpdateTestCaseStatusSchema,
  bulkAssignTestCasesSchema,
  bulkImportSchema,
} from "@/lib/validations/testcase";
import { generateDownloadUrl } from "../services/s3";

/**
 * Generate a default code from a name (uppercase first letters of words, max 4 chars)
 */
function generateCodeFromName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word: take first 3-4 characters
    return name.toUpperCase().slice(0, 4).replace(/[^A-Z0-9]/g, "");
  }
  // Multiple words: take first letter of each word
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Generate a reference ID for a test case
 * Format: {PROJECT_CODE}-{MODULE_CODE}-{COUNTER}
 */
async function generateReferenceId(
  tx: Prisma.TransactionClient,
  moduleId: string
): Promise<{ referenceId: string; newCounter: number }> {
  // Get module with project info
  const module = await tx.module.findUnique({
    where: { id: moduleId },
    include: {
      project: {
        select: { code: true, name: true },
      },
    },
  });

  if (!module) {
    throw new Error("Module not found");
  }

  // Increment counter atomically
  const updatedModule = await tx.module.update({
    where: { id: moduleId },
    data: { testCaseCounter: { increment: 1 } },
    select: { testCaseCounter: true, code: true, name: true },
  });

  // Get codes (use generated code if not set)
  const projectCode = module.project.code || generateCodeFromName(module.project.name);
  const moduleCode = updatedModule.code || generateCodeFromName(updatedModule.name);

  // Format: PRJ-MOD-001
  const counter = updatedModule.testCaseCounter.toString().padStart(3, "0");
  const referenceId = `${projectCode}-${moduleCode}-${counter}`;

  return { referenceId, newCounter: updatedModule.testCaseCounter };
}

/**
 * Helper to verify user has access to a module
 */
async function verifyModuleAccess(
  db: PrismaClient,
  moduleId: string,
  userId: string
) {
  const module = await db.module.findUnique({
    where: { id: moduleId },
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

  if (!module || module.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Module not found",
    });
  }

  return module;
}

/**
 * Helper to verify user has access to a test case
 */
async function verifyTestCaseAccess(
  db: PrismaClient,
  testCaseId: string,
  userId: string
) {
  const testCase = await db.testCase.findUnique({
    where: { id: testCaseId },
    include: {
      module: {
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
      },
    },
  });

  if (!testCase || testCase.module.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Test case not found",
    });
  }

  return testCase;
}

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

export const testcasesRouter = createTRPCRouter({
  /**
   * Create a new test case
   */
  create: protectedProcedure
    .input(createTestCaseSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        moduleId,
        // referenceId is now auto-generated, ignore any input
        title,
        description,
        stepsToReproduce,
        expectedResult,
        actualResult,
        severity,
        priority,
        assigneeId,
        browserInfo,
        screenSize,
        url,
      } = input;

      // Verify access to the module
      const module = await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Verify assignee is a member of the organization (if provided)
      if (assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: assigneeId,
              organizationId: module.project.organizationId,
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

      // Create test case in a transaction with auto-generated referenceId
      const testCase = await ctx.db.$transaction(async (tx) => {
        // Generate reference ID
        const { referenceId: generatedRefId } = await generateReferenceId(tx, moduleId);

        const createdTestCase = await tx.testCase.create({
          data: {
            moduleId,
            creatorId: ctx.session.user.id,
            referenceId: generatedRefId,
            title,
            description,
            stepsToReproduce,
            expectedResult,
            actualResult,
            severity,
            priority,
            assigneeId,
            browserInfo: browserInfo ?? undefined,
            screenSize: screenSize ?? undefined,
            url: url || null,
          },
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            module: {
              select: { id: true, name: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            testCaseId: createdTestCase.id,
            userId: ctx.session.user.id,
            action: "CREATED",
            details: {
              title,
              severity,
              priority,
              referenceId: generatedRefId,
            },
          },
        });

        return createdTestCase;
      });

      return testCase;
    }),

  /**
   * Update test case details
   */
  update: protectedProcedure
    .input(updateTestCaseSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, ...updates } = input;

      // Verify access
      const existingTestCase = await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Verify assignee if provided
      if (updates.assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: updates.assigneeId,
              organizationId: existingTestCase.module.project.organizationId,
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

      // referenceId is auto-generated and read-only, cannot be changed via update

      // Build update data - only include fields that were provided (excluding referenceId)
      const updateData: Record<string, unknown> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.stepsToReproduce !== undefined) updateData.stepsToReproduce = updates.stepsToReproduce;
      if (updates.expectedResult !== undefined) updateData.expectedResult = updates.expectedResult;
      if (updates.actualResult !== undefined) updateData.actualResult = updates.actualResult;
      if (updates.severity !== undefined) updateData.severity = updates.severity;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
      if (updates.url !== undefined) updateData.url = updates.url || null;

      const testCase = await ctx.db.$transaction(async (tx) => {
        const updatedTestCase = await tx.testCase.update({
          where: { id: testCaseId },
          data: updateData,
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            module: {
              select: { id: true, name: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            testCaseId,
            userId: ctx.session.user.id,
            action: "UPDATED",
            details: {
              changes: updates,
              before: {
                title: existingTestCase.title,
                description: existingTestCase.description,
                severity: existingTestCase.severity,
                priority: existingTestCase.priority,
                assigneeId: existingTestCase.assigneeId,
              },
            },
          },
        });

        return updatedTestCase;
      });

      return testCase;
    }),

  /**
   * Update test case status
   */
  updateStatus: protectedProcedure
    .input(updateTestCaseStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, status } = input;

      // Verify access
      const existingTestCase = await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Update with executedAt timestamp if status changes to a terminal state
      const additionalData: Record<string, unknown> = {};
      if (status === "PASSED" || status === "FAILED") {
        additionalData.executedAt = new Date();
      }

      const testCase = await ctx.db.$transaction(async (tx) => {
        const updatedTestCase = await tx.testCase.update({
          where: { id: testCaseId },
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
            module: {
              select: { id: true, name: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            testCaseId,
            userId: ctx.session.user.id,
            action: "STATUS_CHANGED",
            details: {
              from: existingTestCase.status,
              to: status,
            },
          },
        });

        return updatedTestCase;
      });

      return testCase;
    }),

  /**
   * Assign test case to a user
   */
  assign: protectedProcedure
    .input(assignTestCaseSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, assigneeId } = input;

      // Verify access
      const existingTestCase = await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Verify assignee if provided
      if (assigneeId) {
        const assigneeMember = await ctx.db.member.findUnique({
          where: {
            userId_organizationId: {
              userId: assigneeId,
              organizationId: existingTestCase.module.project.organizationId,
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

      const testCase = await ctx.db.$transaction(async (tx) => {
        const updatedTestCase = await tx.testCase.update({
          where: { id: testCaseId },
          data: { assigneeId },
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            module: {
              select: { id: true, name: true },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            testCaseId,
            userId: ctx.session.user.id,
            action: assigneeId ? "ASSIGNED" : "UNASSIGNED",
            details: {
              from: existingTestCase.assigneeId,
              to: assigneeId,
            },
          },
        });

        return updatedTestCase;
      });

      return testCase;
    }),

  /**
   * Delete a test case
   */
  delete: protectedProcedure
    .input(deleteTestCaseSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId } = input;

      // Verify access
      await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Delete test case (cascade will delete screenshots, annotations, comments, audit logs)
      await ctx.db.testCase.delete({
        where: { id: testCaseId },
      });

      return { success: true };
    }),

  /**
   * Get test case by ID with all relations
   */
  getById: protectedProcedure
    .input(getTestCaseByIdSchema)
    .query(async ({ ctx, input }) => {
      const { testCaseId } = input;

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
                      },
                    },
                  },
                },
              },
              parent: true,
            },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          screenshots: {
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: { annotations: true },
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

      if (!testCase || testCase.module.project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case not found",
        });
      }

      // Generate presigned URLs for screenshots
      const screenshotsWithUrls = await Promise.all(
        testCase.screenshots.map(async (screenshot) => {
          const presignedUrl = await generateDownloadUrl(screenshot.s3Key);
          return {
            ...screenshot,
            originalUrl: presignedUrl,
            thumbnailUrl: presignedUrl,
            previewUrl: presignedUrl,
          };
        })
      );

      // Build module breadcrumb
      const breadcrumb: Array<{ id: string; name: string }> = [];
      let currentModule: { id: string; name: string; parent?: { id: string; name: string } | null } = testCase.module;
      breadcrumb.unshift({ id: currentModule.id, name: currentModule.name });

      while (currentModule.parent) {
        const parent = await ctx.db.module.findUnique({
          where: { id: currentModule.parent.id },
          include: { parent: { select: { id: true, name: true } } },
        });
        if (parent) {
          breadcrumb.unshift({ id: parent.id, name: parent.name });
          currentModule = parent;
        } else {
          break;
        }
      }

      return {
        ...testCase,
        screenshots: screenshotsWithUrls,
        moduleBreadcrumb: breadcrumb,
      };
    }),

  /**
   * Get test cases by module with filters and pagination
   */
  getByModule: protectedProcedure
    .input(getTestCasesByModuleSchema)
    .query(async ({ ctx, input }) => {
      const {
        moduleId,
        status,
        severity,
        priority,
        assigneeId,
        search,
        page,
        pageSize,
        sortBy,
        sortOrder,
      } = input;

      // Verify access to the module
      await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Build where clause
      const where: Record<string, unknown> = { moduleId };

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
          { referenceId: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count for pagination
      const totalCount = await ctx.db.testCase.count({ where });

      // Get test cases
      const testCases = await ctx.db.testCase.findMany({
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
            select: { screenshots: true, comments: true },
          },
        },
      });

      return {
        testCases,
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
   * Get test cases by project with filters and pagination
   */
  getByProject: protectedProcedure
    .input(getTestCasesByProjectSchema)
    .query(async ({ ctx, input }) => {
      const {
        projectId,
        moduleId,
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
      const where: Record<string, unknown> = {
        module: { projectId },
      };

      if (moduleId) {
        where.moduleId = moduleId;
      }
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
          { referenceId: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count for pagination
      const totalCount = await ctx.db.testCase.count({ where });

      // Get test cases
      const testCases = await ctx.db.testCase.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          module: {
            select: { id: true, name: true },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { screenshots: true, comments: true },
          },
        },
      });

      return {
        testCases,
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
   * Get all test cases for an organization
   */
  getByOrganization: protectedProcedure
    .input(getTestCasesByOrganizationSchema)
    .query(async ({ ctx, input }) => {
      const {
        orgSlug,
        projectId,
        moduleId,
        status,
        severity,
        priority,
        assigneeId,
        assignedToMe,
        creatorId,
        search,
        page,
        pageSize,
        sortBy,
        sortOrder,
      } = input;

      // Get organization and verify membership
      const org = await ctx.db.organization.findUnique({
        where: { slug: orgSlug },
        include: {
          members: {
            where: { userId: ctx.session.user.id },
          },
          projects: {
            select: { id: true },
          },
        },
      });

      if (!org || org.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      let projectIds = org.projects.map((p) => p.id);

      // Filter by specific project if provided
      if (projectId) {
        if (!projectIds.includes(projectId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        projectIds = [projectId];
      }

      if (projectIds.length === 0) {
        return {
          testCases: [],
          pagination: { page, pageSize, totalCount: 0, totalPages: 0, hasMore: false },
        };
      }

      // Build where clause
      const where: Record<string, unknown> = {
        module: { projectId: { in: projectIds } },
      };

      // Filter by module (including all descendants)
      if (moduleId) {
        // Get all descendant module IDs recursively
        const getAllDescendantIds = async (parentId: string): Promise<string[]> => {
          const children = await ctx.db.module.findMany({
            where: { parentId },
            select: { id: true },
          });
          const childIds = children.map((c) => c.id);
          const descendantIds: string[] = [];
          for (const childId of childIds) {
            descendantIds.push(childId, ...(await getAllDescendantIds(childId)));
          }
          return descendantIds;
        };

        const descendantIds = await getAllDescendantIds(moduleId);
        const allModuleIds = [moduleId, ...descendantIds];
        where.moduleId = { in: allModuleIds };
      }

      if (status && status.length > 0) {
        where.status = { in: status };
      }
      if (severity && severity.length > 0) {
        where.severity = { in: severity };
      }
      if (priority && priority.length > 0) {
        where.priority = { in: priority };
      }
      if (assignedToMe) {
        where.assigneeId = ctx.session.user.id;
      } else if (assigneeId !== undefined) {
        where.assigneeId = assigneeId;
      }
      if (creatorId) {
        where.creatorId = creatorId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { referenceId: { contains: search, mode: "insensitive" } },
        ];
      }

      const totalCount = await ctx.db.testCase.count({ where });

      const testCases = await ctx.db.testCase.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          module: {
            select: {
              id: true,
              name: true,
              project: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { screenshots: true, comments: true },
          },
        },
      });

      return {
        testCases,
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
    .input(bulkUpdateTestCaseStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseIds, status } = input;

      // Verify access to all test cases
      const testCases = await ctx.db.testCase.findMany({
        where: { id: { in: testCaseIds } },
        include: {
          module: {
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
          },
        },
      });

      // Filter to only test cases the user has access to
      const accessibleTestCases = testCases.filter(
        (tc) => tc.module.project.organization.members.length > 0
      );

      if (accessibleTestCases.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No accessible test cases found",
        });
      }

      // Determine additional data for status update
      const additionalData: Record<string, unknown> = {};
      if (status === "PASSED" || status === "FAILED") {
        additionalData.executedAt = new Date();
      }

      // Update each test case
      await ctx.db.$transaction(
        accessibleTestCases.map((tc) =>
          ctx.db.testCase.update({
            where: { id: tc.id },
            data: { status, ...additionalData },
          })
        )
      );

      // Create audit logs
      await ctx.db.auditLog.createMany({
        data: accessibleTestCases.map((tc) => ({
          testCaseId: tc.id,
          userId: ctx.session.user.id,
          action: "STATUS_CHANGED" as const,
          details: { from: tc.status, to: status },
        })),
      });

      return { updated: accessibleTestCases.length };
    }),

  /**
   * Bulk assign
   */
  bulkAssign: protectedProcedure
    .input(bulkAssignTestCasesSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseIds, assigneeId } = input;

      // Verify access to all test cases
      const testCases = await ctx.db.testCase.findMany({
        where: { id: { in: testCaseIds } },
        include: {
          module: {
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
          },
        },
      });

      // Filter to only test cases the user has access to
      const accessibleTestCases = testCases.filter(
        (tc) => tc.module.project.organization.members.length > 0
      );

      if (accessibleTestCases.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No accessible test cases found",
        });
      }

      // Verify assignee if provided
      if (assigneeId) {
        // Get unique org IDs
        const orgIds = [...new Set(accessibleTestCases.map((tc) => tc.module.project.organizationId))];

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

      // Update all test cases
      await ctx.db.testCase.updateMany({
        where: { id: { in: accessibleTestCases.map((tc) => tc.id) } },
        data: { assigneeId },
      });

      // Create audit logs
      const auditAction = assigneeId ? "ASSIGNED" : "UNASSIGNED";
      await ctx.db.auditLog.createMany({
        data: accessibleTestCases.map((tc) => ({
          testCaseId: tc.id,
          userId: ctx.session.user.id,
          action: auditAction as "ASSIGNED" | "UNASSIGNED",
          details: { from: tc.assigneeId, to: assigneeId },
        })),
      });

      return { updated: accessibleTestCases.length };
    }),

  /**
   * Bulk create/update test cases (import from CSV/Excel)
   * If referenceId is provided and exists, updates the existing test case
   * Otherwise creates a new test case
   */
  bulkCreate: protectedProcedure
    .input(bulkImportSchema)
    .mutation(async ({ ctx, input }) => {
      const { moduleId, testCases } = input;

      // Verify access to the module
      const module = await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Create/update test cases in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        let createdCount = 0;
        let updatedCount = 0;
        const errors: Array<{ index: number; error: string }> = [];

        for (let i = 0; i < testCases.length; i++) {
          const testCaseData = testCases[i];
          try {
            // Check if test case with referenceId exists
            let existingTestCase = null;
            if (testCaseData.referenceId) {
              existingTestCase = await tx.testCase.findUnique({
                where: {
                  moduleId_referenceId: {
                    moduleId,
                    referenceId: testCaseData.referenceId,
                  },
                },
              });
            }

            if (existingTestCase) {
              // Update existing test case (keep existing referenceId)
              const updatedTestCase = await tx.testCase.update({
                where: { id: existingTestCase.id },
                data: {
                  title: testCaseData.title,
                  description: testCaseData.description || "",
                  stepsToReproduce: testCaseData.stepsToReproduce,
                  expectedResult: testCaseData.expectedResult,
                  actualResult: testCaseData.actualResult,
                  severity: testCaseData.severity || "MEDIUM",
                  priority: testCaseData.priority || "MEDIUM",
                  url: testCaseData.url || null,
                },
              });

              // Create audit log for update
              await tx.auditLog.create({
                data: {
                  testCaseId: updatedTestCase.id,
                  userId: ctx.session.user.id,
                  action: "UPDATED",
                  details: {
                    title: updatedTestCase.title,
                    severity: updatedTestCase.severity,
                    priority: updatedTestCase.priority,
                    importedFrom: "bulk_import",
                    referenceId: existingTestCase.referenceId,
                  },
                },
              });

              updatedCount++;
            } else {
              // Create new test case with auto-generated referenceId
              const { referenceId: generatedRefId } = await generateReferenceId(tx, moduleId);

              const createdTestCase = await tx.testCase.create({
                data: {
                  moduleId,
                  creatorId: ctx.session.user.id,
                  referenceId: generatedRefId,
                  title: testCaseData.title,
                  description: testCaseData.description || "",
                  stepsToReproduce: testCaseData.stepsToReproduce,
                  expectedResult: testCaseData.expectedResult,
                  actualResult: testCaseData.actualResult,
                  severity: testCaseData.severity || "MEDIUM",
                  priority: testCaseData.priority || "MEDIUM",
                  url: testCaseData.url || null,
                },
              });

              // Create audit log for creation
              await tx.auditLog.create({
                data: {
                  testCaseId: createdTestCase.id,
                  userId: ctx.session.user.id,
                  action: "CREATED",
                  details: {
                    title: createdTestCase.title,
                    severity: createdTestCase.severity,
                    priority: createdTestCase.priority,
                    importedFrom: "bulk_import",
                    referenceId: generatedRefId,
                  },
                },
              });

              createdCount++;
            }
          } catch (error) {
            errors.push({
              index: i,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return { created: createdCount, updated: updatedCount, errors };
      });

      return result;
    }),

  /**
   * Get module members for assignee dropdown
   */
  getModuleMembers: protectedProcedure
    .input(getTestCasesByModuleSchema.pick({ moduleId: true }))
    .query(async ({ ctx, input }) => {
      const { moduleId } = input;

      // Verify access
      const module = await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Get all members of the organization
      const members = await ctx.db.member.findMany({
        where: { organizationId: module.project.organizationId },
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
