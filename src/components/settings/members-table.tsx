"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { toast } from "sonner";
import { MoreHorizontal, Shield, ShieldCheck, Code, TestTube } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

interface Member {
  id: string;
  role: Role;
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface MembersTableProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: Role;
}

const roleConfig: Record<Role, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ADMIN: {
    label: "Admin",
    icon: <ShieldCheck className="h-3 w-3" />,
    variant: "default",
  },
  PROJECT_MANAGER: {
    label: "Project Manager",
    icon: <Shield className="h-3 w-3" />,
    variant: "secondary",
  },
  DEVELOPER: {
    label: "Developer",
    icon: <Code className="h-3 w-3" />,
    variant: "outline",
  },
  TESTER: {
    label: "Tester",
    icon: <TestTube className="h-3 w-3" />,
    variant: "outline",
  },
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function MembersTable({
  organizationId,
  currentUserId,
  currentUserRole,
}: MembersTableProps) {
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const utils = trpc.useUtils();

  const { data: members, isLoading } = trpc.members.getByOrganization.useQuery({
    organizationId,
  });

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
      utils.members.getByOrganization.invalidate({ organizationId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const removeMember = trpc.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Member removed successfully");
      utils.members.getByOrganization.invalidate({ organizationId });
      setMemberToRemove(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const canManageMembers = currentUserRole === Role.ADMIN;

  const handleRoleChange = (memberId: string, newRole: Role) => {
    updateRole.mutate({
      organizationId,
      memberId,
      role: newRole,
    });
  };

  const handleRemoveMember = () => {
    if (memberToRemove) {
      removeMember.mutate({
        organizationId,
        memberId: memberToRemove.id,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No members found
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManageMembers && <TableHead className="w-[70px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;
            const config = roleConfig[member.role];

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={member.user.avatarUrl || undefined}
                        alt={member.user.name || member.user.email}
                      />
                      <AvatarFallback>
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {member.user.name || "Unnamed User"}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {canManageMembers && !isCurrentUser ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value as Role)
                      }
                      disabled={updateRole.isPending}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleConfig).map(([role, config]) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex items-center gap-2">
                              {config.icon}
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={config.variant} className="gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </TableCell>
                {canManageMembers && (
                  <TableCell>
                    {!isCurrentUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setMemberToRemove(member)}
                          >
                            Remove from organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">
                {memberToRemove?.user.name || memberToRemove?.user.email}
              </span>{" "}
              from this organization? They will lose access to all projects and
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={removeMember.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMember.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
