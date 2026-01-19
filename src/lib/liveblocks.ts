"use client";

import { createClient } from "@liveblocks/client";
import { createRoomContext, createLiveblocksContext } from "@liveblocks/react";
import type { LiveMap, LiveObject } from "@liveblocks/client";

// Define presence type - what each user broadcasts to others
export type Presence = {
  cursor: { x: number; y: number } | null;
  selectedAnnotationId: string | null;
  isTyping: boolean;
};

// Define user meta type - info about each user
export type UserMeta = {
  id: string;
  info: {
    name: string;
    email: string;
    avatar?: string;
    color: string;
  };
};

// Define annotation shape for storage
export type StoredAnnotation = {
  id: string;
  type: "rectangle" | "circle" | "arrow" | "freehand" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  text?: string;
  stroke: string;
  strokeWidth: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

// Define storage structure - shared state
export type Storage = {
  annotations: LiveMap<string, LiveObject<StoredAnnotation>>;
};

// Define room event types
export type RoomEvent =
  | { type: "ANNOTATION_CREATED"; annotationId: string; userId: string }
  | { type: "ANNOTATION_UPDATED"; annotationId: string; userId: string }
  | { type: "ANNOTATION_DELETED"; annotationId: string; userId: string }
  | { type: "USER_JOINED"; userId: string; userName: string }
  | { type: "USER_LEFT"; userId: string; userName: string };

// Thread metadata for comments (if using Liveblocks Comments)
export type ThreadMetadata = {
  annotationId?: string;
  resolved?: boolean;
};

// Create the Liveblocks client
export const liveblocksClient = createClient({
  authEndpoint: "/api/liveblocks-auth",
  throttle: 16, // ~60fps for smooth cursor movement
});

// Create room context with types
// Note: Using type assertion due to Liveblocks internal type constraints
const roomContext = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(
  liveblocksClient as Parameters<typeof createRoomContext>[0]
);

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useSelf,
  useStorage,
  useMutation,
  useHistory,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
  useStatus,
  useLostConnectionListener,
  useErrorListener,
  useEventListener,
  useBroadcastEvent,
} = roomContext;

// Create Liveblocks context for global features
const liveblocksContext = createLiveblocksContext(
  liveblocksClient as Parameters<typeof createLiveblocksContext>[0]
);

export const {
  LiveblocksProvider,
} = liveblocksContext;

// User colors for cursors and presence
export const USER_COLORS = [
  "#E57373", // Red
  "#64B5F6", // Blue
  "#81C784", // Green
  "#FFD54F", // Yellow
  "#BA68C8", // Purple
  "#4DB6AC", // Teal
  "#FF8A65", // Orange
  "#A1887F", // Brown
  "#90A4AE", // Gray
  "#F06292", // Pink
];

// Get a consistent color for a user based on their ID
export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// Room ID helpers
export function getScreenshotRoomId(screenshotId: string): string {
  return `screenshot:${screenshotId}`;
}

export function getBugRoomId(bugId: string): string {
  return `bug:${bugId}`;
}

// Connection status types
export type ConnectionStatus = "initial" | "connecting" | "connected" | "reconnecting" | "disconnected";

// Helper to check if connected
export function isConnected(status: ConnectionStatus): boolean {
  return status === "connected";
}
