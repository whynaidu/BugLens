"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  Loader2,
  Link2,
  Copy,
  Trash2,
  Plus,
  Clock,
  Users,
  Infinity,
} from "lucide-react";
import { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";

interface InviteLinksPanelProps {
  organizationId: string;
}

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

export function InviteLinksPanel({ organizationId }: InviteLinksPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [newLinkRole, setNewLinkRole] = useState<Role>(Role.TESTER);
  const [newLinkMaxUses, setNewLinkMaxUses] = useState<string>("");
  const [newLinkExpiry, setNewLinkExpiry] = useState<string>("7");

  const utils = trpc.useUtils();

  const { data: inviteLinks, isLoading } = trpc.members.getInviteLinks.useQuery({
    organizationId,
  });

  const createLink = trpc.members.createInviteLink.useMutation({
    onSuccess: (invitation) => {
      toast.success("Invite link created!");
      utils.members.getInviteLinks.invalidate({ organizationId });
      setCreateDialogOpen(false);
      setNewLinkRole(Role.TESTER);
      setNewLinkMaxUses("");
      setNewLinkExpiry("7");
      // Copy to clipboard
      const url = `${window.location.origin}/invite/${invitation.inviteCode}`;
      navigator.clipboard.writeText(url);
      toast.info("Link copied to clipboard!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create invite link");
    },
  });

  const revokeLink = trpc.members.revokeInviteLink.useMutation({
    onSuccess: () => {
      toast.success("Invite link revoked");
      utils.members.getInviteLinks.invalidate({ organizationId });
      setDeleteDialogId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke invite link");
    },
  });

  function handleCreateLink() {
    createLink.mutate({
      organizationId,
      role: newLinkRole,
      maxUses: newLinkMaxUses ? parseInt(newLinkMaxUses, 10) : undefined,
      expiresInDays: parseInt(newLinkExpiry, 10),
    });
  }

  function handleCopyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Invite Links
          </CardTitle>
          <CardDescription>
            Create shareable invite links for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
              <Skeleton className="h-4 w-32" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const links = inviteLinks || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Invite Links
            </CardTitle>
            <CardDescription>
              Create shareable invite links for your organization.
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Invite Link</DialogTitle>
                <DialogDescription>
                  Create a shareable link that anyone can use to join your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Role for new members</Label>
                  <Select
                    value={newLinkRole}
                    onValueChange={(value) => setNewLinkRole(value as Role)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Maximum uses (optional)</Label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={newLinkMaxUses}
                    onChange={(e) => setNewLinkMaxUses(e.target.value)}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for unlimited uses.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Expires in</Label>
                  <Select
                    value={newLinkExpiry}
                    onValueChange={setNewLinkExpiry}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={createLink.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateLink}
                  disabled={createLink.isPending}
                >
                  {createLink.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No active invite links</p>
              <p className="text-sm">Create a link to invite people to your organization</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        /invite/{link.inviteCode}
                      </code>
                      <Badge variant="outline" className="capitalize">
                        {link.role.toLowerCase().replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {link.maxUses ? (
                          `${link.usedCount}/${link.maxUses} uses`
                        ) : (
                          <>
                            {link.usedCount} uses <Infinity className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {format(new Date(link.expiresAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(link.inviteCode!)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialogId(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteDialogId}
        onOpenChange={(open) => !open && setDeleteDialogId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invite Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invite link? Anyone who tries to use it will no longer be able to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeLink.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteDialogId &&
                revokeLink.mutate({
                  organizationId,
                  invitationId: deleteDialogId,
                })
              }
              disabled={revokeLink.isPending}
            >
              {revokeLink.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Revoke Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
