"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useSelf,
  useOthersMapped,
} from "@/lib/liveblocks";

/**
 * Hook to manage cursor presence
 */
export function useCursorPresence() {
  const [myPresence] = useMyPresence();
  const updateMyPresence = useUpdateMyPresence();
  const lastUpdateRef = useRef<number>(0);
  const throttleMs = 16; // ~60fps

  // Throttled cursor update
  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;
      lastUpdateRef.current = now;
      updateMyPresence({ cursor });
    },
    [updateMyPresence]
  );

  // Clear cursor
  const clearCursor = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  return {
    cursor: myPresence.cursor,
    updateCursor,
    clearCursor,
  };
}

/**
 * Hook to track selected annotation across users
 */
export function useSelectionPresence() {
  const [myPresence] = useMyPresence();
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();

  // Update my selected annotation
  const selectAnnotation = useCallback(
    (annotationId: string | null) => {
      updateMyPresence({ selectedAnnotationId: annotationId });
    },
    [updateMyPresence]
  );

  // Get annotations selected by other users
  const othersSelections = useMemo(() => {
    return others
      .filter((user) => user.presence?.selectedAnnotationId)
      .map((user) => ({
        annotationId: user.presence?.selectedAnnotationId as string,
        userId: user.id || "",
        userName: user.info?.name || "Anonymous",
        userColor: user.info?.color || "#6366f1",
      }));
  }, [others]);

  // Check if an annotation is selected by someone else
  const isSelectedByOther = useCallback(
    (annotationId: string) => {
      return othersSelections.some((s) => s.annotationId === annotationId);
    },
    [othersSelections]
  );

  // Get who is selecting an annotation
  const getAnnotationEditor = useCallback(
    (annotationId: string) => {
      return othersSelections.find((s) => s.annotationId === annotationId);
    },
    [othersSelections]
  );

  return {
    selectedAnnotationId: myPresence.selectedAnnotationId,
    selectAnnotation,
    othersSelections,
    isSelectedByOther,
    getAnnotationEditor,
  };
}

/**
 * Hook to track typing state for comments
 */
export function useTypingPresence() {
  const [myPresence] = useMyPresence();
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();

  // Update typing state
  const setIsTyping = useCallback(
    (isTyping: boolean) => {
      updateMyPresence({ isTyping });
    },
    [updateMyPresence]
  );

  // Get users who are currently typing
  const typingUsers = useMemo(() => {
    return others
      .filter((user) => user.presence?.isTyping)
      .map((user) => ({
        userId: user.id || "",
        userName: user.info?.name || "Anonymous",
      }));
  }, [others]);

  return {
    isTyping: myPresence.isTyping,
    setIsTyping,
    typingUsers,
  };
}

/**
 * Hook to get all presence information for the current user
 */
export function useMyPresenceInfo() {
  const self = useSelf();

  return useMemo(() => {
    if (!self) return null;

    return {
      connectionId: self.connectionId,
      userId: self.id || "",
      name: self.info?.name || "Anonymous",
      email: self.info?.email || "",
      avatar: self.info?.avatar,
      color: self.info?.color || "#6366f1",
      presence: self.presence,
    };
  }, [self]);
}

/**
 * Hook to get other users in the room
 */
export function useOtherUsers() {
  const others = useOthers();

  return useMemo(() => {
    return others.map((user) => ({
      connectionId: user.connectionId,
      userId: user.id || "",
      name: user.info?.name || "Anonymous",
      email: user.info?.email || "",
      avatar: user.info?.avatar,
      color: user.info?.color || "#6366f1",
      cursor: user.presence?.cursor ?? null,
      selectedAnnotationId: user.presence?.selectedAnnotationId ?? null,
      isTyping: user.presence?.isTyping ?? false,
    }));
  }, [others]);
}

/**
 * Hook to get count of users in the room
 */
export function useUserCount() {
  const others = useOthers();
  return others.length + 1; // Include self
}

/**
 * Hook to get mapped presence data efficiently
 */
export function usePresenceMapping<T>(
  selector: (user: {
    connectionId: number;
    id: string | undefined;
    info: { name: string; email: string; avatar?: string; color: string } | undefined;
    presence: { cursor: { x: number; y: number } | null; selectedAnnotationId: string | null; isTyping: boolean };
  }) => T
) {
  return useOthersMapped((other) => selector(other));
}
