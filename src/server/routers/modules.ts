import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  createModuleSchema,
  updateModuleSchema,
  deleteModuleSchema,
  reorderModulesSchema,
  getModulesSchema,
  getModuleByIdSchema,
  moveModuleSchema,
  MAX_MODULE_DEPTH,
  calculateModuleDepth,
  validateModuleDepth,
} from "@/lib/validations/module";

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
 * Recursively build module tree structure
 */
interface ModuleWithCounts {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  order: number;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    testCases: number;
    children: number;
  };
  children?: ModuleWithCounts[];
}

function buildModuleTree(
  modules: ModuleWithCounts[],
  parentId: string | null = null
): ModuleWithCounts[] {
  return modules
    .filter((m) => m.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      ...m,
      children: buildModuleTree(modules, m.id),
    }));
}

export const modulesRouter = createTRPCRouter({
  /**
   * Create a new module in a project
   */
  create: protectedProcedure
    .input(createModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, parentId, name, code, description } = input;

      // Verify project exists and user has access
      await verifyProjectAccess(ctx.db, projectId, ctx.session.user.id);

      // If creating under a parent, verify parent access and depth
      let parentDepth: number | null = null;
      if (parentId) {
        const parent = await verifyModuleAccess(ctx.db, parentId, ctx.session.user.id);

        if (parent.projectId !== projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent module must belong to the same project",
          });
        }

        parentDepth = parent.depth;

        if (!validateModuleDepth(parentDepth)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot create module at depth ${parentDepth + 1}. Maximum depth is ${MAX_MODULE_DEPTH}`,
          });
        }
      }

      // Get the highest order number among siblings
      const lastSibling = await ctx.db.module.findFirst({
        where: { projectId, parentId: parentId ?? null },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const order = (lastSibling?.order ?? -1) + 1;
      const depth = calculateModuleDepth(parentDepth);

      const module = await ctx.db.module.create({
        data: {
          projectId,
          parentId,
          name,
          code: code || "",
          description,
          order,
          depth,
        },
        include: {
          _count: {
            select: { testCases: true, children: true },
          },
        },
      });

      return module;
    }),

  /**
   * Update module details
   */
  update: protectedProcedure
    .input(updateModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { moduleId, name, code, description } = input;

      // Verify access
      await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;

      const updatedModule = await ctx.db.module.update({
        where: { id: moduleId },
        data: updateData,
        include: {
          _count: {
            select: { testCases: true, children: true },
          },
        },
      });

      return updatedModule;
    }),

  /**
   * Delete a module and its contents (cascades)
   */
  delete: protectedProcedure
    .input(deleteModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { moduleId } = input;

      // Verify access
      await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Delete the module (cascade will handle children, test cases, screenshots, etc.)
      await ctx.db.module.delete({
        where: { id: moduleId },
      });

      return { success: true };
    }),

  /**
   * Reorder modules within the same parent
   */
  reorder: protectedProcedure
    .input(reorderModulesSchema)
    .mutation(async ({ ctx, input }) => {
      const { parentId, moduleIds } = input;

      // Verify all modules exist and belong to same parent
      const modules = await ctx.db.module.findMany({
        where: { id: { in: moduleIds } },
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

      if (modules.length !== moduleIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some modules not found",
        });
      }

      // Verify all modules have the same parent
      const allSameParent = modules.every(
        (m) => (m.parentId ?? null) === (parentId ?? null)
      );
      if (!allSameParent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All modules must have the same parent",
        });
      }

      // Verify user has access to all modules
      const hasAccess = modules.every(
        (m) => m.project.organization.members.length > 0
      );
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to some modules",
        });
      }

      // Update order for each module
      await ctx.db.$transaction(
        moduleIds.map((moduleId, index) =>
          ctx.db.module.update({
            where: { id: moduleId },
            data: { order: index },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Move a module to a different parent
   */
  move: protectedProcedure
    .input(moveModuleSchema)
    .mutation(async ({ ctx, input }) => {
      const { moduleId, newParentId } = input;

      // Verify access to the module being moved
      const module = await verifyModuleAccess(ctx.db, moduleId, ctx.session.user.id);

      // Verify new parent if provided
      let newParentDepth: number | null = null;
      if (newParentId) {
        const newParent = await verifyModuleAccess(ctx.db, newParentId, ctx.session.user.id);

        if (newParent.projectId !== module.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot move module to a different project",
          });
        }

        // Prevent moving a module to one of its descendants
        let checkParentId: string | null = newParentId;
        while (checkParentId) {
          if (checkParentId === moduleId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot move a module to one of its descendants",
            });
          }
          const foundParent: { parentId: string | null } | null = await ctx.db.module.findUnique({
            where: { id: checkParentId },
            select: { parentId: true },
          });
          checkParentId = foundParent?.parentId ?? null;
        }

        newParentDepth = newParent.depth;

        if (!validateModuleDepth(newParentDepth)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot move module to depth ${newParentDepth + 1}. Maximum depth is ${MAX_MODULE_DEPTH}`,
          });
        }
      }

      // Calculate new depth for the module and its descendants
      const newDepth = calculateModuleDepth(newParentDepth);
      const depthDelta = newDepth - module.depth;

      // Get the highest order among new siblings
      const lastSibling = await ctx.db.module.findFirst({
        where: { projectId: module.projectId, parentId: newParentId ?? null },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const newOrder = (lastSibling?.order ?? -1) + 1;

      // Update module and recursively update descendants' depth
      await ctx.db.$transaction(async (tx) => {
        // Update the module itself
        await tx.module.update({
          where: { id: moduleId },
          data: {
            parentId: newParentId,
            depth: newDepth,
            order: newOrder,
          },
        });

        // Recursively update descendants' depth
        if (depthDelta !== 0) {
          const updateDescendants = async (parentId: string, delta: number) => {
            const children = await tx.module.findMany({
              where: { parentId },
              select: { id: true },
            });

            for (const child of children) {
              await tx.module.update({
                where: { id: child.id },
                data: { depth: { increment: delta } },
              });
              await updateDescendants(child.id, delta);
            }
          };

          await updateDescendants(moduleId, depthDelta);
        }
      });

      return { success: true };
    }),

  /**
   * Get all modules for a project as a tree structure
   */
  getByProject: protectedProcedure
    .input(getModulesSchema)
    .query(async ({ ctx, input }) => {
      const { projectId } = input;

      // Verify project access
      await verifyProjectAccess(ctx.db, projectId, ctx.session.user.id);

      const modules = await ctx.db.module.findMany({
        where: { projectId },
        orderBy: [{ depth: "asc" }, { order: "asc" }],
        include: {
          _count: {
            select: { testCases: true, children: true },
          },
        },
      });

      // Build tree structure
      const tree = buildModuleTree(modules as ModuleWithCounts[]);

      return {
        modules,
        tree,
      };
    }),

  /**
   * Get a single module by ID with children and test case count
   */
  getById: protectedProcedure
    .input(getModuleByIdSchema)
    .query(async ({ ctx, input }) => {
      const { moduleId } = input;

      const module = await ctx.db.module.findUnique({
        where: { id: moduleId },
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
          children: {
            orderBy: { order: "asc" },
            include: {
              _count: {
                select: { testCases: true, children: true },
              },
            },
          },
          testCases: {
            orderBy: { createdAt: "desc" },
            take: 10,
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
          },
          _count: {
            select: { testCases: true, children: true },
          },
        },
      });

      if (!module || module.project.organization.members.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Module not found",
        });
      }

      // Build breadcrumb (path from root to current module)
      const breadcrumb: Array<{ id: string; name: string }> = [];
      let currentModule = module;
      breadcrumb.unshift({ id: currentModule.id, name: currentModule.name });

      while (currentModule.parent) {
        const parent = await ctx.db.module.findUnique({
          where: { id: currentModule.parent.id },
          include: { parent: true },
        });
        if (parent) {
          breadcrumb.unshift({ id: parent.id, name: parent.name });
          currentModule = parent as typeof currentModule;
        } else {
          break;
        }
      }

      return {
        ...module,
        breadcrumb,
      };
    }),
});
