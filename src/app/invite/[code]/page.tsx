import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { InviteClient } from "./client";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const session = await auth();

  // If not logged in, redirect to login with callback
  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${code}`);
  }

  // Find the invitation
  const invitation = await db.invitation.findUnique({
    where: { inviteCode: code },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  // Check if invitation is valid
  if (!invitation) {
    return (
      <InviteClient
        error="invalid"
        message="This invite link is invalid or has been revoked."
      />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <InviteClient
        error="expired"
        message="This invite link has expired. Please request a new one from the organization admin."
      />
    );
  }

  if (invitation.maxUses && invitation.usedCount >= invitation.maxUses) {
    return (
      <InviteClient
        error="max-uses"
        message="This invite link has reached its maximum number of uses."
      />
    );
  }

  // Check if user is already a member
  const existingMember = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invitation.organizationId,
      },
    },
  });

  if (existingMember) {
    redirect(`/${invitation.organization.slug}`);
  }

  return (
    <InviteClient
      invitation={{
        id: invitation.id,
        code: invitation.inviteCode!,
        role: invitation.role,
        organization: invitation.organization,
      }}
    />
  );
}
