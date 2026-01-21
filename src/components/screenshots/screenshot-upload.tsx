"use client";

import { useCallback, useEffect } from "react";
import { Upload, Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/shared/file-upload";
import { useMultiUpload } from "@/hooks/use-upload";

interface ScreenshotUploadProps {
  testCaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function ScreenshotUpload({
  testCaseId,
  open,
  onOpenChange,
  onComplete,
}: ScreenshotUploadProps) {
  const {
    uploads,
    isUploading,
    addFiles,
    removeUpload,
    clearAll,
    startUploads,
    completedCount,
    errorCount,
    pendingCount,
  } = useMultiUpload({ testCaseId });

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      addFiles(files);
    },
    [addFiles]
  );

  const handleClose = useCallback(() => {
    if (!isUploading) {
      clearAll();
      onOpenChange(false);
    }
  }, [isUploading, clearAll, onOpenChange]);

  // Auto-close when all uploads complete successfully
  useEffect(() => {
    if (
      uploads.length > 0 &&
      !isUploading &&
      completedCount === uploads.length &&
      errorCount === 0
    ) {
      const timer = setTimeout(() => {
        clearAll();
        onOpenChange(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [uploads.length, isUploading, completedCount, errorCount, clearAll, onOpenChange, onComplete]);

  const allComplete = completedCount === uploads.length && uploads.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Screenshots</DialogTitle>
          <DialogDescription>
            Add screenshots to this test case. You can upload multiple files at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Zone */}
          {!isUploading && uploads.length === 0 && (
            <FileUpload onFilesSelected={handleFilesSelected} maxFiles={20} />
          )}

          {/* Upload Queue */}
          {uploads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isUploading
                    ? `Uploading ${completedCount + 1} of ${uploads.length}...`
                    : allComplete
                    ? "All uploads complete!"
                    : `${uploads.length} file${uploads.length !== 1 ? "s" : ""} selected`}
                </span>
                {errorCount > 0 && (
                  <span className="text-destructive">
                    {errorCount} failed
                  </span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {uploads.map((upload) => (
                  <UploadItem
                    key={upload.id}
                    fileName={upload.file.name}
                    status={upload.state.status}
                    progress={upload.state.progress}
                    error={upload.state.error}
                    onRemove={() => removeUpload(upload.id)}
                    disabled={isUploading}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              {allComplete ? "Done" : "Cancel"}
            </Button>
            {uploads.length > 0 && !allComplete && (
              <Button
                type="button"
                onClick={startUploads}
                disabled={isUploading || pendingCount === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface UploadItemProps {
  fileName: string;
  status: string;
  progress: number;
  error: string | null;
  onRemove: () => void;
  disabled: boolean;
}

function UploadItem({
  fileName,
  status,
  progress,
  error,
  onRemove,
  disabled,
}: UploadItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        {status === "error" ? (
          <p className="text-xs text-destructive">{error || "Upload failed"}</p>
        ) : status === "complete" ? (
          <p className="text-xs text-green-600">Complete</p>
        ) : status === "uploading" || status === "getting-url" || status === "processing" ? (
          <div className="space-y-1">
            <Progress value={progress} className="h-1" />
            <p className="text-xs text-muted-foreground">
              {status === "processing"
                ? "Processing..."
                : status === "getting-url"
                ? "Preparing..."
                : `${progress}%`}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Pending</p>
        )}
      </div>

      {/* Status Icon / Remove Button */}
      <div className="shrink-0">
        {status === "complete" ? (
          <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        ) : status === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        ) : status === "uploading" || status === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
