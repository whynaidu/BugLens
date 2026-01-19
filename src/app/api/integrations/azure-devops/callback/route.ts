import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { exchangeAzureDevOpsCode } from "@/server/services/azure-devops";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Contains orgSlug
  const error = searchParams.get("error");

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Check if user cancelled or error occurred
  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/${state}/settings/integrations?error=azure_${error}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard?error=azure_missing_params`
    );
  }

  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      `${APP_URL}/login?callbackUrl=/${state}/settings/integrations`
    );
  }

  try {
    // Get organization by slug
    const organization = await db.organization.findUnique({
      where: { slug: state },
      include: {
        members: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!organization) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=org_not_found`
      );
    }

    // Verify user is admin
    const member = organization.members[0];
    if (!member || member.role !== "ADMIN") {
      return NextResponse.redirect(
        `${APP_URL}/${state}/settings/integrations?error=forbidden`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeAzureDevOpsCode(code);

    // Store integration
    await db.integration.upsert({
      where: {
        organizationId_type: {
          organizationId: organization.id,
          type: "AZURE_DEVOPS",
        },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        config: {},
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        type: "AZURE_DEVOPS",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        config: {},
        isActive: true,
      },
    });

    // Redirect back to integrations page
    return NextResponse.redirect(
      `${APP_URL}/${state}/settings/integrations?success=azure_connected`
    );
  } catch (error) {
    console.error("Azure DevOps OAuth callback error:", error);
    return NextResponse.redirect(
      `${APP_URL}/${state}/settings/integrations?error=azure_connection_failed`
    );
  }
}
