"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { z } from "zod";
import { useDebouncedCallback } from "use-debounce";

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
import { trpc } from "@/lib/trpc";
import { generateSlug } from "@/lib/validations/organization";

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  slug: z
    .string()
    .min(1, "URL is required")
    .max(50, "URL must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "URL can only contain lowercase letters, numbers, and hyphens"
    ),
});

type FormData = z.infer<typeof formSchema>;

export function CreateOrgForm() {
  const router = useRouter();
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const utils = trpc.useUtils();

  const checkSlug = trpc.organizations.checkSlugAvailability.useQuery(
    { slug: form.watch("slug") },
    {
      enabled: false,
    }
  );

  const createOrg = trpc.organizations.create.useMutation({
    onSuccess: (org) => {
      toast.success("Organization created successfully!");
      utils.organizations.getUserOrganizations.invalidate();
      router.push(`/${org.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const debouncedCheckSlug = useDebouncedCallback(
    useCallback(async (slug: string) => {
      if (!slug || slug.length < 2) {
        setSlugStatus("idle");
        return;
      }

      // Validate format first
      const isValidFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
      if (!isValidFormat) {
        setSlugStatus("idle");
        return;
      }

      setSlugStatus("checking");
      try {
        const result = await utils.organizations.checkSlugAvailability.fetch({ slug });
        setSlugStatus(result.available ? "available" : "taken");
        if (!result.available) {
          form.setError("slug", { message: "This URL is already taken" });
        } else {
          form.clearErrors("slug");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, [utils, form]),
    500
  );

  const name = form.watch("name");
  const slug = form.watch("slug");

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !form.getFieldState("slug").isDirty) {
      const generatedSlug = generateSlug(name);
      form.setValue("slug", generatedSlug);
    }
  }, [name, form]);

  // Check slug availability when slug changes
  useEffect(() => {
    debouncedCheckSlug(slug);
  }, [slug, debouncedCheckSlug]);

  function onSubmit(data: FormData) {
    if (slugStatus === "taken") {
      toast.error("Please choose a different URL");
      return;
    }
    createOrg.mutate({
      name: data.name,
      slug: data.slug,
    });
  }

  const getSlugIcon = () => {
    switch (slugStatus) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case "available":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "taken":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Create Organization
        </CardTitle>
        <CardDescription>
          Set up a new organization for your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Acme Inc."
                      disabled={createOrg.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is the display name for your organization.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization URL</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center flex-1 border rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <Input
                          placeholder="acme-inc"
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          disabled={createOrg.isPending}
                          {...field}
                          onChange={(e) => {
                            // Convert to lowercase and remove invalid chars
                            const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                            field.onChange(value);
                          }}
                        />
                        <span className="px-3 text-sm text-muted-foreground whitespace-nowrap">
                          .buglens.app
                        </span>
                        <div className="pr-3">
                          {getSlugIcon()}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {slugStatus === "available" && (
                      <span className="text-green-600">This URL is available!</span>
                    )}
                    {slugStatus === "taken" && (
                      <span className="text-destructive">This URL is already taken. Please choose another.</span>
                    )}
                    {slugStatus === "idle" && "This will be your organization's unique URL."}
                    {slugStatus === "checking" && "Checking availability..."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createOrg.isPending || slugStatus === "taken" || slugStatus === "checking"}
            >
              {createOrg.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Organization
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
