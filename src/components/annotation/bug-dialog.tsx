"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Bug, AlertTriangle, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { type BugSeverity, type BugPriority } from "@/lib/validations/bug";
import { SeverityBadge, ALL_SEVERITIES } from "@/components/bugs/severity-badge";
import { PriorityBadge, ALL_PRIORITIES } from "@/components/bugs/priority-badge";

// Form schema for creating/editing bugs
const bugFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(10000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  assigneeId: z.string().nullable(),
});

type BugFormValues = z.infer<typeof bugFormSchema>;

interface BugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  annotationId?: string;
  existingBug?: {
    id: string;
    title: string;
    description: string;
    severity: BugSeverity;
    priority: BugPriority;
    assigneeId: string | null;
  };
  onSuccess?: () => void;
}

export function BugDialog({
  open,
  onOpenChange,
  projectId,
  annotationId,
  existingBug,
  onSuccess,
}: BugDialogProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [isDeleting, setIsDeleting] = useState(false);

  // Get project members for assignee dropdown
  const { data: members } = trpc.bugs.getProjectMembers.useQuery(
    { projectId },
    { enabled: open && !!projectId }
  );

  // Create mutation
  const createMutation = trpc.bugs.create.useMutation({
    onSuccess: () => {
      toast({ title: "Bug created successfully" });
      utils.bugs.getByProject.invalidate({ projectId });
      if (annotationId) {
        utils.annotations.getByScreenshot.invalidate();
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to create bug",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = trpc.bugs.update.useMutation({
    onSuccess: () => {
      toast({ title: "Bug updated successfully" });
      utils.bugs.getByProject.invalidate({ projectId });
      utils.bugs.getById.invalidate({ bugId: existingBug?.id });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to update bug",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = trpc.bugs.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Bug deleted successfully" });
      utils.bugs.getByProject.invalidate({ projectId });
      if (annotationId) {
        utils.annotations.getByScreenshot.invalidate();
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete bug",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<BugFormValues>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      title: existingBug?.title ?? "",
      description: existingBug?.description ?? "",
      severity: existingBug?.severity ?? "MEDIUM",
      priority: existingBug?.priority ?? "MEDIUM",
      assigneeId: existingBug?.assigneeId ?? null,
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: BugFormValues) => {
    if (existingBug) {
      updateMutation.mutate({
        bugId: existingBug.id,
        ...values,
      });
    } else {
      createMutation.mutate({
        projectId,
        annotationId,
        ...values,
      });
    }
  };

  const handleDelete = () => {
    if (existingBug) {
      setIsDeleting(true);
      deleteMutation.mutate({ bugId: existingBug.id });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            {existingBug ? "Edit Bug" : "Create Bug"}
          </DialogTitle>
          <DialogDescription>
            {existingBug
              ? "Update the bug details below."
              : "Create a new bug report for this annotation."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief description of the issue"
                      {...field}
                    />
                  </FormControl>
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
                      placeholder="Detailed description of the bug (supports markdown)"
                      className="min-h-[100px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                          <SelectValue placeholder="Select severity">
                            {field.value && (
                              <SeverityBadge severity={field.value} />
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ALL_SEVERITIES.map((severity) => (
                          <SelectItem key={severity} value={severity}>
                            <SeverityBadge severity={severity} />
                          </SelectItem>
                        ))}
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
                          <SelectValue placeholder="Select priority">
                            {field.value && (
                              <PriorityBadge priority={field.value} />
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ALL_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            <PriorityBadge priority={priority} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "unassigned" ? null : value)}
                    value={field.value ?? "unassigned"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <span className="text-muted-foreground">Unassigned</span>
                      </SelectItem>
                      {members?.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {member.name?.charAt(0) ?? member.email?.charAt(0) ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name ?? member.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {existingBug && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mr-auto"
                      disabled={isLoading || isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete Bug
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this bug? This action cannot be undone.
                        All comments and activity history will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {existingBug ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
