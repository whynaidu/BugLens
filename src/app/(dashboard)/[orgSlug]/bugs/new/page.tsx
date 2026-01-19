"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Bug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

const createBugFormSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(10000, "Description must be 10000 characters or less").optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});

type CreateBugFormValues = z.infer<typeof createBugFormSchema>;

export default function NewBugPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get organization ID from slug
  const { data: org } = trpc.organizations.getBySlug.useQuery({ slug: orgSlug });

  // Get projects for the organization
  const { data: projects, isLoading: isLoadingProjects } = trpc.projects.getByOrganization.useQuery(
    { organizationId: org?.id ?? "" },
    { enabled: !!org?.id }
  );

  const createBugMutation = trpc.bugs.create.useMutation({
    onSuccess: (bug) => {
      toast.success("Bug created successfully");
      router.push(`/${orgSlug}/projects/${bug.projectId}/bugs/${bug.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create bug");
      setIsSubmitting(false);
    },
  });

  const form = useForm<CreateBugFormValues>({
    resolver: zodResolver(createBugFormSchema),
    defaultValues: {
      projectId: "",
      title: "",
      description: "",
      severity: "MEDIUM" as const,
      priority: "MEDIUM" as const,
    },
  });

  const onSubmit = async (data: CreateBugFormValues) => {
    setIsSubmitting(true);
    createBugMutation.mutate({
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      severity: data.severity,
      priority: data.priority,
    });
  };

  if (isLoadingProjects) {
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
          href={`/${orgSlug}/bugs`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bugs
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Report a Bug</h1>
        <p className="text-muted-foreground mt-2">
          Create a new bug report for tracking
        </p>
      </div>

      {projects && projects.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-full bg-primary/10 p-6">
                <Bug className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">No projects yet</h2>
                <p className="text-muted-foreground max-w-sm">
                  You need to create a project first before you can report bugs.
                </p>
              </div>
              <Link href={`/${orgSlug}/projects/new`}>
                <Button size="lg" className="mt-2">
                  Create Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bug Details</CardTitle>
            <CardDescription>
              Provide information about the bug you encountered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the project where this bug was found
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the bug" {...field} />
                      </FormControl>
                      <FormDescription>
                        A clear, concise title for the bug
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed description of the bug, steps to reproduce, expected vs actual behavior..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide as much detail as possible to help developers understand and fix the bug
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="CRITICAL">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How severe is this bug?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="URGENT">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How urgently should this be fixed?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/${orgSlug}/bugs`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Bug
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
