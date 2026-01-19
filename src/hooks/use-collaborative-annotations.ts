"use client";

import { useCallback, useMemo } from "react";
import { LiveObject } from "@liveblocks/client";
import {
  useStorage,
  useMutation,
  useSelf,
  useStatus,
  useBroadcastEvent,
  type StoredAnnotation,
} from "@/lib/liveblocks";
import { useSelectionPresence } from "./use-presence";

export type AnnotationType = "rectangle" | "circle" | "arrow" | "freehand" | "text";

export interface Annotation {
  id: string;
  type: AnnotationType;
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

interface UseCollaborativeAnnotationsReturn {
  // Data
  annotations: Annotation[];
  selectedAnnotationId: string | null;

  // Actions
  addAnnotation: (annotation: Omit<Annotation, "id" | "createdBy" | "createdAt" | "updatedAt">) => string;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;

  // Status
  isConnected: boolean;
  isSyncing: boolean;

  // Remote editing
  getAnnotationEditor: (annotationId: string) => { userId: string; userName: string; userColor: string } | undefined;
  isEditedByOther: (annotationId: string) => boolean;
}

/**
 * Hook to manage collaborative annotations with real-time sync
 */
export function useCollaborativeAnnotations(): UseCollaborativeAnnotationsReturn {
  const self = useSelf();
  const status = useStatus();
  const broadcastEvent = useBroadcastEvent();
  const { selectAnnotation, selectedAnnotationId, getAnnotationEditor, isSelectedByOther } =
    useSelectionPresence();

  // Get annotations from storage
  const storageAnnotations = useStorage((root) => root.annotations);

  // Convert storage map to array
  const annotations = useMemo(() => {
    if (!storageAnnotations) return [];

    const result: Annotation[] = [];
    storageAnnotations.forEach((value) => {
      // Access LiveObject properties directly
      result.push({
        id: value.id,
        type: value.type,
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        points: value.points,
        text: value.text,
        stroke: value.stroke,
        strokeWidth: value.strokeWidth,
        createdBy: value.createdBy,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      });
    });

    // Sort by creation time
    return result.sort((a, b) => a.createdAt - b.createdAt);
  }, [storageAnnotations]);

  // Add annotation mutation
  const addAnnotation = useMutation(
    ({ storage, self: selfData }, annotation: Omit<Annotation, "id" | "createdBy" | "createdAt" | "updatedAt">) => {
      const annotations = storage.get("annotations");
      const id = generateId();
      const now = Date.now();
      const userId = selfData?.id || "unknown";

      const newAnnotation: StoredAnnotation = {
        id,
        type: annotation.type,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        points: annotation.points,
        text: annotation.text,
        stroke: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      annotations.set(id, new LiveObject(newAnnotation));

      return id;
    },
    []
  );

  // Update annotation mutation
  const updateAnnotation = useMutation(
    ({ storage, self: selfData }, id: string, updates: Partial<Annotation>) => {
      const annotations = storage.get("annotations");
      const annotation = annotations.get(id);

      if (!annotation) return;

      // Check if another user is editing this annotation
      const editor = getAnnotationEditor(id);
      if (editor && editor.userId !== selfData?.id) {
        console.warn(`Annotation ${id} is being edited by ${editor.userName}`);
        return;
      }

      // Apply updates
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== "id" && key !== "createdBy" && key !== "createdAt") {
          annotation.set(key as keyof StoredAnnotation, value as never);
        }
      });

      annotation.set("updatedAt", Date.now());
    },
    [getAnnotationEditor]
  );

  // Delete annotation mutation
  const deleteAnnotation = useMutation(
    ({ storage }, id: string) => {
      const annotations = storage.get("annotations");
      annotations.delete(id);

      // Broadcast deletion event
      broadcastEvent({
        type: "ANNOTATION_DELETED",
        annotationId: id,
        userId: self?.id || "unknown",
      });
    },
    [broadcastEvent, self?.id]
  );

  // Wrapper for adding annotation with broadcast
  const handleAddAnnotation = useCallback(
    (annotation: Omit<Annotation, "id" | "createdBy" | "createdAt" | "updatedAt">) => {
      const id = addAnnotation(annotation);

      // Broadcast creation event
      broadcastEvent({
        type: "ANNOTATION_CREATED",
        annotationId: id,
        userId: self?.id || "unknown",
      });

      return id;
    },
    [addAnnotation, broadcastEvent, self?.id]
  );

  // Wrapper for updating annotation with broadcast
  const handleUpdateAnnotation = useCallback(
    (id: string, updates: Partial<Annotation>) => {
      updateAnnotation(id, updates);

      // Broadcast update event (throttled)
      broadcastEvent({
        type: "ANNOTATION_UPDATED",
        annotationId: id,
        userId: self?.id || "unknown",
      });
    },
    [updateAnnotation, broadcastEvent, self?.id]
  );

  return {
    // Data
    annotations,
    selectedAnnotationId,

    // Actions
    addAnnotation: handleAddAnnotation,
    updateAnnotation: handleUpdateAnnotation,
    deleteAnnotation,
    selectAnnotation,

    // Status
    isConnected: status === "connected",
    isSyncing: status === "connecting" || status === "reconnecting",

    // Remote editing
    getAnnotationEditor,
    isEditedByOther: isSelectedByOther,
  };
}

/**
 * Generate a unique ID for annotations
 */
function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook to sync local annotations with collaborative storage
 * Use this when you need to initialize storage from existing annotations
 */
export function useSyncAnnotations(localAnnotations: Annotation[]) {
  const status = useStatus();

  // Sync local annotations to storage when connected
  const syncToStorage = useMutation(
    ({ storage, self: selfData }, annotations: Annotation[]) => {
      const storageAnnotations = storage.get("annotations");

      // Clear existing and add all local annotations
      // This is useful for initial sync from database
      annotations.forEach((annotation) => {
        if (!storageAnnotations.has(annotation.id)) {
          storageAnnotations.set(
            annotation.id,
            new LiveObject({
              ...annotation,
              createdBy: annotation.createdBy || selfData?.id || "unknown",
            })
          );
        }
      });
    },
    []
  );

  return {
    syncToStorage: () => syncToStorage(localAnnotations),
    isConnected: status === "connected",
  };
}

/**
 * Hook for undo/redo functionality
 */
export { useHistory, useUndo, useRedo, useCanUndo, useCanRedo } from "@/lib/liveblocks";
