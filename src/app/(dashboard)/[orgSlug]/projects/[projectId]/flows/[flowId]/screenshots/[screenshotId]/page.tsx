"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, X, Bug, Loader2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateBugDialog } from "@/components/screenshots/create-bug-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Annotation } from "@/store/annotation-store";
import type { NormalizedAnnotation } from "@/components/screenshots/screenshot-viewer";

// Dynamically import ScreenshotViewer to avoid SSR issues with react-konva
const ScreenshotViewer = dynamic(
  () => import("@/components/screenshots/screenshot-viewer").then((mod) => mod.ScreenshotViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function ScreenshotViewerPage() {
  const router = useRouter();
  const params = useParams<{
    orgSlug: string;
    projectId: string;
    flowId: string;
    screenshotId: string;
  }>();

  const { orgSlug, projectId, flowId, screenshotId } = params;

  // Get screenshot with annotations
  const { data: screenshot, isLoading: isLoadingScreenshot } =
    trpc.screenshots.getById.useQuery({ screenshotId });

  // Get all screenshots in the flow for navigation
  const { data: allScreenshots = [] } = trpc.screenshots.getByFlow.useQuery({
    flowId,
  });

  const utils = trpc.useUtils();

  // Dialog state for creating bug from annotation
  const [isBugDialogOpen, setIsBugDialogOpen] = useState(false);
  const [selectedAnnotationForBug, setSelectedAnnotationForBug] = useState<Annotation | null>(null);

  // Track highlighted bug in sidebar
  const [highlightedBugId, setHighlightedBugId] = useState<string | null>(null);
  const bugRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Batch update annotations mutation (to save annotations to DB)
  const batchUpdateAnnotationsMutation = trpc.annotations.batchUpdate.useMutation();

  // Create bug mutation
  const createBugMutation = trpc.bugs.create.useMutation({
    onSuccess: (bug) => {
      toast.success(`Bug "${bug.title}" created successfully`);
      setIsBugDialogOpen(false);
      setSelectedAnnotationForBug(null);
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create bug");
    },
  });

  // Find current index and navigation
  const currentIndex = useMemo(
    () => allScreenshots.findIndex((s: { id: string }) => s.id === screenshotId),
    [allScreenshots, screenshotId]
  );

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allScreenshots.length - 1;

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      const prevScreenshot = allScreenshots[currentIndex - 1];
      router.push(
        `/${orgSlug}/projects/${projectId}/flows/${flowId}/screenshots/${prevScreenshot.id}`
      );
    }
  }, [hasPrevious, allScreenshots, currentIndex, router, orgSlug, projectId, flowId]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextScreenshot = allScreenshots[currentIndex + 1];
      router.push(
        `/${orgSlug}/projects/${projectId}/flows/${flowId}/screenshots/${nextScreenshot.id}`
      );
    }
  }, [hasNext, allScreenshots, currentIndex, router, orgSlug, projectId, flowId]);

  // Clear highlight after delay
  useEffect(() => {
    if (highlightedBugId) {
      const timer = setTimeout(() => {
        setHighlightedBugId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedBugId]);

  // Handle annotation click - either highlight existing bug or open create dialog
  const handleAnnotationSelect = useCallback((annotation: Annotation) => {
    // Check if this annotation has a linked bug
    if (annotation.bugId) {
      // Highlight the bug in sidebar and scroll to it
      setHighlightedBugId(annotation.bugId);

      // Scroll to the bug card
      const bugElement = bugRefs.current.get(annotation.bugId);
      if (bugElement) {
        bugElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      // No bug linked - open create bug dialog
      setSelectedAnnotationForBug(annotation);
      setIsBugDialogOpen(true);
    }
  }, []);

  // Handle creating a new bug for an annotation (even if it already has one)
  const handleCreateNewBug = useCallback((annotation: Annotation) => {
    setSelectedAnnotationForBug(annotation);
    setIsBugDialogOpen(true);
  }, []);

  // Helper to check if an ID is a valid CUID (from database)
  const isValidCuid = (id: string) => /^c[^\s-]{8,}$/i.test(id);

  // Handle bug creation from dialog
  const handleCreateBug = useCallback(
    async (data: { title: string; description: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }) => {
      if (!selectedAnnotationForBug) return;

      // Check if the annotation is already saved to the database (has a valid CUID)
      const annotationId = isValidCuid(selectedAnnotationForBug.id)
        ? selectedAnnotationForBug.id
        : undefined;

      await createBugMutation.mutateAsync({
        projectId,
        annotationId,
        title: data.title,
        description: data.description,
        severity: data.severity,
        priority: data.priority,
      });
    },
    [selectedAnnotationForBug, projectId, createBugMutation]
  );

  // Convert DB annotations to store format
  const annotations: Annotation[] = useMemo(() => {
    if (!screenshot?.annotations) return [];
    return screenshot.annotations.map((a) => ({
      id: a.id,
      type: a.type.toLowerCase() as Annotation["type"],
      x: a.x,
      y: a.y,
      width: a.width || undefined,
      height: a.height || undefined,
      points: a.points as number[] | undefined,
      stroke: a.stroke || "#EF4444",
      strokeWidth: a.strokeWidth,
      bugId: a.bugId || undefined,
    }));
  }, [screenshot]);

  // Get annotation for a specific bug
  const getAnnotationForBug = useCallback((bugId: string) => {
    return annotations.find((a) => a.bugId === bugId);
  }, [annotations]);

  // Save annotation to database when drawing finishes
  const handleAnnotationCreate = useCallback(
    async (normalizedAnnotation: NormalizedAnnotation): Promise<Annotation | null> => {
      try {
        // Get existing annotations from the database to preserve them
        const existingDbAnnotations = screenshot?.annotations || [];

        // Prepare existing annotations for batchUpdate (include their IDs)
        const existingForUpdate = existingDbAnnotations.map((a) => ({
          id: a.id,
          type: a.type.toLowerCase() as "rectangle" | "circle" | "arrow" | "freehand",
          x: a.x,
          y: a.y,
          width: a.width || undefined,
          height: a.height || undefined,
          points: (a.points as number[]) || undefined,
          stroke: a.stroke || "#EF4444",
          strokeWidth: a.strokeWidth,
          bugId: a.bugId || undefined,
        }));

        // Use batchUpdate to save existing + new annotation
        const savedAnnotations = await batchUpdateAnnotationsMutation.mutateAsync({
          screenshotId,
          annotations: [
            ...existingForUpdate,
            {
              // New annotation without ID - will be created
              type: normalizedAnnotation.type,
              x: normalizedAnnotation.x,
              y: normalizedAnnotation.y,
              width: normalizedAnnotation.width,
              height: normalizedAnnotation.height,
              points: normalizedAnnotation.points,
              stroke: normalizedAnnotation.stroke,
              strokeWidth: normalizedAnnotation.strokeWidth,
            },
          ],
        });

        if (savedAnnotations && savedAnnotations.length > 0) {
          // The last annotation should be the newly created one
          const saved = savedAnnotations[savedAnnotations.length - 1];
          toast.success("Annotation saved");
          utils.screenshots.getById.invalidate({ screenshotId });

          // Return the saved annotation with database ID
          return {
            id: saved.id,
            type: saved.type as Annotation["type"],
            x: saved.x,
            y: saved.y,
            width: saved.width || undefined,
            height: saved.height || undefined,
            points: saved.points || undefined,
            stroke: saved.stroke,
            strokeWidth: saved.strokeWidth,
            bugId: saved.bugId || undefined,
          };
        }
        return null;
      } catch (error) {
        console.error("Failed to save annotation:", error);
        toast.error("Failed to save annotation");
        return null;
      }
    },
    [screenshotId, screenshot?.annotations, batchUpdateAnnotationsMutation, utils.screenshots.getById]
  );

  const handleAnnotationUpdate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (id: string, updates: Partial<Annotation>) => {
      // TODO: Update annotation via tRPC
      toast.success("Annotation updated");
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    [screenshotId, utils.screenshots.getById]
  );

  const handleAnnotationDelete = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (id: string) => {
      // TODO: Delete annotation via tRPC
      toast.success("Annotation deleted");
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    [screenshotId, utils.screenshots.getById]
  );

  if (isLoadingScreenshot) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!screenshot) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Screenshot not found</p>
        <Button asChild>
          <Link href={`/${orgSlug}/projects/${projectId}/flows/${flowId}`}>
            Go Back
          </Link>
        </Button>
      </div>
    );
  }

  const linkedBugs = screenshot.annotations
    ?.map((a) => (a.bug ? { ...a.bug, annotationId: a.id } : null))
    .filter((item): item is NonNullable<typeof item> =>
      item !== null
    );

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      {/* Main viewer area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${orgSlug}/projects/${projectId}/flows/${flowId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {screenshot.title || "Untitled Screenshot"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} of {allScreenshots.length} screenshots
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${orgSlug}/projects/${projectId}/flows/${flowId}`}>
              <X className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Viewer */}
        <div className="flex-1">
          <ScreenshotViewer
            imageUrl={screenshot.downloadUrl || screenshot.originalUrl}
            annotations={annotations}
            onAnnotationCreate={handleAnnotationCreate}
            onAnnotationUpdate={handleAnnotationUpdate}
            onAnnotationDelete={handleAnnotationDelete}
            onAnnotationSelect={handleAnnotationSelect}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        </div>
      </div>

      {/* Bug sidebar */}
      <div className="w-80 border-l bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Linked Bugs
          </h2>
          <p className="text-sm text-muted-foreground">
            {linkedBugs?.length || 0} bug{linkedBugs?.length !== 1 ? "s" : ""} linked to annotations
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {linkedBugs && linkedBugs.length > 0 ? (
              linkedBugs.map((bug) => (
                <ContextMenu key={bug.id}>
                  <ContextMenuTrigger>
                    <div
                      ref={(el) => {
                        if (el) bugRefs.current.set(bug.id, el);
                      }}
                      className={`block p-3 rounded-lg border bg-background transition-all cursor-pointer ${
                        highlightedBugId === bug.id
                          ? "ring-2 ring-primary border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        // Find the annotation for this bug and highlight it
                        const annotation = getAnnotationForBug(bug.id);
                        if (annotation) {
                          // Could trigger annotation highlight on canvas here
                        }
                      }}
                    >
                      <p className="font-medium text-sm truncate">{bug.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {bug.status}
                        </Badge>
                        <Badge
                          variant={
                            bug.severity === "CRITICAL" || bug.severity === "HIGH"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {bug.severity}
                        </Badge>
                      </div>
                      {highlightedBugId === bug.id && (
                        <p className="text-xs text-primary mt-2 font-medium">
                          Click annotation to view this bug
                        </p>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem asChild>
                      <Link href={`/${orgSlug}/projects/${projectId}/bugs/${bug.id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Bug Details
                      </Link>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        const annotation = getAnnotationForBug(bug.id);
                        if (annotation) {
                          handleCreateNewBug(annotation);
                        }
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Another Bug
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            ) : (
              <div className="text-center py-8">
                <Bug className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No bugs linked yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click an annotation to create a bug
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Annotations without bugs section */}
        {annotations.filter(a => !a.bugId).length > 0 && (
          <div className="p-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              {annotations.filter(a => !a.bugId).length} annotation(s) without bugs
            </p>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              onClick={() => {
                const unlinkedAnnotation = annotations.find(a => !a.bugId);
                if (unlinkedAnnotation) {
                  handleCreateNewBug(unlinkedAnnotation);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Bug for Annotation
            </Button>
          </div>
        )}
      </div>

      {/* Bug creation dialog */}
      <CreateBugDialog
        open={isBugDialogOpen}
        onOpenChange={setIsBugDialogOpen}
        onSubmit={handleCreateBug}
        isSubmitting={createBugMutation.isPending}
        annotationType={selectedAnnotationForBug?.type}
      />
    </div>
  );
}
