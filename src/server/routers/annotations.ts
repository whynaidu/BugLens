import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  batchUpdateAnnotationsSchema,
  updateAnnotationSchema,
  deleteAnnotationSchema,
  getAnnotationsByScreenshotSchema,
  linkAnnotationToBugSchema,
  toPrismaAnnotationType,
  fromPrismaAnnotationType,
} from "@/lib/validations/annotation";

/**
 * Helper to verify user has access to a screenshot
 */
async function verifyScreenshotAccess(
  db: PrismaClient,
  screenshotId: string,
  userId: string
) {
  const screenshot = await db.screenshot.findUnique({
    where: { id: screenshotId },
    include: {
      flow: {
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

  if (!screenshot || screenshot.flow.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Screenshot not found",
    });
  }

  return screenshot;
}

/**
 * Helper to verify user has access to an annotation
 */
async function verifyAnnotationAccess(
  db: PrismaClient,
  annotationId: string,
  userId: string
) {
  const annotation = await db.annotation.findUnique({
    where: { id: annotationId },
    include: {
      screenshot: {
        include: {
          flow: {
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
      },
    },
  });

  if (!annotation || annotation.screenshot.flow.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Annotation not found",
    });
  }

  return annotation;
}

export const annotationsRouter = createTRPCRouter({
  /**
   * Get all annotations for a screenshot
   */
  getByScreenshot: protectedProcedure
    .input(getAnnotationsByScreenshotSchema)
    .query(async ({ ctx, input }) => {
      const { screenshotId } = input;

      // Verify access to the screenshot
      await verifyScreenshotAccess(ctx.db, screenshotId, ctx.session.user.id);

      const annotations = await ctx.db.annotation.findMany({
        where: { screenshotId },
        orderBy: { order: "asc" },
        include: {
          bugs: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      // Convert Prisma enum types to frontend types
      return annotations.map((annotation) => ({
        ...annotation,
        type: fromPrismaAnnotationType(annotation.type),
        points: annotation.points as number[] | null,
      }));
    }),

  /**
   * Batch update annotations for a screenshot
   * This replaces all annotations with the new set
   */
  batchUpdate: protectedProcedure
    .input(batchUpdateAnnotationsSchema)
    .mutation(async ({ ctx, input }) => {
      const { screenshotId, annotations } = input;

      // Verify access to the screenshot
      await verifyScreenshotAccess(ctx.db, screenshotId, ctx.session.user.id);

      // Get existing annotation IDs
      const existingAnnotations = await ctx.db.annotation.findMany({
        where: { screenshotId },
        select: { id: true },
      });
      const existingIds = new Set(existingAnnotations.map((a) => a.id));

      // Separate into create, update, and delete operations
      const toCreate: typeof annotations = [];
      const toUpdate: typeof annotations = [];
      const incomingIds = new Set<string>();

      for (const annotation of annotations) {
        if (annotation.id && existingIds.has(annotation.id)) {
          toUpdate.push(annotation);
          incomingIds.add(annotation.id);
        } else {
          toCreate.push(annotation);
        }
      }

      // IDs to delete (existing but not in incoming)
      const toDeleteIds = [...existingIds].filter((id) => !incomingIds.has(id));

      // Execute all operations in a transaction
      await ctx.db.$transaction(async (tx) => {
        // Delete removed annotations
        if (toDeleteIds.length > 0) {
          await tx.annotation.deleteMany({
            where: {
              id: { in: toDeleteIds },
              screenshotId,
            },
          });
        }

        // Update existing annotations
        for (const annotation of toUpdate) {
          if (!annotation.id) continue;
          await tx.annotation.update({
            where: { id: annotation.id },
            data: {
              type: toPrismaAnnotationType(annotation.type),
              x: annotation.x,
              y: annotation.y,
              width: annotation.width,
              height: annotation.height,
              radius: annotation.radius,
              points: annotation.points,
              stroke: annotation.stroke,
              strokeWidth: annotation.strokeWidth,
              fill: annotation.fill,
              // Note: Bug links are managed via the bugs.create mutation (many-to-many)
            },
          });
        }

        // Create new annotations
        if (toCreate.length > 0) {
          // Get the highest current order
          const lastAnnotation = await tx.annotation.findFirst({
            where: { screenshotId },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          let nextOrder = (lastAnnotation?.order ?? -1) + 1;

          for (const annotation of toCreate) {
            await tx.annotation.create({
              data: {
                screenshotId,
                type: toPrismaAnnotationType(annotation.type),
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height,
                radius: annotation.radius,
                points: annotation.points,
                stroke: annotation.stroke,
                strokeWidth: annotation.strokeWidth,
                fill: annotation.fill,
                // Note: Bug links are managed via the bugs.create mutation (many-to-many)
                order: nextOrder++,
              },
            });
          }
        }
      });

      // Fetch and return updated annotations
      const updatedAnnotations = await ctx.db.annotation.findMany({
        where: { screenshotId },
        orderBy: { order: "asc" },
        include: {
          bugs: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      return updatedAnnotations.map((annotation) => ({
        ...annotation,
        type: fromPrismaAnnotationType(annotation.type),
        points: annotation.points as number[] | null,
      }));
    }),

  /**
   * Update a single annotation
   */
  update: protectedProcedure
    .input(updateAnnotationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify access
      await verifyAnnotationAccess(ctx.db, id, ctx.session.user.id);

      const annotation = await ctx.db.annotation.update({
        where: { id },
        data: updates,
        include: {
          bugs: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      return {
        ...annotation,
        type: fromPrismaAnnotationType(annotation.type),
        points: annotation.points as number[] | null,
      };
    }),

  /**
   * Delete a single annotation
   */
  delete: protectedProcedure
    .input(deleteAnnotationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Verify access
      await verifyAnnotationAccess(ctx.db, id, ctx.session.user.id);

      await ctx.db.annotation.delete({
        where: { id },
      });

      return { success: true };
    }),

  /**
   * Link an annotation to a bug (many-to-many - adds to existing links)
   */
  linkToBug: protectedProcedure
    .input(linkAnnotationToBugSchema)
    .mutation(async ({ ctx, input }) => {
      const { annotationId, bugId } = input;

      // Verify access to annotation
      const annotation = await verifyAnnotationAccess(ctx.db, annotationId, ctx.session.user.id);

      // If linking to a bug, verify access to the bug
      if (bugId) {
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
          },
        });

        if (!bug || bug.project.organization.members.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bug not found",
          });
        }

        // Verify bug belongs to same organization
        const screenshotOrgId = annotation.screenshot.flow.project.organizationId;
        if (bug.project.organizationId !== screenshotOrgId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bug must belong to the same organization",
          });
        }

        // Connect the bug to the annotation (many-to-many)
        const updatedAnnotation = await ctx.db.annotation.update({
          where: { id: annotationId },
          data: {
            bugs: {
              connect: { id: bugId },
            },
          },
          include: {
            bugs: {
              select: {
                id: true,
                title: true,
                status: true,
                severity: true,
              },
            },
          },
        });

        return {
          ...updatedAnnotation,
          type: fromPrismaAnnotationType(updatedAnnotation.type),
          points: updatedAnnotation.points as number[] | null,
        };
      }

      // If no bugId provided, just return the annotation as is
      const currentAnnotation = await ctx.db.annotation.findUnique({
        where: { id: annotationId },
        include: {
          bugs: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      if (!currentAnnotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Annotation not found",
        });
      }

      return {
        ...currentAnnotation,
        type: fromPrismaAnnotationType(currentAnnotation.type),
        points: currentAnnotation.points as number[] | null,
      };
    }),

  /**
   * Unlink an annotation from a bug
   */
  unlinkFromBug: protectedProcedure
    .input(linkAnnotationToBugSchema)
    .mutation(async ({ ctx, input }) => {
      const { annotationId, bugId } = input;

      // Verify access to annotation
      await verifyAnnotationAccess(ctx.db, annotationId, ctx.session.user.id);

      if (!bugId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bug ID is required for unlinking",
        });
      }

      // Disconnect the bug from the annotation
      const updatedAnnotation = await ctx.db.annotation.update({
        where: { id: annotationId },
        data: {
          bugs: {
            disconnect: { id: bugId },
          },
        },
        include: {
          bugs: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      return {
        ...updatedAnnotation,
        type: fromPrismaAnnotationType(updatedAnnotation.type),
        points: updatedAnnotation.points as number[] | null,
      };
    }),
});
