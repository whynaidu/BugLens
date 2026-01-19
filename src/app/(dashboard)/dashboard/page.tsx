"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const router = useRouter();
  const { data: organizations, isLoading } = trpc.organizations.getUserOrganizations.useQuery();

  useEffect(() => {
    if (!isLoading && organizations) {
      if (organizations.length > 0) {
        // Redirect to the first organization
        router.replace(`/${organizations[0].slug}`);
      } else {
        // No organizations, go to selection page
        router.replace("/select-organization");
      }
    }
  }, [organizations, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
