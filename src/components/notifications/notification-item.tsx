"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Bug,
  MessageSquare,
  RefreshCw,
  AtSign,
  Plus,
  CheckCircle,
  Bell,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data: unknown;
    isRead: boolean;
    createdAt: Date;
  };
  onClick?: () => void;
  compact?: boolean;
}

// Map notification types to icons and colors
const notificationConfig: Record<
  string,
  { icon: typeof Bug; color: string; bgColor: string }
> = {
  bug_assigned: {
    icon: Bug,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  bug_commented: {
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  status_changed: {
    icon: RefreshCw,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  mentioned: {
    icon: AtSign,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  bug_created: {
    icon: Plus,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  bug_resolved: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
};

export function NotificationItem({
  notification,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const config = notificationConfig[notification.type] || {
    icon: Bell,
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  };

  const Icon = config.icon;
  const data = notification.data as Record<string, string> | null;
  const bugUrl = data?.bugUrl || data?.orgSlug && data?.bugId
    ? `/${data.orgSlug}/bugs/${data.bugId}`
    : null;

  const content = (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50",
        !notification.isRead && "bg-primary/5"
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 rounded-full p-2",
          config.bgColor
        )}
      >
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              !notification.isRead && "text-foreground",
              notification.isRead && "text-muted-foreground"
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {!compact && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );

  if (bugUrl) {
    return (
      <Link href={bugUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Skeleton loader for notification item
 */
export function NotificationItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-3 p-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        {!compact && (
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
        )}
        <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
