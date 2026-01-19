import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScreenshotGrid } from "@/components/screenshots/screenshot-grid";

interface FlowDetailPageProps {
  params: Promise<{ orgSlug: string; projectId: string; flowId: string }>;
}

export default async function FlowDetailPage({ params }: FlowDetailPageProps) {
  const session = await auth();
  const { orgSlug, projectId, flowId } = await params;

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

  // Get project
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.organizationId !== organization.id) {
    notFound();
  }

  // Get flow
  const flow = await db.flow.findUnique({
    where: { id: flowId },
  });

  if (!flow || flow.projectId !== projectId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${orgSlug}/projects`}>Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${orgSlug}/projects/${projectId}`}>
              {project.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${orgSlug}/projects/${projectId}/flows`}>
              Flows
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{flow.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${orgSlug}/projects/${projectId}/flows`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: project.color }}
            >
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{flow.name}</h1>
              {flow.description && (
                <p className="text-sm text-muted-foreground">{flow.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Grid with Upload and Reorder */}
      <ScreenshotGrid
        flowId={flowId}
        projectId={projectId}
        orgSlug={orgSlug}
      />
    </div>
  );
}
