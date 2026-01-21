"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Upload,
  User,
  UserCircle,
  ExternalLink,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/testcases/status-badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TestCaseStatus } from "@/lib/validations/testcase";
import { useState, useRef } from "react";
import { useMultiUpload } from "@/hooks/use-upload";
import { useSession } from "@/hooks/use-session";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";

const severityColors: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS: TestCaseStatus[] = [
  "DRAFT",
  "PENDING",
  "PASSED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
];

export default function TestCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const projectId = params.projectId as string;
  const moduleId = params.moduleId as string;
  const testcaseId = params.testcaseId as string;

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Upload hook
  const {
    uploads,
    isUploading,
    addFilesAndUpload,
    removeUpload,
    clearCompleted,
  } = useMultiUpload({ testCaseId: testcaseId });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const validFiles: File[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        toast.error(`${file.name}: Invalid file type. Only PNG, JPEG, WebP, and GIF are allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large. Maximum size is 10MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      // Add and upload in one operation
      addFilesAndUpload(validFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadComplete = () => {
    clearCompleted();
    utils.testcases.getById.invalidate({ testCaseId: testcaseId });
    toast.success("Screenshots uploaded successfully");
  };

  const { data: testCase, isLoading } = trpc.testcases.getById.useQuery({
    testCaseId: testcaseId,
  });

  // Get module members for assignee dropdown
  const { data: moduleMembers } = trpc.testcases.getModuleMembers.useQuery(
    { moduleId },
    { enabled: !!moduleId }
  );

  // Get current user session for "Assign to me" feature
  const { user: currentUser } = useSession();

  const assignMutation = trpc.testcases.assign.useMutation({
    onMutate: () => setIsUpdatingAssignee(true),
    onSuccess: () => {
      toast.success("Assignee updated");
      utils.testcases.getById.invalidate({ testCaseId: testcaseId });
      setAssigneePopoverOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => setIsUpdatingAssignee(false),
  });

  const handleAssigneeChange = (userId: string | null) => {
    assignMutation.mutate({
      testCaseId: testcaseId,
      assigneeId: userId,
    });
  };

  const updateStatusMutation = trpc.testcases.updateStatus.useMutation({
    onMutate: () => setIsUpdatingStatus(true),
    onSuccess: () => {
      toast.success("Status updated");
      utils.testcases.getById.invalidate({ testCaseId: testcaseId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => setIsUpdatingStatus(false),
  });

  const deleteMutation = trpc.testcases.delete.useMutation({
    onSuccess: () => {
      toast.success("Test case deleted");
      router.push(`/${orgSlug}/projects/${projectId}/modules`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleStatusChange = (newStatus: TestCaseStatus) => {
    updateStatusMutation.mutate({
      testCaseId: testcaseId,
      status: newStatus,
    });
  };

  const backUrl = `/${orgSlug}/projects/${projectId}/modules`;

  if (isLoading) {
    return (
      <div className="container py-6">
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="container py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Test Case Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The test case you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild className="mt-4">
            <Link href={backUrl}>Back to Modules</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href={backUrl}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Modules
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  {testCase.referenceId && (
                    <Badge
                      variant="secondary"
                      className="font-mono text-sm px-3 py-1 bg-primary/10 text-primary border border-primary/20"
                    >
                      {testCase.referenceId}
                    </Badge>
                  )}
                  <CardTitle className="text-xl font-semibold">{testCase.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn("font-medium", severityColors[testCase.severity])}
                    >
                      Sev: {testCase.severity}
                    </Badge>
                    <Badge
                      className={cn("font-medium", priorityColors[testCase.priority])}
                    >
                      Pri: {testCase.priority}
                    </Badge>
                  </div>
                </div>
                <Select
                  value={testCase.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdatingStatus}
                >
                  <SelectTrigger className="w-[130px]">
                    {isUpdatingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        <StatusBadge status={status} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            {(testCase.description || testCase.url) && (
              <CardContent className="pt-0">
                {testCase.description && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {testCase.description}
                  </p>
                )}
                {testCase.url && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={testCase.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {testCase.url}
                    </a>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Steps to Reproduce */}
          {testCase.stepsToReproduce && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Steps to Reproduce</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {testCase.stepsToReproduce}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expected vs Actual Results */}
          {(testCase.expectedResult || testCase.actualResult) && (
            <div className="grid gap-4 md:grid-cols-2">
              {testCase.expectedResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Expected Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                      {testCase.expectedResult}
                    </p>
                  </CardContent>
                </Card>
              )}
              {testCase.actualResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Actual Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                      {testCase.actualResult}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Screenshots Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Screenshots</CardTitle>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Progress */}
              {uploads.length > 0 && (
                <div className="space-y-2">
                  {uploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {upload.file.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {upload.state.status === "complete" ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs">Uploaded</span>
                            </div>
                          ) : upload.state.status === "error" ? (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs">{upload.state.error}</span>
                            </div>
                          ) : (
                            <>
                              <Progress
                                value={upload.state.progress}
                                className="h-1.5 flex-1"
                              />
                              <span className="text-xs text-muted-foreground">
                                {upload.state.progress}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {(upload.state.status === "complete" ||
                        upload.state.status === "error") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeUpload(upload.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {uploads.every(
                    (u) =>
                      u.state.status === "complete" || u.state.status === "error"
                  ) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUploadComplete}
                      className="w-full"
                    >
                      Done
                    </Button>
                  )}
                </div>
              )}

              {/* Screenshots Grid */}
              {testCase.screenshots && testCase.screenshots.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {testCase.screenshots.map((screenshot) => (
                    <Link
                      key={screenshot.id}
                      href={`/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testcaseId}/screenshots/${screenshot.id}`}
                      className="group relative overflow-hidden rounded-lg border"
                    >
                      <img
                        src={screenshot.thumbnailUrl ?? screenshot.originalUrl}
                        alt={screenshot.title ?? "Screenshot"}
                        className="h-40 w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <p className="truncate text-sm font-medium text-white">
                          {screenshot.title ?? "Untitled"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : uploads.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No screenshots uploaded yet
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Module */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Module
                </p>
                <p className="font-medium">{testCase.module.name}</p>
              </div>

              {/* Reference ID */}
              {testCase.referenceId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Reference ID
                  </p>
                  <p className="font-mono text-sm font-medium">{testCase.referenceId}</p>
                </div>
              )}

              <Separator />

              {/* Creator */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Created by
                </p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={testCase.creator.avatarUrl ?? undefined}
                    />
                    <AvatarFallback className="text-xs">
                      {testCase.creator.name?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {testCase.creator.name ?? testCase.creator.email}
                  </span>
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Assigned to
                  </p>
                  {currentUser && !testCase.assignee && (
                    <button
                      onClick={() => handleAssigneeChange(currentUser.id)}
                      className="text-xs text-primary hover:underline"
                      disabled={isUpdatingAssignee}
                    >
                      Assign to me
                    </button>
                  )}
                </div>
                <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={assigneePopoverOpen}
                      className="w-full justify-between h-auto min-h-[40px] py-2"
                      disabled={isUpdatingAssignee}
                    >
                      {isUpdatingAssignee ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Updating...</span>
                        </div>
                      ) : testCase.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={testCase.assignee.avatarUrl ?? undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {testCase.assignee.name?.charAt(0) ?? "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {testCase.assignee.name ?? testCase.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <UserCircle className="h-5 w-5" />
                          <span>Unassigned</span>
                        </div>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search members..." />
                      <CommandList>
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup>
                          {/* Unassigned option */}
                          <CommandItem
                            value="unassigned"
                            onSelect={() => handleAssigneeChange(null)}
                          >
                            <UserCircle className="mr-2 h-5 w-5 text-muted-foreground" />
                            <span>Unassigned</span>
                            {!testCase.assignee && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        </CommandGroup>
                        {currentUser && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="Quick assign">
                              <CommandItem
                                value={`assign-me-${currentUser.name || currentUser.email}`}
                                onSelect={() => handleAssigneeChange(currentUser.id)}
                              >
                                <Avatar className="mr-2 h-5 w-5">
                                  <AvatarImage src={currentUser.image ?? undefined} />
                                  <AvatarFallback className="text-xs">
                                    {currentUser.name?.charAt(0) ?? "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{currentUser.name ?? currentUser.email}</span>
                                <span className="ml-1 text-xs text-muted-foreground">(Assign to me)</span>
                                {testCase.assignee?.id === currentUser.id && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            </CommandGroup>
                          </>
                        )}
                        {moduleMembers && moduleMembers.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="Team members">
                              {moduleMembers
                                .filter((member) => member.id !== currentUser?.id)
                                .map((member) => (
                                  <CommandItem
                                    key={member.id}
                                    value={`${member.name || ""} ${member.email}`}
                                    onSelect={() => handleAssigneeChange(member.id)}
                                  >
                                    <Avatar className="mr-2 h-5 w-5">
                                      <AvatarImage src={member.avatarUrl ?? undefined} />
                                      <AvatarFallback className="text-xs">
                                        {member.name?.charAt(0) ?? member.email.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">
                                      {member.name ?? member.email}
                                    </span>
                                    {testCase.assignee?.id === member.id && (
                                      <Check className="ml-auto h-4 w-4" />
                                    )}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Separator />

              {/* Dates */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Created
                </p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(testCase.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Last updated
                </p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(testCase.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              {testCase.executedAt && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Last executed
                  </p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(testCase.executedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link
                  href={`/${orgSlug}/projects/${projectId}/modules/${moduleId}/testcases/${testcaseId}/edit`}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Test Case
                </Link>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Test Case
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Test Case</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this test case? This will
                      also delete all associated screenshots and annotations.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        deleteMutation.mutate({ testCaseId: testcaseId })
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
