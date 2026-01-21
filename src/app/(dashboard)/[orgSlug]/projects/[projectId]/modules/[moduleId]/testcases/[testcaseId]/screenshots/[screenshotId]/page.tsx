"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ScreenshotViewer,
  type NormalizedAnnotation,
} from "@/components/screenshots/screenshot-viewer";
import type { Annotation } from "@/store/annotation-store";

export default function ScreenshotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const moduleId = params.moduleId as string;
  const testcaseId = params.testcaseId as string;
  const screenshotId = params.screenshotId as string;

  const utils = trpc.useUtils();

  // Fetch screenshot data
  const { data: screenshot, isLoading } = trpc.screenshots.getById.useQuery({
    screenshotId,
  });

  // Fetch all screenshots for this test case (for navigation)
  const { data: testCase } = trpc.testcases.getById.useQuery({
    testCaseId: testcaseId,
  });

  // Mutations for annotations
  const batchUpdateAnnotationsMutation = trpc.annotations.batchUpdate.useMutation({
    onSuccess: () => {
      utils.screenshots.getById.invalidate({ screenshotId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateAnnotationMutation = trpc.annotations.update.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteAnnotationMutation = trpc.annotations.delete.useMutation({
    onSuccess: () => {
      utils.screenshots.getById.invalidate({ screenshotId });
      toast.success("Annotation deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle annotation creation using batchUpdate
  const handleAnnotationCreate = async (
    annotation: NormalizedAnnotation
  ): Promise<Annotation | null> => {
    try {
      // Get existing annotations to include in batch update
      // Note: Convert type to lowercase as DB stores UPPERCASE but schema expects lowercase
      const existingAnnotations = screenshot?.annotations.map((a) => ({
        id: a.id,
        type: a.type.toLowerCase() as "rectangle" | "circle" | "arrow" | "freehand",
        x: a.x,
        y: a.y,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
        points: (a.points as number[] | null) ?? undefined,
        stroke: a.stroke,
        strokeWidth: a.strokeWidth,
      })) ?? [];

      // Add the new annotation (without id so it gets created)
      const newAnnotation = {
        type: annotation.type,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        points: annotation.points,
        stroke: annotation.stroke,
        strokeWidth: annotation.strokeWidth,
      };

      const result = await batchUpdateAnnotationsMutation.mutateAsync({
        screenshotId,
        annotations: [...existingAnnotations, newAnnotation],
      });

      // Find the newly created annotation (last one in the result)
      const createdAnnotation = result[result.length - 1];
      if (createdAnnotation) {
        return {
          id: createdAnnotation.id,
          type: createdAnnotation.type as Annotation["type"],
          x: createdAnnotation.x,
          y: createdAnnotation.y,
          width: createdAnnotation.width ?? undefined,
          height: createdAnnotation.height ?? undefined,
          points: (createdAnnotation.points as number[] | null) ?? undefined,
          stroke: createdAnnotation.stroke,
          strokeWidth: createdAnnotation.strokeWidth,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Handle annotation update
  const handleAnnotationUpdate = (
    id: string,
    updates: Partial<NormalizedAnnotation>
  ) => {
    updateAnnotationMutation.mutate({
      id,
      ...updates,
    });
  };

  // Handle annotation delete
  const handleAnnotationDelete = (id: string) => {
    deleteAnnotationMutation.mutate({ id });
  };

  // Navigation between screenshots
  const screenshots = testCase?.screenshots ?? [];
  const currentIndex = screenshots.findIndex((s) => s.id === screenshotId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < screenshots.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevScreenshot = screenshots[currentIndex - 1];
      router.push(
        `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testcaseId}/screenshots/${prevScreenshot.id}`
      );
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextScreenshot = screenshots[currentIndex + 1];
      router.push(
        `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testcaseId}/screenshots/${nextScreenshot.id}`
      );
    }
  };

  const backUrl = `/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testcaseId}`;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!screenshot) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Screenshot Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The screenshot you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild className="mt-4">
          <Link href={backUrl}>Back to Test Case</Link>
        </Button>
      </div>
    );
  }

  // Transform annotations for the viewer
  // Note: Convert type to lowercase as DB stores UPPERCASE but frontend expects lowercase
  const annotations: Annotation[] = screenshot.annotations.map((a) => ({
    id: a.id,
    type: a.type.toLowerCase() as Annotation["type"],
    x: a.x,
    y: a.y,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    points: (a.points as number[] | null) ?? undefined,
    stroke: a.stroke,
    strokeWidth: a.strokeWidth,
    testCases: a.testCases,
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <Link
            href={backUrl}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="font-medium">
              {screenshot.title ?? "Screenshot"}
            </h1>
            {screenshots.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} of {screenshots.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Screenshot Viewer */}
      <div className="flex-1">
        <ScreenshotViewer
          imageUrl={screenshot.originalUrl}
          annotations={annotations}
          onAnnotationCreate={handleAnnotationCreate}
          onAnnotationUpdate={handleAnnotationUpdate}
          onAnnotationDelete={handleAnnotationDelete}
          onPrevious={handlePrevious}
          onNext={handleNext}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
        />
      </div>
    </div>
  );
}
