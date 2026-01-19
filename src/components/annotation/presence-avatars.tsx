"use client";

import { useMemo } from "react";
import { useOthers, useSelf } from "@/lib/liveblocks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresenceAvatarsProps {
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  showSelf?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

const borderSizeClasses = {
  sm: "ring-1",
  md: "ring-2",
  lg: "ring-2",
};

/**
 * Display avatars of users currently viewing the same room
 */
export function PresenceAvatars({
  maxVisible = 5,
  size = "md",
  showSelf = false,
  className,
}: PresenceAvatarsProps) {
  const others = useOthers();
  const self = useSelf();

  // Build list of users to display
  const users = useMemo(() => {
    const userList = others.map((user) => ({
      id: user.id || `connection-${user.connectionId}`,
      connectionId: user.connectionId,
      name: user.info?.name || "Anonymous",
      avatar: user.info?.avatar,
      color: user.info?.color || "#6366f1",
    }));

    // Optionally add self at the beginning
    if (showSelf && self) {
      userList.unshift({
        id: self.id || "self",
        connectionId: self.connectionId,
        name: self.info?.name || "You",
        avatar: self.info?.avatar,
        color: self.info?.color || "#6366f1",
      });
    }

    return userList;
  }, [others, self, showSelf]);

  // Split into visible and overflow
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = Math.max(0, users.length - maxVisible);

  if (users.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center -space-x-2", className)}>
        {/* Visible avatars */}
        {visibleUsers.map((user, index) => (
          <Tooltip key={user.connectionId}>
            <TooltipTrigger asChild>
              <div
                className="relative"
                style={{ zIndex: visibleUsers.length - index }}
              >
                <Avatar
                  className={cn(
                    sizeClasses[size],
                    borderSizeClasses[size],
                    "ring-background cursor-pointer transition-transform hover:scale-110 hover:z-10"
                  )}
                  style={{ borderColor: user.color }}
                >
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback
                    className="font-medium"
                    style={{ backgroundColor: user.color, color: "white" }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative z-0">
                <Avatar
                  className={cn(
                    sizeClasses[size],
                    borderSizeClasses[size],
                    "ring-background cursor-pointer bg-muted"
                  )}
                >
                  <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                    +{overflowCount}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {overflowCount} other{overflowCount > 1 ? "s" : ""} viewing
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Display a single user's avatar with their status
 */
export function UserPresenceAvatar({
  userId,
  size = "md",
  className,
}: {
  userId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const others = useOthers();

  const user = useMemo(() => {
    return others.find((u) => u.id === userId);
  }, [others, userId]);

  if (!user) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar
            className={cn(
              sizeClasses[size],
              borderSizeClasses[size],
              "ring-offset-2",
              className
            )}
            style={{ borderColor: user.info?.color }}
          >
            <AvatarImage src={user.info?.avatar} alt={user.info?.name} />
            <AvatarFallback
              style={{
                backgroundColor: user.info?.color,
                color: "white",
              }}
            >
              {(user.info?.name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p>{user.info?.name || "Anonymous"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Text indicator showing who else is viewing
 */
export function PresenceIndicator({ className }: { className?: string }) {
  const others = useOthers();

  if (others.length === 0) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Only you
      </span>
    );
  }

  const names = others.slice(0, 2).map((u) => u.info?.name || "Someone");
  const remaining = others.length - 2;

  let text: string;
  if (others.length === 1) {
    text = `${names[0]} is here`;
  } else if (others.length === 2) {
    text = `${names[0]} and ${names[1]} are here`;
  } else {
    text = `${names.join(", ")} and ${remaining} other${remaining > 1 ? "s" : ""} are here`;
  }

  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      {text}
    </span>
  );
}

/**
 * Animated presence badge that shows when users join/leave
 */
export function PresenceBadge({ className }: { className?: string }) {
  const others = useOthers();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-muted px-3 py-1",
        className
      )}
    >
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </div>
      <span className="text-xs font-medium">
        {others.length + 1} viewing
      </span>
    </div>
  );
}
