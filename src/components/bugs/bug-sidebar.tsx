"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  ExternalLink,
  FolderOpen,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import type { BugStatus, BugSeverity, BugPriority } from "@/lib/validations/bug";
import { StatusBadge } from "./status-badge";
import { SeverityBadge } from "./severity-badge";
import { PriorityBadge } from "./priority-badge";
import { ExternalSync } from "./external-sync";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface RelatedBug {
  id: string;
  title: string;
  status: BugStatus;
  severity: BugSeverity;
  priority: BugPriority;
  createdAt: Date;
  creator: User;
}

interface ExternalIds {
  jira?: string;
  trello?: string;
  azureDevOps?: string | number;
}

interface BugSidebarData {
  id: string;
  status: BugStatus;
  severity: BugSeverity;
  priority: BugPriority;
  createdAt: Date;
  updatedAt: Date;
  creator: User;
  assignee: User | null;
  project: {
    id: string;
    name: string;
    organization: {
      id: string;
      slug: string;
      name: string;
    };
  };
  _count: {
    annotations: number;
    comments: number;
  };
  externalIds?: ExternalIds | null;
}

interface BugSidebarProps {
  bug: BugSidebarData;
  relatedBugs?: RelatedBug[];
  isLoadingRelated?: boolean;
  onDelete?: () => void;
}

export function BugSidebar({
  bug,
  relatedBugs = [],
  isLoadingRelated = false,
  onDelete,
}: BugSidebarProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const orgSlug = bug.project.organization.slug;
  const projectId = bug.project.id;

  // Delete mutation
  const deleteMutation = trpc.bugs.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Bug deleted" });
      onDelete?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete bug",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyId = () => {
    navigator.clipboard.writeText(bug.id);
    toast({ title: "Bug ID copied to clipboard" });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/${orgSlug}/projects/${projectId}/bugs/${bug.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ bugId: bug.id });
    setDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyId}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Bug ID
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Bug
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={`/${orgSlug}/projects/${projectId}`}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Project
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={bug.status} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Severity</span>
            <SeverityBadge severity={bug.severity} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Priority</span>
            <PriorityBadge priority={bug.priority} />
          </div>
        </CardContent>
      </Card>

      {/* Project Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/${orgSlug}/projects/${projectId}`}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{bug.project.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {bug.project.organization.name}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        </CardContent>
      </Card>

      {/* Assignee */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Assignee</CardTitle>
        </CardHeader>
        <CardContent>
          {bug.assignee ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={bug.assignee.image ?? undefined} />
                <AvatarFallback>
                  {bug.assignee.name?.charAt(0) ?? bug.assignee.email?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {bug.assignee.name ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {bug.assignee.email}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="h-8 w-8 p-1.5 border rounded-full" />
              <span className="text-sm">Unassigned</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Annotations</span>
            <span className="text-sm font-medium">{bug._count.annotations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Comments</span>
            <span className="text-sm font-medium">{bug._count.comments}</span>
          </div>
        </CardContent>
      </Card>

      {/* External Integrations */}
      <ExternalSync
        bugId={bug.id}
        organizationId={bug.project.organization.id}
        externalIds={bug.externalIds}
      />

      {/* Related Bugs */}
      {(relatedBugs.length > 0 || isLoadingRelated) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Related Bugs</CardTitle>
            <CardDescription className="text-xs">
              Bugs linked to the same annotation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingRelated ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              relatedBugs.map((relatedBug) => (
                <Link
                  key={relatedBug.id}
                  href={`/${orgSlug}/projects/${projectId}/bugs/${relatedBug.id}`}
                  className="block p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1">
                      {relatedBug.title}
                    </p>
                    <StatusBadge status={relatedBug.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(relatedBug.createdAt), { addSuffix: true })}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bug</AlertDialogTitle>
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
