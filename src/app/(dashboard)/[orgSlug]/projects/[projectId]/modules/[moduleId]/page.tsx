"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Edit, Trash2, FolderOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TestCaseList } from "@/components/testcases/testcase-list";
import { toast } from "sonner";

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const moduleId = params.moduleId as string;

  const utils = trpc.useUtils();

  const { data: module, isLoading } = trpc.modules.getById.useQuery({
    moduleId,
  });

  const deleteMutation = trpc.modules.delete.useMutation({
    onSuccess: () => {
      toast.success("Module deleted");
      router.push(`/${orgSlug}/projects/${projectId}/modules`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const backUrl = `/${orgSlug}/projects/${projectId}/modules`;

  if (isLoading) {
    return (
      <div className="container py-6">
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="container py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Module Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The module you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild className="mt-4">
            <Link href={backUrl}>Back to Modules</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href={backUrl}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Modules
        </Link>
      </div>

      {/* Module Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{module.name}</CardTitle>
              {module.description && (
                <p className="mt-1 text-muted-foreground">
                  {module.description}
                </p>
              )}
              {/* Breadcrumb */}
              {module.breadcrumb.length > 1 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {module.breadcrumb.map((b) => b.name).join(" / ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() =>
                  router.push(
                    `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/new`
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New Test Case
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Module</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this module? This will
                      also delete all sub-modules and test cases within it. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ moduleId })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{module._count.testCases} test cases</span>
            <span>{module._count.children} sub-modules</span>
          </div>
        </CardContent>
      </Card>

      {/* Sub-modules */}
      {module.children.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sub-modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {module.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/${orgSlug}/projects/${projectId}/modules/${child.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{child.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {child._count.testCases} tests
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Cases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <TestCaseList
            testCases={module.testCases}
            orgSlug={orgSlug}
            projectId={projectId}
            moduleId={moduleId}
            emptyMessage="No test cases in this module yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
