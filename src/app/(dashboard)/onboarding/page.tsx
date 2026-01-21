"use client";

import { useSession } from "next-auth/react";
import { Building2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/layout/user-menu";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";
import { JoinOrgForm } from "@/components/onboarding/join-org-form";

export default function OnboardingPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex justify-end p-4">
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96 mb-8" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar with user menu */}
      <div className="flex justify-end p-4">
        {session?.user && (
          <UserMenu
            user={
              session.user as {
                id: string;
                name?: string | null;
                email?: string | null;
                image?: string | null;
              }
            }
          />
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-4 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to BugLens
            </h1>
            <p className="text-muted-foreground mt-2">
              Create a new organization or join an existing one to get started.
            </p>
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="create">Create Organization</TabsTrigger>
              <TabsTrigger value="join">Join Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <CreateOrgForm />
            </TabsContent>

            <TabsContent value="join">
              <JoinOrgForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
