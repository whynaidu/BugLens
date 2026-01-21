"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Users,
  Bell,
  Plug,
  Building2,
  ChevronRight,
  Loader2,
  Trash2,
  Calendar,
  Hash,
  FolderKanban,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { trpc } from "@/lib/trpc";

const settingsItems = [
  {
    title: "Members",
    description: "Manage team members and invitations",
    href: "members",
    icon: Users,
  },
  {
    title: "Notifications",
    description: "Configure notification preferences",
    href: "notifications",
    icon: Bell,
  },
  {
    title: "Integrations",
    description: "Connect external tools like Jira, Slack, and more",
    href: "integrations",
    icon: Plug,
  },
];

const updateOrgFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type UpdateOrgFormValues = z.infer<typeof updateOrgFormSchema>;

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [isDeleting, setIsDeleting] = useState(false);

  const utils = trpc.useUtils();

  // Get organization data
  const { data: org, isLoading } = trpc.organizations.getBySlug.useQuery({ slug: orgSlug });

  const form = useForm<UpdateOrgFormValues>({
    resolver: zodResolver(updateOrgFormSchema),
    defaultValues: {
      name: "",
      logoUrl: "",
    },
    values: org ? {
      name: org.name,
      logoUrl: org.logoUrl || "",
    } : undefined,
  });

  const updateOrg = trpc.organizations.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated successfully");
      utils.organizations.getBySlug.invalidate({ slug: orgSlug });
      utils.organizations.getUserOrganizations.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update organization", {
        description: error.message,
      });
    },
  });

  const deleteOrg = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error("Failed to delete organization", {
        description: error.message,
      });
      setIsDeleting(false);
    },
  });

  const onSubmit = (values: UpdateOrgFormValues) => {
    if (!org) return;
    updateOrg.mutate({
      organizationId: org.id,
      name: values.name,
      logoUrl: values.logoUrl || null,
    });
  };

  const handleDelete = () => {
    if (!org) return;
    setIsDeleting(true);
    deleteOrg.mutate({ organizationId: org.id });
  };

  const isAdmin = org?.membership?.role === "ADMIN";

  if (isLoading) {
    return (
      <div className="container max-w-4xl px-4 py-4 sm:py-8">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-72 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl px-4 py-4 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="grid gap-4">
        {settingsItems.map((item) => (
          <Link key={item.href} href={`/${orgSlug}/settings/${item.href}`}>
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Organization Details */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Organization Details</CardTitle>
              <CardDescription>
                View and update your organization information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-sm">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Slug</p>
                <p className="font-medium">{org?.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">
                  {org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Members</p>
                <p className="font-medium">{org?._count?.members || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Projects</p>
                <p className="font-medium">{org?._count?.projects || 0}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Edit Form */}
          {isAdmin ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Organization" {...field} />
                      </FormControl>
                      <FormDescription>
                        This is your organization&apos;s display name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/logo.png" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL to your organization&apos;s logo image.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateOrg.isPending}>
                  {updateOrg.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Organization Name</Label>
                <p className="font-medium">{org?.name}</p>
              </div>
              {org?.logoUrl && (
                <div>
                  <Label className="text-muted-foreground">Logo URL</Label>
                  <p className="font-medium truncate">{org.logoUrl}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Only administrators can edit organization details.
              </p>
            </div>
          )}
        </CardContent>

        {/* Danger Zone */}
        {isAdmin && (
          <CardFooter className="border-t pt-6">
            <div className="w-full">
              <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting your organization will permanently remove all projects, bugs, and data.
                This action cannot be undone.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete Organization
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete <strong>{org?.name}</strong> and all of its data including:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{org?._count?.projects || 0} projects</li>
                        <li>All bugs and comments</li>
                        <li>All screenshots and annotations</li>
                        <li>All member associations</li>
                      </ul>
                      <p className="mt-2 font-medium">This action cannot be undone.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Organization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
