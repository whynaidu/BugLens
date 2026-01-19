import { db } from "@/server/db";
import { NotificationChannel } from "@prisma/client";
import { queueNotifications, type NotificationJobData } from "./queue";

// Notification event types
export type NotificationEventType =
  | "bug_assigned"
  | "bug_commented"
  | "status_changed"
  | "mentioned"
  | "bug_created"
  | "bug_resolved";

interface CreateNotificationParams {
  userId: string;
  type: NotificationEventType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  organizationId?: string;
}

interface NotificationContext {
  bugId?: string;
  bugTitle?: string;
  projectId?: string;
  projectName?: string;
  orgSlug?: string;
  assignerName?: string;
  commenterName?: string;
  changerName?: string;
  commentPreview?: string;
  oldStatus?: string;
  newStatus?: string;
}

/**
 * Create a notification for a user and queue it for delivery
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  organizationId,
}: CreateNotificationParams): Promise<void> {
  // Get user with their notification preferences and email
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      notificationPrefs: {
        where: {
          OR: [
            { organizationId: null }, // Global preferences
            { organizationId }, // Org-specific preferences
          ],
        },
      },
    },
  });

  if (!user) {
    console.warn(`User ${userId} not found for notification`);
    return;
  }

  // Determine which channels are enabled for this event type
  const enabledChannels = getEnabledChannels(user.notificationPrefs, type, organizationId);

  // Queue notifications for each enabled channel
  const jobs: NotificationJobData[] = [];

  // Always create in-app notification if enabled
  if (enabledChannels.includes("IN_APP")) {
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data as object,
        channel: "IN_APP",
      },
    });

    jobs.push({
      type: "SEND_IN_APP",
      userId,
      notificationId: notification.id,
      payload: {
        eventType: type,
        title,
        message,
        data: data as Record<string, unknown>,
      },
    });
  }

  // Queue email notification if enabled
  if (enabledChannels.includes("EMAIL") && user.email) {
    jobs.push({
      type: "SEND_EMAIL",
      userId,
      payload: {
        eventType: type,
        title,
        message,
        recipientEmail: user.email,
        data: data as Record<string, unknown>,
      },
    });
  }

  // Queue Slack notification if enabled
  if (enabledChannels.includes("SLACK") && organizationId) {
    const slackConfig = await getSlackConfig(organizationId);
    if (slackConfig) {
      jobs.push({
        type: "SEND_SLACK",
        userId,
        payload: {
          eventType: type,
          title,
          message,
          slackWebhookUrl: slackConfig.webhookUrl,
          data: data as Record<string, unknown>,
        },
      });
    }
  }

  // Queue Teams notification if enabled
  if (enabledChannels.includes("TEAMS") && organizationId) {
    const teamsConfig = await getTeamsConfig(organizationId);
    if (teamsConfig) {
      jobs.push({
        type: "SEND_TEAMS",
        userId,
        payload: {
          eventType: type,
          title,
          message,
          teamsWebhookUrl: teamsConfig.webhookUrl,
          data: data as Record<string, unknown>,
        },
      });
    }
  }

  // Queue all notification jobs
  if (jobs.length > 0) {
    await queueNotifications(jobs);
  }
}

/**
 * Get enabled notification channels based on user preferences
 */
function getEnabledChannels(
  preferences: Array<{
    eventType: string;
    channel: NotificationChannel;
    isEnabled: boolean;
    organizationId: string | null;
  }>,
  eventType: NotificationEventType,
  organizationId?: string
): NotificationChannel[] {
  // Default channels if no preferences set
  const defaultChannels: NotificationChannel[] = ["IN_APP", "EMAIL"];

  if (preferences.length === 0) {
    return defaultChannels;
  }

  // Filter preferences for this event type
  const eventPrefs = preferences.filter((p) => p.eventType === eventType);

  if (eventPrefs.length === 0) {
    return defaultChannels;
  }

  // Org-specific preferences override global preferences
  const channels: NotificationChannel[] = [];

  for (const channel of ["IN_APP", "EMAIL", "SLACK", "TEAMS"] as NotificationChannel[]) {
    // First check org-specific preference
    const orgPref = eventPrefs.find(
      (p) => p.channel === channel && p.organizationId === organizationId
    );
    if (orgPref) {
      if (orgPref.isEnabled) channels.push(channel);
      continue;
    }

    // Fall back to global preference
    const globalPref = eventPrefs.find(
      (p) => p.channel === channel && p.organizationId === null
    );
    if (globalPref) {
      if (globalPref.isEnabled) channels.push(channel);
      continue;
    }

    // Default: enable IN_APP and EMAIL
    if (channel === "IN_APP" || channel === "EMAIL") {
      channels.push(channel);
    }
  }

  return channels;
}

/**
 * Get Slack configuration for an organization
 */
async function getSlackConfig(organizationId: string): Promise<{
  webhookUrl: string;
} | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "SLACK",
      },
    },
  });

  if (!integration || !integration.isActive) {
    return null;
  }

  const config = integration.config as { webhookUrl?: string };

  if (!config.webhookUrl) {
    return null;
  }

  return {
    webhookUrl: config.webhookUrl,
  };
}

/**
 * Get Teams configuration for an organization
 */
async function getTeamsConfig(organizationId: string): Promise<{
  webhookUrl: string;
} | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_type: {
        organizationId,
        type: "TEAMS",
      },
    },
  });

  if (!integration || !integration.isActive) {
    return null;
  }

  const config = integration.config as { webhookUrl?: string };

  if (!config.webhookUrl) {
    return null;
  }

  return {
    webhookUrl: config.webhookUrl,
  };
}

// ============================================
// NOTIFICATION TRIGGERS
// ============================================

/**
 * Notify user when a bug is assigned to them
 */
export async function notifyBugAssigned(
  assigneeId: string,
  context: NotificationContext & { assignerId: string }
): Promise<void> {
  const { bugId, bugTitle, projectName, orgSlug, assignerName } = context;

  await createNotification({
    userId: assigneeId,
    type: "bug_assigned",
    title: `Bug assigned: ${bugTitle}`,
    message: `${assignerName} assigned you a bug in ${projectName}`,
    data: {
      bugId,
      bugTitle,
      projectName,
      orgSlug,
      assignerName,
      bugUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${orgSlug}/bugs/${bugId}`,
    },
  });
}

/**
 * Notify user when someone comments on their bug
 */
export async function notifyBugCommented(
  userId: string,
  context: NotificationContext
): Promise<void> {
  const { bugId, bugTitle, projectName, orgSlug, commenterName, commentPreview } = context;

  await createNotification({
    userId,
    type: "bug_commented",
    title: `New comment on: ${bugTitle}`,
    message: `${commenterName}: "${commentPreview}"`,
    data: {
      bugId,
      bugTitle,
      projectName,
      orgSlug,
      commenterName,
      commentPreview,
      bugUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${orgSlug}/bugs/${bugId}`,
    },
  });
}

/**
 * Notify user when status changes on their assigned bug
 */
export async function notifyStatusChanged(
  userId: string,
  context: NotificationContext
): Promise<void> {
  const { bugId, bugTitle, projectName, orgSlug, changerName, oldStatus, newStatus } = context;

  await createNotification({
    userId,
    type: "status_changed",
    title: `Status changed: ${bugTitle}`,
    message: `${changerName} changed status from ${oldStatus} to ${newStatus}`,
    data: {
      bugId,
      bugTitle,
      projectName,
      orgSlug,
      changerName,
      oldStatus,
      newStatus,
      bugUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${orgSlug}/bugs/${bugId}`,
    },
  });
}

/**
 * Notify user when they are mentioned in a comment
 */
export async function notifyMentioned(
  userId: string,
  context: NotificationContext & { mentionerName: string }
): Promise<void> {
  const { bugId, bugTitle, projectName, orgSlug, mentionerName, commentPreview } = context;

  await createNotification({
    userId,
    type: "mentioned",
    title: `${mentionerName} mentioned you`,
    message: `In bug "${bugTitle}": "${commentPreview}"`,
    data: {
      bugId,
      bugTitle,
      projectName,
      orgSlug,
      mentionerName,
      commentPreview,
      bugUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${orgSlug}/bugs/${bugId}`,
    },
  });
}
