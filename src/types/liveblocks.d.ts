import type { LiveMap, LiveObject } from "@liveblocks/client";

// Re-export types from liveblocks config
export type {
  Presence,
  UserMeta,
  StoredAnnotation,
  Storage,
  RoomEvent,
  ThreadMetadata,
  ConnectionStatus,
} from "@/lib/liveblocks";

// Augment the Liveblocks global types
declare global {
  interface Liveblocks {
    // Presence type for the current user and others
    Presence: {
      cursor: { x: number; y: number } | null;
      selectedAnnotationId: string | null;
      isTyping: boolean;
    };

    // Storage type for the room's shared state
    Storage: {
      annotations: LiveMap<string, LiveObject<StoredAnnotationData>>;
    };

    // User meta type for user information
    UserMeta: {
      id: string;
      info: {
        name: string;
        email: string;
        avatar?: string;
        color: string;
      };
    };

    // Room event types for custom events
    RoomEvent:
      | { type: "ANNOTATION_CREATED"; annotationId: string; userId: string }
      | { type: "ANNOTATION_UPDATED"; annotationId: string; userId: string }
      | { type: "ANNOTATION_DELETED"; annotationId: string; userId: string }
      | { type: "USER_JOINED"; userId: string; userName: string }
      | { type: "USER_LEFT"; userId: string; userName: string };

    // Thread metadata for comments
    ThreadMetadata: {
      annotationId?: string;
      resolved?: boolean;
    };
  }
}

// Stored annotation data shape
interface StoredAnnotationData {
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
}

// User with presence data
export interface UserWithPresence {
  connectionId: number;
  id: string;
  info: {
    name: string;
    email: string;
    avatar?: string;
    color: string;
  };
  presence: {
    cursor: { x: number; y: number } | null;
    selectedAnnotationId: string | null;
    isTyping: boolean;
  };
}

// Cursor data for display
export interface CursorData {
  connectionId: number;
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

// Annotation being edited by another user
export interface RemoteEditingState {
  annotationId: string;
  userId: string;
  userName: string;
  userColor: string;
}
