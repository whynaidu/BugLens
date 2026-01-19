import { redirect, notFound } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ProjectList } from "@/components/projects/project-list";

interface ProjectsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const session = await auth();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const organization = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!organization) {
    notFound();
  }

  // Verify membership
  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: organization.id,
      },
    },
  });

  if (!member) {
    redirect("/select-organization");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="h-6 w-6" />
          Projects
        </h1>
        <p className="text-muted-foreground">
          Manage and organize your bug tracking projects.
        </p>
      </div>

      <ProjectList organizationId={organization.id} />
    </div>
  );
}
