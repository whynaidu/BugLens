"use client";

import { useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Bug,
  MessageSquare,
  UserPlus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  AtSign,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

// Poll interval for real-time updates (30 seconds)
const POLL_INTERVAL = 30000;

const notificationIcons: Record<string, React.ReactNode> = {
  bug_assigned: <Bug className="h-4 w-4 text-orange-500" />,
  bug_commented: <MessageSquare className="h-4 w-4 text-blue-500" />,
  status_changed: <RefreshCw className="h-4 w-4 text-amber-500" />,
  mentioned: <AtSign className="h-4 w-4 text-purple-500" />,
  bug_created: <Plus className="h-4 w-4 text-indigo-500" />,
  bug_resolved: <CheckCircle className="h-4 w-4 text-green-500" />,
  member_invited: <UserPlus className="h-4 w-4 text-purple-500" />,
  default: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
};

export function NotificationsPopover() {
  const params = useParams();
  const orgSlug = params.orgSlug as string | undefined;
  const previousCountRef = useRef(0);

  // Query with polling for real-time updates
  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    {
      refetchInterval: POLL_INTERVAL,
    }
  );
  const { data, isLoading } = trpc.notifications.getAll.useQuery(
    {
      limit: 10,
      unreadOnly: false,
    },
    {
      refetchInterval: POLL_INTERVAL,
    }
  );

  const utils = trpc.useUtils();

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

  const unreadCount = unreadData?.count ?? 0;
  const notifications = data?.notifications ?? [];

  // Show toast when new notifications arrive
  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current > 0) {
      const newCount = unreadCount - previousCountRef.current;
      toast.info(`You have ${newCount} new notification${newCount > 1 ? "s" : ""}`, {
        duration: 3000,
      });
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead.mutate({ notificationId });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const icon =
                  notificationIcons[notification.type] ||
                  notificationIcons.default;
                const data = notification.data as { bugId?: string; projectId?: string } | null;
                const href = data?.bugId && orgSlug
                  ? `/${orgSlug}/bugs/${data.bugId}`
                  : undefined;

                const content = (
                  <div
                    className={`flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !notification.isRead ? "bg-muted/30" : ""
                    }`}
                    onClick={() =>
                      handleNotificationClick(notification.id, notification.isRead)
                    }
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {icon}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                );

                return href ? (
                  <Link key={notification.id} href={href}>
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-sm" asChild>
            <Link href={orgSlug ? `/${orgSlug}/notifications` : "/notifications"}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
