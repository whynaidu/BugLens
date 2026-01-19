"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";

/**
 * This page handles direct bug links without projectId in the URL.
 * It fetches the bug to get its projectId, then redirects to the full URL.
 */
export default function BugRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const bugId = params.bugId as string;

  // Fetch bug details to get projectId
  const { data: bug, isLoading, error } = trpc.bugs.getById.useQuery({ bugId });

  useEffect(() => {
    if (bug?.projectId) {
      // Redirect to the full URL with projectId
      router.replace(`/${orgSlug}/projects/${bug.projectId}/bugs/${bugId}`);
    }
  }, [bug, orgSlug, bugId, router]);

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

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading bug details...</p>
      </div>
    </div>
  );
}
