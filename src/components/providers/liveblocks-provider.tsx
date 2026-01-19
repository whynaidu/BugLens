"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { LiveMap, LiveObject } from "@liveblocks/client";
import { toast } from "sonner";

import {
  RoomProvider,
  useErrorListener,
  useLostConnectionListener,
  useEventListener,
  useStatus,
  type Presence,
  type Storage,
  type StoredAnnotation,
  type RoomEvent,
} from "@/lib/liveblocks";

interface LiveblocksRoomProviderProps {
  roomId: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Provider component that wraps content with Liveblocks RoomProvider
 * Handles connection status, errors, and events
 */
export function LiveblocksRoomProvider({
  roomId,
  children,
  fallback,
}: LiveblocksRoomProviderProps) {
  const [isReady, setIsReady] = useState(false);

  // Initial presence state
  const initialPresence: Presence = {
    cursor: null,
    selectedAnnotationId: null,
    isTyping: false,
  };

  // Initialize storage with empty annotations map
  const initialStorage: Storage = {
    annotations: new LiveMap<string, LiveObject<StoredAnnotation>>(),
  };

  return (
    <RoomProvider
      id={roomId}
      initialPresence={initialPresence}
      initialStorage={initialStorage}
    >
      <RoomEventHandlers onReady={() => setIsReady(true)}>
        {isReady ? children : fallback ?? <LoadingFallback />}
      </RoomEventHandlers>
    </RoomProvider>
  );
}

/**
 * Internal component to handle room events and connection status
 */
function RoomEventHandlers({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  const status = useStatus();

  // Mark as ready once connected
  useEffect(() => {
    if (status === "connected") {
      onReady();
    }
  }, [status, onReady]);

  // Handle connection lost
  useLostConnectionListener(
    useCallback((event) => {
      switch (event) {
        case "lost":
          toast.warning("Connection lost", {
            description: "Attempting to reconnect...",
            id: "liveblocks-connection",
          });
          break;
        case "restored":
          toast.success("Connection restored", {
            description: "You're back online!",
            id: "liveblocks-connection",
          });
          break;
        case "failed":
          toast.error("Connection failed", {
            description: "Please refresh the page to reconnect.",
            id: "liveblocks-connection",
          });
          break;
      }
    }, [])
  );

  // Handle errors
  useErrorListener(
    useCallback((error) => {
      console.error("Liveblocks error:", error);
      const errorMessage = error.message || "Unknown error";
      if (errorMessage.includes("authentication") || errorMessage.includes("unauthorized")) {
        toast.error("Authentication failed", {
          description: "Please sign in again to continue collaborating.",
        });
      } else if (errorMessage.includes("forbidden") || errorMessage.includes("access denied")) {
        toast.error("Access denied", {
          description: "You don't have permission to access this room.",
        });
      } else {
        toast.error("Connection error", {
          description: "An error occurred with real-time collaboration.",
        });
      }
    }, [])
  );

  // Handle room events (user joins/leaves)
  useEventListener(
    useCallback((eventData: { event: RoomEvent }) => {
      const { event } = eventData;
      switch (event.type) {
        case "USER_JOINED":
          toast.info(`${event.userName} joined`, {
            duration: 2000,
          });
          break;
        case "USER_LEFT":
          toast.info(`${event.userName} left`, {
            duration: 2000,
          });
          break;
      }
    }, [])
  );

  return <>{children}</>;
}

/**
 * Default loading fallback while connecting to room
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm">Connecting to collaboration session...</span>
      </div>
    </div>
  );
}

/**
 * Hook to get current connection status with human-readable labels
 */
export function useConnectionStatus() {
  const status = useStatus();

  const statusLabels: Record<string, string> = {
    initial: "Initializing",
    connecting: "Connecting",
    connected: "Connected",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
  };

  return {
    status,
    label: statusLabels[status] || status,
    isConnected: status === "connected",
    isConnecting: status === "connecting" || status === "reconnecting",
    isDisconnected: status === "disconnected",
  };
}
