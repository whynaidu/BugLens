import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  verifyTrelloWebhook,
  parseTrelloWebhook,
  type TrelloWebhookPayload,
} from "@/server/services/trello";
import { Prisma } from "@prisma/client";

// Find bug by Trello card ID (with project for organizationId)
async function findBugByTrelloCard(cardId: string) {
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

  // Filter bugs that have this Trello card ID
  for (const bug of bugs) {
    const externalIds = bug.externalIds as Record<string, string> | null;
    if (externalIds?.trello === cardId) {
      return bug;
    }
  }

  return null;
}

// Find integration by board ID
async function findIntegrationByBoard(boardId: string) {
  const integrations = await db.integration.findMany({
    where: {
      type: "TRELLO",
      isActive: true,
    },
  });

  for (const integration of integrations) {
    const config = integration.config as Record<string, unknown> | null;
    if (config?.boardId === boardId) {
      return integration;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-trello-webhook");

    // Parse the payload
    const payload: TrelloWebhookPayload = parseTrelloWebhook(JSON.parse(body));

    // Get board ID from payload
    const boardId = payload.model?.id || payload.action?.data?.board?.id;
    if (!boardId) {
      return NextResponse.json({ error: "No board ID in webhook" }, { status: 400 });
    }

    // Find the integration for this board
    const integration = await findIntegrationByBoard(boardId);
    if (!integration) {
      // No integration found for this board, ignore webhook
      return NextResponse.json({ message: "No integration found for board" }, { status: 200 });
    }

    // Verify webhook signature
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/trello`;
    if (signature) {
      const isValid = verifyTrelloWebhook(body, signature, callbackUrl);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Get card ID from the action
    const cardId = payload.action?.data?.card?.id;
    if (!cardId) {
      // No card in this action, ignore
      return NextResponse.json({ message: "No card in action" }, { status: 200 });
    }

    // Find the bug associated with this Trello card
    const bug = await findBugByTrelloCard(cardId);
    if (!bug) {
      // No linked bug found, ignore webhook
      return NextResponse.json({ message: "No linked bug found" }, { status: 200 });
    }

    const config = integration.config as Record<string, unknown> | null;

    // Handle different action types
    switch (payload.action.type) {
      case "updateCard":
        await handleCardUpdated(bug.id, bug.creatorId, payload, config);
        break;

      case "deleteCard":
        await handleCardDeleted(bug.id, bug.creatorId);
        break;

      // Skip comment sync - would require system user
      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Trello webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleCardUpdated(
  bugId: string,
  userId: string,
  payload: TrelloWebhookPayload,
  config: Record<string, unknown> | null
) {
  const action = payload.action;
  const updates: Prisma.BugUpdateInput = {};

  // Check if list changed (status change)
  if (action.data.listAfter && action.data.listBefore) {
    const newListId = action.data.listAfter.id;
    const listMapping = config?.listMapping as Record<string, string> | undefined;

    if (listMapping) {
      // Reverse lookup: find BugLens status from list ID
      for (const [bugStatus, listId] of Object.entries(listMapping)) {
        if (listId === newListId) {
          updates.status = bugStatus as Prisma.EnumBugStatusFieldUpdateOperationsInput["set"];
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
          source: "trello",
          actionType: action.type,
          changes: {
            listFrom: action.data.listBefore?.name,
            listTo: action.data.listAfter?.name,
          },
        },
      },
    });
  }
}

async function handleCardDeleted(bugId: string, userId: string) {
  // Clear the Trello external ID when card is deleted
  const bug = await db.bug.findUnique({ where: { id: bugId } });
  if (!bug) return;

  const externalIds = (bug.externalIds as Record<string, string> | null) || {};
  delete externalIds.trello;

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
        source: "trello",
        reason: "Card deleted in Trello",
      },
    },
  });
}

// Handle HEAD requests (Trello uses this to verify webhook URL)
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
