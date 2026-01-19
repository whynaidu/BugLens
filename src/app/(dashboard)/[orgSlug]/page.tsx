import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FolderKanban,
  Users,
  Bug,
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
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

interface DashboardPageProps {
  params: Promise<{ orgSlug: string }>;
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
    totalBugs,
    openBugs,
    inProgressBugs,
    resolvedBugs,
    recentBugs,
  ] = await Promise.all([
    db.project.count({ where: { organizationId: organization.id } }),
    db.member.count({ where: { organizationId: organization.id } }),
    db.bug.count({ where: { project: { organizationId: organization.id } } }),
    db.bug.count({
      where: {
        project: { organizationId: organization.id },
        status: BugStatus.OPEN,
      },
    }),
    db.bug.count({
      where: {
        project: { organizationId: organization.id },
        status: BugStatus.IN_PROGRESS,
      },
    }),
    db.bug.count({
      where: {
        project: { organizationId: organization.id },
        status: { in: [BugStatus.RESOLVED, BugStatus.CLOSED] },
      },
    }),
    db.bug.findMany({
      where: { project: { organizationId: organization.id } },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        createdAt: true,
        project: { select: { name: true, slug: true } },
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
      title: "Open Bugs",
      value: openBugs,
      icon: AlertCircle,
      href: `/${orgSlug}/bugs?status=OPEN`,
      color: "text-red-500",
    },
    {
      title: "In Progress",
      value: inProgressBugs,
      icon: Clock,
      href: `/${orgSlug}/bugs?status=IN_PROGRESS`,
      color: "text-yellow-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of {organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/${orgSlug}/bugs/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Report Bug
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:bg-muted/50 transition-colors">
            <Link href={stat.href}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Bugs */}
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bugs</CardTitle>
              <CardDescription>Latest bug reports in your organization</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${orgSlug}/bugs`}>
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBugs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bug className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No bugs reported yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href={`/${orgSlug}/bugs/new`}>Report your first bug</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentBugs.map((bug) => (
                  <Link
                    key={bug.id}
                    href={`/${orgSlug}/bugs/${bug.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[bug.status]}`}
                      />
                      <div>
                        <p className="font-medium line-clamp-1">{bug.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {bug.project.name} &middot;{" "}
                          {formatDistanceToNow(new Date(bug.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityBadgeVariant[bug.severity] || "outline"}>
                        {bug.severity}
                      </Badge>
                      {bug.assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={bug.assignee.avatarUrl || undefined}
                            alt={bug.assignee.name || bug.assignee.email}
                          />
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

        {/* Quick Actions & Summary */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Bug status summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bug Status Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm">Open</span>
                </div>
                <span className="font-medium">{openBugs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="font-medium">{inProgressBugs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">Resolved</span>
                </div>
                <span className="font-medium">{resolvedBugs}</span>
              </div>
            </div>

            {/* Progress Bar */}
            {totalBugs > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resolution Rate</span>
                  <span className="font-medium">
                    {Math.round((resolvedBugs / totalBugs) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${(resolvedBugs / totalBugs) * 100}%`,
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
                  <Link href={`/${orgSlug}/bugs/new`}>
                    <Bug className="mr-2 h-4 w-4" />
                    Report Bug
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
