import { Liveblocks } from "@liveblocks/node";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getUserColor } from "@/lib/liveblocks";

// Lazy initialize Liveblocks client only when needed
function getLiveblocks(): Liveblocks | null {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) {
    return null;
  }
  return new Liveblocks({ secret });
}

export async function POST(request: NextRequest) {
  // Check if Liveblocks is configured
  const liveblocks = getLiveblocks();
  if (!liveblocks) {
    return NextResponse.json(
      { error: "Liveblocks is not configured. Real-time collaboration is disabled." },
      { status: 503 }
    );
  }

  // Get the current user's session
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Get full user info from database
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Parse the request body to get the room ID
  let room: string | undefined;
  try {
    const body = await request.json();
    room = body.room;
  } catch {
    // Room might not be provided in initial auth
  }

  // If a room is specified, verify user has access
  if (room) {
    const hasAccess = await verifyRoomAccess(user.id, room);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this room" },
        { status: 403 }
      );
    }
  }

  // Create Liveblocks session with user info
  const liveblocksSession = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.name || user.email || "Anonymous",
      email: user.email || "",
      avatar: user.avatarUrl || undefined,
      color: getUserColor(user.id),
    },
  });

  // Grant access to the requested room or use a wildcard
  if (room) {
    liveblocksSession.allow(room, liveblocksSession.FULL_ACCESS);
  } else {
    // Allow access to all rooms the user has access to
    // In production, you'd want to be more restrictive
    liveblocksSession.allow("screenshot:*", liveblocksSession.FULL_ACCESS);
    liveblocksSession.allow("testcase:*", liveblocksSession.FULL_ACCESS);
  }

  // Authorize and return the response
  const { status, body } = await liveblocksSession.authorize();

  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Verify that a user has access to a specific Liveblocks room
 */
async function verifyRoomAccess(userId: string, room: string): Promise<boolean> {
  // Parse the room ID to determine the resource type and ID
  const [resourceType, resourceId] = room.split(":");

  if (!resourceType || !resourceId) {
    return false;
  }

  switch (resourceType) {
    case "screenshot": {
      // Verify user has access to the screenshot's organization
      // Screenshot -> TestCase -> Module -> Project -> Organization
      const screenshot = await db.screenshot.findUnique({
        where: { id: resourceId },
        select: {
          testCase: {
            select: {
              module: {
                select: {
                  project: {
                    select: {
                      organization: {
                        select: {
                          members: {
                            where: { userId },
                            select: { id: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      return (screenshot?.testCase?.module?.project?.organization?.members?.length ?? 0) > 0;
    }

    case "testcase": {
      // Verify user has access to the test case's organization
      // TestCase -> Module -> Project -> Organization
      const testCase = await db.testCase.findUnique({
        where: { id: resourceId },
        select: {
          module: {
            select: {
              project: {
                select: {
                  organization: {
                    select: {
                      members: {
                        where: { userId },
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      return (testCase?.module?.project?.organization?.members?.length ?? 0) > 0;
    }

    default:
      return false;
  }
}
