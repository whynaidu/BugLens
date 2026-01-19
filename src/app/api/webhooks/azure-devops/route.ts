import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  verifyAzureDevOpsWebhook,
  parseAzureDevOpsWebhook,
  type AzureDevOpsWebhookPayload,
} from "@/server/services/azure-devops";
import { Prisma } from "@prisma/client";

// Find bug by Azure DevOps work item ID (with project for organizationId)
async function findBugByWorkItem(workItemId: number) {
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

  // Filter bugs that have this Azure DevOps work item ID
  for (const bug of bugs) {
    const externalIds = bug.externalIds as Record<string, string | number> | null;
    if (externalIds?.azureDevOps === workItemId || externalIds?.azureDevOps === String(workItemId)) {
      return bug;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Azure DevOps uses Basic Auth for service hooks
    const authHeader = request.headers.get("authorization");

    if (authHeader && authHeader.startsWith("Basic ")) {
      const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
      const [username, password] = credentials.split(":");

      const expectedUsername = process.env.AZURE_DEVOPS_WEBHOOK_USERNAME;
      const expectedPassword = process.env.AZURE_DEVOPS_WEBHOOK_PASSWORD;

      if (expectedUsername && expectedPassword) {
        const isValid = verifyAzureDevOpsWebhook(
          username,
          password,
          expectedUsername,
          expectedPassword
        );

        if (!isValid) {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
      }
    }

    // Parse the payload
    const body = await request.json();
    const payload: AzureDevOpsWebhookPayload = parseAzureDevOpsWebhook(body);

    // Get work item ID
    const workItemId = payload.resource.workItemId || payload.resource.id;
    if (!workItemId) {
      return NextResponse.json({ error: "No work item ID in webhook" }, { status: 400 });
    }

    // Find the bug associated with this work item
    const bug = await findBugByWorkItem(workItemId);
    if (!bug) {
      // No linked bug found, ignore webhook
      return NextResponse.json({ message: "No linked bug found" }, { status: 200 });
    }

    // Get the integration for this organization
    const integration = await db.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId: bug.project.organizationId,
          type: "AZURE_DEVOPS",
        },
      },
    });

    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: "Integration not found or inactive" }, { status: 404 });
    }

    const config = integration.config as Record<string, unknown> | null;

    // Handle different event types
    switch (payload.eventType) {
      case "workitem.updated":
        await handleWorkItemUpdated(bug.id, bug.creatorId, payload, config);
        break;

      case "workitem.deleted":
        await handleWorkItemDeleted(bug.id, bug.creatorId);
        break;

      // Skip comment sync - would require system user
      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Azure DevOps webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleWorkItemUpdated(
  bugId: string,
  userId: string,
  payload: AzureDevOpsWebhookPayload,
  config: Record<string, unknown> | null
) {
  const fields = payload.resource.revision?.fields || payload.resource.fields;
  if (!fields) return;

  const updates: Prisma.BugUpdateInput = {};
  const changes: Record<string, { from?: unknown; to?: unknown }> = {};

  // Check for state changes
  const newState = fields["System.State"] as string | undefined;
  if (newState) {
    const stateMapping = config?.stateMapping as Record<string, string> | undefined;

    if (stateMapping) {
      // Reverse lookup: find BugLens status from Azure DevOps state
      for (const [bugStatus, azureState] of Object.entries(stateMapping)) {
        if (azureState === newState) {
          updates.status = bugStatus as Prisma.EnumBugStatusFieldUpdateOperationsInput["set"];
          changes.status = { to: bugStatus };
          break;
        }
      }
    }
  }

  // Check for priority changes
  const newPriority = fields["Microsoft.VSTS.Common.Priority"] as number | undefined;
  if (newPriority !== undefined) {
    const severityMapping = config?.severityMapping as Record<string, number> | undefined;

    if (severityMapping) {
      // Reverse lookup: find BugLens severity from Azure DevOps priority
      for (const [bugSeverity, azurePriority] of Object.entries(severityMapping)) {
        if (azurePriority === newPriority) {
          updates.severity = bugSeverity as Prisma.EnumBugSeverityFieldUpdateOperationsInput["set"];
          changes.severity = { to: bugSeverity };
          break;
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
          source: "azure_devops",
          eventType: payload.eventType,
          changedFields: Object.keys(changes),
        },
      },
    });
  }
}

async function handleWorkItemDeleted(bugId: string, userId: string) {
  // Clear the Azure DevOps external ID when work item is deleted
  const bug = await db.bug.findUnique({ where: { id: bugId } });
  if (!bug) return;

  const externalIds = (bug.externalIds as Record<string, unknown> | null) || {};
  delete externalIds.azureDevOps;

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
        source: "azure_devops",
        reason: "Work item deleted in Azure DevOps",
      },
    },
  });
}

// Handle GET for subscription verification
export async function GET() {
  // Azure DevOps may send a GET request to verify the webhook URL
  return NextResponse.json({ status: "ok" });
}
