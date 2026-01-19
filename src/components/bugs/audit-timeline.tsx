"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Edit,
  RefreshCw,
  UserPlus,
  UserMinus,
  MessageSquare,
  Paperclip,
  PenTool,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { AuditAction } from "@prisma/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface AuditTimelineProps {
  bugId: string;
  className?: string;
}

interface AuditDetails {
  from?: string;
  to?: string;
  field?: string;
  assigneeName?: string | null;
  previousAssigneeName?: string | null;
  commentId?: string;
  annotationId?: string;
  attachmentId?: string;
  fileName?: string;
  integrationType?: string;
  externalId?: string;
  title?: string;
  status?: string;
  severity?: string;
  priority?: string;
}

const ACTION_ICONS: Record<AuditAction, React.ReactNode> = {
  CREATED: <Plus className="h-4 w-4" />,
  UPDATED: <Edit className="h-4 w-4" />,
  STATUS_CHANGED: <RefreshCw className="h-4 w-4" />,
  ASSIGNED: <UserPlus className="h-4 w-4" />,
  UNASSIGNED: <UserMinus className="h-4 w-4" />,
  COMMENTED: <MessageSquare className="h-4 w-4" />,
  ATTACHMENT_ADDED: <Paperclip className="h-4 w-4" />,
  ANNOTATION_ADDED: <PenTool className="h-4 w-4" />,
  ANNOTATION_UPDATED: <Edit className="h-4 w-4" />,
  ANNOTATION_DELETED: <Trash2 className="h-4 w-4" />,
  SYNCED_TO_EXTERNAL: <ExternalLink className="h-4 w-4" />,
  EXTERNAL_SYNC: <RefreshCw className="h-4 w-4" />,
  EXTERNAL_UNLINKED: <ExternalLink className="h-4 w-4" />,
};

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  UPDATED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  STATUS_CHANGED: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  ASSIGNED: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  UNASSIGNED: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  COMMENTED: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  ATTACHMENT_ADDED: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  ANNOTATION_ADDED: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  ANNOTATION_UPDATED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  ANNOTATION_DELETED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  SYNCED_TO_EXTERNAL: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  EXTERNAL_SYNC: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXTERNAL_UNLINKED: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

function formatActionMessage(action: AuditAction, details: AuditDetails): string {
  switch (action) {
    case "CREATED":
      return "created this bug";
    case "UPDATED":
      if (details.field) {
        return `updated ${details.field} from "${details.from}" to "${details.to}"`;
      }
      return "updated this bug";
    case "STATUS_CHANGED":
      return `changed status from ${formatStatusLabel(details.from)} to ${formatStatusLabel(details.to)}`;
    case "ASSIGNED":
      return `assigned to ${details.assigneeName || "someone"}`;
    case "UNASSIGNED":
      if (details.previousAssigneeName) {
        return `unassigned from ${details.previousAssigneeName}`;
      }
      return "removed assignee";
    case "COMMENTED":
      return "added a comment";
    case "ATTACHMENT_ADDED":
      return `added attachment "${details.fileName || "file"}"`;
    case "ANNOTATION_ADDED":
      return "added an annotation";
    case "ANNOTATION_UPDATED":
      return "updated an annotation";
    case "ANNOTATION_DELETED":
      return "deleted an annotation";
    case "SYNCED_TO_EXTERNAL":
      return `synced to ${details.integrationType || "external tool"}`;
    default:
      return "performed an action";
  }
}

function formatStatusLabel(status?: string): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function AuditTimeline({ bugId, className }: AuditTimelineProps) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.auditLogs.getByBug.useInfiniteQuery(
    { bugId, limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  if (allItems.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <RefreshCw className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {allItems.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "flex gap-3 py-3",
            index !== allItems.length - 1 && "border-b"
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
              ACTION_COLORS[item.action]
            )}
          >
            {ACTION_ICONS[item.action]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={item.user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {item.user.name?.charAt(0) ?? item.user.email?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">
                  {item.user.name ?? item.user.email}
                </span>{" "}
                <span className="text-muted-foreground">
                  {formatActionMessage(item.action, item.details as AuditDetails)}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-7">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasNextPage && (
        <div className="pt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
