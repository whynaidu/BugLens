"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

const formSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z
    .string()
    .max(10000, "Description must be 10000 characters or less"),
  stepsToReproduce: z.string().max(20000).optional(),
  expectedResult: z.string().max(5000).optional(),
  actualResult: z.string().max(5000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  url: z.string().url().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTestCasePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const moduleId = params.moduleId as string;

  const { data: module, isLoading: isLoadingModule } =
    trpc.modules.getById.useQuery({ moduleId });

  const createTestCaseMutation = trpc.testcases.create.useMutation({
    onSuccess: (testCase) => {
      toast.success("Test case created");
      router.push(
        `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testCase.id}`
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      stepsToReproduce: "",
      expectedResult: "",
      actualResult: "",
      severity: "MEDIUM",
      priority: "MEDIUM",
      url: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createTestCaseMutation.mutate({
      moduleId,
      title: values.title,
      description: values.description,
      stepsToReproduce: values.stepsToReproduce || null,
      expectedResult: values.expectedResult || null,
      actualResult: values.actualResult || null,
      severity: values.severity,
      priority: values.priority,
      url: values.url || null,
    });
  };

  const backUrl = `/${orgSlug}/projects/${projectId}/modules`;

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
        <h1 className="text-2xl font-bold">New Test Case</h1>
        {isLoadingModule ? (
          <Skeleton className="mt-1 h-5 w-48" />
        ) : module ? (
          <p className="text-muted-foreground">
            Creating in module:{" "}
            <span className="font-medium">{module.name}</span>
            {module.breadcrumb.length > 1 && (
              <span className="text-xs">
                {" "}
                ({module.breadcrumb.map((b) => b.name).join(" / ")})
              </span>
            )}
          </p>
        ) : null}
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Test Case Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter test case title" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique Reference ID will be auto-generated
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
                        placeholder="Describe the test case..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="stepsToReproduce"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steps to Reproduce</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="1. Step one&#10;2. Step two&#10;3. Step three"
                        className="min-h-[120px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the steps needed to reproduce or test this case
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expectedResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Result</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What should happen..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actualResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Result</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What actually happened..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/page"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The URL where this test case applies
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href={backUrl}>Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={createTestCaseMutation.isPending}
                >
                  {createTestCaseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Test Case
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
