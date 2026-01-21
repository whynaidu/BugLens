"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Role } from "@prisma/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Loader2,
  Mail,
  UserPlus,
  Clock,
  X,
  RefreshCw,
  Shield,
  ShieldCheck,
  Code,
  TestTube,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";

const inviteFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  role: z.nativeEnum(Role),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

interface InviteDialogProps {
  organizationId: string;
  children?: React.ReactNode;
}

const roleOptions = [
  {
    value: Role.ADMIN,
    label: "Admin",
    description: "Full access to all features and settings",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    value: Role.PROJECT_MANAGER,
    label: "Project Manager",
    description: "Manage projects, assign bugs, view reports",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: Role.DEVELOPER,
    label: "Developer",
    description: "View and update assigned bugs",
    icon: <Code className="h-4 w-4" />,
  },
  {
    value: Role.TESTER,
    label: "Tester",
    description: "Create bugs, upload screenshots, annotate",
    icon: <TestTube className="h-4 w-4" />,
  },
];

function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = new Date(expiresAt).getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} left`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} left`;
  }
  return "Expires soon";
}

export function InviteDialog({ organizationId, children }: InviteDialogProps) {
  const [open, setOpen] = useState(false);

  const utils = trpc.useUtils();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: Role.TESTER,
    },
  });

  const { data: pendingInvites, isLoading: loadingInvites } =
    trpc.members.getPendingInvites.useQuery(
      { organizationId },
      { enabled: open }
    );

  const invite = trpc.members.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      utils.members.getPendingInvites.invalidate({ organizationId });
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const cancelInvite = trpc.members.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      utils.members.getPendingInvites.invalidate({ organizationId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });

  const resendInvite = trpc.members.resendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent successfully!");
      utils.members.getPendingInvites.invalidate({ organizationId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  function onSubmit(data: InviteFormData) {
    invite.mutate({
      organizationId,
      email: data.email,
      role: data.role,
    });
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Invite people to join your organization. They will receive an email
            with instructions to accept.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="colleague@company.com"
                        className="pl-10"
                        disabled={invite.isPending}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => {
                const selectedRole = roleOptions.find((r) => r.value === field.value);
                return (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={invite.isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {selectedRole ? (
                            <div className="flex items-center gap-2">
                              {selectedRole.icon}
                              <span>{selectedRole.label}</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Select a role" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="py-3">
                            <div className="flex items-center gap-2">
                              {option.icon}
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the level of access this person will have.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {(pendingInvites && pendingInvites.length > 0) || loadingInvites ? (
          <>
            <Separator className="my-4" />
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Invitations
              </h4>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {loadingInvites ? (
                    <div className="text-sm text-muted-foreground">
                      Loading invitations...
                    </div>
                  ) : (
                    pendingInvites?.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {invitation.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {invitation.role.replace("_", " ")}
                            </Badge>
                            <span>
                              {formatTimeRemaining(invitation.expiresAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              resendInvite.mutate({
                                organizationId,
                                invitationId: invitation.id,
                              })
                            }
                            disabled={resendInvite.isPending}
                            title="Resend invitation"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${
                                resendInvite.isPending ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              cancelInvite.mutate({
                                organizationId,
                                invitationId: invitation.id,
                              })
                            }
                            disabled={cancelInvite.isPending}
                            title="Cancel invitation"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
