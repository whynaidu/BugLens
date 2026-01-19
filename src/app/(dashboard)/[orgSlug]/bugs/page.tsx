"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Bug, Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/bugs/status-badge";
import { SeverityBadge } from "@/components/bugs/severity-badge";
import { formatDistanceToNow } from "date-fns";

export default function OrgBugsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // Get all bugs for the user's organizations
  const { data, isLoading } = trpc.bugs.getByOrganization.useQuery({});

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const allBugs = data?.bugs || [];

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Bugs</h1>
          <p className="text-muted-foreground mt-2">
            View and manage bugs across all projects
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bugs..." className="pl-9" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {allBugs.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-full bg-primary/10 p-6">
                <Bug className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">No bugs yet</h2>
                <p className="text-muted-foreground max-w-sm">
                  Bugs will appear here when you create them from screenshots in your projects.
                </p>
              </div>
              <Link href={`/${orgSlug}/projects`}>
                <Button size="lg" className="mt-2">
                  Go to Projects
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allBugs.map((bug) => (
            <Link
              key={bug.id}
              href={`/${orgSlug}/projects/${bug.project.id}/bugs/${bug.id}`}
            >
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{bug.title}</CardTitle>
                      <CardDescription>
                        in {bug.project.name} • Created {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={bug.status} />
                      <SeverityBadge severity={bug.severity} />
                    </div>
                  </div>
                </CardHeader>
                {bug.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {bug.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
