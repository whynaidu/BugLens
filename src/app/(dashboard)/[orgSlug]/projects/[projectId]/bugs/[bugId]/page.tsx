"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Bug } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BugDetail } from "@/components/bugs/bug-detail";
import { BugSidebar } from "@/components/bugs/bug-sidebar";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/hooks/use-session";

export default function BugDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const bugId = params.bugId as string;

  // Fetch bug details
  const {
    data: bug,
    isLoading,
    error,
    refetch,
  } = trpc.bugs.getById.useQuery({ bugId });

  // Fetch organization members for comments
  const { data: membersData } = trpc.members.getByOrganization.useQuery(
    { organizationId: bug?.project?.organization?.id ?? "" },
    { enabled: !!bug?.project?.organization?.id }
  );

  // Handle delete - redirect to bugs list
  const handleDelete = () => {
    router.push(`/${orgSlug}/projects/${projectId}/bugs`);
  };

  // Handle updates - refetch data
  const handleUpdate = () => {
    refetch();
  };

  // Transform members data for the component
  const members = membersData?.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.avatarUrl,
  })) ?? [];

  if (error) {
    return (
      <div className="container py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message === "Bug not found"
              ? "This bug could not be found. It may have been deleted."
              : "Failed to load bug details. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-6 w-64" />

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="container py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            This bug could not be found. It may have been deleted.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Transform bug data to match component interfaces
  const transformedBug = {
    id: bug.id,
    title: bug.title,
    description: bug.description,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    createdAt: bug.createdAt,
    updatedAt: bug.updatedAt,
    creator: {
      id: bug.creator.id,
      name: bug.creator.name,
      email: bug.creator.email,
      image: bug.creator.avatarUrl,
    },
    assignee: bug.assignee ? {
      id: bug.assignee.id,
      name: bug.assignee.name,
      email: bug.assignee.email,
      image: bug.assignee.avatarUrl,
    } : null,
    project: {
      id: bug.project.id,
      name: bug.project.name ?? "Project",
      organization: {
        id: bug.project.organization.id,
        slug: bug.project.organization.slug ?? orgSlug,
        name: bug.project.organization.name ?? "Organization",
      },
    },
    annotations: bug.annotations.map((ann) => ({
      id: ann.id,
      screenshot: {
        id: ann.screenshot.id,
        fileName: ann.screenshot.title ?? "Screenshot",
        flow: {
          id: ann.screenshot.flow.id,
          name: ann.screenshot.flow.name,
        },
      },
    })),
    _count: {
      annotations: bug.annotations.length,
      comments: bug.comments.length,
    },
  };

  // Transform for sidebar
  const sidebarBug = {
    id: bug.id,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    createdAt: bug.createdAt,
    updatedAt: bug.updatedAt,
    creator: {
      id: bug.creator.id,
      name: bug.creator.name,
      email: bug.creator.email,
      image: bug.creator.avatarUrl,
    },
    assignee: bug.assignee ? {
      id: bug.assignee.id,
      name: bug.assignee.name,
      email: bug.assignee.email,
      image: bug.assignee.avatarUrl,
    } : null,
    project: {
      id: bug.project.id,
      name: bug.project.name ?? "Project",
      organization: {
        id: bug.project.organization.id,
        slug: bug.project.organization.slug ?? orgSlug,
        name: bug.project.organization.name ?? "Organization",
      },
    },
    _count: {
      annotations: bug.annotations.length,
      comments: bug.comments.length,
    },
    externalIds: bug.externalIds as { jira?: string; trello?: string; azureDevOps?: string | number } | null,
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}`}>Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}/projects`}>Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}/projects/${projectId}`}>
                {transformedBug.project.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${orgSlug}/projects/${projectId}/bugs`}>Bugs</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <Bug className="h-4 w-4" />
              {bug.title.length > 30 ? `${bug.title.substring(0, 30)}...` : bug.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <BugDetail
            bug={transformedBug}
            currentUserId={user?.id ?? ""}
            members={members}
            onUpdate={handleUpdate}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <BugSidebar bug={sidebarBug} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
}
