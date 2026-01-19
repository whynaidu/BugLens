import { Queue } from "bullmq";

// Redis connection URL for BullMQ
const REDIS_URL = process.env.REDIS_URL;

// Check if we're in a serverless environment or Redis is not configured
const IS_SERVERLESS = !REDIS_URL || process.env.VERCEL === "1";

// Job types for the notification queue
export type NotificationJobType =
  | "SEND_IN_APP"
  | "SEND_EMAIL"
  | "SEND_SLACK"
  | "SEND_TEAMS"
  | "SEND_DIGEST";

export interface NotificationJobData {
  type: NotificationJobType;
  userId: string;
  notificationId?: string;
  payload: {
    eventType: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    // Email specific
    recipientEmail?: string;
    // Slack specific (webhook-based)
    slackWebhookUrl?: string;
    // Teams specific
    teamsWebhookUrl?: string;
    // Digest specific
    digestPeriod?: "daily" | "weekly";
  };
}

export interface DigestJobData {
  type: "SEND_DIGEST";
  userId: string;
  payload: {
    digestPeriod: "daily" | "weekly";
    recipientEmail: string;
    notifications: Array<{
      title: string;
      message: string;
      createdAt: Date;
    }>;
  };
}

// Create the notification queue (only if Redis is available)
let notificationQueue: Queue<NotificationJobData, unknown, NotificationJobType> | null = null;

if (!IS_SERVERLESS && REDIS_URL) {
  try {
    notificationQueue = new Queue<NotificationJobData, unknown, NotificationJobType>("notifications", {
      connection: {
        url: REDIS_URL,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days
        },
      },
    });
  } catch (error) {
    console.warn("Failed to initialize BullMQ queue:", error);
  }
}

// Handlers for direct processing (serverless mode)
type NotificationHandler = (data: NotificationJobData) => Promise<void>;
const handlers: Map<NotificationJobType, NotificationHandler> = new Map();

export function registerNotificationHandler(type: NotificationJobType, handler: NotificationHandler) {
  handlers.set(type, handler);
}

// Process notification directly (for serverless)
async function processDirectly(data: NotificationJobData): Promise<void> {
  const handler = handlers.get(data.type);
  if (handler) {
    try {
      await handler(data);
    } catch (error) {
      console.error(`Failed to process ${data.type} notification:`, error);
    }
  } else {
    // Just log for now if no handler registered
    console.log(`Notification queued (no handler): ${data.type}`, data.payload.title);
  }
}

// Add a notification job to the queue (or process directly in serverless)
export async function queueNotification(data: NotificationJobData) {
  if (IS_SERVERLESS || !notificationQueue) {
    // Process directly in serverless mode
    await processDirectly(data);
    return { id: `direct-${Date.now()}`, data };
  }

  const job = await notificationQueue.add(data.type, data, {
    priority: getPriority(data.type),
  });
  return job;
}

// Add multiple notification jobs (for multi-channel delivery)
export async function queueNotifications(jobs: NotificationJobData[]) {
  const results = await Promise.all(
    jobs.map((job) => queueNotification(job))
  );
  return results;
}

// Schedule a digest email
export async function scheduleDigest(
  userId: string,
  email: string,
  period: "daily" | "weekly"
) {
  if (IS_SERVERLESS || !notificationQueue) {
    console.log(`Digest scheduling not available in serverless mode for ${email}`);
    return null;
  }

  const job = await notificationQueue.add(
    "SEND_DIGEST",
    {
      type: "SEND_DIGEST",
      userId,
      payload: {
        eventType: "digest",
        title: `${period === "daily" ? "Daily" : "Weekly"} Digest`,
        message: "",
        digestPeriod: period,
        recipientEmail: email,
      },
    },
    {
      repeat: {
        pattern: period === "daily" ? "0 9 * * *" : "0 9 * * 1", // 9 AM daily or Monday
      },
    }
  );
  return job;
}

// Get job priority based on type
function getPriority(type: NotificationJobType): number {
  switch (type) {
    case "SEND_IN_APP":
      return 1; // Highest priority
    case "SEND_EMAIL":
      return 2;
    case "SEND_SLACK":
      return 2;
    case "SEND_TEAMS":
      return 2;
    case "SEND_DIGEST":
      return 3; // Lowest priority
    default:
      return 2;
  }
}

// Get queue stats
export async function getQueueStats() {
  if (IS_SERVERLESS || !notificationQueue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, mode: "serverless" };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    mode: "queue",
  };
}

// Clean old jobs
export async function cleanQueue() {
  if (IS_SERVERLESS || !notificationQueue) {
    return;
  }

  await Promise.all([
    notificationQueue.clean(24 * 60 * 60 * 1000, 1000, "completed"),
    notificationQueue.clean(7 * 24 * 60 * 60 * 1000, 1000, "failed"),
  ]);
}

// Export the Redis URL for use in workers
export { REDIS_URL, IS_SERVERLESS, notificationQueue };
