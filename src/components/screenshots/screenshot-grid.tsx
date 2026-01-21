"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ScreenshotCard,
  ScreenshotCardSkeleton,
  type Screenshot,
} from "./screenshot-card";
import { ScreenshotUpload } from "./screenshot-upload";

interface ScreenshotGridProps {
  testCaseId: string;
  moduleId: string;
  projectId: string;
  orgSlug: string;
}

export function ScreenshotGrid({
  testCaseId,
  moduleId,
  projectId,
  orgSlug,
}: ScreenshotGridProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deletingScreenshot, setDeletingScreenshot] = useState<Screenshot | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: screenshots = [], isLoading } = trpc.screenshots.getByTestCase.useQuery(
    { testCaseId }
  );

  const updateMutation = trpc.screenshots.update.useMutation({
    onSuccess: () => {
      utils.screenshots.getByTestCase.invalidate({ testCaseId });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.screenshots.delete.useMutation({
    onSuccess: () => {
      toast.success("Screenshot deleted");
      setDeletingScreenshot(null);
      utils.screenshots.getByTestCase.invalidate({ testCaseId });
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const reorderMutation = trpc.screenshots.reorder.useMutation({
    onError: (error: { message: string }) => {
      toast.error(error.message);
      utils.screenshots.getByTestCase.invalidate({ testCaseId });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = screenshots.findIndex(
          (s: Screenshot) => s.id === active.id
        );
        const newIndex = screenshots.findIndex(
          (s: Screenshot) => s.id === over.id
        );

        const newOrder = arrayMove(screenshots, oldIndex, newIndex);
        const screenshotIds = newOrder.map((s: Screenshot) => s.id);

        // Optimistic update
        utils.screenshots.getByTestCase.setData({ testCaseId }, newOrder);

        reorderMutation.mutate({ testCaseId, screenshotIds });
      }
    },
    [screenshots, testCaseId, utils.screenshots.getByTestCase, reorderMutation]
  );

  const handleView = useCallback(
    (screenshotId: string) => {
      router.push(
        `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testCaseId}/screenshots/${screenshotId}`
      );
    },
    [router, orgSlug, projectId, moduleId, testCaseId]
  );

  const handleTitleChange = useCallback(
    (screenshotId: string, title: string) => {
      updateMutation.mutate({ screenshotId, title });
    },
    [updateMutation]
  );

  const handleUploadComplete = useCallback(() => {
    utils.screenshots.getByTestCase.invalidate({ testCaseId });
  }, [utils.screenshots.getByTestCase, testCaseId]);

  const activeScreenshot = activeId
    ? screenshots.find((s: Screenshot) => s.id === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Screenshots</h2>
            <p className="text-sm text-muted-foreground">
              Loading screenshots...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <ScreenshotCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Screenshots</h2>
          <p className="text-sm text-muted-foreground">
            {screenshots.length === 0
              ? "No screenshots yet"
              : `${screenshots.length} screenshot${
                  screenshots.length !== 1 ? "s" : ""
                }. Drag to reorder.`}
          </p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {screenshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No screenshots yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Upload screenshots to start annotating and documenting test cases.
          </p>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload Screenshots
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={screenshots.map((s: Screenshot) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {screenshots.map((screenshot: Screenshot) => (
                <ScreenshotCard
                  key={screenshot.id}
                  screenshot={screenshot}
                  onView={() => handleView(screenshot.id)}
                  onDelete={() => setDeletingScreenshot(screenshot)}
                  onTitleChange={(title) =>
                    handleTitleChange(screenshot.id, title)
                  }
                  isDragging={activeId === screenshot.id}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeScreenshot ? (
              <ScreenshotCard
                screenshot={activeScreenshot}
                onView={() => {}}
                onDelete={() => {}}
                onTitleChange={() => {}}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Upload Dialog */}
      <ScreenshotUpload
        testCaseId={testCaseId}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onComplete={handleUploadComplete}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingScreenshot}
        onOpenChange={() => setDeletingScreenshot(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screenshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;
              {deletingScreenshot?.title || "Untitled"}&quot; and all its
              annotations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingScreenshot) {
                  deleteMutation.mutate({
                    screenshotId: deletingScreenshot.id,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
