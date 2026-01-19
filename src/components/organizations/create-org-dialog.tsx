"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// Local form schema with simpler types
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  slug: z.string().optional(),
  logoUrl: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateOrgDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateOrgDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: CreateOrgDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slugPreview, setSlugPreview] = useState("");

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;
  const setIsOpen = isControlled ? onOpenChange! : setOpen;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      logoUrl: "",
    },
  });

  const utils = trpc.useUtils();
  const createOrg = trpc.organizations.create.useMutation({
    onSuccess: (org) => {
      toast.success("Organization created successfully!");
      utils.organizations.getUserOrganizations.invalidate();
      setIsOpen(false);
      form.reset();
      router.push(`/${org.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const name = form.watch("name");

  // Update slug preview when name changes
  useEffect(() => {
    if (name) {
      setSlugPreview(generateSlug(name));
    } else {
      setSlugPreview("");
    }
  }, [name]);

  function onSubmit(data: FormData) {
    createOrg.mutate({
      name: data.name,
      slug: data.slug || undefined,
      logoUrl: data.logoUrl || undefined,
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Organization
          </DialogTitle>
          <DialogDescription>
            Create a new organization to start collaborating with your team.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormLabel>URL Slug</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground mr-1">
                        buglens.com/
                      </span>
                      <Input
                        placeholder={slugPreview || "acme-inc"}
                        disabled={createOrg.isPending}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Leave blank to auto-generate from the name.
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
                  <FormLabel>Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/logo.png"
                      disabled={createOrg.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Direct link to your organization&apos;s logo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={createOrg.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createOrg.isPending}>
                {createOrg.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Organization
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
