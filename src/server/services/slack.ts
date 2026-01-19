import type { Block, KnownBlock } from "@slack/types";

// Validate Slack webhook URL
export function validateSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "hooks.slack.com" &&
      parsed.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}

interface SendSlackNotificationParams {
  webhookUrl: string;
  eventType: string;
  title: string;
  message: string;
  data?: Record<string, string>;
}

// Send notification to Slack via webhook
export async function sendSlackNotification({
  webhookUrl,
  eventType,
  title,
  message,
  data = {},
}: SendSlackNotificationParams): Promise<void> {
  const blocks = formatSlackBlocks(eventType, title, message, data);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: `${title}: ${message}`,
      blocks,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send Slack message: ${text}`);
  }
}

// Format message as Slack Block Kit
function formatSlackBlocks(
  eventType: string,
  title: string,
  message: string,
  data: Record<string, string>
): (Block | KnownBlock)[] {
  const bugUrl = data.bugUrl || "";
  const projectName = data.projectName || "";

  switch (eventType) {
    case "bug_assigned":
      return [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🐛 Bug Assigned",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}*\n${message}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Project: *${projectName}*`,
            },
          ],
        },
        ...(bugUrl
          ? [
              {
                type: "actions" as const,
                elements: [
                  {
                    type: "button" as const,
                    text: {
                      type: "plain_text" as const,
                      text: "View Bug",
                      emoji: true,
                    },
                    url: bugUrl,
                    style: "primary" as const,
                  },
                ],
              },
            ]
          : []),
      ];

    case "bug_commented":
      return [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "💬 New Comment",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}*\n${message}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Project: *${projectName}*`,
            },
          ],
        },
        ...(bugUrl
          ? [
              {
                type: "actions" as const,
                elements: [
                  {
                    type: "button" as const,
                    text: {
                      type: "plain_text" as const,
                      text: "View Comment",
                      emoji: true,
                    },
                    url: bugUrl,
                  },
                ],
              },
            ]
          : []),
      ];

    case "status_changed":
      const oldStatus = data.oldStatus || "";
      const newStatus = data.newStatus || "";

      return [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📊 Status Changed",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}*`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*From:*\n${oldStatus}`,
            },
            {
              type: "mrkdwn",
              text: `*To:*\n${newStatus}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Project: *${projectName}*`,
            },
          ],
        },
        ...(bugUrl
          ? [
              {
                type: "actions" as const,
                elements: [
                  {
                    type: "button" as const,
                    text: {
                      type: "plain_text" as const,
                      text: "View Bug",
                      emoji: true,
                    },
                    url: bugUrl,
                  },
                ],
              },
            ]
          : []),
      ];

    default:
      return [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}*\n${message}`,
          },
        },
        ...(bugUrl
          ? [
              {
                type: "actions" as const,
                elements: [
                  {
                    type: "button" as const,
                    text: {
                      type: "plain_text" as const,
                      text: "View Details",
                      emoji: true,
                    },
                    url: bugUrl,
                  },
                ],
              },
            ]
          : []),
      ];
  }
}

// Test Slack webhook connection
export async function testSlackConnection(webhookUrl: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "🔗 BugLens connection test successful!",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Webhook returned error: ${text}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
