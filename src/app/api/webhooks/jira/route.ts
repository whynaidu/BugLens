import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  verifyJiraWebhook,
  parseJiraWebhook,
  type JiraWebhookPayload,
} from "@/server/services/jira";
import { Prisma } from "@prisma/client";

// Find bug by Jira issue key (with project for organizationId)
async function findBugByJiraIssue(issueKey: string) {
  // Query bugs and filter by externalIds JSON field
  const bugs = await db.bug.findMany({
    where: {
      externalIds: {
        not: Prisma.DbNull,
      },
    },
    include: {
      project: true,
    },
  });

  // Filter bugs that have this Jira issue key
  for (const bug of bugs) {
    const externalIds = bug.externalIds as Record<string, string> | null;
    if (externalIds?.jira === issueKey) {
      return bug;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature");

    // Parse the payload first to get cloudId
    const payload: JiraWebhookPayload = parseJiraWebhook(JSON.parse(body));

    // Get issue key from payload
    const issueKey = payload.issue?.key;
    if (!issueKey) {
      return NextResponse.json({ error: "No issue key in webhook" }, { status: 400 });
    }

    // Find the bug associated with this Jira issue
    const bug = await findBugByJiraIssue(issueKey);
    if (!bug) {
      // No linked bug found, ignore webhook
      return NextResponse.json({ message: "No linked bug found" }, { status: 200 });
    }

    // Get the integration for this organization
    const integration = await db.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId: bug.project.organizationId,
          type: "JIRA",
        },
      },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: "Integration not found or inactive" }, { status: 404 });
    }

    // Verify webhook signature if secret is configured
    const config = integration.config as Record<string, unknown> | null;
    const webhookSecret = config?.webhookSecret as string | undefined;

    if (webhookSecret && signature) {
      const isValid = verifyJiraWebhook(body, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Handle different webhook events
    switch (payload.webhookEvent) {
      case "jira:issue_updated":
        await handleIssueUpdated(bug.id, bug.creatorId, payload, config);
        break;

      case "jira:issue_deleted":
        await handleIssueDeleted(bug.id, bug.creatorId);
        break;

      // Skip comment sync - would require system user
      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Jira webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleIssueUpdated(
  bugId: string,
  userId: string,
  payload: JiraWebhookPayload,
  config: Record<string, unknown> | null
) {
  const changelog = payload.changelog;
  if (!changelog?.items.length) return;

  const statusMapping = config?.statusMapping as Record<string, string> | undefined;
  const syncDirection = config?.syncDirection as string | undefined;

  // Only sync back if direction is "pull" or "both"
  if (syncDirection !== "pull" && syncDirection !== "both") {
    return;
  }

  const updates: Prisma.BugUpdateInput = {};

  for (const change of changelog.items) {
    // Handle status changes
    if (change.field === "status") {
      const newJiraStatus = change.toString;

      // Find BugLens status from reverse mapping
      if (statusMapping) {
        for (const [bugStatus, jiraStatus] of Object.entries(statusMapping)) {
          if (jiraStatus === newJiraStatus) {
            updates.status = bugStatus as Prisma.EnumBugStatusFieldUpdateOperationsInput["set"];
            break;
          }
        }
      }
    }

    // Handle priority changes
    if (change.field === "priority") {
      const newJiraPriority = change.toString;
      const severityMapping = config?.severityMapping as Record<string, string> | undefined;

      if (severityMapping) {
        for (const [bugSeverity, jiraPriority] of Object.entries(severityMapping)) {
          if (jiraPriority === newJiraPriority) {
            updates.severity = bugSeverity as Prisma.EnumBugSeverityFieldUpdateOperationsInput["set"];
            break;
          }
        }
      }
    }
  }

  // Update bug if there are changes
  if (Object.keys(updates).length > 0) {
    await db.bug.update({
      where: { id: bugId },
      data: updates,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        bugId,
        userId,
        action: "EXTERNAL_SYNC",
        details: {
          source: "jira",
          changes: changelog.items.map((item) => ({
            field: item.field,
            from: item.fromString,
            to: item.toString,
          })),
        },
      },
    });
  }
}

async function handleIssueDeleted(bugId: string, userId: string) {
  // Clear the Jira external ID when issue is deleted
  const bug = await db.bug.findUnique({ where: { id: bugId } });
  if (!bug) return;

  const externalIds = (bug.externalIds as Record<string, string> | null) || {};
  delete externalIds.jira;

  await db.bug.update({
    where: { id: bugId },
    data: { externalIds: externalIds as Prisma.InputJsonValue },
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      bugId,
      userId,
      action: "EXTERNAL_UNLINKED",
      details: {
        source: "jira",
        reason: "Issue deleted in Jira",
      },
    },
  });
}

// Handle HEAD requests (Jira uses this to verify webhook URL)
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
