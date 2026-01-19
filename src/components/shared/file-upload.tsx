"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileImage, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
  type AllowedImageType,
} from "@/lib/constants";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  error?: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  disabled = false,
  className,
}: FileUploadProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      return `Invalid file type: ${file.type}. Allowed: PNG, JPEG, WebP`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: ${MAX_FILE_SIZE_MB}MB`;
    }
    return null;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newErrors: string[] = [];
      const validFiles: File[] = [];
      const newPreviews: FilePreview[] = [];

      acceptedFiles.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          newErrors.push(`${file.name}: ${error}`);
          newPreviews.push({
            file,
            preview: "",
            error,
          });
        } else {
          validFiles.push(file);
          newPreviews.push({
            file,
            preview: URL.createObjectURL(file),
          });
        }
      });

      setErrors(newErrors);
      setPreviews((prev) => [...prev, ...newPreviews].slice(0, maxFiles));

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [validateFile, maxFiles, onFilesSelected]
  );

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const newPreviews = [...prev];
      if (newPreviews[index]?.preview) {
        URL.revokeObjectURL(newPreviews[index].preview);
      }
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  }, []);

  const clearAll = useCallback(() => {
    previews.forEach((p) => {
      if (p.preview) {
        URL.revokeObjectURL(p.preview);
      }
    });
    setPreviews([]);
    setErrors([]);
  }, [previews]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles,
    disabled,
    maxSize: MAX_FILE_SIZE,
  });

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          !isDragActive && !disabled && "hover:border-primary/50"
        )}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          <input {...getInputProps()} />
          <Upload
            className={cn(
              "h-10 w-10 mb-4 text-muted-foreground",
              isDragActive && "text-primary"
            )}
          />
          {isDragActive ? (
            <p className="text-sm text-primary font-medium">
              Drop the files here...
            </p>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">
                Drag & drop screenshots here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse (PNG, JPEG, WebP up to {MAX_FILE_SIZE_MB}MB)
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* File Previews */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {previews.length} file{previews.length !== 1 ? "s" : ""} selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
            >
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previews.map((preview, index) => (
              <div
                key={index}
                className={cn(
                  "relative group rounded-lg overflow-hidden border",
                  preview.error && "border-destructive"
                )}
              >
                {preview.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.preview}
                    alt={preview.file.name}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-muted flex items-center justify-center">
                    <FileImage className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePreview(index);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-xs text-white truncate">
                    {preview.file.name}
                  </p>
                </div>
                {preview.error && (
                  <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface UploadProgressProps {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
  onCancel?: () => void;
}

export function UploadProgress({
  fileName,
  progress,
  status,
  error,
  onCancel,
}: UploadProgressProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <FileImage className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        {status === "error" ? (
          <p className="text-xs text-destructive">{error || "Upload failed"}</p>
        ) : status === "complete" ? (
          <p className="text-xs text-green-600">Upload complete</p>
        ) : (
          <>
            <Progress value={progress} className="h-1.5 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {status === "processing" ? "Processing..." : `${progress}%`}
            </p>
          </>
        )}
      </div>
      {(status === "uploading" || status === "processing") && onCancel && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
