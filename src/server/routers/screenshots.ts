import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  generateUploadUrl,
  generateDownloadUrl,
  generateS3Key,
  deleteScreenshotFiles,
  getCdnUrl,
} from "../services/s3";
import {
  getUploadUrlSchema,
  createScreenshotSchema,
  updateScreenshotSchema,
  deleteScreenshotSchema,
  reorderScreenshotsSchema,
  getScreenshotsByTestCaseSchema,
  getScreenshotByIdSchema,
} from "@/lib/validations/screenshot";

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
      testCase: {
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
      },
    },
  });

  if (!screenshot || screenshot.testCase.module.project.organization.members.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Screenshot not found",
    });
  }

  return screenshot;
}

export const screenshotsRouter = createTRPCRouter({
  /**
   * Get a presigned URL for uploading a screenshot
   */
  getUploadUrl: protectedProcedure
    .input(getUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, fileName, contentType } = input;

      // Verify access to the test case
      const testCase = await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Generate a unique screenshot ID for the key
      const screenshotId = crypto.randomUUID();

      // Get file extension from content type
      const extension = contentType.split("/")[1] || "png";
      const originalFileName = `original.${extension}`;

      // Generate the S3 key
      const s3Key = generateS3Key(
        testCase.module.project.organizationId,
        testCase.module.projectId,
        testCase.moduleId,
        screenshotId,
        originalFileName
      );

      // Generate presigned upload URL
      const uploadUrl = await generateUploadUrl(s3Key, contentType);

      return {
        uploadUrl,
        key: s3Key,
        screenshotId,
        fileName,
      };
    }),

  /**
   * Create a screenshot record after upload completes
   */
  create: protectedProcedure
    .input(createScreenshotSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, s3Key, title, description, width, height, fileSize, mimeType } =
        input;

      // Verify access to the test case
      const testCase = await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Get the highest order number for this test case
      const lastScreenshot = await ctx.db.screenshot.findFirst({
        where: { testCaseId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const order = (lastScreenshot?.order ?? -1) + 1;

      // Generate URLs
      const originalUrl = getCdnUrl(s3Key);
      const thumbnailKey = s3Key.replace(/\.[^.]+$/, "-thumbnail.webp");
      const previewKey = s3Key.replace(/\.[^.]+$/, "-preview.webp");

      const screenshot = await ctx.db.screenshot.create({
        data: {
          testCaseId,
          s3Key,
          originalUrl,
          thumbnailUrl: getCdnUrl(thumbnailKey),
          previewUrl: getCdnUrl(previewKey),
          title,
          description,
          width,
          height,
          fileSize,
          mimeType,
          order,
        },
      });

      // Trigger background job for thumbnail/preview generation
      // TODO: Add to job queue once BullMQ is set up

      return {
        ...screenshot,
        module: testCase.module,
        project: testCase.module.project,
      };
    }),

  /**
   * Update screenshot details
   */
  update: protectedProcedure
    .input(updateScreenshotSchema)
    .mutation(async ({ ctx, input }) => {
      const { screenshotId, title, description } = input;

      // Verify access
      await verifyScreenshotAccess(ctx.db, screenshotId, ctx.session.user.id);

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;

      const screenshot = await ctx.db.screenshot.update({
        where: { id: screenshotId },
        data: updateData,
      });

      return screenshot;
    }),

  /**
   * Delete a screenshot
   */
  delete: protectedProcedure
    .input(deleteScreenshotSchema)
    .mutation(async ({ ctx, input }) => {
      const { screenshotId } = input;

      // Verify access and get screenshot details
      const screenshot = await verifyScreenshotAccess(
        ctx.db,
        screenshotId,
        ctx.session.user.id
      );

      // Delete in transaction
      await ctx.db.$transaction(async (tx) => {
        // Delete all annotations for this screenshot
        await tx.annotation.deleteMany({
          where: { screenshotId },
        });

        // Delete the screenshot record
        await tx.screenshot.delete({
          where: { id: screenshotId },
        });
      });

      // Delete files from S3 (don't fail if this errors)
      try {
        await deleteScreenshotFiles(screenshot.s3Key);
      } catch {
        console.error("Failed to delete S3 files for screenshot:", screenshotId);
      }

      return { success: true };
    }),

  /**
   * Reorder screenshots within a test case
   */
  reorder: protectedProcedure
    .input(reorderScreenshotsSchema)
    .mutation(async ({ ctx, input }) => {
      const { testCaseId, screenshotIds } = input;

      // Verify access to the test case
      await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      // Update order for each screenshot
      await ctx.db.$transaction(
        screenshotIds.map((screenshotId, index) =>
          ctx.db.screenshot.update({
            where: { id: screenshotId },
            data: { order: index },
          })
        )
      );

      return { success: true };
    }),

  /**
   * Get all screenshots for a test case
   */
  getByTestCase: protectedProcedure
    .input(getScreenshotsByTestCaseSchema)
    .query(async ({ ctx, input }) => {
      const { testCaseId } = input;

      // Verify access to the test case
      await verifyTestCaseAccess(ctx.db, testCaseId, ctx.session.user.id);

      const screenshots = await ctx.db.screenshot.findMany({
        where: { testCaseId },
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: { annotations: true },
          },
        },
      });

      // Generate fresh presigned URLs for each screenshot
      const screenshotsWithUrls = await Promise.all(
        screenshots.map(async (screenshot) => {
          const presignedUrl = await generateDownloadUrl(screenshot.s3Key);
          // Use original URL for all fields since thumbnails aren't generated yet
          // TODO: Once thumbnail generation is implemented, check if files exist
          return {
            ...screenshot,
            originalUrl: presignedUrl,
            thumbnailUrl: presignedUrl,
            previewUrl: presignedUrl,
          };
        })
      );

      return screenshotsWithUrls;
    }),

  /**
   * Get a single screenshot by ID with annotations
   */
  getById: protectedProcedure
    .input(getScreenshotByIdSchema)
    .query(async ({ ctx, input }) => {
      const { screenshotId } = input;

      const screenshot = await verifyScreenshotAccess(
        ctx.db,
        screenshotId,
        ctx.session.user.id
      );

      // Get annotations with test cases info (many-to-many relationship)
      const annotations = await ctx.db.annotation.findMany({
        where: { screenshotId },
        include: {
          testCases: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      // Generate fresh presigned URL for the original file
      const presignedUrl = await generateDownloadUrl(screenshot.s3Key);
      // Use original URL for all fields since thumbnails aren't generated yet

      return {
        ...screenshot,
        originalUrl: presignedUrl,
        thumbnailUrl: presignedUrl,
        previewUrl: presignedUrl,
        annotations,
        downloadUrl: presignedUrl,
      };
    }),

  /**
   * Get a fresh download URL for a screenshot
   */
  getDownloadUrl: protectedProcedure
    .input(getScreenshotByIdSchema)
    .query(async ({ ctx, input }) => {
      const { screenshotId } = input;

      const screenshot = await verifyScreenshotAccess(
        ctx.db,
        screenshotId,
        ctx.session.user.id
      );

      const downloadUrl = await generateDownloadUrl(screenshot.s3Key);

      return { downloadUrl };
    }),
});
