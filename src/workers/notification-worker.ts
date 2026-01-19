import { Worker, Job } from "bullmq";
import { REDIS_URL, type NotificationJobData, type NotificationJobType } from "@/server/services/queue";
import {
  sendBugAssignedEmail,
  sendNewCommentEmail,
  sendStatusChangedEmail,
  sendDigestEmail,
} from "@/server/services/email";
import { sendSlackNotification } from "@/server/services/slack";
import { sendTeamsNotification } from "@/server/services/teams";
import { db } from "@/server/db";

// Create the notification worker
const notificationWorker = new Worker<NotificationJobData, unknown, NotificationJobType>(
  "notifications",
  async (job: Job<NotificationJobData, unknown, NotificationJobType>) => {
    const { type, userId, notificationId, payload } = job.data;

    console.log(`Processing notification job: ${job.id} - Type: ${type}`);

    try {
      switch (type) {
        case "SEND_IN_APP":
          // In-app notifications are already created in the database
          // This job just ensures they're processed and can trigger real-time updates
          if (notificationId) {
            // Just log, no update needed
            console.log(`In-app notification ${notificationId} processed`);
          }
          break;

        case "SEND_EMAIL":
          await handleEmailNotification(payload);
          break;

        case "SEND_SLACK":
          await handleSlackNotification(userId, payload);
          break;

        case "SEND_TEAMS":
          await handleTeamsNotification(payload);
          break;

        case "SEND_DIGEST":
          await handleDigestNotification(userId, payload);
          break;

        default:
          console.warn(`Unknown notification type: ${type}`);
      }

      return { success: true, type, userId };
    } catch (error) {
      console.error(`Failed to process notification job ${job.id}:`, error);
      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: {
      url: REDIS_URL,
      maxRetriesPerRequest: null,
    },
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000, // 100 jobs per second
    },
  }
);

// Handle email notifications
async function handleEmailNotification(payload: NotificationJobData["payload"]) {
  const { eventType, recipientEmail, data } = payload;

  if (!recipientEmail) {
    throw new Error("Recipient email is required for email notifications");
  }

  switch (eventType) {
    case "bug_assigned":
      await sendBugAssignedEmail({
        to: recipientEmail,
        bugTitle: (data?.bugTitle as string) || "Bug",
        bugId: (data?.bugId as string) || "",
        assignerName: (data?.assignerName as string) || "Someone",
        projectName: (data?.projectName as string) || "Project",
        orgSlug: (data?.orgSlug as string) || "",
      });
      break;

    case "bug_commented":
      await sendNewCommentEmail({
        to: recipientEmail,
        bugTitle: (data?.bugTitle as string) || "Bug",
        bugId: (data?.bugId as string) || "",
        commenterName: (data?.commenterName as string) || "Someone",
        commentPreview: (data?.commentPreview as string) || "",
        projectName: (data?.projectName as string) || "Project",
        orgSlug: (data?.orgSlug as string) || "",
      });
      break;

    case "status_changed":
      await sendStatusChangedEmail({
        to: recipientEmail,
        bugTitle: (data?.bugTitle as string) || "Bug",
        bugId: (data?.bugId as string) || "",
        changerName: (data?.changerName as string) || "Someone",
        oldStatus: (data?.oldStatus as string) || "unknown",
        newStatus: (data?.newStatus as string) || "unknown",
        projectName: (data?.projectName as string) || "Project",
        orgSlug: (data?.orgSlug as string) || "",
      });
      break;

    default:
      console.warn(`Unknown email event type: ${eventType}`);
  }
}

// Handle Slack notifications
async function handleSlackNotification(
  userId: string,
  payload: NotificationJobData["payload"]
) {
  const { slackWebhookUrl, eventType, title, message, data } = payload;

  if (!slackWebhookUrl) {
    // Try to get webhook URL from user's organization integration
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                integrations: {
                  where: { type: "SLACK", isActive: true },
                },
              },
            },
          },
        },
      },
    });

    const integration = user?.memberships
      .flatMap((m) => m.organization.integrations)
      .find((i) => i.type === "SLACK");

    const config = integration?.config as { webhookUrl?: string } | null;

    if (!config?.webhookUrl) {
      throw new Error("Slack integration not found or not configured");
    }

    await sendSlackNotification({
      webhookUrl: config.webhookUrl,
      eventType,
      title,
      message,
      data: data as Record<string, string>,
    });
  } else {
    await sendSlackNotification({
      webhookUrl: slackWebhookUrl,
      eventType,
      title,
      message,
      data: data as Record<string, string>,
    });
  }
}

// Handle Teams notifications
async function handleTeamsNotification(payload: NotificationJobData["payload"]) {
  const { teamsWebhookUrl, eventType, title, message, data } = payload;

  if (!teamsWebhookUrl) {
    throw new Error("Teams webhook URL is required");
  }

  await sendTeamsNotification({
    webhookUrl: teamsWebhookUrl,
    eventType,
    title,
    message,
    data: data as Record<string, string>,
  });
}

// Handle digest notifications
async function handleDigestNotification(
  userId: string,
  payload: NotificationJobData["payload"]
) {
  const { digestPeriod, recipientEmail } = payload;

  if (!recipientEmail || !digestPeriod) {
    throw new Error("Recipient email and digest period are required");
  }

  // Get unread notifications for the user
  const since = digestPeriod === "daily"
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const notifications = await db.notification.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      channel: "IN_APP",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (notifications.length === 0) {
    console.log(`No notifications to send in digest for user ${userId}`);
    return;
  }

  await sendDigestEmail({
    to: recipientEmail,
    period: digestPeriod,
    notifications: notifications.map((n) => ({
      title: n.title,
      message: n.message,
      createdAt: n.createdAt,
    })),
  });
}

// Event handlers
notificationWorker.on("completed", (job) => {
  console.log(`Notification job ${job.id} completed successfully`);
});

notificationWorker.on("failed", (job, error) => {
  console.error(`Notification job ${job?.id} failed:`, error.message);
});

notificationWorker.on("error", (error) => {
  console.error("Notification worker error:", error);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down notification worker...");
  await notificationWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down notification worker...");
  await notificationWorker.close();
  process.exit(0);
});

export { notificationWorker };
