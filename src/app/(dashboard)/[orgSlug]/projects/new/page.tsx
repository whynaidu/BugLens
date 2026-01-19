"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectForm, type ProjectFormData } from "@/components/projects/project-form";
import { trpc } from "@/lib/trpc";

export default function NewProjectPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  // Get organization ID from slug
  const { data: org, isLoading: isLoadingOrg } = trpc.organizations.getBySlug.useQuery({
    slug: orgSlug,
  });

  const utils = trpc.useUtils();

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      toast.success("Project created successfully");
      utils.projects.getByOrganization.invalidate();
      router.push(`/${orgSlug}/projects/${project.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    },
  });

  const handleSubmit = (data: ProjectFormData) => {
    if (!org?.id) return;
    createProjectMutation.mutate({
      organizationId: org.id,
      name: data.name,
      description: data.description,
      color: data.color,
    });
  };

  if (isLoadingOrg) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <Link
          href={`/${orgSlug}/projects`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create Project</h1>
        <p className="text-muted-foreground mt-2">
          Create a new project to organize your bugs and test flows
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Enter the details for your new project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            onSubmit={handleSubmit}
            isLoading={createProjectMutation.isPending}
            submitLabel="Create Project"
          />
        </CardContent>
      </Card>
    </div>
  );
}
