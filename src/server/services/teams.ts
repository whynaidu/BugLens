// Rate limiter for Teams webhooks (4 requests per second)
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(webhookUrl: string): boolean {
  const now = Date.now();
  const windowMs = 1000; // 1 second window
  const maxRequests = 4;

  const requests = rateLimiter.get(webhookUrl) || [];
  const recentRequests = requests.filter((t) => now - t < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(webhookUrl, recentRequests);
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [url, requests] of rateLimiter.entries()) {
    const recent = requests.filter((t) => now - t < 2000);
    if (recent.length === 0) {
      rateLimiter.delete(url);
    } else {
      rateLimiter.set(url, recent);
    }
  }
}, 10000);

interface AdaptiveCard {
  type: "AdaptiveCard";
  $schema: string;
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
}

interface AdaptiveCardElement {
  type: string;
  text?: string;
  weight?: string;
  size?: string;
  wrap?: boolean;
  spacing?: string;
  color?: string;
  columns?: AdaptiveCardColumn[];
  items?: AdaptiveCardElement[];
  facts?: Array<{ title: string; value: string }>;
}

interface AdaptiveCardColumn {
  type: string;
  width?: string;
  items: AdaptiveCardElement[];
}

interface AdaptiveCardAction {
  type: string;
  title: string;
  url?: string;
}

interface SendTeamsNotificationParams {
  webhookUrl: string;
  eventType: string;
  title: string;
  message: string;
  data?: Record<string, string>;
}

// Send notification to Teams
export async function sendTeamsNotification({
  webhookUrl,
  eventType,
  title,
  message,
  data = {},
}: SendTeamsNotificationParams): Promise<void> {
  // Check rate limit
  if (!checkRateLimit(webhookUrl)) {
    // Wait and retry after a short delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!checkRateLimit(webhookUrl)) {
      throw new Error("Rate limit exceeded for Teams webhook");
    }
  }

  const card = formatAdaptiveCard(eventType, title, message, data);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: card,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send Teams notification: ${response.status} ${errorText}`);
  }
}

// Format message as Adaptive Card
function formatAdaptiveCard(
  eventType: string,
  title: string,
  message: string,
  data: Record<string, string>
): AdaptiveCard {
  const bugUrl = data.bugUrl || "";
  const projectName = data.projectName || "";

  const baseCard: AdaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [],
    actions: [],
  };

  switch (eventType) {
    case "bug_assigned":
      baseCard.body = [
        {
          type: "TextBlock",
          text: "🐛 Bug Assigned",
          weight: "Bolder",
          size: "Large",
        },
        {
          type: "TextBlock",
          text: title,
          weight: "Bolder",
          wrap: true,
        },
        {
          type: "TextBlock",
          text: message,
          wrap: true,
          spacing: "Small",
        },
        {
          type: "FactSet",
          facts: [{ title: "Project", value: projectName }],
        },
      ];
      baseCard.actions = bugUrl
        ? [
            {
              type: "Action.OpenUrl",
              title: "View Bug",
              url: bugUrl,
            },
          ]
        : [];
      break;

    case "bug_commented":
      baseCard.body = [
        {
          type: "TextBlock",
          text: "💬 New Comment",
          weight: "Bolder",
          size: "Large",
        },
        {
          type: "TextBlock",
          text: title,
          weight: "Bolder",
          wrap: true,
        },
        {
          type: "TextBlock",
          text: message,
          wrap: true,
          spacing: "Small",
        },
        {
          type: "FactSet",
          facts: [{ title: "Project", value: projectName }],
        },
      ];
      baseCard.actions = bugUrl
        ? [
            {
              type: "Action.OpenUrl",
              title: "View Comment",
              url: bugUrl,
            },
          ]
        : [];
      break;

    case "status_changed":
      const oldStatus = data.oldStatus || "";
      const newStatus = data.newStatus || "";

      baseCard.body = [
        {
          type: "TextBlock",
          text: "📊 Status Changed",
          weight: "Bolder",
          size: "Large",
        },
        {
          type: "TextBlock",
          text: title,
          weight: "Bolder",
          wrap: true,
        },
        {
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: "From",
                  weight: "Bolder",
                  size: "Small",
                  color: "Attention",
                },
                {
                  type: "TextBlock",
                  text: oldStatus,
                  wrap: true,
                },
              ],
            },
            {
              type: "Column",
              width: "auto",
              items: [
                {
                  type: "TextBlock",
                  text: "→",
                  size: "Large",
                },
              ],
            },
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: "To",
                  weight: "Bolder",
                  size: "Small",
                  color: "Good",
                },
                {
                  type: "TextBlock",
                  text: newStatus,
                  wrap: true,
                },
              ],
            },
          ],
        },
        {
          type: "FactSet",
          facts: [{ title: "Project", value: projectName }],
        },
      ];
      baseCard.actions = bugUrl
        ? [
            {
              type: "Action.OpenUrl",
              title: "View Bug",
              url: bugUrl,
            },
          ]
        : [];
      break;

    default:
      baseCard.body = [
        {
          type: "TextBlock",
          text: title,
          weight: "Bolder",
          wrap: true,
        },
        {
          type: "TextBlock",
          text: message,
          wrap: true,
        },
      ];
      baseCard.actions = bugUrl
        ? [
            {
              type: "Action.OpenUrl",
              title: "View Details",
              url: bugUrl,
            },
          ]
        : [];
      break;
  }

  return baseCard;
}

// Validate Teams webhook URL
export function validateTeamsWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Teams webhook URLs should be from Microsoft
    const validHosts = [
      "outlook.office.com",
      "outlook.office365.com",
      ".webhook.office.com",
    ];
    return validHosts.some(
      (host) =>
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith(host)
    );
  } catch {
    return false;
  }
}

// Test Teams webhook connection
export async function testTeamsConnection(webhookUrl: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!validateTeamsWebhookUrl(webhookUrl)) {
    return { ok: false, error: "Invalid Teams webhook URL" };
  }

  try {
    await sendTeamsNotification({
      webhookUrl,
      eventType: "test",
      title: "BugLens Test Notification",
      message: "Your Teams integration is working correctly!",
      data: {},
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
