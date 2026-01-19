"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Edit2,
  ExternalLink,
  Image,
  Loader2,
  User,
  MessageSquare,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import type { BugStatus, BugSeverity, BugPriority } from "@/lib/validations/bug";
import { STATUS_TRANSITIONS, isValidStatusTransition } from "@/lib/validations/bug";
import { StatusBadge, getStatusLabel } from "./status-badge";
import { SeverityBadge } from "./severity-badge";
import { PriorityBadge } from "./priority-badge";
import { BugDialog } from "@/components/annotation/bug-dialog";
import { AuditTimeline } from "./audit-timeline";
import { CommentsList } from "./comments-list";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Annotation {
  id: string;
  screenshot: {
    id: string;
    fileName: string;
    flow: {
      id: string;
      name: string;
    };
  };
}

interface BugDetailData {
  id: string;
  title: string;
  description: string;
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
    };
  };
  annotations: Annotation[];
  _count: {
    annotations: number;
    comments: number;
  };
}

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface BugDetailProps {
  bug: BugDetailData;
  currentUserId: string;
  members?: Member[];
  onUpdate?: () => void;
}

export function BugDetail({ bug, currentUserId, members = [], onUpdate }: BugDetailProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const orgSlug = bug.project.organization.slug;
  const projectId = bug.project.id;

  // Get valid status transitions
  const validTransitions = STATUS_TRANSITIONS[bug.status] || [];

  // Update status mutation
  const updateStatusMutation = trpc.bugs.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Status updated" });
      utils.bugs.getById.invalidate({ bugId: bug.id });
      onUpdate?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: BugStatus) => {
    if (!isValidStatusTransition(bug.status, newStatus)) {
      toast({
        title: "Invalid status transition",
        description: `Cannot transition from ${getStatusLabel(bug.status)} to ${getStatusLabel(newStatus)}`,
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({ bugId: bug.id, status: newStatus });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{bug.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Created {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}</span>
            <span>•</span>
            <span>Updated {formatDistanceToNow(new Date(bug.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Status & Badges */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={bug.status} />
        <SeverityBadge severity={bug.severity} />
        <PriorityBadge priority={bug.priority} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            Comments
            {bug._count.comments > 0 && (
              <span className="ml-1 text-xs bg-muted rounded-full px-1.5">
                {bug._count.comments}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6 mt-6">
          {/* Status Workflow */}
          {validTransitions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Change Status</CardTitle>
                <CardDescription>
                  Available status transitions from {getStatusLabel(bug.status)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {validTransitions.map((newStatus) => (
                    <Button
                      key={newStatus}
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(newStatus as BugStatus)}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      {getStatusLabel(newStatus as BugStatus)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {bug.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{bug.description}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided</p>
              )}
            </CardContent>
          </Card>

          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Creator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Reporter</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={bug.creator.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {bug.creator.name?.charAt(0) ?? bug.creator.email?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{bug.creator.name ?? bug.creator.email}</span>
                </div>
              </div>

              <Separator />

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Assignee</span>
                </div>
                {bug.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={bug.assignee.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {bug.assignee.name?.charAt(0) ?? bug.assignee.email?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{bug.assignee.name ?? bug.assignee.email}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Created</span>
                </div>
                <span className="text-sm">
                  {format(new Date(bug.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Updated</span>
                </div>
                <span className="text-sm">
                  {format(new Date(bug.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Linked Annotations */}
          {bug.annotations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Linked Screenshots ({bug.annotations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bug.annotations.map((annotation) => (
                  <Link
                    key={annotation.id}
                    href={`/${orgSlug}/projects/${projectId}/flows/${annotation.screenshot.flow.id}/screenshots/${annotation.screenshot.id}`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{annotation.screenshot.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {annotation.screenshot.flow.name}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
              </CardTitle>
              <CardDescription>
                Discuss this bug with your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommentsList
                bugId={bug.id}
                currentUserId={currentUserId}
                members={members}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
              <CardDescription>
                Complete history of changes to this bug
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline bugId={bug.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <BugDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        projectId={projectId}
        existingBug={{
          id: bug.id,
          title: bug.title,
          description: bug.description,
          severity: bug.severity,
          priority: bug.priority,
          assigneeId: bug.assignee?.id ?? null,
        }}
        onSuccess={() => {
          utils.bugs.getById.invalidate({ bugId: bug.id });
          onUpdate?.();
        }}
      />
    </div>
  );
}
