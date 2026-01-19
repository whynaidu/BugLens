import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  createCommentSchema,
  updateCommentSchema,
  extractMentions,
} from "@/lib/validations/comment";
import { logCommentAdded } from "../services/audit";

export const commentsRouter = createTRPCRouter({
  /**
   * Create a new comment
   */
  create: protectedProcedure
    .input(createCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { bugId, content } = input;

      // Verify bug exists and user has access
      const bug = await ctx.db.bug.findUnique({
        where: { id: bugId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                    select: { role: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      const membership = bug.project.organization.members[0];
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this bug",
        });
      }

      // Create the comment
      const comment = await ctx.db.comment.create({
        data: {
          bugId,
          authorId: ctx.session.user.id,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Log audit
      await logCommentAdded(bugId, ctx.session.user.id, comment.id);

      // Handle mentions and create notifications
      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        // Find users by name or email that match the mentions
        const mentionedUsers = await ctx.db.user.findMany({
          where: {
            OR: [
              { name: { in: mentions } },
              { email: { in: mentions.map((m) => `${m}@%`) } },
            ],
          },
          select: { id: true },
        });

        // Create notifications for mentioned users
        if (mentionedUsers.length > 0) {
          await ctx.db.notification.createMany({
            data: mentionedUsers
              .filter((u) => u.id !== ctx.session.user.id) // Don't notify self
              .map((user) => ({
                userId: user.id,
                type: "BUG_MENTIONED",
                title: "You were mentioned in a comment",
                message: `${ctx.session.user.name || ctx.session.user.email} mentioned you in a comment on "${bug.title}"`,
                data: {
                  bugId,
                  commentId: comment.id,
                  projectId: bug.projectId,
                  organizationId: bug.project.organizationId,
                },
              })),
          });
        }
      }

      // Also notify the bug assignee if they're not the commenter
      if (bug.assigneeId && bug.assigneeId !== ctx.session.user.id) {
        await ctx.db.notification.create({
          data: {
            userId: bug.assigneeId,
            type: "BUG_COMMENTED",
            title: "New comment on assigned bug",
            message: `${ctx.session.user.name || ctx.session.user.email} commented on "${bug.title}"`,
            data: {
              bugId,
              commentId: comment.id,
              projectId: bug.projectId,
              organizationId: bug.project.organizationId,
            },
          },
        });
      }

      return comment;
    }),

  /**
   * Update a comment (own comments only)
   */
  update: protectedProcedure
    .input(updateCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, content } = input;

      // Find the comment
      const comment = await ctx.db.comment.findUnique({
        where: { id },
        include: {
          bug: {
            include: {
              project: {
                include: {
                  organization: {
                    include: {
                      members: {
                        where: { userId: ctx.session.user.id },
                        select: { role: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check ownership or admin role
      const membership = comment.bug.project.organization.members[0];
      const isOwner = comment.authorId === ctx.session.user.id;
      const isAdmin = membership?.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own comments",
        });
      }

      // Update the comment
      const updatedComment = await ctx.db.comment.update({
        where: { id },
        data: { content },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return updatedComment;
    }),

  /**
   * Delete a comment (own comments only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Find the comment
      const comment = await ctx.db.comment.findUnique({
        where: { id },
        include: {
          bug: {
            include: {
              project: {
                include: {
                  organization: {
                    include: {
                      members: {
                        where: { userId: ctx.session.user.id },
                        select: { role: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check ownership or admin role
      const membership = comment.bug.project.organization.members[0];
      const isOwner = comment.authorId === ctx.session.user.id;
      const isAdmin = membership?.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      // Delete the comment
      await ctx.db.comment.delete({
        where: { id },
      });

      return { success: true };
    }),

  /**
   * Get comments for a bug
   */
  getByBug: protectedProcedure
    .input(
      z.object({
        bugId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { bugId, limit, cursor } = input;

      // Verify bug exists and user has access
      const bug = await ctx.db.bug.findUnique({
        where: { id: bugId },
        include: {
          project: {
            include: {
              organization: {
                include: {
                  members: {
                    where: { userId: ctx.session.user.id },
                    select: { role: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!bug) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bug not found",
        });
      }

      const membership = bug.project.organization.members[0];
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this bug",
        });
      }

      // Fetch comments
      const comments = await ctx.db.comment.findMany({
        where: { bugId },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "asc" }, // Oldest first for comments
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (comments.length > limit) {
        const nextItem = comments.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: comments,
        nextCursor,
      };
    }),

  /**
   * Get comment count for a bug
   */
  getCount: protectedProcedure
    .input(z.object({ bugId: z.string() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.comment.count({
        where: { bugId: input.bugId },
      });
      return count;
    }),
});
