"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, X, Bug, Loader2, Plus, ExternalLink, Eye, Trash2, Unlink, Link2, Search } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { CreateBugDialog } from "@/components/screenshots/create-bug-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { data: screenshot, isLoading: isLoadingScreenshot, error: screenshotError } =
    trpc.screenshots.getById.useQuery({ screenshotId });

  // Get all screenshots in the flow for navigation
  const { data: allScreenshots = [] } = trpc.screenshots.getByFlow.useQuery({
    flowId,
  });

  const utils = trpc.useUtils();

  // Dialog state for creating bug from annotation
  const [isBugDialogOpen, setIsBugDialogOpen] = useState(false);
  const [selectedAnnotationForBug, setSelectedAnnotationForBug] = useState<Annotation | null>(null);

  // Dialog state for annotation with existing bug (action chooser)
  const [isAnnotationActionOpen, setIsAnnotationActionOpen] = useState(false);
  const [selectedAnnotationWithBug, setSelectedAnnotationWithBug] = useState<Annotation | null>(null);

  // Track highlighted bugs in sidebar (can be multiple for many-to-many)
  const [highlightedBugIds, setHighlightedBugIds] = useState<string[]>([]);
  const bugRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Dialog state for linking existing bug to annotation
  const [isLinkBugDialogOpen, setIsLinkBugDialogOpen] = useState(false);
  const [annotationToLink, setAnnotationToLink] = useState<Annotation | null>(null);
  const [bugSearchQuery, setBugSearchQuery] = useState("");

  // Batch update annotations mutation (to save annotations to DB)
  const batchUpdateAnnotationsMutation = trpc.annotations.batchUpdate.useMutation();

  // Create bug mutation
  const createBugMutation = trpc.bugs.create.useMutation({
    onSuccess: (bug) => {
      toast.success(`Bug "${bug.title}" created successfully`);

      // Optimistically update the local screenshot data to include the new bug
      // This ensures clicking the annotation immediately shows the view dialog
      if (selectedAnnotationForBug) {
        utils.screenshots.getById.setData({ screenshotId }, (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            annotations: oldData.annotations.map((a) =>
              a.id === selectedAnnotationForBug.id
                ? {
                    ...a,
                    bugs: [
                      ...(a.bugs || []),
                      {
                        id: bug.id,
                        title: bug.title,
                        status: bug.status,
                        severity: bug.severity,
                      },
                    ],
                  }
                : a
            ),
          };
        });
      }

      setIsBugDialogOpen(false);
      setSelectedAnnotationForBug(null);
      // Still invalidate to sync with server
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create bug");
    },
  });

  // Delete annotation mutation
  const deleteAnnotationMutation = trpc.annotations.delete.useMutation({
    onSuccess: () => {
      toast.success("Annotation deleted");
      // Close any open dialogs
      setIsAnnotationActionOpen(false);
      setSelectedAnnotationWithBug(null);
      // Refresh the screenshot data
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete annotation");
    },
  });

  // Unlink bug from annotation mutation
  const unlinkBugMutation = trpc.annotations.unlinkFromBug.useMutation({
    onSuccess: () => {
      toast.success("Bug unlinked from annotation");
      // Refresh the screenshot data
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to unlink bug");
    },
  });

  // Link existing bug to annotation mutation
  const linkBugMutation = trpc.annotations.linkToBug.useMutation({
    onSuccess: () => {
      toast.success("Bug linked to annotation");
      setIsLinkBugDialogOpen(false);
      setAnnotationToLink(null);
      setBugSearchQuery("");
      // Refresh the screenshot data
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to link bug");
    },
  });

  // Fetch project bugs for linking (only when dialog is open)
  const { data: projectBugsData, isLoading: isLoadingBugs } = trpc.bugs.getByProject.useQuery(
    {
      projectId,
      page: 1,
      pageSize: 50,
      search: bugSearchQuery || undefined,
    },
    {
      enabled: isLinkBugDialogOpen,
    }
  );

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
    if (highlightedBugIds.length > 0) {
      const timer = setTimeout(() => {
        setHighlightedBugIds([]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedBugIds]);

  // Handle annotation click - show action dialog with options
  const handleAnnotationSelect = useCallback((annotation: Annotation) => {
    // Always show action dialog with options
    setSelectedAnnotationWithBug(annotation);
    setIsAnnotationActionOpen(true);
  }, []);

  // Handle viewing the linked bugs (highlight all bugs from the annotation)
  const handleViewLinkedBug = useCallback((bugId?: string) => {
    if (bugId) {
      // Single bug click - highlight just that one
      setHighlightedBugIds([bugId]);
      const bugElement = bugRefs.current.get(bugId);
      if (bugElement) {
        bugElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (selectedAnnotationWithBug?.bugs && selectedAnnotationWithBug.bugs.length > 0) {
      // "View Linked Bugs" button - highlight all bugs from this annotation
      const bugIds = selectedAnnotationWithBug.bugs.map(b => b.id);
      setHighlightedBugIds(bugIds);

      // Scroll to the first bug
      const firstBugElement = bugRefs.current.get(bugIds[0]);
      if (firstBugElement) {
        firstBugElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    setIsAnnotationActionOpen(false);
    setSelectedAnnotationWithBug(null);
  }, [selectedAnnotationWithBug]);

  // Handle creating a new bug for an annotation that already has one
  const handleCreateAnotherBug = useCallback(() => {
    if (selectedAnnotationWithBug) {
      setSelectedAnnotationForBug(selectedAnnotationWithBug);
      setIsBugDialogOpen(true);
    }
    setIsAnnotationActionOpen(false);
    setSelectedAnnotationWithBug(null);
  }, [selectedAnnotationWithBug]);

  // Handle creating a new bug for an annotation (even if it already has one)
  const handleCreateNewBug = useCallback((annotation: Annotation) => {
    setSelectedAnnotationForBug(annotation);
    setIsBugDialogOpen(true);
  }, []);

  // Handle opening the link bug dialog
  const handleOpenLinkBugDialog = useCallback((annotation: Annotation) => {
    setAnnotationToLink(annotation);
    setBugSearchQuery("");
    setIsLinkBugDialogOpen(true);
    // Close the action dialog if it's open
    setIsAnnotationActionOpen(false);
    setSelectedAnnotationWithBug(null);
  }, []);

  // Handle linking a bug to the annotation
  const handleLinkBug = useCallback((bugId: string) => {
    if (!annotationToLink) return;
    linkBugMutation.mutate({
      annotationId: annotationToLink.id,
      bugId,
    });
  }, [annotationToLink, linkBugMutation]);

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
      bugs: a.bugs || [],  // Many-to-many: array of bugs
    }));
  }, [screenshot]);

  // Get annotation for a specific bug
  const getAnnotationForBug = useCallback((bugId: string) => {
    return annotations.find((a) => a.bugs?.some((b) => b.id === bugId));
  }, [annotations]);

  // Save annotation to database when drawing finishes
  const handleAnnotationCreate = useCallback(
    async (normalizedAnnotation: NormalizedAnnotation): Promise<Annotation | null> => {
      try {
        // Get existing annotations from the database to preserve them
        const existingDbAnnotations = screenshot?.annotations || [];

        // Prepare existing annotations for batchUpdate (include their IDs)
        // Note: Bug links are preserved separately via many-to-many relationship
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
            bugs: saved.bugs || [],  // Many-to-many: array of bugs
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
    async (id: string) => {
      // Delete annotation via tRPC - bugs will remain (many-to-many relationship)
      await deleteAnnotationMutation.mutateAsync({ id });
    },
    [deleteAnnotationMutation]
  );

  // Handle unlinking a bug from an annotation
  const handleUnlinkBug = useCallback(
    async (annotationId: string, bugId: string) => {
      await unlinkBugMutation.mutateAsync({ annotationId, bugId });
    },
    [unlinkBugMutation]
  );

  // Handle deleting the selected annotation from the action dialog
  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (selectedAnnotationWithBug) {
      deleteAnnotationMutation.mutate({ id: selectedAnnotationWithBug.id });
    }
  }, [selectedAnnotationWithBug, deleteAnnotationMutation]);

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
        <p className="text-muted-foreground mb-4">
          {screenshotError ? `Error: ${screenshotError.message}` : "Screenshot not found"}
        </p>
        <Button asChild>
          <Link href={`/${orgSlug}/projects/${projectId}/flows/${flowId}`}>
            Go Back
          </Link>
        </Button>
      </div>
    );
  }

  // Aggregate all bugs from all annotations (many-to-many relationship)
  const linkedBugs = screenshot.annotations
    ?.flatMap((a) =>
      (a.bugs || []).map((bug) => ({ ...bug, annotationId: a.id }))
    )
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
      <div className="w-72 border-l bg-card flex flex-col">
        <div className="px-4 py-3 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              Linked Bugs
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {linkedBugs?.length || 0}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {linkedBugs && linkedBugs.length > 0 ? (
              linkedBugs.map((bug) => (
                <ContextMenu key={bug.id}>
                  <ContextMenuTrigger>
                    <div
                      ref={(el) => {
                        if (el) bugRefs.current.set(bug.id, el);
                      }}
                      className={`group px-3 py-2 rounded-md transition-all cursor-pointer ${
                        highlightedBugIds.includes(bug.id)
                          ? "bg-primary/10 ring-1 ring-primary/50"
                          : "hover:bg-muted/80"
                      }`}
                      onClick={() => {
                        const annotation = getAnnotationForBug(bug.id);
                        if (annotation) {
                          // Could trigger annotation highlight on canvas here
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Severity indicator dot */}
                        <div
                          className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                            bug.severity === "CRITICAL"
                              ? "bg-red-500"
                              : bug.severity === "HIGH"
                              ? "bg-orange-500"
                              : bug.severity === "MEDIUM"
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {bug.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${
                              bug.status === "OPEN"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : bug.status === "IN_PROGRESS"
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                : bug.status === "RESOLVED"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {bug.status.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {bug.severity}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      </div>
                      {highlightedBugIds.includes(bug.id) && (
                        <p className="text-[10px] text-primary mt-1.5 pl-4">
                          Linked to selected annotation
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
                    <ContextMenuItem
                      onClick={() => {
                        const annotation = getAnnotationForBug(bug.id);
                        if (annotation) {
                          handleUnlinkBug(annotation.id, bug.id);
                        }
                      }}
                      className="text-orange-600 focus:text-orange-600"
                    >
                      <Unlink className="mr-2 h-4 w-4" />
                      Unlink from Annotation
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        const annotation = getAnnotationForBug(bug.id);
                        if (annotation) {
                          handleAnnotationDelete(annotation.id);
                        }
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Annotation
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            ) : (
              <div className="text-center py-12 px-4">
                <div className="rounded-full bg-muted/50 h-12 w-12 flex items-center justify-center mx-auto mb-3">
                  <Bug className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No bugs linked
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click an annotation to create a bug
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Annotations without bugs section */}
        {annotations.filter(a => !a.bugs || a.bugs.length === 0).length > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <Button
              className="w-full h-8 text-xs"
              variant="outline"
              size="sm"
              onClick={() => {
                const unlinkedAnnotation = annotations.find(a => !a.bugs || a.bugs.length === 0);
                if (unlinkedAnnotation) {
                  handleCreateNewBug(unlinkedAnnotation);
                }
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Link {annotations.filter(a => !a.bugs || a.bugs.length === 0).length} unlinked annotation{annotations.filter(a => !a.bugs || a.bugs.length === 0).length !== 1 ? "s" : ""}
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

      {/* Annotation action dialog - shown when clicking annotation with linked bugs */}
      <Dialog open={isAnnotationActionOpen} onOpenChange={setIsAnnotationActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Annotation Actions
            </DialogTitle>
            <DialogDescription>
              {selectedAnnotationWithBug?.bugs && selectedAnnotationWithBug.bugs.length > 0
                ? `This annotation has ${selectedAnnotationWithBug.bugs.length} linked bug(s). What would you like to do?`
                : "This annotation has no linked bugs. Create a new bug or link an existing one."}
            </DialogDescription>
          </DialogHeader>
          {selectedAnnotationWithBug?.bugs && selectedAnnotationWithBug.bugs.length > 0 && (
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {selectedAnnotationWithBug.bugs.map((bug) => (
                <div
                  key={bug.id}
                  className="p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleViewLinkedBug(bug.id)}
                    >
                      <p className="font-medium text-sm">{bug.title}</p>
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
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      onClick={() => {
                        if (selectedAnnotationWithBug) {
                          handleUnlinkBug(selectedAnnotationWithBug.id, bug.id);
                        }
                      }}
                      title="Unlink bug from annotation"
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {selectedAnnotationWithBug?.bugs && selectedAnnotationWithBug.bugs.length > 0 && (
              <Button onClick={() => handleViewLinkedBug()} variant="outline" className="justify-start">
                <Eye className="mr-2 h-4 w-4" />
                View Linked Bugs in Sidebar
              </Button>
            )}
            <Button onClick={handleCreateAnotherBug} variant="outline" className="justify-start">
              <Plus className="mr-2 h-4 w-4" />
              Create New Bug
            </Button>
            {selectedAnnotationWithBug && (
              <Button
                onClick={() => handleOpenLinkBugDialog(selectedAnnotationWithBug)}
                variant="outline"
                className="justify-start"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Link Existing Bug
              </Button>
            )}
            {selectedAnnotationWithBug?.bugs?.[0]?.id && (
              <Button asChild variant="outline" className="justify-start">
                <Link href={`/${orgSlug}/projects/${projectId}/bugs/${selectedAnnotationWithBug.bugs[0].id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Bug Details
                </Link>
              </Button>
            )}
            <div className="border-t pt-2 mt-2">
              <Button
                onClick={handleDeleteSelectedAnnotation}
                variant="outline"
                className="justify-start w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={deleteAnnotationMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteAnnotationMutation.isPending ? "Deleting..." : "Delete Annotation"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Note: Deleting the annotation will not delete the linked bugs.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link existing bug dialog */}
      <Dialog open={isLinkBugDialogOpen} onOpenChange={setIsLinkBugDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Existing Bug
            </DialogTitle>
            <DialogDescription>
              Select a bug from this project to link to the annotation.
            </DialogDescription>
          </DialogHeader>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bugs..."
              value={bugSearchQuery}
              onChange={(e) => setBugSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Bug list */}
          <ScrollArea className="max-h-64">
            {isLoadingBugs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : projectBugsData?.bugs && projectBugsData.bugs.length > 0 ? (
              <div className="space-y-2">
                {projectBugsData.bugs
                  .filter((bug) => {
                    // Filter out bugs already linked to this annotation
                    const alreadyLinked = annotationToLink?.bugs?.some(
                      (linkedBug) => linkedBug.id === bug.id
                    );
                    return !alreadyLinked;
                  })
                  .map((bug) => (
                    <div
                      key={bug.id}
                      className="p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleLinkBug(bug.id)}
                    >
                      <p className="font-medium text-sm">{bug.title}</p>
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
                    </div>
                  ))}
                {projectBugsData.bugs.filter((bug) => {
                  const alreadyLinked = annotationToLink?.bugs?.some(
                    (linkedBug) => linkedBug.id === bug.id
                  );
                  return !alreadyLinked;
                }).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      All bugs are already linked to this annotation.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bug className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {bugSearchQuery ? "No bugs found matching your search." : "No bugs in this project yet."}
                </p>
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsLinkBugDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
