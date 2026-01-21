"use client";

import { useRef, useCallback } from "react";
import { toast } from "sonner";

import { LiveblocksRoomProvider, useConnectionStatus } from "@/components/providers/liveblocks-provider";
import { getScreenshotRoomId, useEventListener, type RoomEvent } from "@/lib/liveblocks";
import { AnnotationCanvas } from "./canvas";
import { Cursors } from "./cursors";
import { PresenceAvatars, PresenceBadge } from "./presence-avatars";
import { useCursorPresence } from "@/hooks/use-presence";
import type { Annotation } from "@/types/annotation";
import { cn } from "@/lib/utils";

interface CollaborativeCanvasProps {
  imageUrl: string;
  screenshotId: string;
  projectId: string;
  initialAnnotations?: Annotation[];
  annotationTestCaseMap?: Record<string, string>;
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
}

/**
 * Collaborative canvas wrapper that adds real-time features
 */
export function CollaborativeCanvas(props: CollaborativeCanvasProps) {
  const roomId = getScreenshotRoomId(props.screenshotId);

  return (
    <LiveblocksRoomProvider
      roomId={roomId}
      fallback={
        <div className="flex flex-col h-full">
          <CollaborativeCanvasHeaderLoading />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Connecting to collaboration session...
              </p>
            </div>
          </div>
        </div>
      }
    >
      <CollaborativeCanvasContent {...props} />
    </LiveblocksRoomProvider>
  );
}

/**
 * Header with presence avatars and connection status (loading state)
 */
function CollaborativeCanvasHeaderLoading() {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-xs">Connecting...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Header with presence avatars and connection status (connected state)
 */
function CollaborativeCanvasHeader() {
  const { isDisconnected } = useConnectionStatus();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-3">
        <PresenceAvatars maxVisible={4} size="sm" />
      </div>
      <div className="flex items-center gap-2">
        <PresenceBadge
          className={cn(
            isDisconnected && "opacity-50"
          )}
        />
        {isDisconnected && (
          <span className="text-xs text-destructive">Offline</span>
        )}
      </div>
    </div>
  );
}

/**
 * Inner component with access to Liveblocks context
 */
function CollaborativeCanvasContent({
  imageUrl,
  screenshotId,
  projectId,
  initialAnnotations = [],
  annotationTestCaseMap = {},
  onAnnotationsChange,
  saveStatus = "idle",
  onSave,
}: CollaborativeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateCursor, clearCursor } = useCursorPresence();

  // Handle cursor tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;

      if (x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height) {
        updateCursor({ x, y });
      }
    },
    [updateCursor]
  );

  const handleMouseLeave = useCallback(() => {
    clearCursor();
  }, [clearCursor]);

  // Listen for room events
  useEventListener(
    useCallback((eventData: { event: RoomEvent }) => {
      const { event } = eventData;

      switch (event.type) {
        case "USER_JOINED":
          toast.info(`${event.userName} joined`, { duration: 2000 });
          break;
        case "USER_LEFT":
          toast.info(`${event.userName} left`, { duration: 2000 });
          break;
        case "ANNOTATION_CREATED":
          // Could show visual feedback
          break;
        case "ANNOTATION_DELETED":
          // Could show visual feedback
          break;
      }
    }, [])
  );

  // Wrap onAnnotationsChange to also update presence
  const handleAnnotationsChange = useCallback(
    (annotations: Annotation[]) => {
      onAnnotationsChange?.(annotations);
    },
    [onAnnotationsChange]
  );

  return (
    <div className="flex flex-col h-full">
      <CollaborativeCanvasHeader />

      <div
        ref={containerRef}
        className="flex-1 relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Collaborative cursors overlay */}
        <Cursors containerRef={containerRef} />

        {/* Actual canvas */}
        <AnnotationCanvas
          imageUrl={imageUrl}
          screenshotId={screenshotId}
          projectId={projectId}
          initialAnnotations={initialAnnotations}
          annotationTestCaseMap={annotationTestCaseMap}
          onAnnotationsChange={handleAnnotationsChange}
          saveStatus={saveStatus}
          onSave={onSave}
        />

        {/* Connection status indicator */}
        <ConnectionStatusIndicator />
      </div>
    </div>
  );
}

/**
 * Small indicator showing sync status
 */
function ConnectionStatusIndicator() {
  const { isConnected, isConnecting, isDisconnected, label } = useConnectionStatus();

  if (isConnected) {
    return null; // Don't show when connected
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        isConnecting && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
        isDisconnected && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
      )}
    >
      {isConnecting && (
        <div className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
      )}
      {isDisconnected && (
        <div className="h-2 w-2 rounded-full bg-current" />
      )}
      <span>{label}</span>
    </div>
  );
}

/**
 * Non-collaborative canvas export for when real-time isn't needed
 */
export { AnnotationCanvas } from "./canvas";
