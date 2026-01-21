"use client";

import { useParams } from "next/navigation";
import { BarChart3, PieChart, TrendingUp, Calendar, Download, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

export default function ReportsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // First get the organization to get its ID
  const { data: org } = trpc.organizations.getBySlug.useQuery({ slug: orgSlug });

  const { data: projects, isLoading } = trpc.projects.getByOrganization.useQuery(
    { organizationId: org?.id || "" },
    { enabled: !!org?.id }
  );

  if (isLoading || !org) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate stats from testCaseStats
  const totalProjects = projects?.length || 0;
  const totalTestCases = projects?.reduce((acc, p) => acc + (p.testCaseStats?.total || 0), 0) || 0;
  const passedTestCases = projects?.reduce((acc, p) => acc + (p.testCaseStats?.passed || 0), 0) || 0;
  const failedTestCases = projects?.reduce((acc, p) => acc + (p.testCaseStats?.failed || 0), 0) || 0;
  const pendingTestCases = projects?.reduce((acc, p) => acc + (p.testCaseStats?.pending || 0), 0) || 0;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">
            Analytics and insights for your organization
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              Active projects in organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Test Cases</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTestCases}</div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{passedTestCases}</div>
            <p className="text-xs text-muted-foreground">
              Test cases passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{failedTestCases}</div>
            <p className="text-xs text-muted-foreground">
              Test cases failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
          <CardDescription>Test case distribution across projects</CardDescription>
        </CardHeader>
        <CardContent>
          {projects && projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => {
                const testCaseCount = project.testCaseStats?.total || 0;
                const percentage = totalTestCases > 0 ? (testCaseCount / totalTestCases) * 100 : 0;

                return (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-muted-foreground">{testCaseCount} test cases</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No projects yet. Create a project to see reports.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pass Rate Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pass Rate Summary</CardTitle>
          <CardDescription>Overall test execution status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Passed</span>
              <span className="text-sm text-green-500 font-medium">{passedTestCases}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Failed</span>
              <span className="text-sm text-red-500 font-medium">{failedTestCases}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pending</span>
              <span className="text-sm text-yellow-500 font-medium">{pendingTestCases}</span>
            </div>
            {totalTestCases > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Pass Rate</span>
                  <span className="text-sm font-medium">
                    {Math.round((passedTestCases / totalTestCases) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${(passedTestCases / totalTestCases) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Analytics</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Advanced charts, trends, and detailed analytics are coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
