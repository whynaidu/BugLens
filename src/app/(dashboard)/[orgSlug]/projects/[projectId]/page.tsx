import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FolderKanban,
  CheckSquare,
  XCircle,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  Settings,
  Layers,
} from "lucide-react";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { TestCaseStatus } from "@prisma/client";
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
  DRAFT: "bg-gray-500",
  PENDING: "bg-yellow-500",
  PASSED: "bg-green-500",
  FAILED: "bg-red-500",
  BLOCKED: "bg-orange-500",
  SKIPPED: "bg-slate-400",
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
      modules: {
        where: { parentId: null }, // Only root modules
        orderBy: { order: "asc" },
        include: {
          _count: { select: { testCases: true, children: true } },
        },
      },
      _count: {
        select: { modules: true },
      },
    },
  });

  if (!project || project.organizationId !== organization.id) {
    notFound();
  }

  // Get test case statistics
  const testCaseStats = await db.testCase.groupBy({
    by: ["status"],
    where: { module: { projectId } },
    _count: { status: true },
  });

  const totalTestCases = await db.testCase.count({
    where: { module: { projectId } },
  });

  const statusCounts = { passed: 0, failed: 0, pending: 0, total: totalTestCases };
  testCaseStats.forEach((stat: { status: TestCaseStatus; _count: { status: number } }) => {
    if (stat.status === TestCaseStatus.PASSED) {
      statusCounts.passed += stat._count.status;
    } else if (stat.status === TestCaseStatus.FAILED) {
      statusCounts.failed += stat._count.status;
    } else if (stat.status === TestCaseStatus.PENDING || stat.status === TestCaseStatus.DRAFT) {
      statusCounts.pending += stat._count.status;
    }
  });

  // Get recent test cases
  const recentTestCases = await db.testCase.findMany({
    where: { module: { projectId } },
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      referenceId: true,
      title: true,
      status: true,
      severity: true,
      createdAt: true,
      module: { select: { id: true, name: true } },
      assignee: { select: { name: true, email: true, avatarUrl: true } },
    },
  });

  const stats = [
    {
      title: "Passed",
      value: statusCounts.passed,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      title: "Failed",
      value: statusCounts.failed,
      icon: XCircle,
      color: "text-red-500",
    },
    {
      title: "Pending",
      value: statusCounts.pending,
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      title: "Modules",
      value: project._count.modules,
      icon: Layers,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: project.color }}
          >
            <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
              <span className="truncate">{project.name}</span>
              {project.isArchived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground line-clamp-2">
              {project.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild size="sm" className="flex-1 sm:flex-none">
            <Link href={`/${orgSlug}/projects/${projectId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Settings</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <Link href={`/${orgSlug}/projects/${projectId}/modules`}>
              <Layers className="mr-2 h-4 w-4" />
              Modules
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Modules */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Modules</CardTitle>
              <CardDescription>Organize test cases by module</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" asChild>
                <Link href={`/${orgSlug}/projects/${projectId}/modules?create=true`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${orgSlug}/projects/${projectId}/modules`}>
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {project.modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No modules created yet
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/projects/${projectId}/modules`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Module
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {project.modules.slice(0, 5).map((module) => (
                  <Link
                    key={module.id}
                    href={`/${orgSlug}/projects/${projectId}/modules`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{module.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {module._count.testCases} test cases
                        {module._count.children > 0 && ` • ${module._count.children} sub-modules`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Test Cases */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Recent Test Cases</CardTitle>
              <CardDescription>Latest test cases in this project</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${orgSlug}/testcases?projectId=${projectId}`}>
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTestCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No test cases created yet
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${orgSlug}/projects/${projectId}/modules`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Test Case
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTestCases.map((testCase) => (
                  <Link
                    key={testCase.id}
                    href={`/${orgSlug}/projects/${projectId}/modules/${testCase.module.id}/testcases/${testCase.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${statusColors[testCase.status]}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {testCase.referenceId && (
                            <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              {testCase.referenceId}
                            </Badge>
                          )}
                          <p className="font-medium truncate">{testCase.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(testCase.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={severityBadgeVariant[testCase.severity]}>
                        Sev: {testCase.severity}
                      </Badge>
                      {testCase.assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={testCase.assignee.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(testCase.assignee.name, testCase.assignee.email)}
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
