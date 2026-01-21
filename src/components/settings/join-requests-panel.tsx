"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2,
  UserPlus,
  Check,
  X,
  Users,
  Mail,
  Clock,
  MessageSquare,
} from "lucide-react";
import { Role, JoinRequestStatus } from "@prisma/client";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

interface JoinRequestsPanelProps {
  organizationId: string;
}

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

export function JoinRequestsPanel({ organizationId }: JoinRequestsPanelProps) {
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    requestId: string;
    userName: string;
    action: "approve" | "reject";
  }>({ open: false, requestId: "", userName: "", action: "approve" });
  const [selectedRole, setSelectedRole] = useState<Role>(Role.TESTER);

  const utils = trpc.useUtils();

  const { data: requests, isLoading } = trpc.joinRequests.getForOrganization.useQuery({
    organizationId,
  });

  const reviewRequest = trpc.joinRequests.review.useMutation({
    onSuccess: (_, variables) => {
      const action = variables.status === JoinRequestStatus.APPROVED ? "approved" : "rejected";
      toast.success(`Request ${action} successfully`);
      utils.joinRequests.getForOrganization.invalidate({ organizationId });
      if (variables.status === JoinRequestStatus.APPROVED) {
        utils.members.getByOrganization.invalidate({ organizationId });
      }
      setReviewDialog({ open: false, requestId: "", userName: "", action: "approve" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to review request");
    },
  });

  function handleReviewClick(
    requestId: string,
    userName: string,
    action: "approve" | "reject"
  ) {
    setReviewDialog({ open: true, requestId, userName, action });
    if (action === "approve") {
      setSelectedRole(Role.TESTER);
    }
  }

  function handleConfirmReview() {
    reviewRequest.mutate({
      requestId: reviewDialog.requestId,
      organizationId,
      status:
        reviewDialog.action === "approve"
          ? JoinRequestStatus.APPROVED
          : JoinRequestStatus.REJECTED,
      role: reviewDialog.action === "approve" ? selectedRole : undefined,
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Requests
          </CardTitle>
          <CardDescription>
            Review pending requests to join your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Review pending requests to join your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No pending join requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={request.user.avatarUrl || undefined}
                        alt={request.user.name || "User"}
                      />
                      <AvatarFallback>
                        {request.user.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {request.user.name || "Unknown User"}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        {request.user.email}
                      </p>
                      {request.message && (
                        <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{request.message}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(request.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleReviewClick(
                          request.id,
                          request.user.name || "this user",
                          "reject"
                        )
                      }
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleReviewClick(
                          request.id,
                          request.user.name || "this user",
                          "approve"
                        )
                      }
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) =>
          setReviewDialog({ ...reviewDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" ? "Approve" : "Reject"} Request
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "approve"
                ? `Select a role for ${reviewDialog.userName} and confirm approval.`
                : `Are you sure you want to reject ${reviewDialog.userName}'s request?`}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.action === "approve" && (
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Assign Role
              </label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as Role)}
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
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setReviewDialog({ ...reviewDialog, open: false })
              }
              disabled={reviewRequest.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === "reject" ? "destructive" : "default"}
              onClick={handleConfirmReview}
              disabled={reviewRequest.isPending}
            >
              {reviewRequest.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {reviewDialog.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
