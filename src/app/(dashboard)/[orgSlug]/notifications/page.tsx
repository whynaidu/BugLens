"use client";

import { useState } from "react";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { Bell, Check, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem } from "@/components/notifications/notification-item";
import { trpc } from "@/lib/trpc";

// Notification types for filtering
const notificationTypes = [
  { value: "all", label: "All notifications" },
  { value: "bug_assigned", label: "Bug assigned" },
  { value: "bug_commented", label: "Comments" },
  { value: "status_changed", label: "Status changes" },
  { value: "mentioned", label: "Mentions" },
  { value: "bug_created", label: "Bugs created" },
  { value: "bug_resolved", label: "Bugs resolved" },
] as const;

type NotificationType = typeof notificationTypes[number]["value"];

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState<NotificationType>("all");

  const utils = trpc.useUtils();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.notifications.getAll.useInfiniteQuery(
      {
        limit: 20,
        type: typeFilter === "all" ? undefined : typeFilter as Exclude<NotificationType, "all">,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getAll.invalidate();
    },
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getAll.invalidate();
    },
  });

  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery();
  const unreadCount = unreadData?.count ?? 0;

  // Flatten all pages of notifications
  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  // Group notifications by date
  const groupedNotifications = groupByDate(notifications);

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead.mutate({ notificationId });
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as NotificationType)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {notificationTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No notifications</h3>
          <p className="text-muted-foreground">
            {typeFilter === "all"
              ? "You don't have any notifications yet."
              : "No notifications match your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedNotifications.map(({ label, notifications: groupNotifications }) => (
            <div key={label}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {label}
              </h3>
              <div className="space-y-1 border rounded-lg overflow-hidden">
                {groupNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() =>
                      handleNotificationClick(notification.id, notification.isRead)
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to group notifications by date
function groupByDate(
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    data: unknown;
    isRead: boolean;
    createdAt: Date;
  }>
): Array<{
  label: string;
  notifications: typeof notifications;
}> {
  const groups: Record<string, typeof notifications> = {};

  for (const notification of notifications) {
    const date = new Date(notification.createdAt);
    let label: string;

    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else if (isThisWeek(date)) {
      label = format(date, "EEEE"); // Day name
    } else {
      label = format(date, "MMMM d, yyyy");
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(notification);
  }

  return Object.entries(groups).map(([label, notifications]) => ({
    label,
    notifications,
  }));
}
