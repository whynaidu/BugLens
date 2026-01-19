"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAnnotationStore, type Annotation as StoreAnnotation } from "@/store/annotation-store";

interface UseAnnotationOptions {
  screenshotId: string;
  /** Debounce delay in ms for auto-save (default: 1000) */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true) */
  autoSave?: boolean;
}

interface UseAnnotationReturn {
  /** Annotations from the store */
  annotations: StoreAnnotation[];
  /** Whether annotations are loading */
  isLoading: boolean;
  /** Whether annotations are saving */
  isSaving: boolean;
  /** Save status for UI feedback */
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Error if any */
  error: Error | null;
  /** Manually save annotations */
  save: () => Promise<void>;
  /** Reset to last saved state */
  reset: () => void;
}

export function useAnnotation({
  screenshotId,
  debounceMs = 1000,
  autoSave = true,
}: UseAnnotationOptions): UseAnnotationReturn {
  const utils = trpc.useUtils();
  const { annotations, setAnnotations } = useAnnotationStore();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");

  // Fetch annotations
  const {
    data: fetchedAnnotations,
    isLoading,
    error: fetchError,
  } = trpc.annotations.getByScreenshot.useQuery(
    { screenshotId },
    {
      enabled: !!screenshotId,
      refetchOnWindowFocus: false,
    }
  );

  // Batch update mutation
  const batchUpdateMutation = trpc.annotations.batchUpdate.useMutation({
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: (data) => {
      setSaveStatus("saved");
      // Update last saved state
      lastSavedRef.current = JSON.stringify(data);
      // Clear saved status after delay
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
      // Invalidate cache
      utils.annotations.getByScreenshot.invalidate({ screenshotId });
    },
    onError: () => {
      setSaveStatus("error");
    },
  });

  // Initialize store with fetched annotations
  useEffect(() => {
    if (fetchedAnnotations) {
      // Convert to store format (using bugs array from many-to-many relationship)
      const storeAnnotations = fetchedAnnotations.map((a): StoreAnnotation => ({
        id: a.id,
        type: a.type as StoreAnnotation["type"],
        x: a.x,
        y: a.y,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
        points: a.points ?? undefined,
        stroke: a.stroke,
        strokeWidth: a.strokeWidth,
        bugs: a.bugs || [],
      }));
      setAnnotations(storeAnnotations);
      lastSavedRef.current = JSON.stringify(fetchedAnnotations);
    }
  }, [fetchedAnnotations, setAnnotations]);

  // Manual save function
  const save = useCallback(async () => {
    if (annotations.length === 0 && fetchedAnnotations?.length === 0) {
      return; // Nothing to save
    }

    // Convert store annotations to API format
    // Note: Bug links are managed via many-to-many, not included in batch update
    const apiAnnotations = annotations.map((a) => ({
      id: a.id,
      type: a.type,
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
      points: a.points,
      stroke: a.stroke,
      strokeWidth: a.strokeWidth,
    }));

    await batchUpdateMutation.mutateAsync({
      screenshotId,
      annotations: apiAnnotations,
    });
  }, [annotations, screenshotId, batchUpdateMutation, fetchedAnnotations]);

  // Auto-save with debounce
  useEffect(() => {
    if (!autoSave) return;

    // Check if annotations have changed from last saved state
    // Note: Exclude bugs from comparison as they're managed separately
    const currentState = JSON.stringify(
      annotations.map((a) => ({
        id: a.id,
        type: a.type,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        points: a.points,
        stroke: a.stroke,
        strokeWidth: a.strokeWidth,
      }))
    );

    if (currentState === lastSavedRef.current) {
      return; // No changes
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for save
    saveTimeoutRef.current = setTimeout(() => {
      save().catch(console.error);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [annotations, autoSave, debounceMs, save]);

  // Reset to last saved state
  const reset = useCallback(() => {
    if (fetchedAnnotations) {
      const storeAnnotations = fetchedAnnotations.map((a): StoreAnnotation => ({
        id: a.id,
        type: a.type as StoreAnnotation["type"],
        x: a.x,
        y: a.y,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
        points: a.points ?? undefined,
        stroke: a.stroke,
        strokeWidth: a.strokeWidth,
        bugs: a.bugs || [],
      }));
      setAnnotations(storeAnnotations);
    }
  }, [fetchedAnnotations, setAnnotations]);

  // Convert tRPC error to standard Error
  const error = fetchError ?? batchUpdateMutation.error;
  const errorInstance = error ? new Error(error.message) : null;

  return {
    annotations,
    isLoading,
    isSaving: batchUpdateMutation.isPending,
    saveStatus,
    error: errorInstance,
    save,
    reset,
  };
}

/**
 * Hook for linking/unlinking an annotation to a bug
 */
export function useLinkAnnotationToBug() {
  const utils = trpc.useUtils();

  return trpc.annotations.linkToBug.useMutation({
    onSuccess: (data) => {
      // Invalidate the screenshot annotations cache
      utils.annotations.getByScreenshot.invalidate({ screenshotId: data.screenshotId });
    },
  });
}
