"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Building2, Plus, Users, FolderKanban, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateOrgDialog } from "@/components/organizations/create-org-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import { trpc } from "@/lib/trpc";

export default function SelectOrganizationPage() {
  const { data: session } = useSession();
  const { data: organizations, isLoading } =
    trpc.organizations.getUserOrganizations.useQuery();

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-10">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const hasOrganizations = organizations && organizations.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar with user menu */}
      <div className="flex justify-end p-4">
        {session?.user && (
          <UserMenu user={session.user as { id: string; name?: string | null; email?: string | null; image?: string | null }} />
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Select Organization
              </h1>
              <p className="text-muted-foreground">
                Choose an organization to continue, or create a new one.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/onboarding">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Join Another
                </Link>
              </Button>
              <CreateOrgDialog>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Organization
                </Button>
              </CreateOrgDialog>
            </div>
          </div>

        {hasOrganizations ? (
          <div className="grid gap-4">
            {organizations.map((org) => (
              <Link key={org.id} href={`/${org.slug}`}>
                <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={org.logoUrl || undefined} alt={org.name} />
                      <AvatarFallback>
                        <Building2 className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                      <CardDescription>/{org.slug}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {org.role.toLowerCase().replace("_", " ")}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{org._count.members} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FolderKanban className="h-4 w-4" />
                        <span>{org._count.projects} projects</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-6">
                <div className="rounded-full bg-primary/10 p-6">
                  <Building2 className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">No organizations yet</h2>
                  <p className="text-muted-foreground max-w-sm">
                    Create your first organization to start tracking bugs and collaborating with your team.
                  </p>
                </div>
                <CreateOrgDialog>
                  <Button size="lg" className="mt-2">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Organization
                  </Button>
                </CreateOrgDialog>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
