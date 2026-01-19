import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FolderKanban,
  Bug,
  AlertCircle,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  Settings,
  Layers,
} from "lucide-react";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { BugStatus } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ProjectPageProps {
  params: Promise<{ orgSlug: string; projectId: string }>;
}

const statusColors: Record<string, string> = {
  OPEN: "bg-red-500",
  IN_PROGRESS: "bg-yellow-500",
  IN_REVIEW: "bg-blue-500",
  RESOLVED: "bg-green-500",
  CLOSED: "bg-gray-500",
  REOPENED: "bg-orange-500",
};

const severityBadgeVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "destructive",
  MEDIUM: "default",
  LOW: "secondary",
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return email[0].toUpperCase();
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await auth();
  const { orgSlug, projectId } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const organization = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!organization) {
    notFound();
  }

  // Get project with related data
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      flows: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { screenshots: true } },
        },
      },
      _count: {
        select: { bugs: true, flows: true },
      },
    },
  });

  if (!project || project.organizationId !== organization.id) {
    notFound();
  }

  // Get bug statistics
  const bugStats = await db.bug.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { status: true },
  });

  const statusCounts = { open: 0, inProgress: 0, resolved: 0, total: 0 };
  bugStats.forEach((stat) => {
    statusCounts.total += stat._count.status;
    if (stat.status === BugStatus.OPEN || stat.status === BugStatus.REOPENED) {
      statusCounts.open += stat._count.status;
    } else if (stat.status === BugStatus.IN_PROGRESS || stat.status === BugStatus.IN_REVIEW) {
      statusCounts.inProgress += stat._count.status;
    } else {
      statusCounts.resolved += stat._count.status;
    }
  });

  // Get recent bugs
  const recentBugs = await db.bug.findMany({
    where: { projectId },
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      severity: true,
      createdAt: true,
      assignee: { select: { name: true, email: true, avatarUrl: true } },
    },
  });

  const stats = [
    {
      title: "Open Bugs",
      value: statusCounts.open,
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "In Progress",
      value: statusCounts.inProgress,
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      title: "Resolved",
      value: statusCounts.resolved,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      title: "Total Flows",
      value: project._count.flows,
      icon: Layers,
      color: "text-blue-500",
    },
  ];

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
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: project.color }}
          >
            <FolderKanban className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {project.name}
              {project.isArchived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              {project.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${orgSlug}/projects/${projectId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/${orgSlug}/bugs/new?projectId=${projectId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Report Bug
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Flows */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Flows</CardTitle>
              <CardDescription>Organize screenshots by user flows</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${orgSlug}/projects/${projectId}/flows`}>
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {project.flows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No flows created yet
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/projects/${projectId}/flows`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Flow
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {project.flows.slice(0, 5).map((flow) => (
                  <Link
                    key={flow.id}
                    href={`/${orgSlug}/projects/${projectId}/flows/${flow.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{flow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {flow._count.screenshots} screenshots
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bugs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bugs</CardTitle>
              <CardDescription>Latest bug reports in this project</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${orgSlug}/bugs?projectId=${projectId}`}>
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBugs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bug className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No bugs reported yet
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/bugs/new?projectId=${projectId}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Report Bug
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentBugs.map((bug) => (
                  <Link
                    key={bug.id}
                    href={`/${orgSlug}/bugs/${bug.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${statusColors[bug.status]}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{bug.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={severityBadgeVariant[bug.severity]}>
                        {bug.severity}
                      </Badge>
                      {bug.assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={bug.assignee.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(bug.assignee.name, bug.assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
