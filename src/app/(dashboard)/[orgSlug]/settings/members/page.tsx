import { redirect, notFound } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MembersTable } from "@/components/settings/members-table";
import { InviteDialog } from "@/components/settings/invite-dialog";
import { Role } from "@prisma/client";

interface MembersPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const session = await auth();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Find the organization by slug
  const organization = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) {
    notFound();
  }

  // Get current user's membership and role
  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: organization.id,
      },
    },
    select: { id: true, role: true },
  });

  if (!member) {
    redirect("/select-organization");
  }

  const isAdmin = member.role === Role.ADMIN;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage your organization&apos;s team members and their roles.
          </p>
        </div>
        {isAdmin && (
          <InviteDialog organizationId={organization.id}>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </InviteDialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>
            View and manage team members in {organization.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable
            organizationId={organization.id}
            currentUserId={session.user.id}
            currentUserRole={member.role}
          />
        </CardContent>
      </Card>
    </div>
  );
}
