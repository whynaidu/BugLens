import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FolderKanban,
  Users,
  CheckSquare,
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
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

interface DashboardPageProps {
  params: Promise<{ orgSlug: string }>;
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
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const session = await auth();
  const { orgSlug } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Find the organization
  const organization = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!organization) {
    notFound();
  }

  // Get dashboard stats
  const [
    totalProjects,
    totalMembers,
    totalTestCases,
    passedTestCases,
    failedTestCases,
    pendingTestCases,
    recentTestCases,
  ] = await Promise.all([
    db.project.count({ where: { organizationId: organization.id } }),
    db.member.count({ where: { organizationId: organization.id } }),
    db.testCase.count({ where: { module: { project: { organizationId: organization.id } } } }),
    db.testCase.count({
      where: {
        module: { project: { organizationId: organization.id } },
        status: TestCaseStatus.PASSED,
      },
    }),
    db.testCase.count({
      where: {
        module: { project: { organizationId: organization.id } },
        status: TestCaseStatus.FAILED,
      },
    }),
    db.testCase.count({
      where: {
        module: { project: { organizationId: organization.id } },
        status: { in: [TestCaseStatus.PENDING, TestCaseStatus.DRAFT] },
      },
    }),
    db.testCase.findMany({
      where: { module: { project: { organizationId: organization.id } } },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        referenceId: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
        module: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true, slug: true } },
          },
        },
        creator: { select: { name: true, email: true, avatarUrl: true } },
        assignee: { select: { name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  const stats = [
    {
      title: "Total Projects",
      value: totalProjects,
      icon: FolderKanban,
      href: `/${orgSlug}/projects`,
      color: "text-blue-500",
    },
    {
      title: "Team Members",
      value: totalMembers,
      icon: Users,
      href: `/${orgSlug}/settings/members`,
      color: "text-green-500",
    },
    {
      title: "Failed Tests",
      value: failedTestCases,
      icon: XCircle,
      href: `/${orgSlug}/testcases?status=FAILED`,
      color: "text-red-500",
    },
    {
      title: "Pending Tests",
      value: pendingTestCases,
      icon: Clock,
      href: `/${orgSlug}/testcases?status=PENDING`,
      color: "text-yellow-500",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome back! Here&apos;s an overview of {organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/${orgSlug}/projects`}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:bg-muted/50 transition-colors">
            <Link href={stat.href}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {/* Recent Test Cases */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Recent Test Cases</CardTitle>
              <CardDescription>Latest test cases in your organization</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${orgSlug}/testcases`}>
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTestCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No test cases created yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href={`/${orgSlug}/projects`}>Create your first project</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTestCases.map((testCase) => (
                  <Link
                    key={testCase.id}
                    href={`/${orgSlug}/projects/${testCase.module.project.id}/modules/${testCase.module.id}/testcases/${testCase.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColors[testCase.status]}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {testCase.referenceId && (
                            <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              {testCase.referenceId}
                            </Badge>
                          )}
                          <p className="font-medium line-clamp-1 text-sm sm:text-base">{testCase.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {testCase.module.project.name} &middot;{" "}
                          {formatDistanceToNow(new Date(testCase.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-5 sm:ml-0 flex-shrink-0">
                      <Badge variant={severityBadgeVariant[testCase.severity] || "outline"} className="text-xs">
                        Sev: {testCase.severity}
                      </Badge>
                      {testCase.assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={testCase.assignee.avatarUrl || undefined}
                            alt={testCase.assignee.name || testCase.assignee.email}
                          />
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

        {/* Quick Actions & Summary */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Test case status summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Test Case Status Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Passed</span>
                </div>
                <span className="font-medium">{passedTestCases}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Failed</span>
                </div>
                <span className="font-medium">{failedTestCases}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Pending</span>
                </div>
                <span className="font-medium">{pendingTestCases}</span>
              </div>
            </div>

            {/* Progress Bar */}
            {totalTestCases > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pass Rate</span>
                  <span className="font-medium">
                    {Math.round((passedTestCases / totalTestCases) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${(passedTestCases / totalTestCases) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium">Quick Actions</p>
              <div className="grid gap-2">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/${orgSlug}/projects/new`}>
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Create Project
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/${orgSlug}/testcases`}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    View Test Cases
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/${orgSlug}/settings/members`}>
                    <Users className="mr-2 h-4 w-4" />
                    Invite Team
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
