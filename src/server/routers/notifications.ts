import { z } from "zod";
import { NotificationChannel } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// Notification event types
const notificationEventTypes = [
  "bug_assigned",
  "bug_commented",
  "status_changed",
  "mentioned",
  "bug_created",
  "bug_resolved",
] as const;

const notificationChannels = ["IN_APP", "EMAIL", "SLACK", "TEAMS"] as const;

export const notificationsRouter = createTRPCRouter({
  /**
   * Get user's notifications with filters
   */
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().optional(),
        unreadOnly: z.boolean().default(false),
        type: z.enum(notificationEventTypes).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.notification.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.unreadOnly ? { isRead: false } : {}),
          ...(input.type ? { type: input.type } : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined = undefined;
      if (notifications.length > input.limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem?.id;
      }

      return {
        notifications,
        nextCursor,
      };
    }),

  /**
   * Get unread notifications (quick endpoint for popover)
   */
  getUnread: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.notification.findMany({
        where: {
          userId: ctx.session.user.id,
          isRead: false,
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });

      return notifications;
    }),

  /**
   * Get unread count
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: {
        userId: ctx.session.user.id,
        isRead: false,
      },
    });

    return { count };
  }),

  /**
   * Mark a notification as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.updateMany({
        where: {
          id: input.notificationId,
          userId: ctx.session.user.id,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: {
        userId: ctx.session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }),

  /**
   * Delete a notification
   */
  delete: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.deleteMany({
        where: {
          id: input.notificationId,
          userId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),

  /**
   * Get notification preferences
   */
  getPreferences: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const preferences = await ctx.db.notificationPreference.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.organizationId
            ? {
                OR: [
                  { organizationId: null },
                  { organizationId: input.organizationId },
                ],
              }
            : { organizationId: null }),
        },
      });

      // Build a complete preferences object with defaults
      const preferencesMap: Record<
        string,
        Record<string, boolean>
      > = {};

      // Initialize with defaults
      for (const eventType of notificationEventTypes) {
        preferencesMap[eventType] = {
          IN_APP: true,
          EMAIL: true,
          SLACK: false,
          TEAMS: false,
        };
      }

      // Override with saved preferences
      for (const pref of preferences) {
        if (!preferencesMap[pref.eventType]) {
          preferencesMap[pref.eventType] = {
            IN_APP: true,
            EMAIL: true,
            SLACK: false,
            TEAMS: false,
          };
        }
        preferencesMap[pref.eventType][pref.channel] = pref.isEnabled;
      }

      return preferencesMap;
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        eventType: z.enum(notificationEventTypes),
        channel: z.enum(notificationChannels),
        isEnabled: z.boolean(),
        organizationId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { eventType, channel, isEnabled, organizationId } = input;
      const orgId = organizationId ?? null;

      // Prisma upsert doesn't work with null values in composite unique keys
      // Use findFirst + create/update pattern instead
      const existing = await ctx.db.notificationPreference.findFirst({
        where: {
          userId: ctx.session.user.id,
          organizationId: orgId,
          eventType,
          channel: channel as NotificationChannel,
        },
      });

      if (existing) {
        await ctx.db.notificationPreference.update({
          where: { id: existing.id },
          data: { isEnabled },
        });
      } else {
        await ctx.db.notificationPreference.create({
          data: {
            userId: ctx.session.user.id,
            organizationId: orgId,
            eventType,
            channel: channel as NotificationChannel,
            isEnabled,
          },
        });
      }

      return { success: true };
    }),

  /**
   * Bulk update notification preferences
   */
  updatePreferencesBulk: protectedProcedure
    .input(
      z.object({
        preferences: z.array(
          z.object({
            eventType: z.enum(notificationEventTypes),
            channel: z.enum(notificationChannels),
            isEnabled: z.boolean(),
          })
        ),
        organizationId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { preferences, organizationId } = input;
      const orgId = organizationId ?? null;

      // Use transaction for bulk update
      // Prisma upsert doesn't work with null values in composite unique keys
      // Use findFirst + create/update pattern instead
      await ctx.db.$transaction(async (tx) => {
        for (const pref of preferences) {
          const existing = await tx.notificationPreference.findFirst({
            where: {
              userId: ctx.session.user.id,
              organizationId: orgId,
              eventType: pref.eventType,
              channel: pref.channel as NotificationChannel,
            },
          });

          if (existing) {
            await tx.notificationPreference.update({
              where: { id: existing.id },
              data: { isEnabled: pref.isEnabled },
            });
          } else {
            await tx.notificationPreference.create({
              data: {
                userId: ctx.session.user.id,
                organizationId: orgId,
                eventType: pref.eventType,
                channel: pref.channel as NotificationChannel,
                isEnabled: pref.isEnabled,
              },
            });
          }
        }
      });

      return { success: true };
    }),

  /**
   * Reset preferences to defaults
   */
  resetPreferences: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notificationPreference.deleteMany({
        where: {
          userId: ctx.session.user.id,
          organizationId: input.organizationId || null,
        },
      });

      return { success: true };
    }),
});
